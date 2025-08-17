import { clampScore, levelFromScore } from './weights.js';
import { RULES } from './rules.js';
import type { RiskItem, RiskContext, RiskEvidence } from './types.js';

export function evaluateRisk(ctx: RiskContext, enabled: string[] = Object.keys(RULES)): RiskItem {
  let score = 0;
  const evidences: RiskEvidence[] = [];
  for (const id of enabled) {
    const fn = RULES[id];
    if (!fn) continue;
    const res = fn(ctx);
    if (!res) continue;
    score += res.delta;
    if (res.evidence) evidences.push(res.evidence);
  }
  score = clampScore(score);
  const level = levelFromScore(score);
  return { score, level, evidences };
}

