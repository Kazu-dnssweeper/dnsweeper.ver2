import fs from 'node:fs';
import path from 'node:path';

export type RiskThresholds = {
  lowTtlSec: number; // R-004: TTL anomaly threshold
  servfailMinAttempts: number; // R-004: SERVFAIL/TIMEOUT min attempts
  nxdomainSubMin: number; // R-004: NXDOMAIN subthreshold min attempts (inclusive)
  nxdomainSubMax: number; // R-004: NXDOMAIN subthreshold max attempts (inclusive, below R-001)
};

let cached: RiskThresholds | null = null;

function loadConfigSync(cwd = process.cwd()): any | null {
  const file = path.join(cwd, 'dnsweeper.config.json');
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getRiskThresholds(): RiskThresholds {
  if (cached) return cached;
  const cfg = loadConfigSync();
  const risk = (cfg && (cfg as any).risk) || {};
  const n = (v: any, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
  cached = {
    lowTtlSec: n(risk.lowTtlSec, 30),
    servfailMinAttempts: Math.max(0, n(risk.servfailMinAttempts, 2)),
    nxdomainSubMin: Math.max(0, n(risk.nxdomainSubMin, 1)),
    nxdomainSubMax: Math.max(0, n(risk.nxdomainSubMax, 2)),
  };
  return cached;
}

