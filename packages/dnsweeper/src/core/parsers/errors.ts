import fs from 'node:fs';
import Papa from 'papaparse';

export type RowError = { error: string; row: Record<string, unknown> };

export async function writeErrorsCsv(errors: RowError[], file: string) {
  if (!errors.length) return;
  const rows = errors.map((e) => ({ ...e.row, error: e.error }));
  const csv = (Papa as unknown as { unparse: (r: unknown, cfg?: unknown) => string }).unparse(rows, {
    header: true,
  });
  await fs.promises.writeFile(file, csv, 'utf8');
}

