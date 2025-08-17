import { CsvRecord } from '../../types.js';

function stripDot(s: string): string {
  return s.endsWith('.') ? s.slice(0, -1) : s;
}

export function normalizeRoute53(row: Record<string, unknown>): CsvRecord {
  // Route53 export sample headers include: Name,Type,TTL,Value,Alias Target
  const map: Record<string, string> = {};
  for (const k of Object.keys(row)) map[k.toLowerCase()] = k;
  const get = (k: string) => row[map[k]];

  const type = String(get('type') ?? '').toUpperCase();
  const name = stripDot(String(get('name') ?? '').trim());
  const ttlRaw = get('ttl');
  const value = String(get('value') ?? '').trim();
  const alias = String((get('alias target') ?? get('aliastarget') ?? '') as string).trim();

  if (!name || !type) throw new Error('missing name/type');
  const rec: CsvRecord = { name, type };
  if (alias) rec.aliasTarget = stripDot(alias);
  if (value) rec.content = type === 'TXT' ? value.replace(/^\"|\"$/g, '') : value;
  if (ttlRaw !== undefined && ttlRaw !== null && String(ttlRaw).trim() !== '') {
    const ttl = Number.parseInt(String(ttlRaw), 10);
    if (Number.isFinite(ttl) && ttl > 0) rec.ttl = ttl;
    else throw new Error('invalid ttl');
  }
  if (!rec.aliasTarget && ['A', 'AAAA', 'CNAME', 'TXT'].includes(rec.type) && !rec.content) {
    throw new Error('missing value/alias');
  }
  return rec;
}
