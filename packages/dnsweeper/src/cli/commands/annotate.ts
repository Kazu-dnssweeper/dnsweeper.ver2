import { Command } from 'commander';
import fs from 'node:fs';

interface AnnotatedRecord {
  domain?: string;
  note?: string;
  labels?: string[];
  marks?: Record<string, string>;
  [key: string]: unknown;
}

type AnnotateOptions = {
  output?: string;
  contains?: string;
  regex?: string;
  note?: string;
  label?: string[];
  mark?: string[];
  pretty?: boolean;
};

function matchDomain(rec: AnnotatedRecord, contains?: string, regex?: RegExp): boolean {
  const domain = String(rec.domain ?? '');
  if (!domain) return false;
  if (contains && domain.includes(contains)) return true;
  if (regex && regex.test(domain)) return true;
  return !contains && !regex ? true : false;
}

function addLabels(arr: unknown, labels: string[]): string[] {
  const set = new Set<string>();
  if (Array.isArray(arr)) {
    for (const v of arr) if (typeof v === 'string') set.add(v);
  }
  for (const l of labels) set.add(l);
  return Array.from(set.values());
}

export function registerAnnotateCommand(program: Command) {
  program
    .command('annotate')
    .argument('<input>', 'input JSON array file')
    .option('-o, --output <file>', 'output JSON file (writes array)')
    .option('--contains <text>', 'match domain containing text')
    .option('--regex <pattern>', 'match domain by JS RegExp (without flags)')
    .option('--note <text>', 'set or append note')
    .option('--label <name...>', 'add label(s)')
    .option('--mark <k:v...>', 'add or update mark(s), e.g., keep:prod owner:web')
    .option('--pretty', 'pretty-print JSON', false)
    .description('Annotate JSON records with notes/labels by domain filter')
    .action(async (input: string, opts: AnnotateOptions) => {
      try {
        const raw = await fs.promises.readFile(input, 'utf8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) throw new Error('input JSON must be an array');

        const re = opts.regex ? new RegExp(opts.regex) : undefined;
        const labels = opts.label || [];
        const marks: Record<string, string> = {};
        for (const m of opts.mark || []) {
          const [k, v] = String(m).split(':');
          if (k && typeof v !== 'undefined') marks[k] = v;
        }
        let matched = 0;

        const out = (data as AnnotatedRecord[]).map((r) => {
          if (matchDomain(r, opts.contains, re)) {
            matched += 1;
            const next: AnnotatedRecord = { ...r };
            if (opts.note) {
              const prev = String(next.note ?? '').trim();
              next.note = prev ? `${prev}; ${opts.note}` : opts.note;
            }
            if (labels.length) {
              next.labels = addLabels(next.labels, labels);
            }
            if (Object.keys(marks).length) {
              const prev = next.marks || {};
              next.marks = { ...prev, ...marks };
            }
            return next;
          }
          return r;
        });

        const space = opts.pretty ? 2 : 0;
        const json = JSON.stringify(out, null, space);
        if (opts.output) {
          await fs.promises.writeFile(opts.output, json, 'utf8');
          // eslint-disable-next-line no-console
          console.log(`annotated=${matched}, wrote: ${opts.output}`);
        } else {
          // eslint-disable-next-line no-console
          console.log(json);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.error(msg);
        process.exit(1);
      }
    });
}
