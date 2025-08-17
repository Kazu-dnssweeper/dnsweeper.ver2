import { Command } from 'commander';
import fs from 'node:fs';
import Table from 'cli-table3';

type Risk = 'low' | 'medium' | 'high';

function riskToRank(r: Risk): number {
  return r === 'low' ? 0 : r === 'medium' ? 1 : 2;
}

export function registerListCommand(program: Command) {
  program
    .command('list')
    .argument('<input>', 'input JSON file (array of records with risk)')
    .option('--min-risk <level>', 'low|medium|high', 'low')
    .description('List records by minimum risk')
    .action(async (input: string, opts: { minRisk: Risk }) => {
      const raw = await fs.promises.readFile(input, 'utf8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        throw new Error('input JSON must be an array');
      }
      const minRisk = (opts.minRisk || 'low') as Risk;
      const minRank = riskToRank(minRisk);
      const records = (data as Record<string, unknown>[]) 
        .filter((r) => ['low', 'medium', 'high'].includes(String((r as any).risk)))
        .filter((r) => riskToRank((r as any).risk as Risk) >= minRank);

      const table = new Table({ head: ['domain', 'risk'] });
      for (const r of records) {
        table.push([String((r as any).domain ?? ''), String((r as any).risk ?? '')]);
      }
      // eslint-disable-next-line no-console
      console.log(table.toString());
      // eslint-disable-next-line no-console
      console.log(`count=${records.length}`);
    });
}
