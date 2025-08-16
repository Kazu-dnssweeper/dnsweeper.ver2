import fs from 'node:fs';
import Papa from 'papaparse';
export function registerImportCommand(program) {
    program
        .command('import')
        .argument('<file>', 'input CSV file')
        .option('-o, --output <file>', 'output JSON file (writes array)')
        .option('--pretty', 'pretty-print JSON', false)
        .description('Import CSV and normalize to JSON')
        .action(async (file, opts) => {
        try {
            const fileStream = fs.createReadStream(file, { encoding: 'utf8' });
            const records = [];
            const papaStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
                header: true,
                skipEmptyLines: true,
            });
            papaStream.on('data', (row) => {
                records.push(row);
            });
            await new Promise((resolve, reject) => {
                fileStream.on('error', reject);
                papaStream.on('error', reject);
                papaStream.on('finish', () => resolve());
                fileStream.pipe(papaStream);
            });
            const space = opts.pretty ? 2 : 0;
            const json = JSON.stringify(records, null, space);
            if (opts.output) {
                await fs.promises.writeFile(opts.output, json, { encoding: 'utf8' });
                // eslint-disable-next-line no-console
                console.log(`wrote JSON: ${opts.output}`);
            }
            else {
                // eslint-disable-next-line no-console
                console.log(json);
            }
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            // eslint-disable-next-line no-console
            console.error(msg);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=import.js.map