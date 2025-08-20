import { describe, it, expect, beforeEach } from 'vitest';
import { configureCache, getCached, putCached } from '../../src/core/resolver/cache.js';
import type { ResolveResult } from '../../src/core/resolver/doh.js';

function makeResult(name: string): ResolveResult {
  return { qname: name, qtype: 'A', status: 'NOERROR', chain: [], elapsedMs: 0 };
}

describe('resolver cache eviction', () => {
  beforeEach(() => {
    configureCache();
  });

  it('evicts entries after ttl', async () => {
    configureCache({ maxEntries: 10, ttlMs: 10 });
    const r = makeResult('ttl.example.');
    putCached(r.qname, r.qtype, r, 60);
    expect(getCached(r.qname, r.qtype)).not.toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(getCached('ttl.example.', 'A')).toBeNull();
  });

  it('evicts least recently used entry when max exceeded', () => {
    configureCache({ maxEntries: 2, ttlMs: 1000 });
    const r1 = makeResult('a.example.');
    const r2 = makeResult('b.example.');
    const r3 = makeResult('c.example.');
    putCached(r1.qname, r1.qtype, r1, 60);
    putCached(r2.qname, r2.qtype, r2, 60);
    // access r1 to make it most recently used
    getCached(r1.qname, r1.qtype);
    putCached(r3.qname, r3.qtype, r3, 60);
    expect(getCached(r1.qname, r1.qtype)).not.toBeNull();
    expect(getCached(r2.qname, r2.qtype)).toBeNull();
    expect(getCached(r3.qname, r3.qtype)).not.toBeNull();
  });
});
