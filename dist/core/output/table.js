import Table from 'cli-table3';
export function renderTable(rows, columns) {
    const head = columns.map((c) => c.header);
    const colWidths = columns.map((c) => c.width).filter((w) => typeof w === 'number');
    const table = new Table({ head, colWidths: colWidths.length ? colWidths : undefined });
    for (const r of rows) {
        const line = columns.map((c) => {
            const v = r[c.key];
            const out = c.map ? c.map(v, r) : v;
            if (out === null || out === undefined)
                return '';
            if (typeof out === 'object')
                return JSON.stringify(out);
            return String(out);
        });
        table.push(line);
    }
    return table.toString();
}
//# sourceMappingURL=table.js.map