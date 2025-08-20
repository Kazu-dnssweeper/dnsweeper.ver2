import { describe, it, expect } from 'vitest';
import { evaluateRisk } from '../../src/core/risk/engine.js';
import { ConfigService } from '../../src/core/config/service.js';

const cfgSvc = new ConfigService();

describe('risk engine', () => {
  it('R-001: NXDOMAIN x3 → +40', () => {
    const ctx = { dns: { status: 'NXDOMAIN', attempts: 3 } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(40);
    expect(r.level).toBe('medium');
  });

  it('R-003: suspicious name → +15', () => {
    const ctx = { name: 'api-old.example.com' };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(15);
    expect(r.level).toBe('low');
  });

  it('R-010: proxied=true → −10', () => {
    const ctx = { proxied: true };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(0); // floor 0
  });

  it('R-002: DNS TIMEOUT → +10', () => {
    const ctx = { dns: { status: 'TIMEOUT' } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(10);
    expect(r.level).toBe('low');
  });

  it('R-006: HTTP 5xx bumps score', () => {
    const ctx = { http: { httpsOk: false, httpOk: true, statuses: [200, 502] } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(10);
    expect(r.level).toBe('low');
  });

  it('R-007: HTTP 404 bumps score', () => {
    const ctx = { http: { httpsOk: true, httpOk: true, statuses: [301, 404] } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(10);
    expect(r.level).toBe('low');
  });

  it('Composite: 40 + 15 + 15 = 70 → high', () => {
    const ctx = {
      dns: { status: 'NXDOMAIN', attempts: 3 },
      name: 'tmp.example.com',
      http: { httpsOk: false, httpOk: false },
    };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(70);
    expect(r.level).toBe('high');
  });

  it('R-004: NXDOMAIN attempts=2 (subthreshold) → +10', () => {
    const ctx = { dns: { status: 'NXDOMAIN', attempts: 2 } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(10);
    expect(r.level).toBe('low');
  });

  it('R-004: SERVFAIL attempts>=2 → +10 (with R-002 total 20)', () => {
    const ctx = { dns: { status: 'SERVFAIL', attempts: 2 } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(20);
    expect(r.level).toBe('low');
  });

  it('R-004: low TTL (<=30) in chain → +10', () => {
    const ctx = { dns: { status: 'NOERROR', chain: [{ type: 'A', data: '1.2.3.4', ttl: 20 }] } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(10);
  });

  it('R-008: CNAME without A/AAAA → +10', () => {
    const ctx = { dns: { chain: [{ type: 'CNAME', data: 'target.example.com.' }] } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(10);
  });

  it('R-008: CNAME with terminal A present → no bump', () => {
    const ctx = { dns: { chain: [{ type: 'CNAME', data: 'target.example.com.' }, { type: 'A', data: '93.184.216.34' }] } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(0);
  });

  it('R-009: TXT weak SPF (~all) → +5', () => {
    const ctx = { dns: { chain: [{ type: 'TXT', data: 'v=spf1 include:_spf.example.com ~all' }] } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(5);
  });

  it('R-009: TXT strong SPF (-all) → no bump', () => {
    const ctx = { dns: { chain: [{ type: 'TXT', data: 'v=spf1 include:_spf.example.com -all' }] } };
    const r = evaluateRisk(ctx, cfgSvc);
    expect(r.score).toBe(0);
  });
});
