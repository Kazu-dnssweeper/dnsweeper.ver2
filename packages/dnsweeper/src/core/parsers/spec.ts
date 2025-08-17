export type Provider = 'cloudflare' | 'route53' | 'generic';

export type HeaderSpec = {
  required: string[];
  optional: string[];
  aliases?: Record<string, string>; // lower-case alias -> canonical
};

const lc = (a: string[]) => a.map((s) => s.toLowerCase());

export const HEADER_SPECS: Record<Provider, HeaderSpec> = {
  cloudflare: {
    required: lc(['type', 'name']),
    optional: lc(['content', 'ttl', 'proxied', 'proxy status']),
    aliases: { 'proxy status': 'proxied' },
  },
  route53: {
    required: lc(['name', 'type']),
    optional: lc(['ttl', 'value', 'alias target', 'aliastarget']),
    aliases: { aliastarget: 'alias target' },
  },
  generic: {
    required: lc(['name', 'type']),
    optional: lc(['content', 'ttl']),
  },
};

export function validateHeaders(provider: Provider, headers: string[]): { ok: boolean; missing: string[] } {
  const hset = new Set(headers.map((h) => h.toLowerCase().trim()));
  const spec = HEADER_SPECS[provider];
  const missing = spec.required.filter((r) => !hset.has(r));
  return { ok: missing.length === 0, missing };
}

