import { Command } from 'commander';
import fs from 'node:fs';
import Table from 'cli-table3';

function colorRisk(risk: string): string {
  if (risk === 'high') return `\x1b[31m${risk}\x1b[0m`;
  if (risk === 'medium') return `\x1b[33m${risk}\x1b[0m`;
  if (risk === 'low') return `\x1b[32m${risk}\x1b[0m`;
  return risk;
}

type Risk = 'low' | 'medium' | 'high';

function riskToRank(r: Risk): number {
  return r === 'low' ? 0 : r === 'medium' ? 1 : 2;
}

export function registerListCommand(program: Command) {
  program
    .command('list')
    .argument('<input>', 'input JSON file (array of records with risk)')
    .option('--min-risk <level>', 'low|medium|high', 'low')
    .option('--sort <key>', 'risk|domain', 'risk')
    .option('--desc', 'sort descending', false)
    .option('--format <fmt>', 'table|json|csv', 'table')
    .option('-o, --output <file>', 'output file for json/csv (stdout if omitted)')
    .description('List records by minimum risk with optional sorting and output formats')
    .action(async (input: string, opts: { minRisk: Risk; sort?: string; desc?: boolean; format?: string; output?: string }) => {
      const raw = await fs.promises.readFile(input, 'utf8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        throw new Error('input JSON must be an array');
      }
      const minRisk = (opts.minRisk || 'low') as Risk;
      const minRank = riskToRank(minRisk);
      let records = (data as Record<string, unknown>[]) 
        .filter((r) => ['low', 'medium', 'high'].includes(String((r as any).risk)))
        .filter((r) => riskToRank((r as any).risk as Risk) >= minRank);

      // sorting
      const key = String(opts.sort || 'risk');
      records = records.sort((a, b) => {
        if (key === 'risk') return riskToRank((b as any).risk) - riskToRank((a as any).risk);
        const da = String((a as any).domain || '');
        const db = String((b as any).domain || '');
        return da.localeCompare(db);
      });
      if (opts.desc) records.reverse();

      const rows = records.map((r) => ({
        domain: String((r as any).domain ?? ''),
        risk: String((r as any).risk ?? ''),
        https: (r as any).https?.status ?? '',
        http: (r as any).http?.status ?? '',
        dns: (r as any).dns?.status ?? '',
        skipped: (r as any).skipped ? 'yes' : '',
        action: (r as any).action ?? '',
        reason: (r as any).reason ?? '',
        confidence: typeof (r as any).confidence === 'number' ? (r as any).confidence : '',
      }));

      const fmt = String(opts.format || 'table').toLowerCase();
      if (fmt === 'json') {
        const json = JSON.stringify(rows, null, 2);
        if (opts.output) {
          await fs.promises.writeFile(opts.output, json, 'utf8');
          console.log(`wrote json: ${opts.output}`);
        } else {
          console.log(json);
        }
        console.error(`count=${rows.length}`);
        return;
      }
      if (fmt === 'csv') {
        const { default: Papa } = await import('papaparse');
        const csv = (Papa as any).unparse(rows, { header: true });
        if (opts.output) {
          await fs.promises.writeFile(opts.output, csv, 'utf8');
          console.log(`wrote csv: ${opts.output}`);
        } else {
          process.stdout.write(csv + '\n');
        }
        console.error(`count=${rows.length}`);
        return;
      }

      const table = new Table({ head: ['domain', 'risk', 'https', 'http', 'dns', 'skipped', 'action', 'reason', 'conf'] });
      for (const row of rows) {
        table.push([
          row.domain,
          colorRisk(row.risk),
          String(row.https),
          String(row.http),
          String(row.dns),
          row.skipped,
          String(row.action || ''),
          String(row.reason || ''),
          String(row.confidence ?? ''),
        ]);
      }
      console.log(table.toString());
      console.log(`count=${rows.length}`);
    });
}
