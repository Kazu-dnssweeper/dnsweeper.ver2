import { CsvRecord } from '../../types.js';

function stripDot(s: string): string {
  return s.endsWith('.') ? s.slice(0, -1) : s;
}

export function normalizeGeneric(row: Record<string, unknown>): CsvRecord {
  // Expect lower keys: name,type,content,ttl
  const map: Record<string, string> = {};
  for (const k of Object.keys(row)) map[k.toLowerCase()] = k;
  const get = (k: string) => row[map[k]];

  const type = String(get('type') ?? '').toUpperCase();
  const name = stripDot(String(get('name') ?? '').trim());
  const content = String(get('content') ?? '').trim();
  const ttlRaw = get('ttl');

  if (!name || !type) throw new Error('missing name/type');
  const rec: CsvRecord = { name, type };
  if (content) rec.content = type === 'TXT' ? content.replace(/^\"|\"$/g, '') : content;
  if (ttlRaw !== undefined && ttlRaw !== null && String(ttlRaw).trim() !== '') {
    const ttl = Number.parseInt(String(ttlRaw), 10);
    if (Number.isFinite(ttl) && ttl >= 0) rec.ttl = ttl;
    else throw new Error('invalid ttl');
  }
  // Basic validation: certain types require content
  if (['A', 'AAAA', 'CNAME', 'TXT'].includes(rec.type) && !rec.content) {
    throw new Error('missing content');
  }
  return rec;
}
