import fs from 'node:fs';
import Papa from 'papaparse';
function normalizeRow(row) {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
        if (v === null || v === undefined) {
            out[k] = '';
        }
        else if (typeof v === 'object') {
            out[k] = JSON.stringify(v);
        }
        else {
            out[k] = v;
        }
    }
    return out;
}
export async function writeCsv(records, file) {
    const rows = records.map(normalizeRow);
    const csv = Papa.unparse(rows, { header: true });
    await fs.promises.writeFile(file, csv, 'utf8');
}
//# sourceMappingURL=csv.js.map