import { Command } from 'commander';
import fs from 'node:fs';
import Table from 'cli-table3';
import type { AnalyzeResult } from '../types.js';

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
    .option('--show-tls', 'include TLS summary column (table/csv) and field (json)', false)
    .option('--show-evidence', 'include riskScore and rules summary (table/csv) and fields (json)', false)
    .option('--show-candidates', 'include SRV/derived candidates summary (table/csv) and field (json)', false)
    .option('--verbose', 'print distribution summary to stderr', false)
    .description('List records by minimum risk with optional sorting and output formats')
    .action(
      async (
        input: string,
        opts: {
          minRisk: Risk;
          sort?: string;
          desc?: boolean;
          format?: string;
          output?: string;
          showTls?: boolean;
          showEvidence?: boolean;
          showCandidates?: boolean;
          verbose?: boolean;
        }
      ) => {
        const raw = await fs.promises.readFile(input, 'utf8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) {
          throw new Error('input JSON must be an array');
        }
        const minRisk = (opts.minRisk || 'low') as Risk;
        const minRank = riskToRank(minRisk);
        let records = (data as AnalyzeResult[])
          .filter((r) => r.risk && ['low', 'medium', 'high'].includes(String(r.risk)))
          .filter((r) => riskToRank(r.risk as Risk) >= minRank);

        // sorting
        const key = String(opts.sort || 'risk');
        records = records.sort((a, b) => {
          if (key === 'risk') return riskToRank(b.risk as Risk) - riskToRank(a.risk as Risk);
          const da = String(a.domain || '');
          const db = String(b.domain || '');
          return da.localeCompare(db);
        });
        if (opts.desc) records.reverse();

        const rows = records.map((r) => {
          const tlsObj = r.https?.tls || null;
          const tlsStr = tlsObj ? `${tlsObj.alpn ?? ''}${tlsObj.issuer ? '/' + tlsObj.issuer : ''}` : '';
          const evidences = Array.isArray(r.evidences) ? r.evidences : [];
          const rules = evidences.map((e) => e.ruleId).join(',');
          const riskScore = r.riskScore;
          const candidates: string[] = Array.isArray(r.candidates) ? r.candidates : [];
          const candStr =
            candidates.length > 0 ? `${candidates[0]}${candidates.length > 1 ? ` (+${candidates.length - 1})` : ''}` : '';
          return {
            domain: String(r.domain ?? ''),
            risk: String(r.risk ?? ''),
            https: r.https?.status ?? '',
            http: r.http?.status ?? '',
            dns: r.dns?.status ?? '',
            skipped: r.skipped ? 'yes' : '',
            action: r.action ?? '',
            reason: r.reason ?? '',
            confidence: typeof r.confidence === 'number' ? r.confidence : '',
            ...(opts.showTls ? { tls: opts.format === 'json' ? tlsObj : tlsStr } : {}),
            ...(opts.showEvidence
              ? { riskScore: riskScore ?? '', rules: opts.format === 'json' ? evidences.map((e) => e.ruleId) : rules }
              : {}),
            ...(opts.showCandidates ? { candidates: opts.format === 'json' ? candidates : candStr } : {}),
          };
        });

        const fmt = String(opts.format || 'table').toLowerCase();
        if (opts.verbose) {
          const dist = rows.reduce<Record<string, number>>(
            (acc, r) => {
              acc[String(r.risk)] += 1;
              return acc;
            },
            { low: 0, medium: 0, high: 0 }
          );
          // eslint-disable-next-line no-console
          console.error(`[dist] low=${dist.low} medium=${dist.medium} high=${dist.high}`);
        }
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
          const csv = Papa.unparse(rows, { header: true });
          if (opts.output) {
            await fs.promises.writeFile(opts.output, csv, 'utf8');
            console.log(`wrote csv: ${opts.output}`);
          } else {
            process.stdout.write(csv + '\n');
          }
          console.error(`count=${rows.length}`);
          return;
        }

        const head = ['domain', 'risk', 'https', 'http', 'dns', 'skipped', 'action', 'reason', 'conf'] as string[];
        if (opts.showTls) head.splice(5, 0, 'tls');
        if (opts.showEvidence) head.push('score', 'rules');
        if (opts.showCandidates) head.push('candidates');
        const table = new Table({ head });
        for (const row of rows) {
          const line: string[] = [
            row.domain,
            colorRisk(row.risk),
            String(row.https),
            String(row.http),
            String(row.dns),
          ];
          if (opts.showTls) line.push(String((row as Record<string, unknown>).tls ?? ''));
          line.push(
            row.skipped,
            String(row.action || ''),
            String(row.reason || ''),
            String(row.confidence ?? '')
          );
          if (opts.showEvidence) {
            const rr = row as Record<string, unknown>;
            line.push(String(rr.riskScore ?? ''));
            line.push(String(rr.rules ?? ''));
          }
          if (opts.showCandidates) {
            line.push(String((row as Record<string, unknown>).candidates ?? ''));
          }
          table.push(line);
        }
        console.log(table.toString());
        console.log(`count=${rows.length}`);
      }
    );
}
