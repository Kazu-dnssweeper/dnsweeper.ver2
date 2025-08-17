import { WEIGHTS } from './weights.js';
import { getRiskThresholds } from './config.js';
import type { RiskEvidence, RiskContext } from './types.js';

export type RuleFn = (ctx: RiskContext) => { delta: number; evidence?: RiskEvidence } | null;

const reSuspicious = /(old|tmp|backup|bk|stg|dev)/i;

export const RULES: Record<string, RuleFn> = {
  'R-001': (ctx) => {
    const status = (ctx.dns?.status || '').toUpperCase();
    const attempts = ctx.dns?.attempts || 0;
    if (status === 'NXDOMAIN' && attempts >= 3) {
      return {
        delta: WEIGHTS['R-001'],
        evidence: { ruleId: 'R-001', message: `NXDOMAIN x${attempts}`, severity: 'high', meta: { attempts } },
      };
    }
    return null;
  },
  'R-002': (ctx) => {
    const status = (ctx.dns?.status || '').toUpperCase();
    if (status === 'SERVFAIL' || status === 'TIMEOUT') {
      return { delta: WEIGHTS['R-002'], evidence: { ruleId: 'R-002', message: `DNS ${status}`, severity: 'medium' } };
    }
    return null;
  },
  'R-003': (ctx) => {
    if (ctx.name && reSuspicious.test(ctx.name)) {
      return { delta: WEIGHTS['R-003'], evidence: { ruleId: 'R-003', message: 'suspicious keywords in name', severity: 'medium' } };
    }
    return null;
  },
  'R-004': (_ctx) => null,
  // DNS high-risk hint: composite signals
  // - SERVFAIL/TIMEOUT with repeated attempts (>=2)
  // - NXDOMAIN with attempts in [1,2] (below R-001 threshold)
  // - TTL anomaly: min TTL <= 30s across chain
  'R-004': (ctx) => {
    const th = getRiskThresholds();
    const reasons: string[] = [];
    const status = (ctx.dns?.status || '').toUpperCase();
    const attempts = ctx.dns?.attempts ?? 0;
    if ((status === 'SERVFAIL' || status === 'TIMEOUT') && attempts >= th.servfailMinAttempts) reasons.push('repeated-servfail-timeout');
    if (status === 'NXDOMAIN' && attempts >= th.nxdomainSubMin && attempts <= th.nxdomainSubMax) reasons.push('nxdomain-subthreshold');
    const chain = Array.isArray(ctx.dns?.chain) ? ctx.dns?.chain || [] : [];
    const ttlMin = chain.reduce((min, h) => (typeof h.ttl === 'number' ? Math.min(min, h.ttl) : min), Number.POSITIVE_INFINITY);
    if (Number.isFinite(ttlMin) && (ttlMin as number) <= th.lowTtlSec) reasons.push('low-ttl');
    if (reasons.length === 0) return null;
    const evidence: RiskEvidence = { ruleId: 'R-004', message: 'dns high-risk hint', severity: 'medium', meta: { reasons } };
    return { delta: WEIGHTS['R-004'], evidence };
  },
  'R-005': (ctx) => {
    const ran = typeof ctx.http?.httpsOk === 'boolean' || typeof ctx.http?.httpOk === 'boolean';
    if (!ran) return null;
    if (!ctx.http?.httpsOk && !ctx.http?.httpOk) {
      return { delta: WEIGHTS['R-005'], evidence: { ruleId: 'R-005', message: 'HTTP/TLS all failed', severity: 'medium' } };
    }
    return null;
  },
  'R-006': (ctx) => {
    const st = ctx.http?.statuses || [];
    if (st.some((s) => s >= 500)) {
      return { delta: WEIGHTS['R-006'], evidence: { ruleId: 'R-006', message: 'HTTP 5xx observed', severity: 'medium' } };
    }
    return null;
  },
  'R-007': (ctx) => {
    const st = ctx.http?.statuses || [];
    if (st.includes(404)) {
      return { delta: WEIGHTS['R-007'], evidence: { ruleId: 'R-007', message: 'HTTP 404 observed', severity: 'low' } };
    }
    return null;
  },
  // CNAME chain without terminal A/AAAA
  'R-008': (ctx) => {
    const chain = Array.isArray(ctx.dns?.chain) ? ctx.dns?.chain || [] : [];
    if (chain.length === 0) return null;
    const hasCname = chain.some((h) => String(h.type).toUpperCase() === 'CNAME');
    const hasA = chain.some((h) => {
      const t = String(h.type).toUpperCase();
      return t === 'A' || t === 'AAAA';
    });
    if (hasCname && !hasA) {
      return { delta: WEIGHTS['R-008'], evidence: { ruleId: 'R-008', message: 'CNAME has no terminal A/AAAA', severity: 'medium' } };
    }
    return null;
  },
  // TXT hints: weak SPF (~all or ?all)
  'R-009': (ctx) => {
    const chain = Array.isArray(ctx.dns?.chain) ? ctx.dns?.chain || [] : [];
    if (chain.length === 0) return null;
    const txts = chain.filter((h) => String(h.type).toUpperCase() === 'TXT').map((h) => String(h.data || ''));
    const weakSpf = txts.some((txt) => /v=spf1/i.test(txt) && /[~?]all\b/i.test(txt));
    if (weakSpf) {
      return { delta: WEIGHTS['R-009'], evidence: { ruleId: 'R-009', message: 'weak SPF (~all/?all)', severity: 'low' } };
    }
    return null;
  },
  'R-010': (ctx) => {
    if (ctx.proxied === true) {
      return { delta: WEIGHTS['R-010'], evidence: { ruleId: 'R-010', message: 'cloudflare proxied', severity: 'low' } };
    }
    return null;
  },
};
