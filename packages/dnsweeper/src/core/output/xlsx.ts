import ExcelJS from 'exceljs';

function collectColumns(records: Record<string, unknown>[]): string[] {
  const set = new Set<string>();
  for (const r of records) {
    for (const k of Object.keys(r)) set.add(k);
  }
  return Array.from(set.values());
}

function normalizeCell(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v as string | number | boolean;
}

export async function writeXlsx(records: Record<string, unknown>[], file: string) {
  const wb = new ExcelJS.Workbook();

  const hasRisk = records.some((r) => Object.prototype.hasOwnProperty.call(r, 'risk'));
  if (hasRisk) {
    // Summary sheet
    const wsSummary = wb.addWorksheet('Summary');
    const counts = { low: 0, medium: 0, high: 0 };
    for (const r of records) {
      const risk = typeof r['risk'] === 'string' ? r['risk'] : String(r['risk'] || '');
      if (risk === 'low') counts.low += 1;
      else if (risk === 'medium') counts.medium += 1;
      else if (risk === 'high') counts.high += 1;
    }
    wsSummary.columns = [
      { header: 'risk', key: 'risk' },
      { header: 'count', key: 'count' },
    ];
    wsSummary.addRow({ risk: 'low', count: counts.low });
    wsSummary.addRow({ risk: 'medium', count: counts.medium });
    wsSummary.addRow({ risk: 'high', count: counts.high });

    // High sheet
    const highs = records.filter((r) => String(r['risk']) === 'high');
    const colsHigh = collectColumns(highs);
    const wsHigh = wb.addWorksheet('High');
    wsHigh.columns = colsHigh.map((k) => ({ header: k, key: k }));
    for (const r of highs) {
      const row: Record<string, unknown> = {};
      for (const c of colsHigh) row[c] = normalizeCell(r[c]);
      wsHigh.addRow(row);
    }

    // All sheet
    const colsAll = collectColumns(records);
    const wsAll = wb.addWorksheet('All');
    wsAll.columns = colsAll.map((k) => ({ header: k, key: k }));
    for (const r of records) {
      const row: Record<string, unknown> = {};
      for (const c of colsAll) row[c] = normalizeCell(r[c]);
      wsAll.addRow(row);
    }
  } else {
    // Backward compatible single-sheet export
    const ws = wb.addWorksheet('Export');
    const columns = collectColumns(records);
    ws.columns = columns.map((k) => ({ header: k, key: k }));
    for (const r of records) {
      const row: Record<string, unknown> = {};
      for (const c of columns) row[c] = normalizeCell(r[c]);
      ws.addRow(row);
    }
  }

  await wb.xlsx.writeFile(file);
}
