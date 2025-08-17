import { describe, it, expect } from 'vitest';
import { normalizeCloudflare } from '../../src/core/parsers/cloudflare.js';

describe('normalizeCloudflare', () => {
  it('parses proxied and ttl', () => {
    const row = { Type: 'A', Name: 'api.example.com', Content: '203.0.113.1', TTL: '120', Proxied: 'true' };
    const rec = normalizeCloudflare(row as any);
    expect(rec).toEqual({ name: 'api.example.com', type: 'A', content: '203.0.113.1', ttl: 120, proxied: true });
  });
});

