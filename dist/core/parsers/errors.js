import fs from 'node:fs';
import Papa from 'papaparse';
export async function writeErrorsCsv(errors, file) {
    if (!errors.length)
        return;
    const rows = errors.map((e) => ({ ...e.row, error: e.error }));
    const csv = Papa.unparse(rows, {
        header: true,
    });
    await fs.promises.writeFile(file, csv, 'utf8');
}
//# sourceMappingURL=errors.js.map