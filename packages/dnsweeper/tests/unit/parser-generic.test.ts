import { describe, it, expect } from 'vitest';
import { normalizeGeneric } from '../../src/core/parsers/generic.js';

describe('normalizeGeneric', () => {
  it('normalizes basic A record', () => {
    const row = { name: 'db.example.com', type: 'A', content: '192.0.2.1', ttl: '300' };
    const rec = normalizeGeneric(row);
    expect(rec).toEqual({ name: 'db.example.com', type: 'A', content: '192.0.2.1', ttl: 300 });
  });

  it('allows ttl of zero', () => {
    const row = { name: 'cache.example.com', type: 'A', content: '198.51.100.1', ttl: '0' };
    const rec = normalizeGeneric(row);
    expect(rec).toEqual({ name: 'cache.example.com', type: 'A', content: '198.51.100.1', ttl: 0 });
  });
});

