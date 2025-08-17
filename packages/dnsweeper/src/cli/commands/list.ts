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
    .description('List records by minimum risk with optional sorting')
    .action(async (input: string, opts: { minRisk: Risk; sort?: string; desc?: boolean }) => {
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

      const table = new Table({ head: ['domain', 'risk', 'https', 'http', 'dns', 'skipped'] });
      for (const r of records) {
        const risk = String((r as any).risk ?? '');
        const https = (r as any).https?.status ?? '';
        const http = (r as any).http?.status ?? '';
        const dns = (r as any).dns?.status ?? '';
        const skipped = (r as any).skipped ? 'yes' : '';
        table.push([
          String((r as any).domain ?? ''),
          colorRisk(risk),
          String(https),
          String(http),
          String(dns),
          skipped,
        ]);
      }
      // eslint-disable-next-line no-console
      console.log(table.toString());
      // eslint-disable-next-line no-console
      console.log(`count=${records.length}`);
    });
}
