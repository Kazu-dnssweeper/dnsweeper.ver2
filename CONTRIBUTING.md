# Contributing

Thank you for your interest in improving DNSweeper!

## Development
- Node.js 20, PNPM preferred. See README for setup.
- Run unit tests with `pnpm -C packages/dnsweeper run test:unit`.

## Security-related changes
- Do not include sensitive details in public PRs. If you found a vulnerability, please report via SECURITY.md.
- For PRs that touch security posture (auth, file IO, network probing, rules), describe threat model and test plan.
- Avoid shelling out to external commands. Prefer Node APIs. If unavoidable, whitelist commands and sanitize all args.

## DCO/CLA
- By contributing, you certify that you have the right to submit the work under the project license.

