# Releasing

This document describes how to cut a release and publish artifacts.

## Versioning
- Semantic Versioning (SemVer): MAJOR.MINOR.PATCH
- Tag format: `vX.Y.Z`

## Steps
1. Ensure CI is green on `main` for unit/net/os/bench (optional)
2. Update CHANGELOG.md (automated in future via conventional commits)
3. Create a release tag:
   - `git tag vX.Y.Z && git push origin vX.Y.Z`
   - Or use GitHub UI to create a release
4. Trigger Release workflow (auto on release created or manual via workflow_dispatch)

## npm publish
- Release job builds and runs `npm publish --dry-run` at root
- If `NPM_TOKEN` is configured, it publishes `packages/dnsweeper` to npm
- Scoped or public access can be adjusted in `package.json`

## Notes
- Ensure `bin/dnsweeper` is executable and shebang-correct on all platforms
- Keep published files minimal via `files` in package.json

