import { CsvRecord } from '../../types.js';

function stripDot(s: string): string {
  return s.endsWith('.') ? s.slice(0, -1) : s;
}

export function normalizeGeneric(row: Record<string, unknown>): CsvRecord {
  const map: Record<string, string> = {};
  for (const k of Object.keys(row)) map[k.toLowerCase()] = k;
  const get = (k: string) => (map[k] ? row[map[k]] : undefined);

  const hasType = !!map['type'];
  const hasName = !!map['name'];
  const hasDomain = !!map['domain'];

  const rawType = String(get('type') ?? '').toUpperCase();
  const type = hasType ? rawType : 'A';
  const rawName = hasName ? String(get('name') ?? '').trim() : hasDomain ? String(get('domain') ?? '').trim() : '';
  const name = stripDot(rawName);
  const content = String(get('content') ?? '').trim();
  const ttlRaw = get('ttl');

  if (!name) throw new Error('missing name');
  const rec: CsvRecord = { name, type };
  if (content) rec.content = type === 'TXT' ? content.replace(/^\"|\"$/g, '') : content;
  if (ttlRaw !== undefined && ttlRaw !== null && String(ttlRaw).trim() !== '') {
    const ttl = Number.parseInt(String(ttlRaw), 10);
    if (Number.isFinite(ttl) && ttl >= 0) rec.ttl = ttl;
    else throw new Error('invalid ttl');
  }
  if (hasType && ['A', 'AAAA', 'CNAME', 'TXT'].includes(rec.type) && !rec.content) {
    throw new Error('missing content');
  }
  return rec;
}
