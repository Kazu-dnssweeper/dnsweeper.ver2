import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export type RiskLevel = 'low' | 'medium' | 'high';

export const RulesetSchema = z.object({
  name: z.string().optional(),
  domainIncludes: z.array(z.string()).optional(),
  domainRegex: z.array(z.string()).optional(),
  qtypeWeights: z.record(z.string(), z.number()).optional(),
  cnameExternalBoost: z.boolean().optional(),
  defaultRisk: z.enum(['low', 'medium', 'high']).optional(),
  rules: z
    .array(
      z.object({
        when: z.object({ contains: z.string().optional(), regex: z.string().optional() }).partial(),
        risk: z.enum(['low', 'medium', 'high']).optional(),
        scoreDelta: z.number().optional(),
      })
    )
    .optional(),
});

export type Ruleset = z.infer<typeof RulesetSchema>;

export async function loadRuleset(dir: string, name: string): Promise<Ruleset | null> {
  try {
    const file = path.join(dir, `${name}.json`);
    const raw = await fs.promises.readFile(file, 'utf8');
    const json = JSON.parse(raw);
    return RulesetSchema.parse(json);
  } catch {
    return null;
  }
}

export function applyRules(
  domain: string,
  baseRisk: RiskLevel,
  opts: {
    ruleset?: Ruleset | null;
    dns?: { status?: string; chain?: Array<{ type: string; data: string; ttl?: number }> };
  }
): RiskLevel {
  let score = baseRisk === 'low' ? 0.3 : baseRisk === 'medium' ? 0.6 : 0.9;
  const rs = opts.ruleset;
  if (rs) {
    // qtype weights
    if (opts.dns?.chain && rs.qtypeWeights) {
      for (const hop of opts.dns.chain) {
        const w = rs.qtypeWeights[hop.type] ?? 0;
        score += w * 0.05; // modest influence per hop
      }
    }
    // CNAME external boost: if chain ends with CNAME pointing to another domain
    if (opts.dns?.chain && rs.cnameExternalBoost) {
      const last = opts.dns.chain[0]?.type === 'CNAME' ? opts.dns.chain[0] : null;
      if (last && last.data && !last.data.endsWith(domain)) {
        score += 0.1;
      }
    }
    // Static include/regex rules
    const checks: Array<{ contains?: string; regex?: string; risk?: RiskLevel; scoreDelta?: number }> = [];
    for (const s of rs.domainIncludes || []) checks.push({ contains: s, scoreDelta: 0.1 });
    for (const s of rs.domainRegex || []) checks.push({ regex: s, scoreDelta: 0.1 });
    for (const r of rs.rules || []) checks.push(r.when as any as { contains?: string; regex?: string; risk?: RiskLevel; scoreDelta?: number });
    for (const c of checks) {
      if (c.contains && domain.includes(c.contains)) {
        score += c.scoreDelta ?? 0.1;
        if (c.risk) score = Math.max(score, c.risk === 'low' ? 0.3 : c.risk === 'medium' ? 0.6 : 0.9);
      }
      if (c.regex) {
        try {
          const re = new RegExp(c.regex);
          if (re.test(domain)) {
            score += c.scoreDelta ?? 0.1;
            if (c.risk) score = Math.max(score, c.risk === 'low' ? 0.3 : c.risk === 'medium' ? 0.6 : 0.9);
          }
        } catch {
          // ignore bad regex
        }
      }
    }
  }
  if (opts.dns?.status && ['NXDOMAIN', 'TIMEOUT'].includes(opts.dns.status)) score = Math.max(score, 0.9);
  // Clamp and map
  if (score <= 0.4) return 'low';
  if (score <= 0.7) return 'medium';
  return 'high';
}
