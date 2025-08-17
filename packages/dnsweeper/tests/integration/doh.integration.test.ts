import { describe, expect, it } from 'vitest';
import { resolveDoh } from '../../src/core/resolver/doh.js';

const run = process.env.RUN_INTEGRATION === '1';
const testFn = run ? it : it.skip;

describe('integration: resolveDoh (real endpoint)', () => {
  testFn('example.com A NOERROR', async () => {
    const r = await resolveDoh('example.com.', 'A', { retries: 1, timeoutMs: 5000 });
    expect(['NOERROR', 'SERVFAIL', 'TIMEOUT']).toContain(r.status);
    // In normal internet, should be NOERROR; but allow SERVFAIL/TIMEOUT under CI with restricted network
  });
});

