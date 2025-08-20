# DNSweeper

![CI Unit](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-unit.yml/badge.svg)
![CI Net](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-net.yml/badge.svg)
![CI Large](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-large.yml/badge.svg)

[English](README.en.md) | [日本語](README.md)

DNSweeper is a CLI that analyzes DNS record health and HTTP/TLS reachability, then prioritizes risk and generates a sweep plan (review/delete). It helps individuals and SREs quickly “see the zone state → prioritize → clean up”.

Docs: specs docs/SPEC.md · risk docs/RISK_ENGINE.md · ops docs/OPERATIONS.md · progress instructions/PROGRESS.md · roadmap ROADMAP.md

---

## Overview / Features
- DoH resolution + HTTP/TLS probing (error classification, minimal TLS info, TLS verification enabled by default; set `verifyTls: false` to skip checks)
- Rule‑based risk evaluation (evidence output, rule weights/disable)
- list (filter/columns), export (JSON/CSV/XLSX)
- Sweep plan generation (review/delete)
- Snapshot/resume, QPS/concurrency control, progress and summary

## Requirements / Install
- Node.js 20 (with `.nvmrc`)
```sh
npm install
# (optional) global CLI
pnpm -C packages/dnsweeper link --global
dnsweeper --help
```

## Quickstart (3 commands)
```sh
# 1) Analyze (DoH+HTTP, with summary, save JSON)
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --summary --output analyzed.json --pretty
# 2) List (medium+ risk as table)
npm start -- list analyzed.json --min-risk medium --sort risk --format table
# 3) Export (CSV/XLSX)
npm start -- export analyzed.json --format csv  --output out.csv
npm start -- export analyzed.json --format xlsx --output out.xlsx
```

## Input format (minimal)
Accepts CSV/JSON. A simple CSV with a `domain` column works. See Import example and tests/fixtures.
```sh
# Normalize with provider auto-detection (Cloudflare/Route53/Generic)
npm start -- import packages/dnsweeper/tests/fixtures/cloudflare-small.csv --pretty --output cf.json
```

## Common commands (cheat sheet)
- analyze: DoH+HTTP → risk → JSON
- list: show/filter/add columns for JSON
- export: JSON → CSV/XLSX
- import: CSV → normalized JSON (provider auto-detect)
- sweep plan: generate review/delete plan
- ruleset weights: tune/disable rules
- annotate: add notes/labels/marks to JSON
```sh
dnsweeper sweep plan analyzed.json --min-risk medium --output sweep-plan.json --format json
npm start -- ruleset weights --set R-003=10 R-005=20
```

## Minimal config example (dnsweeper.config.json)
```json
{
  "analyze": { "qps": 200, "concurrency": 40, "timeoutMs": 3000, "dohEndpoint": "https://dns.google/resolve" },
  "risk": { "rules": { "disabled": [], "weights": { "R-003": 10 } } }
}
```

## Notes (safety / limits)
- By default, HTTP probing to private/special targets is skipped (`--allow-private` to override)
- Control load with `qps`/`concurrency`/`timeout`
- Results depend on network conditions; record your measurement settings (timeout/retry/qps) in docs

## Links / Support / License
- Details: docs/SPEC.md, docs/RISK_ENGINE.md, docs/OPERATIONS.md, ROADMAP.md
- Feedback: Issues/Discussions welcome (input/output/defaults/rule priorities)
- License: Apache-2.0

