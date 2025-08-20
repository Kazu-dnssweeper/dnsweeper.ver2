import { Command } from 'commander';
import fs from 'node:fs';
import { writeJson } from '../../core/output/json.js';
import { writeCsv } from '../../core/output/csv.js';
import { writeXlsx } from '../../core/output/xlsx.js';
import logger from '../../core/logger.js';

type ExportOptions = {
  format: 'json' | 'csv' | 'xlsx';
  output: string;
  pretty?: boolean;
  verbose?: boolean;
};

export function registerExportCommand(program: Command) {
  program
    .command('export')
    .argument('<input>', 'input JSON file (array)')
    .requiredOption('-o, --output <file>', 'output file path')
    .option('-f, --format <fmt>', 'json|csv|xlsx', 'json')
    .option('--pretty', 'pretty JSON (when --format=json)', false)
    .option('--verbose', 'print perf stats to stderr', false)
    .description('Export records to JSON/CSV/XLSX')
    .action(async (input: string, opts: ExportOptions) => {
      try {
        const t0 = Date.now();
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
        if (opts.verbose) {
          const elapsed = Date.now() - t0;
          let size = 0;
          try { size = (await fs.promises.stat(opts.output)).size; } catch {}
          const mem = process.memoryUsage?.().rss ?? 0;
          const rps = records.length > 0 ? (records.length / (elapsed / 1000)) : 0;
          logger.error(
            `[perf] count=${records.length} elapsed_ms=${elapsed} out_bytes=${size} rss_mb=${(mem / (1024 * 1024)).toFixed(1)} rps=${rps.toFixed(1)}`
          );
        }
        logger.info(`wrote ${fmt}: ${opts.output}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(msg);
        process.exit(1);
      }
    });
}
