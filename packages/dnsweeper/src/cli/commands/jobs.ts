import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';

type JobsStartOptions = {
  snapshot?: string;
};

export function registerJobsCommand(program: Command) {
  const cmd = program.command('jobs').description('Jobs management (start/status/aggregate/cancel)');

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
        const canceled = !!meta.canceled;
        const ruleset = meta.ruleset || {};
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            { processed, total, ts, canceled, ruleset, percent: total > 0 ? Math.round((processed / total) * 100) : null },
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
    .command('aggregate')
    .requiredOption('--dir <dir>', 'directory containing snapshot JSON files')
    .description('Aggregate progress across multiple snapshots in a directory')
    .action(async (opts: { dir: string }) => {
      try {
        const dir = opts.dir;
        const names = await fs.promises.readdir(dir);
        let total = 0;
        let processed = 0;
        const errors: Record<string, number> = {};
        let files = 0;
        let canceled = 0;
        for (const name of names) {
          if (!name.endsWith('.json')) continue;
          const p = path.join(dir, name);
          try {
            const raw = await fs.promises.readFile(p, 'utf8');
            const snap = JSON.parse(raw);
            const meta = snap?.meta || {};
            total += Number(meta.total || 0);
            processed += Number(meta.processed || (Array.isArray(snap?.results) ? snap.results.length : 0));
            if (meta?.httpErrors && typeof meta.httpErrors === 'object') {
              for (const [k, v] of Object.entries(meta.httpErrors)) {
                errors[k] = (errors[k] || 0) + (v as number);
              }
            }
            if (meta?.canceled) canceled += 1;
            files += 1;
          } catch {
          }
        }
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ files, processed, total, percent: total > 0 ? Math.round((processed / total) * 100) : null, canceled, errors }, null, 2));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[error] aggregate failed:', String(e));
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
        await fs.promises.mkdir(path.dirname(flag), { recursive: true });
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

