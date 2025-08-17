// src/cli/index.ts
import { Command } from "commander";
import ora from "ora";

// src/cli/commands/analyze.ts
import fs3 from "fs";
import Papa from "papaparse";
import pLimit from "p-limit";
import { fetch } from "undici";

// src/core/resolver/doh.ts
import { fetch as undiciFetch } from "undici";

// src/core/resolver/cache.ts
var store = /* @__PURE__ */ new Map();
function keyOf(qname, qtype) {
  return `${qname}|${qtype}`;
}
function getCached(qname, qtype) {
  const k = keyOf(qname, qtype);
  const e = store.get(k);
  if (!e) return null;
  if (Date.now() < e.expiresAt) return e.result;
  store.delete(k);
  return null;
}
function putCached(qname, qtype, result, ttlSec) {
  const expiresAt = Date.now() + Math.max(0, ttlSec) * 1e3;
  store.set(keyOf(qname, qtype), { result, expiresAt });
}

// src/core/resolver/doh.ts
var customFetch = null;
var stats = { hits: 0, misses: 0, timeSpentMs: 0 };
function resetDohStats() {
  stats.hits = 0;
  stats.misses = 0;
  stats.timeSpentMs = 0;
}
function getDohStats() {
  return { ...stats };
}
var TYPE_MAP = {
  1: "A",
  28: "AAAA",
  5: "CNAME",
  16: "TXT",
  33: "SRV",
  257: "CAA",
  15: "MX",
  2: "NS",
  12: "PTR"
};
function codeToStatus(code) {
  if (code === 0) return "NOERROR";
  if (code === 3) return "NXDOMAIN";
  if (code === 2) return "SERVFAIL";
  return "SERVFAIL";
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitterDelay(attempt) {
  const base = Math.min(1500, 200 * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * 300);
  return base + jitter;
}
async function resolveDoh(qname, qtype, opts = {}) {
  const cached = getCached(qname, qtype);
  if (cached) {
    stats.hits += 1;
    return cached;
  }
  const endpoint = opts.dohEndpoint || "https://dns.google/resolve";
  const timeoutMs = opts.timeoutMs ?? 3e3;
  const retries = Math.max(0, opts.retries ?? 2);
  const cd = opts.cd ?? true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const u = new URL(endpoint);
      u.searchParams.set("name", qname);
      u.searchParams.set("type", qtype);
      u.searchParams.set("cd", cd ? "1" : "0");
      const res = await (customFetch || undiciFetch)(u.toString(), {
        method: "GET",
        headers: { accept: "application/dns-json" },
        signal: controller.signal
      });
      if (!("status" in res) || res.status >= 500) {
        throw new Error(`http ${res.status}`);
      }
      const body = await res.json();
      const statusCode = body.Status;
      const status = codeToStatus(statusCode);
      const answers = Array.isArray(body.Answer) ? body.Answer : [];
      const chain = answers.map((a) => ({ type: TYPE_MAP[a.type] || String(a.type), data: String(a.data), ttl: a.TTL }));
      const ttlMin = chain.reduce((min, h) => typeof h.ttl === "number" ? Math.min(min, h.ttl) : min, Number.POSITIVE_INFINITY);
      const elapsedMs2 = Date.now() - started;
      const result = {
        qname,
        qtype,
        status,
        chain,
        ad: !!body.AD,
        cd: !!body.CD,
        elapsedMs: elapsedMs2
      };
      if (status === "NOERROR" && Number.isFinite(ttlMin)) {
        putCached(qname, qtype, result, ttlMin);
      }
      stats.misses += 1;
      stats.timeSpentMs += elapsedMs2;
      clearTimeout(timer);
      return result;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await sleep(jitterDelay(attempt));
        continue;
      }
      clearTimeout(timer);
      const elapsedMs2 = Date.now() - started;
      stats.misses += 1;
      stats.timeSpentMs += elapsedMs2;
      if (e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message))) {
        return { qname, qtype, status: "TIMEOUT", chain: [], elapsedMs: elapsedMs2 };
      }
      return { qname, qtype, status: "SERVFAIL", chain: [], elapsedMs: elapsedMs2 };
    }
  }
  const elapsedMs = Date.now() - started;
  return { qname, qtype, status: "SERVFAIL", chain: [], elapsedMs };
}

// src/core/net/ip.ts
function isPrivateIPv4(ip) {
  const m = ip.match(/^([0-9]{1,3})(?:\.([0-9]{1,3})){3}$/);
  if (!m) return false;
  const parts = ip.split(".").map((x) => parseInt(x, 10));
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  return false;
}
function isSpecialIPv4(ip) {
  const parts = ip.split(".").map((x) => parseInt(x, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 0 || a === 255) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}
function isPrivateIPv6(ip) {
  const s = ip.toLowerCase();
  return s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe80") || s === "::1";
}
function mightBePrivateName(domain) {
  const d = domain.toLowerCase();
  return d.endsWith(".local") || d.endsWith(".lan") || d.endsWith(".intranet");
}

// src/core/schema/analyze.ts
import { z } from "zod";
var HttpSchema = z.object({ ok: z.boolean(), status: z.number().optional() });
var DnsHopSchema = z.object({ type: z.string(), data: z.string(), ttl: z.number().optional() });
var DnsSchema = z.object({
  status: z.string(),
  chain: z.array(DnsHopSchema),
  elapsedMs: z.number(),
  queries: z.array(z.object({ type: z.string(), status: z.string(), elapsedMs: z.number(), answers: z.number() })).optional()
});
var AnalyzeItemSchema = z.object({
  domain: z.string(),
  risk: z.enum(["low", "medium", "high"]).optional(),
  https: HttpSchema.optional(),
  http: HttpSchema.optional(),
  dns: DnsSchema.optional(),
  original: z.record(z.unknown()).optional(),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional()
});
var AnalyzeArraySchema = z.array(AnalyzeItemSchema);
function validateAnalyzeArray(a) {
  AnalyzeArraySchema.parse(a);
}

// src/core/output/json.ts
import fs from "fs";
async function writeJson(records, file, pretty = false) {
  const space = pretty ? 2 : 0;
  const json = JSON.stringify(records, null, space);
  await fs.promises.writeFile(file, json, "utf8");
}

// src/core/audit/audit.ts
import fs2 from "fs";
import path from "path";
import crypto from "crypto";
function defaultAuditPath() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) return path.join(home, ".dnsweeper", "audit.log");
  return path.join(".tmp", "audit.log");
}
async function ensureDirOf(file) {
  const dir = path.dirname(file);
  await fs2.promises.mkdir(dir, { recursive: true });
}
async function appendAudit(entry) {
  const line = JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), ...entry }) + "\n";
  const primary = process.env.DNSWEEPER_AUDIT_PATH || defaultAuditPath();
  try {
    await ensureDirOf(primary);
    try {
      const st = await fs2.promises.stat(primary);
      if (st.size > 5 * 1024 * 1024) {
        const rotated = primary + ".1";
        await fs2.promises.rename(primary, rotated).catch(() => void 0);
      }
    } catch {
    }
    await fs2.promises.appendFile(primary, line, "utf8");
    return primary;
  } catch {
    const fallback = path.join(".tmp", "audit.log");
    await ensureDirOf(fallback);
    await fs2.promises.appendFile(fallback, line, "utf8");
    return fallback;
  }
}
async function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const s = fs2.createReadStream(file);
    s.on("error", reject);
    s.on("data", (chunk) => h.update(chunk));
    s.on("end", () => resolve(h.digest("hex")));
  });
}
async function getRulesetVersion(dir = ".tmp/rulesets") {
  try {
    const items = await fs2.promises.readdir(dir, { withFileTypes: true });
    const files = items.filter((i) => i.isFile()).map((i) => i.name);
    let latest = 0;
    for (const f of files) {
      const s = await fs2.promises.stat(path.join(dir, f));
      latest = Math.max(latest, s.mtimeMs);
    }
    return {
      count: files.length,
      latest: latest ? new Date(latest).toISOString() : null
    };
  } catch {
    return { count: 0, latest: null };
  }
}

// src/cli/commands/analyze.ts
function pickDomain(row) {
  const keys = Object.keys(row).map((k) => k.toLowerCase());
  const map = {};
  for (const k of Object.keys(row)) map[k.toLowerCase()] = k;
  const candidates2 = ["domain", "host", "hostname", "name"];
  for (const c of candidates2) {
    if (keys.includes(c)) {
      const raw = String(row[map[c]] ?? "").trim();
      return raw || null;
    }
  }
  return null;
}
async function probeOnce(url, timeoutMs, userAgent) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: ac.signal,
      headers: userAgent ? { "user-agent": userAgent } : void 0
    });
    return { ok: res.status < 400, status: res.status };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}
async function probeDomain(domain, timeoutMs, userAgent) {
  const https = await probeOnce(`https://${domain}/`, timeoutMs, userAgent);
  let http = { ok: false };
  if (!https.ok) {
    http = await probeOnce(`http://${domain}/`, timeoutMs, userAgent);
  }
  const risk = https.ok ? "low" : http.ok ? "medium" : "high";
  return { https, http, risk };
}
function registerAnalyzeCommand(program2) {
  program2.command("analyze").argument("<input>", "input CSV/JSON path").option("--http-check", "enable HTTP probing").option("-c, --concurrency <n>", "max concurrent probes", (v) => parseInt(String(v), 10), 5).option("-t, --timeout <ms>", "per-request timeout (ms)", (v) => parseInt(String(v), 10), 5e3).option("--summary", "print risk summary (with --http-check)", false).option("--doh", "enable DNS over HTTPS resolution", false).option("--doh-endpoint <url>", "DoH endpoint (default: https://dns.google/resolve)").option("--dns-type <type>", "QTYPE(s): A|AAAA|CNAME|TXT|SRV|CAA|MX|NS|PTR (comma-separated supported)", "A").option("--dns-timeout <ms>", "DNS timeout (ms)", (v) => parseInt(String(v), 10), 3e3).option("--dns-retries <n>", "DNS retries", (v) => parseInt(String(v), 10), 2).option("--allow-private", "allow probing private/special domains or IPs", false).option("--qps <n>", "overall queries per second limit", (v) => parseInt(String(v), 10), 0).option("--user-agent <ua>", "override HTTP User-Agent header").option("--quiet", "suppress periodic progress output", false).option("-o, --output <file>", "write analyzed JSON (array)").option("--pretty", "pretty-print JSON (with --output)", false).option("--include-original", "include original CSV row in output objects", false).description("Analyze CSV and print data row count (header excluded)").action(async (input, options) => {
    try {
      const fileStream = fs3.createReadStream(input, { encoding: "utf8" });
      let rows = 0;
      const domains = [];
      const originals = [];
      const papaStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
        header: true,
        skipEmptyLines: true
      });
      papaStream.on("data", (row) => {
        rows += 1;
        if (options?.httpCheck || options?.doh) {
          const d = pickDomain(row || {});
          if (d) domains.push(d);
        }
        if (options?.includeOriginal) {
          originals.push(row || {});
        }
      });
      await new Promise((resolve, reject) => {
        fileStream.on("error", reject);
        papaStream.on("error", reject);
        papaStream.on("finish", () => resolve());
        fileStream.pipe(papaStream);
      });
      let summary = null;
      const execId = Math.random().toString(36).slice(2, 10);
      const results = [];
      const startedAt = Date.now();
      let processed = 0;
      let failed = 0;
      let sumLatency = 0;
      let progressTimer = null;
      const printProgress = () => {
        const elapsed = (Date.now() - startedAt) / 1e3;
        const qps = elapsed > 0 ? processed / elapsed : 0;
        const avg = processed > 0 ? sumLatency / processed : 0;
        const remain = Math.max(0, domains.length - processed);
        const eta = qps > 0 ? remain / qps : 0;
        if (!options.quiet) {
          console.error(
            `[progress] ${processed}/${domains.length} qps=${qps.toFixed(2)} avg_ms=${avg.toFixed(
              0
            )} fails=${failed} eta_s=${eta.toFixed(0)}`
          );
        }
      };
      if (options?.httpCheck || options?.doh) {
        const limit = pLimit(Math.max(1, options.concurrency ?? 5));
        let low = 0, medium = 0, high = 0;
        if (!options.quiet && domains.length > 0) {
          progressTimer = setInterval(printProgress, 1e3);
        }
        if (options.doh) resetDohStats();
        const qps = Math.max(0, options.qps ?? 0);
        let nextAt = Date.now();
        const gate = async () => {
          if (qps <= 0) return;
          const interval = 1e3 / qps;
          const now = Date.now();
          const wait = Math.max(0, nextAt - now);
          nextAt = (wait ? nextAt : now) + interval;
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        };
        const recent = [];
        await Promise.all(
          domains.map(
            (domain, idx) => limit(async () => {
              const t0 = Date.now();
              await gate();
              const qname = domain.endsWith(".") ? domain : `${domain}.`;
              const dnsTypes = String(options.dnsType || "A").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
              const pDns = options.doh ? Promise.all(
                dnsTypes.map(
                  (qt) => resolveDoh(qname, qt, {
                    dohEndpoint: options.dohEndpoint,
                    timeoutMs: options.dnsTimeout,
                    retries: options.dnsRetries,
                    cd: true
                  })
                )
              ) : Promise.resolve([]);
              const pHttp = options.httpCheck ? probeDomain(domain, options.timeout ?? 5e3, options.userAgent) : Promise.resolve({ https: { ok: false }, http: { ok: false }, risk: "low" });
              const [rrList, probed] = await Promise.all([pDns, pHttp]);
              let dnsResult;
              if (options.doh) {
                const queries = rrList.map((r, i) => ({
                  type: dnsTypes[i],
                  status: r.status,
                  elapsedMs: r.elapsedMs,
                  answers: r.chain?.length || 0
                }));
                const anyNoError = rrList.some((r) => r.status === "NOERROR");
                const anyTimeout = rrList.some((r) => r.status === "TIMEOUT");
                const anyServfail = rrList.some((r) => r.status === "SERVFAIL");
                const allNx = rrList.length > 0 && rrList.every((r) => r.status === "NXDOMAIN");
                const status = anyNoError ? "NOERROR" : allNx ? "NXDOMAIN" : anyTimeout ? "TIMEOUT" : anyServfail ? "SERVFAIL" : "SERVFAIL";
                const chain = rrList.flatMap((r) => r.chain || []);
                const elapsedMs = rrList.reduce((sum, r) => sum + (r.elapsedMs || 0), 0);
                dnsResult = { status, chain, elapsedMs, queries };
              }
              let skipped = false;
              let skipReason;
              if (!options.allowPrivate) {
                const privateName = domain ? mightBePrivateName(domain) : false;
                const privateIP = (rrList || []).some(
                  (r) => (r.chain || []).some(
                    (h) => h.type === "A" && (isPrivateIPv4(h.data) || isSpecialIPv4(h.data)) || h.type === "AAAA" && isPrivateIPv6(h.data)
                  )
                );
                if (privateName || privateIP) {
                  skipped = true;
                  skipReason = privateName ? "private-name" : "private-ip";
                }
              }
              const dt = Date.now() - t0;
              sumLatency += dt;
              processed += 1;
              if (options.httpCheck && !skipped && !probed.https.ok && !probed.http.ok) failed += 1;
              let risk = probed.risk;
              if (options.doh && dnsResult) {
                if (dnsResult.status === "NOERROR") {
                } else if (dnsResult.status === "NXDOMAIN") {
                  risk = "high";
                } else if (dnsResult.status === "TIMEOUT" || dnsResult.status === "SERVFAIL") {
                  risk = risk === "high" ? "high" : "medium";
                }
              }
              if (skipped) {
                if (!options.doh || dnsResult && dnsResult.status === "NOERROR") risk = "low";
              }
              if (risk === "low") low += 1;
              else if (risk === "medium") medium += 1;
              else high += 1;
              results[idx] = {
                domain,
                risk,
                https: skipped ? void 0 : probed.https,
                http: skipped ? void 0 : probed.http,
                dns: dnsResult,
                original: options.includeOriginal ? originals[idx] : void 0,
                ...skipped ? { skipped: true, skipReason } : {}
              };
              recent.push(options.httpCheck ? !skipped && !probed.https.ok && !probed.http.ok : false);
              if (recent.length > 10) recent.shift();
              const failCount = recent.filter(Boolean).length;
              if (recent.length >= 10 && failCount / recent.length > 0.7) {
                await new Promise((r) => setTimeout(r, 1e3));
              }
            })
          )
        );
        if (progressTimer) clearInterval(progressTimer);
        if (!options.quiet && domains.length > 0) printProgress();
        summary = { low, medium, high };
        if (!options.quiet) {
          const elapsed = (Date.now() - startedAt) / 1e3;
          const failRate = processed > 0 ? failed / processed : 0;
          console.error(
            `[summary] exec=${execId} low=${low} medium=${medium} high=${high} elapsed_s=${elapsed.toFixed(
              2
            )} fail_rate=${(failRate * 100).toFixed(1)}%`
          );
          if (options.doh) {
            const s = getDohStats();
            const total = s.hits + s.misses;
            const hitRate = total > 0 ? s.hits / total * 100 : 0;
            const avgMiss = s.misses > 0 ? s.timeSpentMs / s.misses : 0;
            const estSaved = Math.round(s.hits * avgMiss);
            console.error(
              `[dns] exec=${execId} queries=${total} hits=${s.hits} misses=${s.misses} hit_rate=${hitRate.toFixed(
                1
              )}% time_spent_ms=${s.timeSpentMs} est_saved_ms=${estSaved}`
            );
          }
        }
        if (options.summary) {
          console.log(`summary=${JSON.stringify(summary)}`);
        }
      }
      if (options.output) {
        if (options.httpCheck || options.doh) {
          const pretty = !!options.pretty;
          const arr = results.filter(Boolean);
          try {
            validateAnalyzeArray(arr);
          } catch (e) {
            console.error("[warn] analyze output schema validation failed:", e);
          }
          await writeJson(arr, options.output, pretty);
          console.log(`wrote JSON: ${options.output}`);
        } else {
          const out = (originals.length ? originals : domains.map((d) => ({ domain: d }))).map(
            (r, idx) => ({
              domain: pickDomain(r) ?? domains[idx] ?? "",
              original: options.includeOriginal ? r : void 0
            })
          );
          await writeJson(out, options.output, !!options.pretty);
          console.log(`wrote JSON: ${options.output}`);
        }
      }
      try {
        const inputHash = await sha256File(input);
        const ruleset = await getRulesetVersion();
        const auditPath = await appendAudit({
          cmd: "analyze",
          execId,
          args: { input, httpCheck: !!options.httpCheck, concurrency: options.concurrency, timeout: options.timeout },
          inputHash,
          ruleset,
          rows,
          summary,
          node: process.version
        });
        if (!options.quiet) {
          console.error(`[audit] appended -> ${auditPath}`);
        }
      } catch {
      }
      console.log(`rows=${rows}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      process.exit(1);
    }
  });
}

// src/cli/commands/import.ts
import fs7 from "fs";
import Papa3 from "papaparse";

// src/core/parsers/detect.ts
import fs4 from "fs";
async function detectEncoding(file) {
  const fd = await fs4.promises.open(file, "r");
  try {
    const buf = Buffer.alloc(3);
    const { bytesRead } = await fd.read(buf, 0, 3, 0);
    if (bytesRead >= 3 && buf[0] === 239 && buf[1] === 187 && buf[2] === 191) return "utf8-bom";
    return "utf8";
  } finally {
    await fd.close();
  }
}

// src/core/parsers/provider-detect.ts
function detectProviderFromHeader(headers) {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const has = (s) => lower.includes(s);
  if (has("proxied") || has("proxy status") || has("type") && has("content") && has("name")) {
    return "cloudflare";
  }
  if (has("alias target") || has("aliastarget") || has("value") && has("name") && has("type")) {
    return "route53";
  }
  return "generic";
}

// src/core/parsers/cloudflare.ts
function stripDot(s) {
  return s.endsWith(".") ? s.slice(0, -1) : s;
}
function normalizeCloudflare(row) {
  const map = {};
  for (const k of Object.keys(row)) map[k.toLowerCase()] = k;
  const get = (k) => row[map[k]];
  const type = String(get("type") ?? "").toUpperCase();
  const name = stripDot(String(get("name") ?? "").trim());
  const content = String(get("content") ?? "").trim();
  const ttlRaw = get("ttl");
  const proxRaw = get("proxied") ?? get("proxy status");
  if (!name || !type) throw new Error("missing name/type");
  const rec = { name, type };
  if (content) rec.content = type === "TXT" ? content.replace(/^\"|\"$/g, "") : content;
  if (ttlRaw !== void 0 && ttlRaw !== null && String(ttlRaw).trim() !== "") {
    const ttl = Number.parseInt(String(ttlRaw), 10);
    if (Number.isFinite(ttl) && ttl > 0) rec.ttl = ttl;
    else throw new Error("invalid ttl");
  }
  if (proxRaw !== void 0) {
    const v = String(proxRaw).toLowerCase();
    if (v === "true" || v === "proxied") rec.proxied = true;
    else if (v === "false" || v === "dns only") rec.proxied = false;
  }
  if (["A", "AAAA", "CNAME", "TXT"].includes(rec.type) && !rec.content) {
    throw new Error("missing content");
  }
  return rec;
}

// src/core/parsers/route53.ts
function stripDot2(s) {
  return s.endsWith(".") ? s.slice(0, -1) : s;
}
function normalizeRoute53(row) {
  const map = {};
  for (const k of Object.keys(row)) map[k.toLowerCase()] = k;
  const get = (k) => row[map[k]];
  const type = String(get("type") ?? "").toUpperCase();
  const name = stripDot2(String(get("name") ?? "").trim());
  const ttlRaw = get("ttl");
  const value = String(get("value") ?? "").trim();
  const alias = String(get("alias target") ?? get("aliastarget") ?? "").trim();
  if (!name || !type) throw new Error("missing name/type");
  const rec = { name, type };
  if (alias) rec.aliasTarget = stripDot2(alias);
  if (value) rec.content = type === "TXT" ? value.replace(/^\"|\"$/g, "") : value;
  if (ttlRaw !== void 0 && ttlRaw !== null && String(ttlRaw).trim() !== "") {
    const ttl = Number.parseInt(String(ttlRaw), 10);
    if (Number.isFinite(ttl) && ttl > 0) rec.ttl = ttl;
    else throw new Error("invalid ttl");
  }
  if (!rec.aliasTarget && ["A", "AAAA", "CNAME", "TXT"].includes(rec.type) && !rec.content) {
    throw new Error("missing value/alias");
  }
  return rec;
}

// src/core/parsers/generic.ts
function stripDot3(s) {
  return s.endsWith(".") ? s.slice(0, -1) : s;
}
function normalizeGeneric(row) {
  const map = {};
  for (const k of Object.keys(row)) map[k.toLowerCase()] = k;
  const get = (k) => row[map[k]];
  const type = String(get("type") ?? "").toUpperCase();
  const name = stripDot3(String(get("name") ?? "").trim());
  const content = String(get("content") ?? "").trim();
  const ttlRaw = get("ttl");
  if (!name || !type) throw new Error("missing name/type");
  const rec = { name, type };
  if (content) rec.content = type === "TXT" ? content.replace(/^\"|\"$/g, "") : content;
  if (ttlRaw !== void 0 && ttlRaw !== null && String(ttlRaw).trim() !== "") {
    const ttl = Number.parseInt(String(ttlRaw), 10);
    if (Number.isFinite(ttl) && ttl > 0) rec.ttl = ttl;
    else throw new Error("invalid ttl");
  }
  if (["A", "AAAA", "CNAME", "TXT"].includes(rec.type) && !rec.content) {
    throw new Error("missing content");
  }
  return rec;
}

// src/core/parsers/errors.ts
import fs5 from "fs";
import Papa2 from "papaparse";
async function writeErrorsCsv(errors, file) {
  if (!errors.length) return;
  const rows = errors.map((e) => ({ ...e.row, error: e.error }));
  const csv = Papa2.unparse(rows, {
    header: true
  });
  await fs5.promises.writeFile(file, csv, "utf8");
}

// src/core/config/schema.ts
import fs6 from "fs";
import path2 from "path";
import { z as z2 } from "zod";
var ConfigSchema = z2.object({
  // Reserved for future use (M1: read-only placeholder)
  defaultTtl: z2.number().int().positive().optional()
});
var candidates = ["dnsweeper.config.json"];
async function loadConfig(cwd = process.cwd()) {
  for (const f of candidates) {
    const p = path2.join(cwd, f);
    try {
      const raw = await fs6.promises.readFile(p, "utf8");
      const json = JSON.parse(raw);
      return ConfigSchema.parse(json);
    } catch {
    }
  }
  return null;
}

// src/cli/commands/import.ts
function registerImportCommand(program2) {
  program2.command("import").argument("<file>", "input CSV file").option("-o, --output <file>", "output JSON file (writes array)").option("--pretty", "pretty-print JSON", false).option("-p, --provider <name>", "cloudflare|route53|generic (auto if omitted)").option("-e, --encoding <enc>", "input encoding (auto if omitted)").option("--errors <file>", "write failed rows to CSV", "errors.csv").description("Import CSV and normalize to JSON").action(async (file, opts) => {
    try {
      const enc = opts.encoding || await detectEncoding(file);
      const fileStream = fs7.createReadStream(file, { encoding: enc.startsWith("utf8") ? "utf8" : "utf8" });
      const rows = [];
      let headerCaptured = null;
      const papaStream = Papa3.parse(Papa3.NODE_STREAM_INPUT, {
        header: true,
        skipEmptyLines: true
      });
      papaStream.on("data", (row) => {
        const r = row;
        if (!headerCaptured) headerCaptured = Object.keys(r);
        rows.push(r);
      });
      await new Promise((resolve, reject) => {
        fileStream.on("error", reject);
        papaStream.on("error", reject);
        papaStream.on("finish", () => resolve());
        fileStream.pipe(papaStream);
      });
      const cfg = await loadConfig().catch(() => null);
      const provider = opts.provider || detectProviderFromHeader(headerCaptured || []);
      const out = [];
      const errors = [];
      for (const r of rows) {
        try {
          let rec;
          switch (provider) {
            case "cloudflare":
              rec = normalizeCloudflare(r);
              break;
            case "route53":
              rec = normalizeRoute53(r);
              break;
            default:
              rec = normalizeGeneric(r);
              break;
          }
          if (cfg?.defaultTtl && (rec.ttl === void 0 || rec.ttl === null)) {
            rec.ttl = cfg.defaultTtl;
          }
          out.push(rec);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push({ error: msg, row: r });
        }
      }
      if (opts.errors && errors.length) {
        await writeErrorsCsv(errors, opts.errors);
        console.error(`errors.csv: wrote ${errors.length} failed rows -> ${opts.errors}`);
      }
      const space = opts.pretty ? 2 : 0;
      const json = JSON.stringify(out, null, space);
      if (opts.output) {
        await fs7.promises.writeFile(opts.output, json, { encoding: "utf8" });
        console.log(`wrote JSON: ${opts.output}`);
      } else {
        console.log(json);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      process.exit(1);
    }
  });
}

// src/cli/commands/list.ts
import fs8 from "fs";
import Table from "cli-table3";
function riskToRank(r) {
  return r === "low" ? 0 : r === "medium" ? 1 : 2;
}
function registerListCommand(program2) {
  program2.command("list").argument("<input>", "input JSON file (array of records with risk)").option("--min-risk <level>", "low|medium|high", "low").description("List records by minimum risk").action(async (input, opts) => {
    const raw = await fs8.promises.readFile(input, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error("input JSON must be an array");
    }
    const minRisk = opts.minRisk || "low";
    const minRank = riskToRank(minRisk);
    const records = data.filter((r) => ["low", "medium", "high"].includes(String(r.risk))).filter((r) => riskToRank(r.risk) >= minRank);
    const table = new Table({ head: ["domain", "risk"] });
    for (const r of records) {
      table.push([String(r.domain ?? ""), String(r.risk ?? "")]);
    }
    console.log(table.toString());
    console.log(`count=${records.length}`);
  });
}

// src/cli/commands/export.ts
import fs10 from "fs";

// src/core/output/csv.ts
import fs9 from "fs";
import Papa4 from "papaparse";
function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === void 0) {
      out[k] = "";
    } else if (typeof v === "object") {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
async function writeCsv(records, file) {
  const rows = records.map(normalizeRow);
  const csv = Papa4.unparse(
    rows,
    { header: true }
  );
  await fs9.promises.writeFile(file, csv, "utf8");
}

// src/core/output/xlsx.ts
import ExcelJS from "exceljs";
function collectColumns(records) {
  const set = /* @__PURE__ */ new Set();
  for (const r of records) {
    for (const k of Object.keys(r)) set.add(k);
  }
  return Array.from(set.values());
}
function normalizeCell(v) {
  if (v === null || v === void 0) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}
async function writeXlsx(records, file) {
  const wb = new ExcelJS.Workbook();
  const hasRisk = records.some((r) => Object.prototype.hasOwnProperty.call(r, "risk"));
  if (hasRisk) {
    const wsSummary = wb.addWorksheet("Summary");
    const counts = { low: 0, medium: 0, high: 0 };
    for (const r of records) {
      const risk = String(r.risk || "");
      if (risk === "low") counts.low += 1;
      else if (risk === "medium") counts.medium += 1;
      else if (risk === "high") counts.high += 1;
    }
    wsSummary.columns = [
      { header: "risk", key: "risk" },
      { header: "count", key: "count" }
    ];
    wsSummary.addRow({ risk: "low", count: counts.low });
    wsSummary.addRow({ risk: "medium", count: counts.medium });
    wsSummary.addRow({ risk: "high", count: counts.high });
    const highs = records.filter((r) => String(r.risk) === "high");
    const colsHigh = collectColumns(highs);
    const wsHigh = wb.addWorksheet("High");
    wsHigh.columns = colsHigh.map((k) => ({ header: k, key: k }));
    for (const r of highs) {
      const row = {};
      for (const c of colsHigh) row[c] = normalizeCell(r[c]);
      wsHigh.addRow(row);
    }
    const colsAll = collectColumns(records);
    const wsAll = wb.addWorksheet("All");
    wsAll.columns = colsAll.map((k) => ({ header: k, key: k }));
    for (const r of records) {
      const row = {};
      for (const c of colsAll) row[c] = normalizeCell(r[c]);
      wsAll.addRow(row);
    }
  } else {
    const ws = wb.addWorksheet("Export");
    const columns = collectColumns(records);
    ws.columns = columns.map((k) => ({ header: k, key: k }));
    for (const r of records) {
      const row = {};
      for (const c of columns) row[c] = normalizeCell(r[c]);
      ws.addRow(row);
    }
  }
  await wb.xlsx.writeFile(file);
}

// src/cli/commands/export.ts
function registerExportCommand(program2) {
  program2.command("export").argument("<input>", "input JSON file (array)").requiredOption("-o, --output <file>", "output file path").option("-f, --format <fmt>", "json|csv|xlsx", "json").option("--pretty", "pretty JSON (when --format=json)", false).description("Export records to JSON/CSV/XLSX").action(async (input, opts) => {
    try {
      const raw = await fs10.promises.readFile(input, "utf8");
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        throw new Error("input JSON must be an array");
      }
      const records = data;
      const fmt = (opts.format || "json").toLowerCase();
      if (fmt === "json") {
        await writeJson(records, opts.output, !!opts.pretty);
      } else if (fmt === "csv") {
        await writeCsv(records, opts.output);
      } else if (fmt === "xlsx") {
        await writeXlsx(records, opts.output);
      } else {
        throw new Error(`unsupported format: ${opts.format}`);
      }
      console.log(`wrote ${fmt}: ${opts.output}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      process.exit(1);
    }
  });
}

// src/cli/commands/ruleset.ts
import fs11 from "fs";
import path3 from "path";
async function ensureDir(dir) {
  await fs11.promises.mkdir(dir, { recursive: true });
}
async function listFiles(dir) {
  try {
    const items = await fs11.promises.readdir(dir, { withFileTypes: true });
    return items.filter((i) => i.isFile()).map((i) => i.name);
  } catch {
    return [];
  }
}
function registerRulesetCommand(program2) {
  const cmd = program2.command("ruleset").description("Manage rulesets");
  cmd.command("list").option("--dir <path>", "ruleset directory", ".tmp/rulesets").description("List available rulesets").action(async (opts) => {
    const dir = opts.dir || ".tmp/rulesets";
    const files = await listFiles(dir);
    if (!files.length) {
      console.log("(no rulesets)");
      return;
    }
    console.log(files.join("\n"));
  });
  cmd.command("add").argument("<name>", "ruleset name").argument("<file>", "source JSON file").option("--dir <path>", "ruleset directory", ".tmp/rulesets").description("Add a ruleset file by name").action(async (name, file, opts) => {
    const dir = opts.dir || ".tmp/rulesets";
    await ensureDir(dir);
    const dst = path3.join(dir, `${name}.json`);
    const buf = await fs11.promises.readFile(file);
    JSON.parse(buf.toString("utf8"));
    await fs11.promises.writeFile(dst, buf);
    console.log(`added: ${dst}`);
  });
  cmd.command("version").option("--dir <path>", "ruleset directory", ".tmp/rulesets").description("Show ruleset set version (count + latest mtime)").action(async (opts) => {
    const dir = opts.dir || ".tmp/rulesets";
    const files = await listFiles(dir);
    let latest = 0;
    for (const f of files) {
      const s = await fs11.promises.stat(path3.join(dir, f));
      latest = Math.max(latest, s.mtimeMs);
    }
    console.log(
      JSON.stringify(
        { count: files.length, latest: latest ? new Date(latest).toISOString() : null },
        null,
        0
      )
    );
  });
}

// src/cli/commands/annotate.ts
import fs12 from "fs";
function matchDomain(rec, contains, regex) {
  const domain = String(rec.domain ?? "");
  if (!domain) return false;
  if (contains && domain.includes(contains)) return true;
  if (regex && regex.test(domain)) return true;
  return !contains && !regex ? true : false;
}
function addLabels(arr, labels) {
  const set = /* @__PURE__ */ new Set();
  if (Array.isArray(arr)) {
    for (const v of arr) if (typeof v === "string") set.add(v);
  }
  for (const l of labels) set.add(l);
  return Array.from(set.values());
}
function registerAnnotateCommand(program2) {
  program2.command("annotate").argument("<input>", "input JSON array file").option("-o, --output <file>", "output JSON file (writes array)").option("--contains <text>", "match domain containing text").option("--regex <pattern>", "match domain by JS RegExp (without flags)").option("--note <text>", "set or append note").option("--label <name...>", "add label(s)").option("--pretty", "pretty-print JSON", false).description("Annotate JSON records with notes/labels by domain filter").action(async (input, opts) => {
    try {
      const raw = await fs12.promises.readFile(input, "utf8");
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error("input JSON must be an array");
      const re = opts.regex ? new RegExp(opts.regex) : void 0;
      const labels = opts.label || [];
      let matched = 0;
      const out = data.map((r) => {
        if (matchDomain(r, opts.contains, re)) {
          matched += 1;
          const next = { ...r };
          if (opts.note) {
            const prev = String(next.note ?? "").trim();
            next.note = prev ? `${prev}; ${opts.note}` : opts.note;
          }
          if (labels.length) {
            next.labels = addLabels(next.labels, labels);
          }
          return next;
        }
        return r;
      });
      const space = opts.pretty ? 2 : 0;
      const json = JSON.stringify(out, null, space);
      if (opts.output) {
        await fs12.promises.writeFile(opts.output, json, "utf8");
        console.log(`annotated=${matched}, wrote: ${opts.output}`);
      } else {
        console.log(json);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      process.exit(1);
    }
  });
}

// src/cli/commands/echo.ts
function registerEchoCommand(program2) {
  program2.command("echo").argument("[text...]", "text to echo back").option("-n, --no-newline", "do not output the trailing newline").description("Echo arguments back (debug helper)").action((parts = [], opts) => {
    const out = (parts || []).join(" ");
    const suffix = opts?.newline === false ? "" : "\n";
    process.stdout.write(out + suffix);
  });
}

// src/cli/index.ts
var program = new Command();
program.name("dnsweeper").description("DNSweeper CLI").version("0.0.0");
registerAnalyzeCommand(program);
registerImportCommand(program);
registerListCommand(program);
registerExportCommand(program);
registerRulesetCommand(program);
registerAnnotateCommand(program);
registerEchoCommand(program);
async function main() {
  const spinner = ora({ text: "Bootstrapping CLI...", isEnabled: true }).start();
  spinner.stop();
  await program.parseAsync(process.argv);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
//# sourceMappingURL=index.js.map