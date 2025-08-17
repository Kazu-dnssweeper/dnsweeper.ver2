import { z } from 'zod';

export const HttpSchema = z.object({ ok: z.boolean(), status: z.number().optional() });
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
  original: z.record(z.unknown()).optional(),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional(),
});

export const AnalyzeArraySchema = z.array(AnalyzeItemSchema);

export type AnalyzeItem = z.infer<typeof AnalyzeItemSchema>;

export function validateAnalyzeArray(a: unknown): asserts a is AnalyzeItem[] {
  AnalyzeArraySchema.parse(a);
}

