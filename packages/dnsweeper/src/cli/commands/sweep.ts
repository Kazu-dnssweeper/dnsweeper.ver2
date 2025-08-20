import { Command, InvalidOptionArgumentError } from 'commander';
import fs from 'node:fs';

type PlanItem = {
  domain: string;
  type?: string;
  action: 'review' | 'delete';
  reason?: string;
  confidence?: number;
  risk?: 'low' | 'medium' | 'high';
};

export function registerSweepCommand(program: Command) {
  const cmd = program.command('sweep').description('Sweeping helpers');

  const intRange = (name: string, min: number, max: number) => (v: string) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new InvalidOptionArgumentError(`${name} must be an integer ${min}-${max}`);
    }
    return n;
  };
  const floatRange = (name: string, min: number, max: number) => (v: string) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      throw new InvalidOptionArgumentError(`${name} must be between ${min} and ${max}`);
    }
    return n;
  };

  cmd
    .command('plan')
    .argument('<input>', 'analyzed JSON (array)')
    .option('-o, --output <file>', 'output plan file (json/jsonl/csv)', 'sweep-plan.json')
    .option('--min-confidence <n>', 'min confidence (0-1)', floatRange('min-confidence', 0, 1), 0.7)
    .option('--actions <list>', 'actions to include (comma-separated)', 'review,delete')
    .option('--domain-include <regex>', 'only include domains matching regex')
    .option('--domain-exclude <regex>', 'exclude domains matching regex')
    .option('--min-risk <level>', 'min risk level: low|medium|high')
    .option('--max-items <n>', 'limit number of items (0-1000000)', intRange('max-items', 0, 1_000_000), 0)
    .option('--sort <key>', 'sort by: confidence|domain', 'confidence')
    .option('--format <fmt>', 'json|jsonl|csv', 'json')
    .description('Generate sweep plan (review/delete) from analyzed results')
    .action(async (
      input: string,
      opts: {
        output: string;
        minConfidence: number;
        actions?: string;
        domainInclude?: string;
        domainExclude?: string;
        minRisk?: 'low' | 'medium' | 'high';
        maxItems?: number;
        sort?: string;
        format?: string;
      }
    ) => {
      try {
        const raw = await fs.promises.readFile(input, 'utf8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) throw new Error('input must be an array');
        const plan: (PlanItem & { code?: string })[] = [];
        const actSet = new Set(
          String(opts.actions || 'review,delete')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        );
        const incRe = opts.domainInclude ? new RegExp(String(opts.domainInclude)) : null;
        const excRe = opts.domainExclude ? new RegExp(String(opts.domainExclude)) : null;
        const rank = (x: string) => (x === 'low' ? 0 : x === 'medium' ? 1 : 2);
        for (const r of data as any[]) {
          const action = String(r.action || 'keep');
          const conf = typeof r.confidence === 'number' ? r.confidence : 0;
          const domain = String(r.domain || '');
          const risk = (['low', 'medium', 'high'] as const).includes(r.risk) ? (r.risk as 'low' | 'medium' | 'high') : undefined;
          if (!actSet.has(action)) continue;
          if (conf < (opts.minConfidence ?? 0.7)) continue;
          if (incRe && !incRe.test(domain)) continue;
          if (excRe && excRe.test(domain)) continue;
          if (opts.minRisk && risk && rank(risk) < rank(opts.minRisk)) continue;

          plan.push({
            domain,
            type: String(r.original?.type || ''),
            action: action as PlanItem['action'],
            reason: String(r.reason || ''),
            confidence: conf,
            code: String((r as any).reasonCode || ''),
            risk,
          });
        }
        // sort
        const sortKey = String(opts.sort || 'confidence').toLowerCase();
        if (sortKey === 'confidence') plan.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        else if (sortKey === 'domain') plan.sort((a, b) => a.domain.localeCompare(b.domain));
        // limit
        const max = Math.max(0, opts.maxItems || 0);
        const sliced = max > 0 ? plan.slice(0, max) : plan;

        const fmt = String((opts as any).format || 'json').toLowerCase();
        if (fmt === 'jsonl') {
          const lines = sliced.map((p) => JSON.stringify(p)).join('\n') + '\n';
          await fs.promises.writeFile(opts.output, lines, 'utf8');
        } else if (fmt === 'csv') {
          const { default: Papa } = await import('papaparse');
          const csv = (Papa as any).unparse(sliced, { header: true });
          await fs.promises.writeFile(opts.output, csv + '\n', 'utf8');
        } else {
          await fs.promises.writeFile(opts.output, JSON.stringify(sliced, null, 2), 'utf8');
        }
        console.log(`wrote plan: ${opts.output} (items=${sliced.length}, format=${fmt})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(msg);
        process.exit(1);
      }
    });
}
