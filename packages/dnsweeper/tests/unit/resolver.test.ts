import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveDoh, setFetch, ResolveResult } from '../../src/core/resolver/doh.js';
import { clearCache, getCached, putCached } from '../../src/core/resolver/cache.js';

type FetchLike = (input: any, init?: any) => Promise<{ status: number; json: () => Promise<any> }>;

function makeResponse(json: any, status = 200) {
  return { status, json: async () => json } as any;
}

describe('resolveDoh', () => {
  beforeEach(() => {
    clearCache();
  });

  it('resolves A with NOERROR and caches', async () => {
    let calls = 0;
    const fakeFetch: FetchLike = async (url) => {
      calls += 1;
      const u = new URL(String(url));
      expect(u.searchParams.get('name')).toBe('example.com.');
      expect(u.searchParams.get('type')).toBe('A');
      return makeResponse({
        Status: 0,
        Answer: [
          { name: 'example.com.', type: 1, TTL: 60, data: '93.184.216.34' },
        ],
        AD: false,
        CD: true,
      });
    };
    setFetch(fakeFetch as any);
    const r1 = await resolveDoh('example.com.', 'A', { retries: 0 });
    expect(r1.status).toBe('NOERROR');
    expect(r1.chain.length).toBe(1);
    const r2 = await resolveDoh('example.com.', 'A', { retries: 0 });
    expect(r2.status).toBe('NOERROR');
    // second call should be served from cache
    expect(calls).toBe(1);
    setFetch(null);
  });

  it('returns NXDOMAIN', async () => {
    const fakeFetch: FetchLike = async () => makeResponse({ Status: 3, Answer: [] });
    setFetch(fakeFetch as any);
    const r = await resolveDoh('nope.invalid.', 'A');
    expect(r.status).toBe('NXDOMAIN');
    expect(r.chain.length).toBe(0);
    setFetch(null);
  });

  it('captures CNAME chain with multiple hops', async () => {
    const fakeFetch: FetchLike = async () =>
      makeResponse({
        Status: 0,
        Answer: [
          { name: 'www.example.com.', type: 5, TTL: 120, data: 'example.com.' },
          { name: 'example.com.', type: 1, TTL: 300, data: '93.184.216.34' },
        ],
      });
    setFetch(fakeFetch as any);
    const r = await resolveDoh('www.example.com.', 'A', { retries: 0 });
    expect(r.status).toBe('NOERROR');
    expect(r.chain.length).toBe(2);
    expect(r.chain[0].type).toBe('CNAME');
    expect(r.chain[1].type).toBe('A');
    setFetch(null);
  });

  it('handles timeout', async () => {
    const fakeFetch: FetchLike = async (_url, init) => {
      // Simulate never resolving until aborted
      return new Promise((_resolve, reject) => {
        // Abort sooner by triggering AbortError
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }) as any;
    };
    setFetch(fakeFetch as any);
    const r: ResolveResult = await resolveDoh('slow.example.', 'A', { timeoutMs: 10, retries: 0 });
    expect(r.status).toBe('TIMEOUT');
    setFetch(null);
  });

  it('returns SERVFAIL on HTTP 5xx', async () => {
    const fakeFetch: FetchLike = async () => makeResponse({}, 503);
    setFetch(fakeFetch as any);
    const r = await resolveDoh('broke.example.', 'A', { retries: 0 });
    expect(r.status).toBe('SERVFAIL');
    setFetch(null);
  });
});

describe('resolver cache', () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires entries after TTL', () => {
    const result: ResolveResult = { qname: 'a', qtype: 'A', status: 'NOERROR', chain: [], elapsedMs: 1 };
    putCached('a', 'A', result, 1);
    expect(getCached('a', 'A')).toEqual(result);
    vi.advanceTimersByTime(1500);
    expect(getCached('a', 'A')).toBeNull();
  });
});
