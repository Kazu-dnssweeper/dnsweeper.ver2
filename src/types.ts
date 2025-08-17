export type CsvRecord = {
  name: string; // FQDN without trailing dot
  type: string; // e.g., A, AAAA, CNAME, TXT
  content?: string; // primary value (e.g., IP, target)
  ttl?: number; // seconds
  proxied?: boolean; // Cloudflare only
  aliasTarget?: string; // Route53 alias target (FQDN)
};

