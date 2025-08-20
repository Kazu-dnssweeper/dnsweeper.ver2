import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/core/config/schema.js', () => ({ loadConfig: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete (globalThis as any).__DNSWEEPER_CFG__;
});

describe('risk config', () => {
  it('loads config and applies overrides', async () => {
    const { loadConfig }: any = await import('../../src/core/config/schema.js');
    loadConfig.mockResolvedValue({
      risk: {
        lowTtlSec: 10,
        servfailMinAttempts: 5,
        nxdomainSubMin: 2,
        nxdomainSubMax: 4,
        rules: { weights: { 'R-001': 99 }, disabled: ['R-003'] },
      },
    });
    const { warmConfig, getRiskThresholds, getRuleOverrides } = await import('../../src/core/risk/config.js');
    await warmConfig();
    expect(getRiskThresholds()).toEqual({ lowTtlSec: 10, servfailMinAttempts: 5, nxdomainSubMin: 2, nxdomainSubMax: 4 });
    expect(getRuleOverrides()).toEqual({ weights: { 'R-001': 99 }, disabled: ['R-003'] });
    const { evaluateRisk } = await import('../../src/core/risk/engine.js');
    const r = evaluateRisk({ dns: { status: 'NXDOMAIN', attempts: 3 }, name: 'tmp.example' });
    expect(r.score).toBe(100);
  });

  it('uses defaults when config load fails', async () => {
    const { loadConfig }: any = await import('../../src/core/config/schema.js');
    loadConfig.mockRejectedValue(new Error('fail'));
    const { warmConfig, getRiskThresholds, getRuleOverrides } = await import('../../src/core/risk/config.js');
    await warmConfig();
    expect(getRiskThresholds()).toEqual({ lowTtlSec: 30, servfailMinAttempts: 2, nxdomainSubMin: 1, nxdomainSubMax: 2 });
    expect(getRuleOverrides()).toEqual({ weights: {}, disabled: [] });
  });
});
