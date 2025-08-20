import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const ConfigSchema = z
  .object({
    defaultTtl: z.number().int().positive().optional(),
    risk: z
      .object({
        lowTtlSec: z.number().int().positive().optional(),
        servfailMinAttempts: z.number().int().nonnegative().optional(),
        nxdomainSubMin: z.number().int().nonnegative().optional(),
        nxdomainSubMax: z.number().int().nonnegative().optional(),
        rules: z
          .object({
            weights: z.record(z.string(), z.number()).optional(),
            disabled: z.array(z.string()).optional(),
          })
          .optional(),
      })
      .optional(),
    analyze: z
      .object({
        qps: z.number().int().nonnegative().optional(),
        concurrency: z.number().int().positive().optional(),
        timeoutMs: z.number().int().positive().optional(),
        progressIntervalMs: z.number().int().positive().optional(),
        qpsBurst: z.number().int().nonnegative().optional(),
        dohEndpoint: z.string().optional(),
      })
      .optional(),
    annotate: z
      .object({
        defaultLabels: z.array(z.string()).optional(),
      })
      .optional(),
    audit: z
      .object({
        buffer: z
          .object({
            enabled: z.boolean().optional(),
            maxEntries: z.number().int().positive().optional(),
            flushIntervalMs: z.number().int().positive().optional(),
          })
          .optional(),
      })
      .optional(),
    cache: z
      .object({
        dohPersist: z
          .object({
            enabled: z.boolean().optional(),
            path: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    telemetry: z
      .object({
        enabled: z.boolean().optional(),
        endpoint: z.string().url().optional(),
      })
      .optional(),
  })
  .strict();

export type AppConfig = z.infer<typeof ConfigSchema>;

const candidates = ['dnsweeper.config.json'];

export async function loadConfig(cwd = process.cwd()): Promise<AppConfig | null> {
  for (const f of candidates) {
    const p = path.join(cwd, f);
    try {
      const raw = await fs.promises.readFile(p, 'utf8');
      const json = JSON.parse(raw);
      return ConfigSchema.parse(json);
    } catch {
    }
  }
  return null;
}
