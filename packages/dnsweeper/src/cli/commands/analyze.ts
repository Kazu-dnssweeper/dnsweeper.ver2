import { Command } from 'commander';
import fs from 'node:fs';
import Papa from 'papaparse';
import pLimit from 'p-limit';
import { fetch } from 'undici';
import { resolveDoh, getDohStats, resetDohStats, QType } from '../../core/resolver/doh.js';
import { loadRuleset, applyRules } from '../../core/rules/engine.js';
import { isPrivateIPv4, isPrivateIPv6, isSpecialIPv4, mightBePrivateName } from '../../core/net/ip.js';
import { validateAnalyzeArray } from '../../core/schema/analyze.js';
import { writeJson } from '../../core/output/json.js';
import { JobRunner } from '../../core/jobs/runner.js';
import { appendAudit, sha256File, getRulesetVersion } from '../../core/audit/audit.js';
import { probeUrl } from '../../core/http/probe.js';
import { evaluateRisk } from '../../core/risk/engine.js';
import { loadConfig } from '../../core/config/schema.js';

type AnalyzeOptions = {
  httpCheck?: boolean;
  concurrency?: number;
  timeout?: number; // ms per probe
  summary?: boolean; // print risk summary
  output?: string; // write JSON result file
  pretty?: boolean; // pretty JSON output
  includeOriginal?: boolean; // include original row
  includeEvidence?: boolean; // include riskScore + evidences
  quiet?: boolean; // suppress progress
  doh?: boolean; // enable DoH resolution
  dohEndpoint?: string; // custom endpoint
  dnsType?: string; // single or comma-separated list
  dnsTimeout?: number;
  dnsRetries?: number;
  allowPrivate?: boolean;
  qps?: number;
  userAgent?: string;
  ruleset?: string;
  rulesetDir?: string;
  noDowngrade?: boolean;
  probeSrv?: boolean;
  snapshot?: string;
  resume?: boolean;
};

type RiskLevel = 'low' | 'medium' | 'high';

function pickDomain(row: Record<string, unknown>): string | null {
  const keys = Object.keys(row).map((k) => k.toLowerCase());
  const map: Record<string, string> = {};
  for (const k of Object.keys(row)) map[k.toLowerCase()] = k;
  const candidates = ['domain', 'host', 'hostname', 'name'];
  for (const c of candidates) {
    if (keys.includes(c)) {
      const raw = String((row as Record<string, unknown>)[map[c]] ?? '').trim();
      return raw || null;
    }
  }
  return null;
}

async function probeDomain(domain: string, timeoutMs: number, userAgent?: string) {
  const https = await probeUrl(`https://${domain}/`, { timeoutMs, userAgent, maxRedirects: 5, method: 'HEAD' });
  let http = { ok: false } as { ok: boolean; status?: number; redirects?: number; finalUrl?: string; elapsedMs?: number; errorType?: string };
  if (!https.ok) {
    const r = await probeUrl(`http://${domain}/`, { timeoutMs, userAgent, maxRedirects: 5, method: 'HEAD' });
    http = r as any;
  }
  const risk: RiskLevel = https.ok ? 'low' : http.ok ? 'medium' : 'high';
  return { https: https as any, http, risk };
}

export function registerAnalyzeCommand(program: Command) {
  program
    .command('analyze')
    .argument('<input>', 'input CSV/JSON path')
    .option('--http-check', 'enable HTTP probing')
    .option('-c, --concurrency <n>', 'max concurrent probes', (v) => parseInt(String(v), 10), 5)
    .option('-t, --timeout <ms>', 'per-request timeout (ms)', (v) => parseInt(String(v), 10), 5000)
    .option('--summary', 'print risk summary (with --http-check)', false)
    .option('--doh', 'enable DNS over HTTPS resolution', false)
    .option('--doh-endpoint <url>', 'DoH endpoint (default: https://dns.google/resolve)')
    .option('--dns-type <type>', 'QTYPE(s): A|AAAA|CNAME|TXT|SRV|CAA|MX|NS|PTR (comma-separated supported)', 'A')
    .option('--dns-timeout <ms>', 'DNS timeout (ms)', (v) => parseInt(String(v), 10), 3000)
    .option('--dns-retries <n>', 'DNS retries', (v) => parseInt(String(v), 10), 2)
    .option('--allow-private', 'allow probing private/special domains or IPs', false)
    .option('--qps <n>', 'overall queries per second limit', (v) => parseInt(String(v), 10), 0)
    .option('--user-agent <ua>', 'override HTTP User-Agent header')
    .option('--ruleset <name>', 'apply ruleset from directory to adjust risk')
    .option('--ruleset-dir <dir>', 'ruleset directory', '.tmp/rulesets')
    .option('--no-downgrade', 'do not lower risk below base after ruleset adjustment', false)
    .option('--probe-srv', 'probe SRV-derived URLs if present', false)
    .option('--snapshot <file>', 'periodically write snapshot JSON (resume support)', '.tmp/snapshot.json')
    .option('--resume', 'resume from snapshot if input matches', false)
    .option('--quiet', 'suppress periodic progress output', false)
    .option('-o, --output <file>', 'write analyzed JSON (array)')
    .option('--pretty', 'pretty-print JSON (with --output)', false)
    .option('--include-original', 'include original CSV row in output objects', false)
    .option('--include-evidence', 'include riskScore and evidences (Risk Engine)', false)
    .description('Analyze CSV and print data row count (header excluded)')
    .action(async (input: string, options: AnalyzeOptions) => {
      try {
        // Warm config for risk thresholds/overrides
        try { const { warmConfig } = await import('../../core/risk/config.js'); await warmConfig(); } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to warm risk config', e);
        }
        // Apply analyze defaults from config (CLI args > config > built-in)
        try {
          const cfg = await loadConfig();
          const az = cfg?.analyze || {};
          if (typeof az.qps === 'number' && (options.qps ?? 0) === 0) options.qps = az.qps;
          if (typeof az.concurrency === 'number' && (options.concurrency ?? 5) === 5) options.concurrency = az.concurrency;
          if (typeof az.timeoutMs === 'number' && (options.timeout ?? 5000) === 5000) options.timeout = az.timeoutMs;
          if (typeof az.dohEndpoint === 'string' && !options.dohEndpoint) options.dohEndpoint = az.dohEndpoint;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to load config for defaults', e);
          }
        const fileStream = fs.createReadStream(input, { encoding: 'utf8' });
        let rows = 0;
        const domains: string[] = [];
        const originals: Record<string, unknown>[] = [];

        const papaStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
          header: true,
          skipEmptyLines: true,
        }) as unknown as NodeJS.ReadWriteStream;

        papaStream.on('data', (row: unknown) => {
          rows += 1;
          if (options?.httpCheck || options?.doh) {
            const d = pickDomain((row || {}) as Record<string, unknown>);
            if (d) domains.push(d);
          }
          if (options?.includeOriginal) {
            originals.push((row || {}) as Record<string, unknown>);
          }
        });

        await new Promise<void>((resolve, reject) => {
          fileStream.on('error', reject);
          papaStream.on('error', reject);
          papaStream.on('finish', () => resolve());
          fileStream.pipe(papaStream);
        });

        let summary: { low: number; medium: number; high: number } | null = null;
        const execId = Math.random().toString(36).slice(2, 10);
        const results: Array<{
          domain: string;
          risk?: RiskLevel;
          https?: { ok: boolean; status?: number };
          http?: { ok: boolean; status?: number };
          dns?: {
            status: string;
            chain: Array<{ type: string; data: string; ttl?: number }>;
            elapsedMs: number;
            queries?: Array<{ type: string; status: string; elapsedMs: number; answers: number }>;
          };
          original?: Record<string, unknown>;
          action?: 'keep' | 'review' | 'delete';
          reason?: string;
          confidence?: number;
        }> = [];
        // Apply progress interval from config if provided
        let progressIntervalMs: number | undefined;
        try {
          const cfg = await loadConfig();
          const az = cfg?.analyze || {};
          if (typeof az?.progressIntervalMs === 'number') progressIntervalMs = az.progressIntervalMs;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to load config for progress interval', e);
        }
        const runner = new JobRunner(domains.length, { quiet: options.quiet, intervalMs: progressIntervalMs });

        // Resume support
        const processedSet = new Set<string>();
        const snapshotPath = options.snapshot || '.tmp/snapshot.json';
        let inputHash = '';
        try { inputHash = await sha256File(input); } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to hash input file', e);
        }
        // If snapshot exists, warn on ruleset changes even when not resuming
        try {
          const rawSnap = await fs.promises.readFile(snapshotPath, 'utf8');
          const snap = JSON.parse(rawSnap);
          const rsMetaNow = await getRulesetVersion();
          const matchRuleset = JSON.stringify(snap?.meta?.ruleset || {}) === JSON.stringify(rsMetaNow || {});
          if (!matchRuleset) {
            // eslint-disable-next-line no-console
            console.error('[warn] snapshot exists but ruleset meta differs (not resuming unless --resume and meta matches)');
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to read snapshot for ruleset warning', e);
        }

        if (options.resume && snapshotPath) {
          try {
            const rawSnap = await fs.promises.readFile(snapshotPath, 'utf8');
            const snap = JSON.parse(rawSnap);
            const rsMetaNow = await getRulesetVersion();
            const matchRuleset = JSON.stringify(snap?.meta?.ruleset || {}) === JSON.stringify(rsMetaNow || {});
            if (snap?.meta?.inputHash === inputHash && matchRuleset && Array.isArray(snap.results)) {
              for (const r of snap.results as any[]) {
                results.push(r);
                if (r?.domain) processedSet.add(String(r.domain));
              }
            } else {
              // eslint-disable-next-line no-console
              console.error('[warn] resume skipped: snapshot does not match current input/ruleset meta');
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to resume from snapshot', e);
          }
        }

        if (options?.httpCheck || options?.doh) {
          const limit = pLimit(Math.max(1, options.concurrency ?? 5));
          let low = 0, medium = 0, high = 0;
          runner.start();
          if (options.doh) resetDohStats();
          // QPS limiter
          const qps = Math.max(0, options.qps ?? 0);
          // Simple bursty rate-limit: allow up to burst within a 1s window, then pace by qps
          let burst = 0;
          try {
            const cfg = await loadConfig();
            const az = cfg?.analyze || {};
            if (typeof az?.qpsBurst === 'number') burst = Math.max(0, az.qpsBurst);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to load config for qps burst', e);
          }
          let usedInWindow = 0;
          let windowStart = Date.now();
          let nextAt = Date.now();
          const gate = async () => {
            if (qps <= 0) return;
            const now = Date.now();
            if (now - windowStart >= 1000) {
              windowStart = now; usedInWindow = 0;
            }
            if (usedInWindow < burst) { usedInWindow += 1; return; }
            const interval = 1000 / qps;
            const wait = Math.max(0, nextAt - now);
            nextAt = (wait ? nextAt : now) + interval;
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          };
          const recent: boolean[] = [];
          const httpErrorCounts: Record<string, number> = {};
          // snapshot metadata
          const rsMeta = await getRulesetVersion();
          await Promise.all(
            domains.map((domain, idx) =>
              limit(async () => {
                if ((processedSet as Set<string>).has(domain)) return;
                const t0 = Date.now();
                await gate();
                // DNS -> HTTP (serial)
                const qname = domain.endsWith('.') ? domain : `${domain}.`;
                const dnsTypes = String(options.dnsType || 'A')
                  .split(',')
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean) as QType[];
                const rrList = (options.doh
                  ? await Promise.all(
                      dnsTypes.map((qt) =>
                        resolveDoh(qname, qt, {
                          dohEndpoint: options.dohEndpoint,
                          timeoutMs: options.dnsTimeout,
                          retries: options.dnsRetries,
                          cd: true,
                        })
                      )
                    )
                  : []) as Array<{ status: string; chain: Array<{ type: string; data: string; ttl?: number }>; elapsedMs: number; qtype?: string }>;
                // Short-circuit: if DoH says NXDOMAIN (for all queried types), skip HTTP probes
                const dohAllNx = options.doh && rrList.length > 0 && rrList.every((r) => r.status === 'NXDOMAIN');
                const probed = options.httpCheck
                  ? (dohAllNx
                      ? ({ https: { ok: false }, http: { ok: false }, risk: 'high' as RiskLevel } as any)
                      : await probeDomain(domain, options.timeout ?? 5000, options.userAgent))
                  : ({ https: { ok: false }, http: { ok: false }, risk: 'low' as RiskLevel } as any);

                let dnsResult:
                  | {
                      status: string;
                      chain: Array<{ type: string; data: string; ttl?: number }>;
                      elapsedMs: number;
                      queries?: Array<{ type: string; status: string; elapsedMs: number; answers: number }>;
                    }
                  | undefined;
                if (options.doh) {
                  // Aggregate multiple qtypes: prefer NOERROR if any; else TIMEOUT/SERVFAIL -> medium; all NXDOMAIN -> high-ish
                  const queries = rrList.map((r, i) => ({
                    type: dnsTypes[i] as string,
                    status: r.status,
                    elapsedMs: r.elapsedMs,
                    answers: r.chain?.length || 0,
                  }));
                  const anyNoError = rrList.some((r) => r.status === 'NOERROR');
                  const anyTimeout = rrList.some((r) => r.status === 'TIMEOUT');
                  const anyServfail = rrList.some((r) => r.status === 'SERVFAIL');
                  const allNx = rrList.length > 0 && rrList.every((r) => r.status === 'NXDOMAIN');
                  const status = anyNoError ? 'NOERROR' : allNx ? 'NXDOMAIN' : anyTimeout ? 'TIMEOUT' : anyServfail ? 'SERVFAIL' : 'SERVFAIL';
                  const chain = rrList.flatMap((r) => r.chain || []);
                  const elapsedMs = rrList.reduce((sum, r) => sum + (r.elapsedMs || 0), 0);
                  dnsResult = { status, chain, elapsedMs, queries };
                }
                // Private/special filters
                let skipped = false;
                let skipReason: string | undefined;
                if (options.doh && dohAllNx) {
                  skipped = true;
                  skipReason = 'nxdomain';
                }
                if (!options.allowPrivate) {
                  const privateName = domain ? mightBePrivateName(domain) : false;
                  const privateIP = (rrList || []).some((r) =>
                    (r.chain || []).some((h) =>
                      (h.type === 'A' && (isPrivateIPv4(h.data) || isSpecialIPv4(h.data))) ||
                      (h.type === 'AAAA' && isPrivateIPv6(h.data))
                    )
                  );
                  if (privateName || privateIP) {
                    skipped = true;
                    skipReason = privateName ? 'private-name' : 'private-ip';
                  }
                }

                // SRV candidates (annotation + optional probing)
                const candidates: string[] = [];
                if (options.doh && dnsResult) {
                  const srv = (dnsResult.chain || []).filter((h) => String(h.type).toUpperCase() === 'SRV');
                  for (const h of srv) {
                    const parts = String(h.data || '').trim().split(/\s+/);
                    if (parts.length >= 4) {
                      const port = parseInt(parts[2], 10);
                      const target = parts[3];
                      if (Number.isFinite(port) && target) {
                        if (port === 443) candidates.push(`https://${target}:${port}/`);
                        else if (port === 80) candidates.push(`http://${target}:${port}/`);
                        else {
                          candidates.push(`https://${target}:${port}/`);
                          candidates.push(`http://${target}:${port}/`);
                        }
                      }
                    }
                  }
                }

                // Optional probing of first SRV candidate if base checks failed
                let srvProbe: { ok: boolean; status?: number; finalUrl?: string; errorType?: string } | undefined;
                if (options.httpCheck && options.probeSrv && !skipped && !probed.https.ok && !probed.http.ok && candidates.length > 0) {
                  try {
                    const url = candidates[0];
                    const r = await (await import('../../core/http/probe.js')).probeUrl(url, {
                      timeoutMs: options.timeout ?? 5000,
                      userAgent: options.userAgent,
                      maxRedirects: 5,
                      method: 'HEAD',
                    });
                    srvProbe = { ok: !!r.ok, status: (r as any).status, finalUrl: (r as any).finalUrl, errorType: (r as any).errorType };
                    if (srvProbe.ok) {
                      probed.http = { ok: true, status: srvProbe.status } as any;
                      if (probed.risk !== 'low') probed.risk = 'medium';
                    }
                  } catch {
                    // ignore
                  }
                }

                const dt = Date.now() - t0;
                const isFail = !!(options.httpCheck && !skipped && !probed.https.ok && !probed.http.ok);
                runner.update(dt, isFail);
                if (options.httpCheck && !skipped) {
                  const tag = (probed.https as any)?.ok || (probed.http as any)?.ok ? 'ok' : ((probed.https as any)?.errorType || (probed.http as any)?.errorType || 'unknown');
                  httpErrorCounts[tag] = (httpErrorCounts[tag] || 0) + 1;
                }

                // Combine risk: heuristic first (preserve existing behavior)
                let risk: RiskLevel = probed.risk;
                if (options.doh && dnsResult) {
                  if (dnsResult.status === 'NOERROR') {
                    // keep HTTP-based risk
                  } else if (dnsResult.status === 'NXDOMAIN') {
                    // If querying multiple types, NXDOMAIN across all -> high
                    risk = 'high';
                  } else if (dnsResult.status === 'TIMEOUT' || dnsResult.status === 'SERVFAIL') {
                    risk = risk === 'high' ? 'high' : 'medium';
                  }
                }
                // Then consult Risk Engine but do not downgrade below heuristic
                let evCombined: { score: number; level: string; evidences: any[] } | null = null;
                try {
                  const ctx = {
                    name: domain,
                    dns: dnsResult ? { status: dnsResult.status, chain: dnsResult.chain } : undefined,
                    http: {
                      httpsOk: !!(probed as any).https?.ok,
                      httpOk: !!(probed as any).http?.ok,
                      statuses: [
                        (probed as any).https?.status as number | undefined,
                        (probed as any).http?.status as number | undefined,
                      ].filter((x) => typeof x === 'number') as number[],
                    },
                  };
                  const ev = evaluateRisk(ctx as any);
                  evCombined = ev as any;
                  const rank = (x: string) => (x === 'low' ? 0 : x === 'medium' ? 1 : 2);
                  // Do not downgrade below heuristic; pick the higher risk level
                  risk = rank(ev.level) > rank(risk) ? (ev.level as RiskLevel) : risk;
                } catch {
                  // ignore
                }
                if (skipped) {
                  if (!options.doh || (dnsResult && dnsResult.status === 'NOERROR')) risk = 'low';
                }
                // Apply ruleset if provided
                const rs = options.ruleset ? loadRuleset(options.rulesetDir || '.tmp/rulesets', options.ruleset) : null;
                const adjusted = rs ? applyRules(domain, risk, { ruleset: rs, dns: dnsResult }) : risk;
                // no-downgrade: do not lower risk below base
                if (options.noDowngrade) {
                  const rank = (x: string) => (x === 'low' ? 0 : x === 'medium' ? 1 : 2);
                  risk = rank(adjusted) < rank(probed.risk) ? probed.risk : adjusted;
                } else {
                  risk = adjusted;
                }
                // Strong override: NXDOMAIN should yield high in DoH-only scenarios
                if (options.doh && dnsResult && dnsResult.status === 'NXDOMAIN') risk = 'high';
                if (risk === 'low') low += 1;
                else if (risk === 'medium') medium += 1;
                else high += 1;
                results[idx] = {
                  domain,
                  risk,
                  https: skipped ? undefined : probed.https,
                  http: skipped ? undefined : probed.http,
                  dns: dnsResult,
                  original: options.includeOriginal ? originals[idx] : undefined,
                  ...(options.includeEvidence && evCombined
                    ? { riskScore: evCombined.score, evidences: evCombined.evidences }
                    : {}),
                  ...(candidates.length > 0 ? { candidates } : {}),
                  ...(skipped ? { skipped: true, skipReason } : {}),
                };
                // Snapshot best-effort with simple rotation
                try {
                  if (snapshotPath) {
                    // rotate: keep up to 2 generations (.1, .2)
                    const pathMod = await import('node:path');
                    const fsMod = fs.promises;
                    const dir = pathMod.dirname(snapshotPath);
                    await fsMod.mkdir(dir, { recursive: true });
                    const r1 = `${snapshotPath}.1`;
                    const r2 = `${snapshotPath}.2`;
                    try { await fsMod.unlink(r2); } catch (e) {
                      // eslint-disable-next-line no-console
                      console.error('Failed to remove snapshot rotation file', e);
                    }
                    try { await fsMod.rename(r1, r2); } catch (e) {
                      // eslint-disable-next-line no-console
                      console.error('Failed to rotate snapshot file', e);
                    }
                    try { await fsMod.rename(snapshotPath, r1); } catch (e) {
                      // eslint-disable-next-line no-console
                      console.error('Failed to rotate snapshot file to .1', e);
                    }
                    const snap = { meta: { inputHash, execId, ts: new Date().toISOString(), ruleset: rsMeta, total: domains.length, processed: results.filter(Boolean).length }, results: results.filter(Boolean) };
                    await fsMod.writeFile(snapshotPath, JSON.stringify(snap), 'utf8');
                  }
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to write snapshot', e);
                  }
                // Stale detection v1
                try {
                  const { detectStale } = await import('../../core/sweep/detector.js');
                  const det = detectStale(
                    domain,
                    risk,
                    results[idx].https,
                    results[idx].http,
                    dnsResult,
                    (results[idx] as any).original?.type
                  );
                  results[idx].action = det.action;
                  results[idx].reason = det.reason;
                  (results[idx] as any).reasonCode = det.reasonCode;
                  results[idx].confidence = det.confidence;
                } catch {
                  // ignore detection errors
                }
                // Failure spike backoff: if recent 10 have >70% failures, pause briefly
                recent.push(options.httpCheck ? (!skipped && !probed.https.ok && !probed.http.ok) : false);
                if (recent.length > 10) recent.shift();
                const failCount = recent.filter(Boolean).length;
                if (recent.length >= 10 && failCount / recent.length > 0.7) {
                  await new Promise((r) => setTimeout(r, 1000));
                }
              })
            )
          );
          runner.done();
          summary = { low, medium, high };
          if (!options.quiet) {
            const s = runner.getStats();
            const elapsed = s.elapsedSec;
            const failRate = s.failRate;
            // eslint-disable-next-line no-console
            console.error(
              `[summary] exec=${execId} low=${low} medium=${medium} high=${high} elapsed_s=${elapsed.toFixed(
                2
              )} fail_rate=${(failRate * 100).toFixed(1)}%`
            );
            if (options.doh) {
              const s = getDohStats();
              const total = s.hits + s.misses;
              const hitRate = total > 0 ? (s.hits / total) * 100 : 0;
              const avgMiss = s.misses > 0 ? s.timeSpentMs / s.misses : 0;
              const estSaved = Math.round(s.hits * avgMiss);
              // eslint-disable-next-line no-console
              console.error(
                `[dns] exec=${execId} queries=${total} hits=${s.hits} misses=${s.misses} hit_rate=${hitRate.toFixed(
                  1
                )}% time_spent_ms=${s.timeSpentMs} est_saved_ms=${estSaved}`
              );
            }
            if (options.httpCheck) {
              const pairs = Object.entries(httpErrorCounts).map(([k, v]) => `${k}:${v}`).join(' ');
              console.error(`[http] errors=${pairs}`);
            }
          }
          if (options.summary) {
            // eslint-disable-next-line no-console
            console.log(`summary=${JSON.stringify(summary)}`);
          }
        }

        if (options.output) {
          if (options.httpCheck || options.doh) {
            // results already populated in order of domains
            const pretty = !!options.pretty;
            const arr = results.filter(Boolean);
            try {
              validateAnalyzeArray(arr);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error('[warn] analyze output schema validation failed:', e);
            }
            await writeJson(arr, options.output, pretty);
            // eslint-disable-next-line no-console
            console.log(`wrote JSON: ${options.output}`);
          } else {
            // Without httpCheck, emit minimal objects with domain if available
            const out = (originals.length ? originals : domains.map((d) => ({ domain: d }))).map(
              (r, idx) => ({
                domain: pickDomain(r as Record<string, unknown>) ?? domains[idx] ?? '',
                original: options.includeOriginal ? (r as Record<string, unknown>) : undefined,
              })
            );
            await writeJson(out, options.output, !!options.pretty);
            // eslint-disable-next-line no-console
            console.log(`wrote JSON: ${options.output}`);
          }
        }

        // Audit log (best-effort)
        try {
          const inputHash = await sha256File(input);
          const ruleset = await getRulesetVersion();
          const auditPath = await appendAudit({
            cmd: 'analyze',
            execId,
            args: { input, httpCheck: !!options.httpCheck, concurrency: options.concurrency, timeout: options.timeout },
            inputHash,
            ruleset,
            rows,
            summary,
            node: process.version,
          });
          if (!options.quiet) {
            // eslint-disable-next-line no-console
            console.error(`[audit] appended -> ${auditPath}`);
          }
        } catch {
          // ignore
        }

        // Always print row count for compatibility
        // eslint-disable-next-line no-console
        console.log(`rows=${rows}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.error(msg);
        process.exit(1);
      }
    });
}
