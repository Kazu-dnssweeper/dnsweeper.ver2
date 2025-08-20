import fs from 'node:fs';
import path from 'node:path';

type PersistResult = {
  status: string;
  chain: Array<{ type: string; data: string; ttl?: number }>;
  elapsedMs: number;
  queries?: Array<{ type: string; status: string; elapsedMs: number; answers: number }>;
};

type Entry = { k: string; result: PersistResult; expiresAt: number };
type Store = Map<string, { result: PersistResult; expiresAt: number }>;

let inited = false;
let store: Store = new Map();
let filePath: string | null = null;

function defaultPath() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (home) return path.join(home, '.cache', 'dnsweeper', 'doh-cache.jsonl');
  return path.join('.tmp', 'doh-cache.jsonl');
}

async function ensureDir(p: string) {
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
}

export function configure(pathOverride?: string) {
  filePath = pathOverride || defaultPath();
}

async function init() {
  if (inited) return;
  inited = true;
  if (!filePath) filePath = defaultPath();
  try {
    await ensureDir(filePath as string);
    const exists = await fs.promises
      .stat(filePath as string)
      .then(() => true)
      .catch(() => false);
    if (!exists) return;
    const s = fs.createReadStream(filePath as string, { encoding: 'utf8' });
    let buf = '';
    await new Promise<void>((resolve, reject) => {
      s.on('data', (chunk) => {
        buf += String(chunk);
        let idx = buf.indexOf('\n');
        while (idx >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (line) {
            try {
              const e = JSON.parse(line) as Entry;
              if (e && e.k && e.expiresAt && e.result) {
                store.set(e.k, { result: e.result, expiresAt: e.expiresAt });
              }
            } catch {}
          }
          idx = buf.indexOf('\n');
        }
      });
      s.on('end', () => resolve());
      s.on('error', reject);
    });
  } catch {}
}

function keyOf(qname: string, qtype: string) {
  return `${qname}|${qtype}`;
}

export async function getPersisted(qname: string, qtype: string): Promise<PersistResult | null> {
  await init();
  const k = keyOf(qname, qtype);
  const e = store.get(k);
  if (!e) return null;
  if (Date.now() < e.expiresAt) return e.result;
  store.delete(k);
  return null;
}

let writer: fs.WriteStream | null = null;

async function append(entry: Entry) {
  if (!filePath) filePath = defaultPath();
  if (!writer) {
    await ensureDir(filePath as string);
    writer = fs.createWriteStream(filePath as string, { flags: 'a', encoding: 'utf8' });
    try {
      (writer as any).on?.('error', () => {});
    } catch {}
  }
  writer.write(JSON.stringify(entry) + '\n');
}

export async function putPersisted(qname: string, qtype: string, result: PersistResult, ttlSec: number) {
  await init();
  const expiresAt = Date.now() + Math.max(0, ttlSec) * 1000;
  const k = keyOf(qname, qtype);
  store.set(k, { result, expiresAt });
  await append({ k, result, expiresAt });
}
