# TELEMETRY

DNSweeper telemetry is fully opt-in and disabled by default. When enabled, it collects a minimal, anonymous set of operational metrics to improve product quality. No domain names, full URLs, or personally identifiable information (PII) are sent.

Scope
- Events: command start/finish, sizes (rows), elapsed time, coarse error buckets (e.g., timeout/tls/http4xx/http5xx), environment summary (OS, Node version).
- Exclusions: input contents, domain names, IPs, URLs, headers, tokens/secrets, and raw error messages that could contain sensitive data.
- Sampling: modules may sample to reduce volume; sampling rate is internal and may change.

Configuration (dnsweeper.config.json)
```json
{
  "telemetry": {
    "enabled": false,
    "endpoint": "https://example.telemetry.endpoint/v1/ingest"
  }
}
```
- enabled: defaults to false. When false, the telemetry module is a no‑op.
- endpoint: optional. If omitted, events may be written to a local JSONL file (best‑effort) for debugging.

Runtime behavior
- When enabled, the CLI records lightweight events for key phases (e.g., analyze_start/analyze_done) and flushes asynchronously.
- Network failures when sending telemetry never fail the CLI; errors are suppressed.
- Sanitization: event payloads are explicitly scrubbed to avoid sending domains, IPs, URLs, filesystem paths, or arbitrary strings from inputs.
- Size limits: events are small and bounded; flushing batches handle backoff.

Opt-out
- Default is already off. To ensure no telemetry in any environment:
  - Do not set telemetry.enabled=true in config.
  - If an environment variable override is introduced in future versions, prefer TELEMETRY=0.

Data retention
- The project does not operate a shared telemetry backend by default. If you configure a custom endpoint, ensure you maintain a proper privacy policy and retention policy for your organization.

Verification
- Unit tests assert that when telemetry is disabled, recordEvent/flush are no-ops.
- When enabled, events are buffered and flushed without leaking domain/url/PII fields.

Location
- Implementation: packages/dnsweeper/src/core/telemetry/telemetry.ts
- Integration (example): analyze command records analyze_start/analyze_done and DoH stats.
