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

function maskValue(key: string, val: unknown): unknown {
  const k = key.toLowerCase();
  const sensitive = /(token|secret|password|pass|authorization|auth|cookie|apikey|api-key|key)/i;
  if (sensitive.test(k)) return '[redacted]';
  if (typeof val === 'string') {
    // Truncate overly long strings to protect logs from bloat
    const maxLen = 2000;
    if (val.length > maxLen) return val.slice(0, maxLen) + '…(truncated)';
    // Mask obvious bearer tokens
    if (/^Bearer\s+[A-Za-z0-9\-_.=]+$/.test(val)) return 'Bearer [redacted]';
  }
  return val;
}

function sanitize(entry: AuditEntry): AuditEntry {
  const recur = (v: unknown, parentKey: string): unknown => {
    if (Array.isArray(v)) return v.map((x) => recur(x, parentKey));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) {
        out[k] = recur(maskValue(k, vv), k);
      }
      return out;
    }
    return maskValue(parentKey, v);
  };
  return recur(entry, '') as AuditEntry;
}

// Buffered audit support
type BufferCfg = { enabled: boolean; maxEntries: number; flushIntervalMs: number };
let _buf: string[] | null = null;
let _timer: NodeJS.Timeout | null = null;
let _installedHandlers = false;

function getBufferCfg(): BufferCfg {
  const cfg = (globalThis as any).__DNSWEEPER_CFG__ || {};
  const b = cfg?.audit?.buffer || {};
  const enabled = !!b.enabled;
  const maxEntries = Number.isFinite(b.maxEntries) && b.maxEntries > 0 ? b.maxEntries : 200;
  const flushIntervalMs = Number.isFinite(b.flushIntervalMs) && b.flushIntervalMs > 0 ? b.flushIntervalMs : 2000;
  return { enabled, maxEntries, flushIntervalMs };
}

async function directAppend(line: string): Promise<string> {
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

function installExitHandlers() {
  if (_installedHandlers) return;
  _installedHandlers = true;
  const flushAndExit = async () => {
    try { await flushNow(); } catch {}
  };
  // Best-effort flush on exit signals
  process.on('beforeExit', flushAndExit);
  process.on('exit', () => {});
  ['SIGINT', 'SIGTERM', 'SIGHUP', 'uncaughtException'].forEach((ev) => {
    process.on(ev as any, async () => {
      try { await flushNow(); } catch {}
    });
  });
}

async function flushNow(): Promise<void> {
  if (!_buf || _buf.length === 0) return;
  const lines = _buf.join('');
  _buf = [];
  await directAppend(lines);
}

function bufferPush(line: string, maxEntries: number, flushIntervalMs: number) {
  if (!_buf) _buf = [];
  _buf.push(line);
  if (_buf.length >= maxEntries) void flushNow();
  if (!_timer) {
    installExitHandlers();
    _timer = setInterval(() => {
      void flushNow().catch(() => void 0);
    }, flushIntervalMs);
    // Do not keep the event loop alive just for the timer
    try { (_timer as any).unref?.(); } catch {}
  }
}

export async function appendAudit(entry: AuditEntry) {
  const safe = sanitize(entry);
  let line = JSON.stringify({ ts: new Date().toISOString(), ...safe }) + '\n';
  // Clamp final line length to ~64KB to avoid giant log lines
  const MAX_LINE = 64 * 1024;
  if (line.length > MAX_LINE) {
    const head = line.slice(0, MAX_LINE - 64);
    line = head + '\\n{"truncated":true,"reason":"line too large"}\n';
  }
  // Buffered mode support (config-driven)
  const { enabled, maxEntries, flushIntervalMs } = getBufferCfg();
  if (enabled) {
    bufferPush(line, maxEntries, flushIntervalMs);
    return process.env.DNSWEEPER_AUDIT_PATH || defaultAuditPath();
  }
  return directAppend(line);
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
