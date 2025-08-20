import { describe, it, expect } from 'vitest';
import { evaluateRisk } from '../../src/core/risk/engine.js';
import { ConfigService } from '../../src/core/config/service.js';

const cfgSvc = new ConfigService();

describe('risk engine (enabled list)', () => {
  it('applies only selected rules', () => {
    // Name contains suspicious -> R-003 (+15) only
    const r = evaluateRisk({ name: 'api-dev.example.com' }, cfgSvc, ['R-003']);
    expect(r.score).toBe(15);
    expect(r.level).toBe('low');
  });

  it('negative + positive combine and clamp', () => {
    // proxied=true (-10) + suspicious name (+15) => 5
    const r = evaluateRisk({ proxied: true, name: 'tmp.example' }, cfgSvc, ['R-003', 'R-010']);
    expect(r.score).toBe(5);
    expect(r.level).toBe('low');
  });
});

