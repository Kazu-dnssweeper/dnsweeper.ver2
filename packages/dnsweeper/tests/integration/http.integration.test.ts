import { describe, it, expect } from 'vitest';
import { probeUrl } from '../../src/core/http/probe.js';

describe('integration: HTTP probe (real endpoint)', () => {
  it('https example.com reachable', async () => {
    const r = await probeUrl('https://example.com/', { timeoutMs: 5000, maxRedirects: 5, method: 'HEAD' });
    expect(typeof r.elapsedMs).toBe('number');
    // Accept 2xx or 3xx as reachable
    expect(r.ok || (r.status && r.status >= 300 && r.status < 400)).toBeTruthy();
  });
});

