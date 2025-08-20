import { ResolveResult } from './doh.js';

type CacheEntry = { result: ResolveResult; expiresAt: number };

const store = new Map<string, CacheEntry>();

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

let maxEntries = DEFAULT_MAX_ENTRIES;
let defaultTtlMs = DEFAULT_TTL_MS;

function keyOf(qname: string, qtype: string) {
  return `${qname}|${qtype}`;
}

export function configureCache(opts: { maxEntries?: number; ttlMs?: number } = {}) {
  maxEntries = opts.maxEntries ?? (Number(process.env.DNSWEEPER_CACHE_MAX) || DEFAULT_MAX_ENTRIES);
  defaultTtlMs = opts.ttlMs ?? (Number(process.env.DNSWEEPER_CACHE_TTL_MS) || DEFAULT_TTL_MS);
  clearCache();
}

export function getCached(qname: string, qtype: string): ResolveResult | null {
  const k = keyOf(qname, qtype);
  const e = store.get(k);
  if (!e) return null;
  if (Date.now() >= e.expiresAt) {
    store.delete(k);
    return null;
  }
  // refresh LRU order
  store.delete(k);
  store.set(k, e);
  return e.result;
}

export function putCached(qname: string, qtype: string, result: ResolveResult, ttlSec: number) {
  const expiresAt = Date.now() + Math.min(defaultTtlMs, Math.max(0, ttlSec) * 1000);
  const k = keyOf(qname, qtype);
  if (store.has(k)) {
    store.delete(k);
  }
  store.set(k, { result, expiresAt });
  if (store.size > maxEntries) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (oldestKey !== undefined) {
      store.delete(oldestKey);
    }
  }
}

export function clearCache() {
  store.clear();
}

configureCache();
