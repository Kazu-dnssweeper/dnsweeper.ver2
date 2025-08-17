# Operations Guide (Repo: dnsweeper.ver2)

This document summarizes how to push via SSH deploy keys, inspect GitHub Actions, and rotate credentials safely. No secrets are stored in the repo.

## Remotes
- SSH origin: `git@github.com:Kazu-dnssweeper/dnsweeper.ver2.git`

## Push via SSH Deploy Key (recommended)
Deploy keys are scoped to a single repository. We use an ED25519 key generated locally and add the public key to GitHub with Write access.

Steps (from repo root):
1) Generate a keypair and print the public key
   - `bash scripts/setup-deploy-key.sh`
   - Copies are written under `.tmp/` (gitignored). Output shows: `PUBLIC_KEY=ssh-ed25519 ...`
2) Add Deploy Key on GitHub
   - Repo → Settings → Deploy keys → Add deploy key
   - Title: `dnsweeper-deploy` (arbitrary)
   - Key: paste the printed `ssh-ed25519 ...` line (exactly one line)
   - Check “Allow write access” → Add key
3) Test and push (temporary config)
   - `bash scripts/ssh-test.sh`
   - `GIT_SSH_COMMAND="ssh -F .tmp/ssh_config" git push -u origin main`

Notes
- The private key stays only on this machine (`.tmp/deploy_key`). DO NOT commit it.
- If the environment is ephemeral, repeat the steps to re-generate and re-add a key.
- To revoke access, remove the Deploy Key from GitHub.

## Inspect GitHub Actions (read-only)
Use a fine‑grained personal access token (PAT) with minimal permissions to read runs/jobs/logs.

Token setup
- Generate: GitHub → Settings → Developer settings → Fine‑grained tokens → Generate
  - Repository access: Only select repositories → `Kazu-dnssweeper/dnsweeper.ver2`
  - Permissions: Actions: Read, Contents: Read, Metadata: Read
  - Expiration: short (e.g., 1–30 days)
- Export locally (example): `export GITHUB_TOKEN=xxxxx`

Provide token once, then reuse without re-typing:
- Save token to `~/.config/dnsweeper/token` (owner-only perms):
  - `mkdir -p ~/.config/dnsweeper && printf '%s' "<YOUR_TOKEN>" > ~/.config/dnsweeper/token && chmod 600 ~/.config/dnsweeper/token`
- Scripts will read from env `GITHUB_TOKEN` first, or fallback to this file.

Check status (helper script)
- `pnpm run ci:status` → prints latest run, jobs, and failing steps
  - Uses `.tmp/gha_*.json` temp files and token for auth

Download logs
- `pnpm run ci:logs` → downloads the latest run logs into `.tmp/gha_logs.latest/`

Re-run workflows
- Requires token permission: Actions: Write.
- Full rerun of latest run: `pnpm run ci:rerun`
- Rerun failed jobs only: `pnpm run ci:rerun:failed`
- Specific run id: `node scripts/ci/rerun.js --run <RUN_ID> [--failed]`

## Push fallback via HTTPS (PAT)
If SSH push is unstable in your environment, use the HTTPS fallback script:

- Save PAT once to `~/.config/dnsweeper/token` (600 perms)
- Commit and push via HTTPS with token:
  - `pnpm run ci:push` (pushes current branch to origin)
  - Optionally pass args: `scripts/ci/push.sh <branch> "commit message"`

## Rotation / Safety
- Deploy Key: Remove from GitHub → re‑generate with the script → re‑add
- PAT: Revoke after use (Settings → Developer settings → Tokens)
- Never commit files under `.tmp/` (ignored via .gitignore)

## Persistent SSH on your machine (no re‑setup)
Automate the persistence of the deploy key and host alias:
- `bash scripts/ssh-persist.sh`
- Test: `ssh -T github-dnsweeper`
- Use: `git push -u origin main`（リモートがSSHの場合）

If origin is HTTPS, convert it once:
- `bash scripts/remote-to-ssh.sh`

## Logout / Cleanup (remove local credentials)
When you finish work or need to sanitize the environment, use the logout helper.

- Dry-run (shows what would be removed):
  - `bash scripts/logout.sh`
- Apply (actually remove files and edit `~/.ssh/config`):
  - `bash scripts/logout.sh --force`
- Scope of removal (local only):
  - Repo-local: `.tmp/deploy_key{,.pub}`, `.tmp/ssh_config`
  - User: `~/.config/dnsweeper/token`, `~/.ssh/dnsweeper{,.pub}`, `Host github-dnsweeper` entry in `~/.ssh/config`
- Server-side: Consider revoking Deploy Key (Repo → Settings → Deploy keys) and PAT（Settings → Developer settings → Tokens）as needed.
