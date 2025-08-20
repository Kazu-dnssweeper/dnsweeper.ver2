import fs from 'node:fs';
import path from 'node:path';

type Event = { name: string; ts: string; data?: Record<string, unknown>; version?: string };

let enabled = false;
let endpoint: string | null = null;
let buffer: Event[] = [];

function defaultFile() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (home) return path.join(home, '.dnsweeper', 'telemetry.log');
  return path.join('.tmp', 'telemetry.log');
}

async function loadOnce() {
  if (enabled || endpoint !== null) return;
  try {
    const { loadConfig } = await import('../config/schema.js');
    const cfg = await loadConfig();
    enabled = !!cfg?.telemetry?.enabled;
    endpoint = cfg?.telemetry?.endpoint || '';
  } catch {
    enabled = false;
    endpoint = '';
  }
}

export async function recordEvent(name: string, data?: Record<string, unknown>) {
  await loadOnce();
  if (!enabled) return;
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (/domain|host|url|name/i.test(k)) continue;
    if (typeof v === 'string' && /https?:\/\//i.test(v)) continue;
    sanitized[k] = v;
  }
  buffer.push({ name, ts: new Date().toISOString(), data: sanitized });
}

export async function flush() {
  await loadOnce();
  if (!enabled) return;
  const items = buffer.splice(0, buffer.length);
  if (items.length === 0) return;
  const ep = endpoint || '';
  if (!ep || !/^https?:\/\//i.test(ep)) {
    const file = defaultFile();
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.appendFile(file, items.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    return;
  }
  try {
    await fetch(ep, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(items),
      signal: AbortSignal.timeout(1500),
    });
  } catch {}
}
