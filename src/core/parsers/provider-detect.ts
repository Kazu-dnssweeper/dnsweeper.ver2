export type Provider = 'cloudflare' | 'route53' | 'generic';

export function detectProviderFromHeader(headers: string[]): Provider {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const has = (s: string) => lower.includes(s);

  // Cloudflare: typical headers include: type,name,content,ttl,proxied/proxy status
  if (has('proxied') || has('proxy status') || (has('type') && has('content') && has('name'))) {
    return 'cloudflare';
  }

  // Route53: often has: name,type,ttl,value or alias target
  if (has('alias target') || has('aliastarget') || (has('value') && has('name') && has('type'))) {
    return 'route53';
  }

  return 'generic';
}

