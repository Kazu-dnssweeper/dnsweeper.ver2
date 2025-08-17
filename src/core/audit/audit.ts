import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type AuditEntry = Record<string, unknown>;

function defaultAuditPath() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) return path.join(home, '.dnsweeper', 'audit.log');
  return path.join('.tmp', 'audit.log');
}

async function ensureDirOf(file: string) {
  const dir = path.dirname(file);
  await fs.promises.mkdir(dir, { recursive: true });
}

export async function appendAudit(entry: AuditEntry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  const primary = process.env.DNSWEEPER_AUDIT_PATH || defaultAuditPath();
  try {
    await ensureDirOf(primary);
    // Simple rotation at ~5MB
    try {
      const st = await fs.promises.stat(primary);
      if (st.size > 5 * 1024 * 1024) {
        const rotated = primary + '.1';
        await fs.promises.rename(primary, rotated).catch(() => void 0);
      }
    } catch {
      // ignore stat failure
    }
    await fs.promises.appendFile(primary, line, 'utf8');
    return primary;
  } catch {
    const fallback = path.join('.tmp', 'audit.log');
    await ensureDirOf(fallback);
    await fs.promises.appendFile(fallback, line, 'utf8');
    return fallback;
  }
}

export async function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(file);
    s.on('error', reject);
    s.on('data', (chunk) => h.update(chunk));
    s.on('end', () => resolve(h.digest('hex')));
  });
}

export async function getRulesetVersion(dir = '.tmp/rulesets') {
  try {
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = items.filter((i) => i.isFile()).map((i) => i.name);
    let latest = 0;
    for (const f of files) {
      const s = await fs.promises.stat(path.join(dir, f));
      latest = Math.max(latest, s.mtimeMs);
    }
    return {
      count: files.length,
      latest: latest ? new Date(latest).toISOString() : null,
    };
  } catch {
    return { count: 0, latest: null as string | null };
  }
}
