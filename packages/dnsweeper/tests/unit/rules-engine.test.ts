import { describe, it, expect, beforeAll } from 'vitest';
import { applyRules, loadRuleset, type Ruleset } from '../../src/core/rules/engine.js';

describe('rules engine', () => {
  let rs: Ruleset | null = null;
  beforeAll(async () => {
    rs = await loadRuleset(process.cwd() + '/../../examples/rulesets', 'default');
  });

  it('qtypeWeights + domainIncludes can lift low -> medium', () => {
    const base = 'low' as const; // score=0.3
    const dns = { chain: [{ type: 'A', data: '93.184.216.34' }, { type: 'CNAME', data: 'cdn.other.net' }] };
    // qtype adds 0.05 + 0.05 = 0.1 → 0.4 (still low)
    let risk = applyRules('app.example.com', base, { ruleset: rs!, dns });
    expect(risk).toBe('medium'); // includes("example") adds 0.1 → 0.5
  });

  it('CNAME external boost applies', () => {
    const base = 'low' as const; // 0.3
    const dns = { chain: [{ type: 'CNAME', data: 'edge.cdn.net' }] };
    const risk = applyRules('app.example.com', base, { ruleset: rs!, dns });
    // +0.1(CNAME ext) +0.1(domainIncludes example) = 0.5 → medium
    expect(risk).toBe('medium');
  });

  it('NXDOMAIN forces high', () => {
    const base = 'low' as const;
    const dns = { status: 'NXDOMAIN', chain: [] } as any;
    const risk = applyRules('nope.invalid', base, { ruleset: rs!, dns });
    expect(risk).toBe('high');
  });

  it('rule can escalate to high with regex', () => {
    const base = 'medium' as const; // 0.6
    const risk = applyRules('api.suspect.example.com', base, { ruleset: rs! });
    expect(risk).toBe('high');
  });
});
