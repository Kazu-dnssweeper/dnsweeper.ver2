import Table from 'cli-table3';

export type ColumnSpec<T extends Record<string, unknown>> = {
  header: string;
  key: keyof T | string;
  width?: number;
  map?: (value: unknown, row: T) => string | number;
};

export function renderTable<T extends Record<string, unknown>>(
  rows: T[],
  columns: ColumnSpec<T>[]
): string {
  const head = columns.map((c) => c.header);
  const colWidths = columns.map((c) => c.width).filter((w): w is number => typeof w === 'number');
  const table = new Table({ head, colWidths: colWidths.length ? colWidths : undefined });
  for (const r of rows) {
    const line = columns.map((c) => {
      const v = (r as any)[c.key as string];
      const out = c.map ? c.map(v, r) : v;
      if (out === null || out === undefined) return '';
      if (typeof out === 'object') return JSON.stringify(out);
      return String(out);
    });
    table.push(line);
  }
  return table.toString();
}

