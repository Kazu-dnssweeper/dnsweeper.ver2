import { fetch as undiciFetch } from 'undici';
import { getCached, putCached } from './cache.js';

export type QType = 'A'|'AAAA'|'CNAME'|'TXT'|'SRV'|'CAA'|'MX'|'NS'|'PTR';

export interface ResolveHop {
  type: string;
  data: string;
  ttl?: number;
}

export interface ResolveResult {
  qname: string;
  qtype: QType;
  status: 'NOERROR'|'NXDOMAIN'|'SERVFAIL'|'TIMEOUT';
  chain: ResolveHop[];
  ad?: boolean;
  cd?: boolean;
  elapsedMs: number;
}

export type ResolveOptions = {
  dohEndpoint?: string; // default to Google DoH
  timeoutMs?: number; // default 3000
  retries?: number; // default 2
  cd?: boolean; // checking disabled
};

let customFetch: typeof fetch | null = null;
export function setFetch(fn: typeof fetch | null) {
  customFetch = fn;
}

const stats = { hits: 0, misses: 0, timeSpentMs: 0 };
export function resetDohStats() {
  stats.hits = 0;
  stats.misses = 0;
  stats.timeSpentMs = 0;
}
export function getDohStats() {
  return { ...stats };
}

const TYPE_MAP: Record<number, QType | string> = {
  1: 'A', 28: 'AAAA', 5: 'CNAME', 16: 'TXT', 33: 'SRV', 257: 'CAA', 15: 'MX', 2: 'NS', 12: 'PTR',
};

function codeToStatus(code: number): ResolveResult['status'] {
  if (code === 0) return 'NOERROR';
  if (code === 3) return 'NXDOMAIN';
  if (code === 2) return 'SERVFAIL';
  return 'SERVFAIL';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitterDelay(attempt: number) {
  // base exponential backoff + jitter ~200-1500ms window
  const base = Math.min(1500, 200 * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * 300);
  return base + jitter;
}

export async function resolveDoh(
  qname: string,
  qtype: QType,
  opts: ResolveOptions = {}
): Promise<ResolveResult> {
  const cached = getCached(qname, qtype);
  if (cached) {
    stats.hits += 1;
    return cached;
  }

  const endpoint = opts.dohEndpoint || 'https://dns.google/resolve';
  const timeoutMs = opts.timeoutMs ?? 3000;
  const retries = Math.max(0, opts.retries ?? 2);
  const cd = opts.cd ?? true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const u = new URL(endpoint);
      u.searchParams.set('name', qname);
      u.searchParams.set('type', qtype);
      u.searchParams.set('cd', cd ? '1' : '0');

      const res = await (customFetch || undiciFetch)(u.toString(), {
        method: 'GET',
        headers: { accept: 'application/dns-json' },
        signal: controller.signal,
      });
      if (res.status >= 500) {
        throw new Error(`http ${res.status}`);
      }
      interface DohBody { Status: number; Answer?: Array<{ type: number; data: string; TTL?: number }>; AD?: boolean; CD?: boolean }
      const body: DohBody = await res.json();
      const statusCode: number = body.Status;
      const status = codeToStatus(statusCode);
      const answers = Array.isArray(body.Answer) ? body.Answer : [];
      const chain: ResolveHop[] = answers.map((a) => ({ type: TYPE_MAP[a.type] || String(a.type), data: String(a.data), ttl: a.TTL }));
      const ttlMin = chain.reduce((min, h) => (typeof h.ttl === 'number' ? Math.min(min, h.ttl) : min), Number.POSITIVE_INFINITY);
      const elapsedMs = Date.now() - started;
      const result: ResolveResult = {
        qname,
        qtype,
        status,
        chain,
        ad: !!body.AD,
        cd: !!body.CD,
        elapsedMs,
      };
      if (status === 'NOERROR' && Number.isFinite(ttlMin)) {
        putCached(qname, qtype, result, ttlMin as number);
      }
      stats.misses += 1;
      stats.timeSpentMs += elapsedMs;
      clearTimeout(timer);
      return result;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await sleep(jitterDelay(attempt));
        continue;
      }
      clearTimeout(timer);
      const elapsedMs = Date.now() - started;
      stats.misses += 1;
      stats.timeSpentMs += elapsedMs;
      if (e instanceof Error && (e.name === 'AbortError' || /abort/i.test(e.message))) {
        return { qname, qtype, status: 'TIMEOUT', chain: [], elapsedMs };
      }
      return { qname, qtype, status: 'SERVFAIL', chain: [], elapsedMs };
    }
  }
  // Should not reach here
  const elapsedMs = Date.now() - started;
  return { qname, qtype, status: 'SERVFAIL', chain: [], elapsedMs };
}
