import { Command } from 'commander';
import fs from 'node:fs';
import { writeJson } from '../../core/output/json.js';
import { writeCsv } from '../../core/output/csv.js';
import { writeXlsx } from '../../core/output/xlsx.js';

type ExportOptions = {
  format: 'json' | 'csv' | 'xlsx';
  output: string;
  pretty?: boolean;
};

export function registerExportCommand(program: Command) {
  program
    .command('export')
    .argument('<input>', 'input JSON file (array)')
    .requiredOption('-o, --output <file>', 'output file path')
    .option('-f, --format <fmt>', 'json|csv|xlsx', 'json')
    .option('--pretty', 'pretty JSON (when --format=json)', false)
    .description('Export records to JSON/CSV/XLSX')
    .action(async (input: string, opts: ExportOptions) => {
      try {
        const raw = await fs.promises.readFile(input, 'utf8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) {
          throw new Error('input JSON must be an array');
        }
        const records = data as Record<string, unknown>[];

        const fmt = (opts.format || 'json').toLowerCase();
        if (fmt === 'json') {
          await writeJson(records, opts.output, !!opts.pretty);
        } else if (fmt === 'csv') {
          await writeCsv(records, opts.output);
        } else if (fmt === 'xlsx') {
          await writeXlsx(records, opts.output);
        } else {
          throw new Error(`unsupported format: ${opts.format}`);
        }
        // eslint-disable-next-line no-console
        console.log(`wrote ${fmt}: ${opts.output}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.error(msg);
        process.exit(1);
      }
    });
}
