function stripDot(s) {
    return s.endsWith('.') ? s.slice(0, -1) : s;
}
export function normalizeCloudflare(row) {
    // Cloudflare exports typically: Type,Name,Content,TTL,Proxied or Proxy Status
    const map = {};
    for (const k of Object.keys(row))
        map[k.toLowerCase()] = k;
    const get = (k) => row[map[k]];
    const type = String(get('type') ?? '').toUpperCase();
    const name = stripDot(String(get('name') ?? '').trim());
    const content = String(get('content') ?? '').trim();
    const ttlRaw = get('ttl');
    const proxRaw = get('proxied') ?? get('proxy status');
    if (!name || !type)
        throw new Error('missing name/type');
    const rec = { name, type };
    if (content)
        rec.content = type === 'TXT' ? content.replace(/^\"|\"$/g, '') : content;
    if (ttlRaw !== undefined && ttlRaw !== null && String(ttlRaw).trim() !== '') {
        const ttl = Number.parseInt(String(ttlRaw), 10);
        if (Number.isFinite(ttl) && ttl > 0)
            rec.ttl = ttl;
        else
            throw new Error('invalid ttl');
    }
    if (proxRaw !== undefined) {
        const v = String(proxRaw).toLowerCase();
        if (v === 'true' || v === 'proxied')
            rec.proxied = true;
        else if (v === 'false' || v === 'dns only')
            rec.proxied = false;
    }
    if (['A', 'AAAA', 'CNAME', 'TXT'].includes(rec.type) && !rec.content) {
        throw new Error('missing content');
    }
    return rec;
}
//# sourceMappingURL=cloudflare.js.map