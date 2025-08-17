import { loadConfig } from '../config/schema.js';

export type RiskThresholds = {
  lowTtlSec: number; // R-004: TTL anomaly threshold
  servfailMinAttempts: number; // R-004: SERVFAIL/TIMEOUT min attempts
  nxdomainSubMin: number; // R-004: NXDOMAIN subthreshold min attempts (inclusive)
  nxdomainSubMax: number; // R-004: NXDOMAIN subthreshold max attempts (inclusive, below R-001)
};

let cached: RiskThresholds | null = null;

export function getRiskThresholds(): RiskThresholds {
  if (cached) return cached;
  // Note: loadConfig is async, but here we use best-effort sync cache via env passthrough
  // Callers can warm config separately; fallback to defaults when not available.
  const risk = (globalThis as any).__DNSWEEPER_CFG__?.risk || {};
  const n = (v: any, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
  cached = {
    lowTtlSec: n(risk.lowTtlSec, 30),
    servfailMinAttempts: Math.max(0, n(risk.servfailMinAttempts, 2)),
    nxdomainSubMin: Math.max(0, n(risk.nxdomainSubMin, 1)),
    nxdomainSubMax: Math.max(0, n(risk.nxdomainSubMax, 2)),
  };
  return cached;
}

export async function warmConfig() {
  try {
    const cfg = await loadConfig();
    (globalThis as any).__DNSWEEPER_CFG__ = cfg;
  } catch {
    // ignore
  }
}

export function getRuleOverrides(): { weights: Record<string, number>; disabled: string[] } {
  const cfg = (globalThis as any).__DNSWEEPER_CFG__ || {};
  const rw = cfg?.risk?.rules?.weights || {};
  const dis = cfg?.risk?.rules?.disabled || [];
  return { weights: rw, disabled: dis };
}
