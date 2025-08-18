import { Command } from 'commander';
import fs from 'node:fs';

type JobsStartOptions = {
  snapshot?: string;
};

export function registerJobsCommand(program: Command) {
  const cmd = program.command('jobs').description('Jobs management (start/status/cancel)');

  cmd
    .command('status')
    .requiredOption('--snapshot <file>', 'snapshot file path')
    .description('Show progress from a snapshot (processed/total/ts)')
    .action(async (opts: { snapshot: string }) => {
      try {
        const raw = await fs.promises.readFile(opts.snapshot, 'utf8');
        const snap = JSON.parse(raw);
        const meta = snap?.meta || {};
        const total = Number(meta.total || 0);
        const processed = Number(meta.processed || (Array.isArray(snap?.results) ? snap.results.length : 0));
        const ts = meta.ts || '';
        const ruleset = meta.ruleset || {};
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            { processed, total, ts, ruleset, percent: total > 0 ? Math.round((processed / total) * 100) : null },
            null,
            2
          )
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[error] failed to read snapshot:', String(e));
        process.exit(1);
      }
    });

  cmd
    .command('start')
    .argument('<input>', 'input CSV/JSON path')
    .option('--snapshot <file>', 'snapshot file path', '.tmp/snapshot.json')
    .description('Print recommended analyze command line with snapshot/resume')
    .action(async (input: string, opts: JobsStartOptions) => {
      const snap = opts.snapshot || '.tmp/snapshot.json';
      const cmd = `dnsweeper analyze ${input} --http-check --doh --snapshot ${snap} --resume --summary --output out.json`;
      // eslint-disable-next-line no-console
      console.log(cmd);
    });

  cmd
    .command('cancel')
    .option('--flag <file>', 'flag file path', '.tmp/job.cancel')
    .description('Create a cancel flag file (cooperative)')
    .action(async (opts: { flag?: string }) => {
      const flag = opts.flag || '.tmp/job.cancel';
      try {
        await fs.promises.mkdir(require('node:path').dirname(flag), { recursive: true });
        await fs.promises.writeFile(flag, String(Date.now()), 'utf8');
        // eslint-disable-next-line no-console
        console.log(`wrote cancel flag: ${flag}`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[error] failed to write flag:', String(e));
        process.exit(1);
      }
    });
}

