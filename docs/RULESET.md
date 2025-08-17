# Ruleset Guide

This document describes the JSON schema used to adjust risk scoring in analyze.

Location and loading
- Place your ruleset as `<name>.json` under a directory (default: `.tmp/rulesets`).
- Enable with: `--ruleset <name> [--ruleset-dir <dir>]`.

Schema (simplified)
```jsonc
{
  "name": "string (optional)",
  "qtypeWeights": { "A": 1, "AAAA": 0.5, "CNAME": 1 },   // optional map of RR type → weight
  "cnameExternalBoost": true,                                 // bump score if CNAME points outside domain
  "defaultRisk": "low|medium|high",                         // optional floor
  "domainIncludes": ["corp", "example"],                   // substring checks (adds small score)
  "domainRegex": ["^test\\.", ".*\\.internal\\."] ,    // regex checks (adds small score)
  "rules": [
    {
      "when": { "contains": "suspect" },                  // or { "regex": "..." }
      "risk": "high",                                      // optional: escalate floor to this level
      "scoreDelta": 0.1                                      // optional: add to score (small increments)
    }
  ]
}
```

Scoring model (current)
- Start from base risk (HTTP/DoH): low=0.3, medium=0.6, high=0.9
- qtypeWeights: for each DNS hop, add `weight * 0.05`
- cnameExternalBoost: +0.1 if CNAME target does not end with domain
- domainIncludes / domainRegex: +0.1 each match by default
- rules[].when: matching rule can add `scoreDelta` and/or raise floor to `risk`
- DoH status: NXDOMAIN/TIMEOUT → floor to ~0.9 (high)
- Map back: <=0.4 → low, <=0.7 → medium, else high

Tips
- Use small weights (0.2–1.0) to keep increments modest.
- Prefer `risk` for hard floors (e.g. suspicious patterns), use `scoreDelta` for gentle nudges.
- Keep ruleset under VCS but deploy per-run in `.tmp/rulesets` to test changes safely.

Example
```sh
cp examples/rulesets/default.json .tmp/rulesets/default.json
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --ruleset default --summary
```

