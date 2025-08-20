import type { RiskLevel, RiskEvidence } from '../core/risk/types.js';
import type { ProbeResult } from '../core/http/types.js';

export interface AnalyzeResult {
  domain: string;
  risk?: RiskLevel;
  https?: ProbeResult;
  http?: ProbeResult;
  dns?: {
    status: string;
    chain: Array<{ type: string; data: string; ttl?: number }>;
    elapsedMs: number;
    queries?: Array<{ type: string; status: string; elapsedMs: number; answers: number }>;
  };
  original?: Record<string, unknown>;
  riskScore?: number;
  evidences?: RiskEvidence[];
  candidates?: string[];
  skipped?: boolean;
  skipReason?: string;
  action?: 'keep' | 'review' | 'delete';
  reason?: string;
  reasonCode?: string;
  confidence?: number;
}
