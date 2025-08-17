// Rule weights (baseline contribution to score)
export const WEIGHTS: Record<string, number> = {
  'R-001': 40, // repeated NXDOMAIN
  'R-002': 10, // SERVFAIL/TIMEOUT single
  'R-003': 15, // suspicious name keywords
  'R-004': 10, // DNS high risk hint
  'R-005': 15, // HTTP all failed
  'R-006': 10, // HTTP 5xx
  'R-007': 10, // HTTP 404
  'R-008': 10, // CNAME no terminal A/AAAA
  'R-009': 5,  // TXT hint
  'R-010': -10 // cloudflare proxied=true (discount)
};

export function clampScore(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

export function levelFromScore(score: number): 'low' | 'medium' | 'high' {
  if (score < 30) return 'low';
  if (score < 60) return 'medium';
  return 'high';
}

