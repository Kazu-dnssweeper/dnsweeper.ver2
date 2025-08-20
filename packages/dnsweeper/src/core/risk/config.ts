import type { ConfigService } from '../config/service.js';

export type RiskThresholds = {
  lowTtlSec: number; // R-004: TTL anomaly threshold
  servfailMinAttempts: number; // R-004: SERVFAIL/TIMEOUT min attempts
  nxdomainSubMin: number; // R-004: NXDOMAIN subthreshold min attempts (inclusive)
  nxdomainSubMax: number; // R-004: NXDOMAIN subthreshold max attempts (inclusive, below R-001)
};

const cache = new WeakMap<ConfigService, RiskThresholds>();

export function getRiskThresholds(cfg: ConfigService): RiskThresholds {
  const hit = cache.get(cfg);
  if (hit) return hit;
  const risk = cfg.get()?.risk || {};
  const n = (v: any, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
  const th: RiskThresholds = {
    lowTtlSec: n(risk.lowTtlSec, 30),
    servfailMinAttempts: Math.max(0, n(risk.servfailMinAttempts, 2)),
    nxdomainSubMin: Math.max(0, n(risk.nxdomainSubMin, 1)),
    nxdomainSubMax: Math.max(0, n(risk.nxdomainSubMax, 2)),
  };
  cache.set(cfg, th);
  return th;
}

export function getRuleOverrides(cfg: ConfigService): { weights: Record<string, number>; disabled: string[] } {
  const c = cfg.get() || {};
  const rw = c?.risk?.rules?.weights || {};
  const dis = c?.risk?.rules?.disabled || [];
  return { weights: rw, disabled: dis };
}

