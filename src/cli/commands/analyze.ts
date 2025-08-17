import { Command } from 'commander';
import fs from 'node:fs';
import Papa from 'papaparse';
import pLimit from 'p-limit';
import { fetch } from 'undici';
import { resolveDoh, getDohStats, resetDohStats, QType } from '../../core/resolver/doh.js';
import { isPrivateIPv4, isPrivateIPv6, isSpecialIPv4, mightBePrivateName } from '../../core/net/ip.js';
import { validateAnalyzeArray } from '../../core/schema/analyze.js';
import { writeJson } from '../../core/output/json.js';
import { appendAudit, sha256File, getRulesetVersion } from '../../core/audit/audit.js';

type AnalyzeOptions = {
  httpCheck?: boolean;
  concurrency?: number;
  timeout?: number; // ms per probe
  summary?: boolean; // print risk summary
  output?: string; // write JSON result file
  pretty?: boolean; // pretty JSON output
  includeOriginal?: boolean; // include original row
  quiet?: boolean; // suppress progress
  doh?: boolean; // enable DoH resolution
  dohEndpoint?: string; // custom endpoint
  dnsType?: string; // single or comma-separated list
  dnsTimeout?: number;
  dnsRetries?: number;
  allowPrivate?: boolean;
  qps?: number;
  userAgent?: string;
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

async function probeOnce(url: string, timeoutMs: number, userAgent?: string): Promise<{ ok: boolean; status?: number }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: ac.signal,
      headers: userAgent ? { 'user-agent': userAgent } : undefined,
    });
    return { ok: res.status < 400, status: res.status };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

async function probeDomain(domain: string, timeoutMs: number, userAgent?: string) {
  const https = await probeOnce(`https://${domain}/`, timeoutMs, userAgent);
  let http: { ok: boolean; status?: number } = { ok: false };
  if (!https.ok) {
    http = await probeOnce(`http://${domain}/`, timeoutMs, userAgent);
  }
  const risk: RiskLevel = https.ok ? 'low' : http.ok ? 'medium' : 'high';
  return { https, http, risk };
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
    .option('--quiet', 'suppress periodic progress output', false)
    .option('-o, --output <file>', 'write analyzed JSON (array)')
    .option('--pretty', 'pretty-print JSON (with --output)', false)
    .option('--include-original', 'include original CSV row in output objects', false)
    .description('Analyze CSV and print data row count (header excluded)')
    .action(async (input: string, options: AnalyzeOptions) => {
      try {
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
        }> = [];
        const startedAt = Date.now();
        let processed = 0;
        let failed = 0;
        let sumLatency = 0;
        let progressTimer: NodeJS.Timeout | null = null;

        const printProgress = () => {
          const elapsed = (Date.now() - startedAt) / 1000;
          const qps = elapsed > 0 ? processed / elapsed : 0;
          const avg = processed > 0 ? sumLatency / processed : 0;
          const remain = Math.max(0, domains.length - processed);
          const eta = qps > 0 ? remain / qps : 0;
          if (!options.quiet) {
            // print to stderr to avoid polluting stdout
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
            progressTimer = setInterval(printProgress, 1000);
          }
          if (options.doh) resetDohStats();
          // QPS limiter
          const qps = Math.max(0, options.qps ?? 0);
          let nextAt = Date.now();
          const gate = async () => {
            if (qps <= 0) return;
            const interval = 1000 / qps;
            const now = Date.now();
            const wait = Math.max(0, nextAt - now);
            nextAt = (wait ? nextAt : now) + interval;
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          };
          const recent: boolean[] = [];
          await Promise.all(
            domains.map((domain, idx) =>
              limit(async () => {
                const t0 = Date.now();
                await gate();
                // Run DoH and HTTP probing in parallel if both enabled
                const qname = domain.endsWith('.') ? domain : `${domain}.`;
                const dnsTypes = String(options.dnsType || 'A')
                  .split(',')
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean) as QType[];
                const pDns = options.doh
                  ? Promise.all(
                      dnsTypes.map((qt) =>
                        resolveDoh(qname, qt, {
                          dohEndpoint: options.dohEndpoint,
                          timeoutMs: options.dnsTimeout,
                          retries: options.dnsRetries,
                          cd: true,
                        })
                      )
                    )
                  : Promise.resolve([]);
                const pHttp = options.httpCheck
                  ? probeDomain(domain, options.timeout ?? 5000, options.userAgent)
                  : Promise.resolve({ https: { ok: false }, http: { ok: false }, risk: 'low' as RiskLevel });

                const [rrList, probed] = (await Promise.all([pDns, pHttp])) as [
                  Array<{ status: string; chain: Array<{ type: string; data: string; ttl?: number }>; elapsedMs: number; qtype?: string }>,
                  { https: { ok: boolean; status?: number }; http: { ok: boolean; status?: number }; risk: RiskLevel }
                ];

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

                const dt = Date.now() - t0;
                sumLatency += dt;
                processed += 1;
                if (options.httpCheck && !skipped && !probed.https.ok && !probed.http.ok) failed += 1;

                // Combine risk
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
                if (skipped) {
                  if (!options.doh || (dnsResult && dnsResult.status === 'NOERROR')) risk = 'low';
                }
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
                  ...(skipped ? { skipped: true, skipReason } : {}),
                };
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
          if (progressTimer) clearInterval(progressTimer);
          if (!options.quiet && domains.length > 0) printProgress();
          summary = { low, medium, high };
          if (!options.quiet) {
            const elapsed = (Date.now() - startedAt) / 1000;
            const failRate = processed > 0 ? failed / processed : 0;
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
