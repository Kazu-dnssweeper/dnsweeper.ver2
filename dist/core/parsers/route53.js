function stripDot(s) {
    return s.endsWith('.') ? s.slice(0, -1) : s;
}
export function normalizeRoute53(row) {
    // Route53 export sample headers include: Name,Type,TTL,Value,Alias Target
    const map = {};
    for (const k of Object.keys(row))
        map[k.toLowerCase()] = k;
    const get = (k) => row[map[k]];
    const type = String(get('type') ?? '').toUpperCase();
    const name = stripDot(String(get('name') ?? '').trim());
    const ttlRaw = get('ttl');
    const value = String(get('value') ?? '').trim();
    const alias = String((get('alias target') ?? get('aliastarget') ?? '')).trim();
    if (!name || !type)
        throw new Error('missing name/type');
    const rec = { name, type };
    if (alias)
        rec.aliasTarget = stripDot(alias);
    if (value)
        rec.content = type === 'TXT' ? value.replace(/^\"|\"$/g, '') : value;
    if (ttlRaw !== undefined && ttlRaw !== null && String(ttlRaw).trim() !== '') {
        const ttl = Number.parseInt(String(ttlRaw), 10);
        if (Number.isFinite(ttl) && ttl > 0)
            rec.ttl = ttl;
        else
            throw new Error('invalid ttl');
    }
    if (!rec.aliasTarget && ['A', 'AAAA', 'CNAME', 'TXT'].includes(rec.type) && !rec.content) {
        throw new Error('missing value/alias');
    }
    return rec;
}
//# sourceMappingURL=route53.js.map