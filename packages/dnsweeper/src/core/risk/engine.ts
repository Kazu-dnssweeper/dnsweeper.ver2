import { clampScore, levelFromScore } from './weights.js';
import { RULES } from './rules.js';
import { getRuleOverrides } from './config.js';
import type { RiskItem, RiskContext, RiskEvidence } from './types.js';

export function evaluateRisk(ctx: RiskContext, enabled: string[] = Object.keys(RULES)): RiskItem {
  let score = 0;
  const evidences: RiskEvidence[] = [];
  const overrides = getRuleOverrides();
  const disabled = new Set(overrides.disabled || []);
  for (const id of enabled) {
    if (disabled.has(id)) continue;
    const fn = RULES[id];
    if (!fn) continue;
    const res = fn(ctx);
    if (!res) continue;
    const delta = Object.prototype.hasOwnProperty.call(overrides.weights || {}, id)
      ? Number(overrides.weights[id])
      : res.delta;
    score += delta;
    if (res.evidence) evidences.push(res.evidence);
  }
  score = clampScore(score);
  const level = levelFromScore(score);
  return { score, level, evidences };
}
