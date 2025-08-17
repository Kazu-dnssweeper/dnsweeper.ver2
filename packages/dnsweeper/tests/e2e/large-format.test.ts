import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function run(cmd: string, cwd?: string) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', cwd });
}

function makeJson(n: number, dir: string) {
  const arr = Array.from({ length: n }).map((_, i) => ({
    domain: `host${i}.example.com`,
    risk: i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low',
    https: { ok: i % 2 === 0, status: i % 2 === 0 ? 200 : 500 },
    http: { ok: i % 3 === 0, status: i % 3 === 0 ? 200 : 404 },
  }));
  const file = path.join(dir, `large-${n}.json`);
  fs.writeFileSync(file, JSON.stringify(arr), 'utf8');
  return file;
}

describe('E2E: large format export (size-gated)', () => {
  const repo = process.cwd();
  const distCli = path.join(repo, 'dist/cli/index.js');
  const tmp = path.join(repo, '.tmp', 'e2e-large');
  fs.mkdirSync(tmp, { recursive: true });

  it('exports 100 records to CSV/XLSX', () => {
    // Ensure build exists
    run('pnpm -C packages/dnsweeper run build', repo);
    const json = makeJson(100, tmp);
    const outCsv = path.join(tmp, 'large-100.csv');
    const outXlsx = path.join(tmp, 'large-100.xlsx');
    run(`node ${distCli} export ${json} --format csv --output ${outCsv}`, repo);
    run(`node ${distCli} export ${json} --format xlsx --output ${outXlsx}`, repo);
    expect(fs.existsSync(outCsv)).toBe(true);
    expect(fs.existsSync(outXlsx)).toBe(true);
  });

  it('optionally validates 10k and 100k sized JSON when LARGE_E2E=1', () => {
    if (!process.env.LARGE_E2E) return;
    const sizes = [10_000, 100_000];
    for (const n of sizes) {
      const json = makeJson(n, tmp);
      const outCsv = path.join(tmp, `large-${n}.csv`);
      run(`node ${distCli} export ${json} --format csv --output ${outCsv}`, repo);
      expect(fs.existsSync(outCsv)).toBe(true);
      const head = fs.readFileSync(outCsv, 'utf8').split(/\r?\n/)[0];
      expect(head).toMatch(/domain/i);
    }
  });
});
