import { clampScore, levelFromScore } from './weights.js';
import { RULES } from './rules.js';
import { getRuleOverrides, getRiskThresholds } from './config.js';
import type { RiskItem, RiskContext, RiskEvidence } from './types.js';
import type { ConfigService } from '../config/service.js';

export function evaluateRisk(
  ctx: RiskContext,
  cfg: ConfigService,
  enabled: string[] = Object.keys(RULES)
): RiskItem {
  let score = 0;
  const evidences: RiskEvidence[] = [];
  const overrides = getRuleOverrides(cfg);
  const th = getRiskThresholds(cfg);
  const disabled = new Set(overrides.disabled || []);
  for (const id of enabled) {
    if (disabled.has(id)) continue;
    const fn = RULES[id];
    if (!fn) continue;
    const res = fn(ctx, th);
    if (!res) continue;
    const delta = Object.prototype.hasOwnProperty.call(overrides.weights || {}, id)
      ? Number((overrides.weights as any)[id])
      : res.delta;
    score += delta;
    if (res.evidence) evidences.push(res.evidence);
  }
  score = clampScore(score);
  const level = levelFromScore(score);
  return { score, level, evidences };
}
