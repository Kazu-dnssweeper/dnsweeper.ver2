import { Command } from 'commander';
import fs from 'node:fs';
import Papa from 'papaparse';
import { detectEncoding } from '../../core/parsers/detect.js';
import { detectProviderFromHeader, Provider } from '../../core/parsers/provider-detect.js';
import { validateHeaders } from '../../core/parsers/spec.js';
import { normalizeCloudflare } from '../../core/parsers/cloudflare.js';
import { normalizeRoute53 } from '../../core/parsers/route53.js';
import { normalizeGeneric } from '../../core/parsers/generic.js';
import { writeErrorsCsv, RowError } from '../../core/parsers/errors.js';
import { CsvRecord } from '../../types.js';
import { loadConfig } from '../../core/config/schema.js';

type ImportOptions = {
  output?: string;
  pretty?: boolean;
  provider?: Provider;
  encoding?: string;
  errors?: string;
};

export function registerImportCommand(program: Command) {
  program
    .command('import')
    .argument('<file>', 'input CSV file')
    .option('-o, --output <file>', 'output JSON file (writes array)')
    .option('--pretty', 'pretty-print JSON', false)
    .option('-p, --provider <name>', 'cloudflare|route53|generic (auto if omitted)')
    .option('-e, --encoding <enc>', 'input encoding (auto if omitted)')
    .option('--errors <file>', 'write failed rows to CSV', 'errors.csv')
    .description('Import CSV and normalize to JSON')
    .action(async (file: string, opts: ImportOptions) => {
      try {
        const enc = opts.encoding || (await detectEncoding(file));
        const fileStream = fs.createReadStream(file, { encoding: enc.startsWith('utf8') ? 'utf8' : 'utf8' });
        const rows: Record<string, unknown>[] = [];
        let headerCaptured: string[] | null = null;

        const papaStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
          header: true,
          skipEmptyLines: true,
        });

        papaStream.on('data', (row: unknown) => {
          const r = row as Record<string, unknown>;
          if (!headerCaptured) headerCaptured = Object.keys(r);
          rows.push(r);
        });

        await new Promise<void>((resolve, reject) => {
          fileStream.on('error', reject);
          papaStream.on('error', reject);
          papaStream.on('finish', () => resolve());
          fileStream.pipe(papaStream);
        });

        const cfg = await loadConfig().catch(() => null);
        const provider: Provider = opts.provider || detectProviderFromHeader(headerCaptured || []);
        // Header validation
        const headers: string[] = headerCaptured || [];
        const headerCheck = validateHeaders(provider, headers);
        if (!headerCheck.ok) {
          // Push all rows to errors with reason and abort normalization to avoid misleading output
          const reason = `invalid header: missing [${headerCheck.missing.join(', ')}]`;
          await writeErrorsCsv(
            rows.map((r) => ({ error: reason, row: r })),
            opts.errors || 'errors.csv'
          );
          console.error(`header validation failed for provider=${provider}: ${reason}`);
          process.exit(1);
        }
        // Unknown headers warning (not required/optional)
        try {
          const { HEADER_SPECS } = await import('../../core/parsers/spec.js') as typeof import('../../core/parsers/spec.js');
          const spec = HEADER_SPECS[provider];
          const allowed = new Set<string>([...spec.required, ...spec.optional, ...Object.keys(spec.aliases || {})]);
          const unknown = headers
            .map((h) => h.toLowerCase().trim())
            .filter((h) => !allowed.has(h));
          const uniq = Array.from(new Set(unknown));
          if (uniq.length) {
            // eslint-disable-next-line no-console
            console.warn(`[warn] unknown headers ignored: ${uniq.join(', ')}`);
          }
        } catch {}

        const out: CsvRecord[] = [];
        const errors: RowError[] = [];
        let success = 0;

        for (const r of rows) {
          try {
            let rec: CsvRecord;
            switch (provider) {
              case 'cloudflare':
                rec = normalizeCloudflare(r);
                break;
              case 'route53':
                rec = normalizeRoute53(r);
                break;
              default:
                rec = normalizeGeneric(r);
                break;
            }
            if (cfg?.defaultTtl && (rec.ttl === undefined || rec.ttl === null)) {
              rec.ttl = cfg.defaultTtl;
            }
            out.push(rec);
            success += 1;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push({ error: msg, row: r });
          }
        }

        if (opts.errors && errors.length) {
          await writeErrorsCsv(errors, opts.errors);
          // eslint-disable-next-line no-console
          console.error(`errors.csv: wrote ${errors.length} failed rows -> ${opts.errors}`);
        }

        const space = opts.pretty ? 2 : 0;
        const json = JSON.stringify(out, null, space);
        if (opts.output) {
          await fs.promises.writeFile(opts.output, json, { encoding: 'utf8' });
          // eslint-disable-next-line no-console
          console.log(`wrote JSON: ${opts.output}`);
        } else {
          // eslint-disable-next-line no-console
          console.log(json);
        }
        // eslint-disable-next-line no-console
        console.error(`[import] provider=${provider} ok=${success} errors=${errors.length}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.error(msg);
        process.exit(1);
      }
    });
}
