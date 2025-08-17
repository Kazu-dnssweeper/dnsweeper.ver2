import { ResolveResult } from './doh.js';

type CacheEntry = { result: ResolveResult; expiresAt: number };

const store = new Map<string, CacheEntry>();

function keyOf(qname: string, qtype: string) {
  return `${qname}|${qtype}`;
}

export function getCached(qname: string, qtype: string): ResolveResult | null {
  const k = keyOf(qname, qtype);
  const e = store.get(k);
  if (!e) return null;
  if (Date.now() < e.expiresAt) return e.result;
  store.delete(k);
  return null;
}

export function putCached(qname: string, qtype: string, result: ResolveResult, ttlSec: number) {
  const expiresAt = Date.now() + Math.max(0, ttlSec) * 1000;
  store.set(keyOf(qname, qtype), { result, expiresAt });
}

export function clearCache() {
  store.clear();
}

