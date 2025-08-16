import { Command } from 'commander';
import fs from 'node:fs';
import Papa from 'papaparse';

export function registerAnalyzeCommand(program: Command) {
  program
    .command('analyze')
    .argument('<input>', 'input CSV/JSON path')
    .option('--http-check', 'enable HTTP probing (stub)')
    .description('Analyze CSV and print data row count (header excluded)')
    .action(async (input: string) => {
      try {
        const fileStream = fs.createReadStream(input, { encoding: 'utf8' });
        let rows = 0;

        const papaStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
          header: true,
          skipEmptyLines: true,
        }) as unknown as NodeJS.ReadWriteStream;

        papaStream.on('data', () => {
          rows += 1;
        });

        await new Promise<void>((resolve, reject) => {
          fileStream.on('error', reject);
          papaStream.on('error', reject);
          papaStream.on('finish', () => resolve());
          fileStream.pipe(papaStream);
        });

        // eslint-disable-next-line no-console
        console.log(`rows=${rows}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.error(msg);
        process.exit(1);
      }
    });
}
