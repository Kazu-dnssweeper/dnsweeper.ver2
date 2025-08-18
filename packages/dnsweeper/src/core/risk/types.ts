export type RiskLevel = 'low' | 'medium' | 'high';

export type RiskEvidence = {
  ruleId: string; // e.g., R-001
  message: string;
  severity: RiskLevel;
  meta?: Record<string, unknown>;
};

export type RiskItem = {
  score: number; // 0..100 (rounded)
  level: RiskLevel; // low<30, 30<=medium<60, 60<=high
  evidences: RiskEvidence[];
};

export type RiskContext = {
  // minimal inputs used by rules
  name?: string; // fqdn
  type?: string; // A/AAAA/CNAME/TXT/MX/NS
  proxied?: boolean; // cloudflare
  dns?: {
    status?: string; // NOERROR/NXDOMAIN/SERVFAIL/TIMEOUT
    attempts?: number; // number of failures or attempts observed
    chain?: Array<{ type: string; data: string; ttl?: number }>; // resolved hops
  };
  http?: {
    httpsOk?: boolean;
    httpOk?: boolean;
    statuses?: number[]; // observed http status codes
  };
};
