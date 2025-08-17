export type HttpInfo = { ok: boolean; status?: number } | undefined;
export type DnsInfo = {
  status?: string;
  chain?: Array<{ type: string; data: string; ttl?: number }>;
};

export type Detection = {
  action: 'keep' | 'review' | 'delete';
  reason: string;
  reasonCode: string;
  confidence: number; // 0..1
};

export function detectStale(
  domain: string,
  risk: 'low' | 'medium' | 'high' | undefined,
  https: HttpInfo,
  http: HttpInfo,
  dns: DnsInfo | undefined,
  recordType?: string
): Detection {
  // Default baseline
  let action: Detection['action'] = 'keep';
  let reason = 'ok';
  let confidence = 0.3;
  let reasonCode = 'OK';

  const dnsStatus = (dns?.status || '').toUpperCase();

  // Strong signals
  if (dnsStatus === 'NXDOMAIN' || dnsStatus === 'TIMEOUT') {
    action = 'delete';
    reason = `DNS ${dnsStatus}`;
    reasonCode = `DNS_${dnsStatus}`;
    confidence = 0.9;
    return { action, reason, reasonCode, confidence };
  }

  // MX/NS records referencing broken name (best-effort: when recordType hints)
  if (recordType && (recordType.toUpperCase() === 'MX' || recordType.toUpperCase() === 'NS')) {
    if (dnsStatus === 'NXDOMAIN') {
      action = 'delete';
      reason = `Referential NXDOMAIN (${recordType.toUpperCase()})`;
      reasonCode = `REF_NXDOMAIN_${recordType.toUpperCase()}`;
      confidence = 0.85;
      return { action, reason, reasonCode, confidence };
    }
  }

  // CNAME without terminal A/AAAA
  if (dns?.chain && dns.chain.length > 0) {
    const hasCNAME = dns.chain.some((h) => h.type === 'CNAME');
    const hasAddr = dns.chain.some((h) => h.type === 'A' || h.type === 'AAAA');
    if (hasCNAME && !hasAddr) {
      action = 'review';
      reason = 'CNAME has no terminal A/AAAA';
      reasonCode = 'CNAME_NO_TERMINAL';
      confidence = 0.75;
    }
  }

  // HTTP/TLS failures (when httpCheck ran)
  const httpRan = typeof https?.ok === 'boolean' || typeof http?.ok === 'boolean';
  if (httpRan) {
    const httpsOk = !!https?.ok;
    const httpOk = !!http?.ok;
    if (!httpsOk && !httpOk) {
      action = 'review';
      reason = 'HTTP/TLS all failed';
      reasonCode = 'HTTP_ALL_FAILED';
      confidence = Math.max(confidence, 0.65);
    } else {
      const statuses = [https?.status, http?.status].filter((s) => typeof s === 'number') as number[];
      if (statuses.some((s) => s >= 500)) {
        action = 'review';
        reason = 'HTTP 5xx';
        reasonCode = 'HTTP_5XX';
        confidence = Math.max(confidence, 0.55);
      } else if (statuses.some((s) => s === 404)) {
        action = 'review';
        reason = 'HTTP 404';
        reasonCode = 'HTTP_404';
        confidence = Math.max(confidence, 0.55);
      }
    }
  }

  // High risk from rules/DNS can elevate confidence
  if (risk === 'high') confidence = Math.max(confidence, 0.7);

  return { action, reason, reasonCode, confidence };
}
