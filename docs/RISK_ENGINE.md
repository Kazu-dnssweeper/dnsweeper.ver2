# Risk Engine (MVP)

This document specifies the MVP scoring model, evidence format, and rule IDs (R-001…R-010) used by the risk engine.

Location
- Engine: `packages/dnsweeper/src/core/risk/engine.ts`
- Rules: `packages/dnsweeper/src/core/risk/rules.ts`
- Weights: `packages/dnsweeper/src/core/risk/weights.ts`
- Types: `packages/dnsweeper/src/core/risk/types.ts`

Evidence schema
- `ruleId` (string): ID like `R-003`.
- `message` (string): short human-readable reason.
- `severity` ("low"|"medium"|"high"): local severity of the evidence.
- `meta` (object, optional): extra fields per rule (e.g., `attempts`, `status`).

Typical meta keys
- `attempts` (number): retry/failure attempts observed by resolver.
- `reasons` (string[]): internal reasons that triggered a composite rule (e.g., `low-ttl`).
- `httpStatus` (number): when a specific HTTP status influenced a rule.

Scoring and levels
- Start score at 0; add each rule’s numeric weight (`WEIGHTS[ruleId]`).
- Rounding: round to the nearest integer, floor at 0, cap at 100.
- Map score to level: `<30 → low`, `<60 → medium`, `>=60 → high`.

Rule overview (MVP)
- R-001: NXDOMAIN repeated (e.g., `attempts >= 3`) → +40.
- R-002: DNS SERVFAIL or TIMEOUT observed → +10.
- R-003: Suspicious name keywords (`old|tmp|backup|bk|stg|dev`) → +15.
- R-004: DNS high-risk hint. Triggers on repeated `SERVFAIL/TIMEOUT` (attempts≥2), `NXDOMAIN` below R-001 threshold (1–2), or very low TTL (≤30s).
- R-005: HTTP/TLS both failed (`httpsOk=false && httpOk=false`) → +15.
- R-006: HTTP 5xx observed → +10.
- R-007: HTTP 404 observed → +10.
- R-008: CNAME chain has no terminal A/AAAA answer.
- R-009: TXT weak SPF policy (e.g., `v=spf1 ~all` or `?all`).
- R-010: Cloudflare proxied (`proxied=true`) → −10.

Extending rules
- Implement a rule as a pure function: `(ctx: RiskContext) => { delta, evidence } | null`.
- Return `null` when a rule does not apply. Keep rule logic side-effect free.
- Add weight in `weights.ts`; keep values modest and use negative weights for discounts.

Configuration (thresholds)
- You can override some thresholds via `dnsweeper.config.json` (optional):
```jsonc
{
  "risk": {
    "lowTtlSec": 20,                 // R-004: TTL anomaly threshold (default 30)
    "servfailMinAttempts": 3,        // R-004: SERVFAIL/TIMEOUT min attempts (default 2)
    "nxdomainSubMin": 1,             // R-004: NXDOMAIN subthreshold min (default 1)
    "nxdomainSubMax": 2              // R-004: NXDOMAIN subthreshold max (default 2)
  }
}
```

Testing
- Add unit tests per rule (positive/negative/boundary). Target coverage ≥80%.
- Add integration tests for composite scoring when multiple rules apply.
