import { getCached, putCached } from './cache.js';
import { fetchWrapper } from '../http/fetch.js';

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
  dohEndpoint?: string;
  timeoutMs?: number;
  retries?: number;
  cd?: boolean;
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
  const base = Math.min(1500, 200 * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * 300);
  return base + jitter;
}

async function getPersistConfig(): Promise<{ enabled: boolean; path?: string }> {
  try {
    const { loadConfig } = await import('../config/schema.js');
    const cfg = await loadConfig();
    const p = (cfg as any)?.cache?.dohPersist;
    return { enabled: !!p?.enabled, path: p?.path };
  } catch {
    return { enabled: false };
  }
}

export async function resolveDoh(
  qname: string,
  qtype: QType,
  opts: ResolveOptions = {}
): Promise<ResolveResult> {
  try {
    const persistCfg = await getPersistConfig();
    if (persistCfg.enabled) {
      const { configure, getPersisted } = await import('./persist-cache.js');
      if (persistCfg.path) configure(persistCfg.path);
      const persisted = await getPersisted(qname, qtype);
      if (persisted) {
        stats.hits += 1;
        return {
          qname,
          qtype,
          status: persisted.status as any,
          chain: persisted.chain as any,
          elapsedMs: persisted.elapsedMs,
        };
      }
    }
  } catch {}

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

      const res = await (customFetch || fetchWrapper)(u.toString(), {
        method: 'GET',
        headers: { accept: 'application/dns-json' },
        signal: controller.signal,
      });
      if (!('status' in res) || (res as any).status >= 500) {
        throw new Error(`http ${(res as any).status}`);
      }
      const body = await (res as any).json();
      const statusCode: number = body.Status;
      const status = codeToStatus(statusCode);
      const answers: any[] = Array.isArray(body.Answer) ? body.Answer : [];
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
        const ttl = ttlMin as number;
        putCached(qname, qtype, result, ttl);
        try {
          const persistCfg = await getPersistConfig();
          if (persistCfg.enabled) {
            const { configure, putPersisted } = await import('./persist-cache.js');
            if (persistCfg.path) configure(persistCfg.path);
            await putPersisted(qname, qtype, { status, chain, elapsedMs }, ttl);
          }
        } catch {}
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
      if (e instanceof Error && (e.name === 'AbortError' || /abort/i.test((e as any).message || ''))) {
        return { qname, qtype, status: 'TIMEOUT', chain: [], elapsedMs };
      }
      return { qname, qtype, status: 'SERVFAIL', chain: [], elapsedMs };
    }
  }
  const elapsedMs = Date.now() - started;
  return { qname, qtype, status: 'SERVFAIL', chain: [], elapsedMs };
}
