import { describe, it, expect } from 'vitest';
import { normalizeRoute53 } from '../../src/core/parsers/route53.js';

describe('normalizeRoute53', () => {
  it('handles alias target and trailing dots', () => {
    const row = { Name: 'www.example.com.', Type: 'CNAME', TTL: '300', Value: '', 'Alias Target': 'target.example.net.' };
    const rec = normalizeRoute53(row as any);
    expect(rec).toEqual({ name: 'www.example.com', type: 'CNAME', aliasTarget: 'target.example.net', ttl: 300 });
  });
});

