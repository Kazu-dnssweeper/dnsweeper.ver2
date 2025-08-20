import { z } from 'zod';

export const HttpSchema = z.object({
  ok: z.boolean(),
  status: z.number().optional(),
  redirects: z.number().optional(),
  finalUrl: z.string().optional(),
  elapsedMs: z.number().optional(),
  errorType: z.string().optional(),
  tls: z
    .object({
      alpn: z.string().optional(),
      issuer: z.string().optional(),
      sni: z.string().optional(),
    })
    .optional(),
});
export const DnsHopSchema = z.object({ type: z.string(), data: z.string(), ttl: z.number().optional() });
export const DnsSchema = z.object({
  status: z.string(),
  chain: z.array(DnsHopSchema),
  elapsedMs: z.number(),
  queries: z
    .array(z.object({ type: z.string(), status: z.string(), elapsedMs: z.number(), answers: z.number() }))
    .optional(),
});

export const AnalyzeItemSchema = z.object({
  domain: z.string(),
  risk: z.enum(['low', 'medium', 'high']).optional(),
  https: HttpSchema.optional(),
  http: HttpSchema.optional(),
  dns: DnsSchema.optional(),
  riskScore: z.number().optional(),
  evidences: z
    .array(
      z.object({
        ruleId: z.string(),
        message: z.string(),
        severity: z.enum(['low', 'medium', 'high']),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
  candidates: z.array(z.string()).optional(),
  original: z.record(z.string(), z.unknown()).optional(),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional(),
});

export const AnalyzeArraySchema = z.array(AnalyzeItemSchema);

export type AnalyzeItem = z.infer<typeof AnalyzeItemSchema>;

export function validateAnalyzeArray(a: unknown): asserts a is AnalyzeItem[] {
  AnalyzeArraySchema.parse(a);
}
