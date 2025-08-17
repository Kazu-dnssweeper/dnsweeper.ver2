import fs from 'node:fs';
import Papa from 'papaparse';

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = '';
    } else if (typeof v === 'object') {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function writeCsv(records: Record<string, unknown>[], file: string) {
  const rows = records.map(normalizeRow);
  const csv = (Papa as unknown as { unparse: (r: unknown, cfg?: unknown) => string }).unparse(
    rows,
    { header: true }
  );
  await fs.promises.writeFile(file, csv, 'utf8');
}
