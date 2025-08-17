import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function run(cmd: string, opts: { cwd?: string } = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', cwd: opts.cwd });
}

describe('E2E: CSV -> analyze -> export', () => {
  const repo = process.cwd();
  const distCli = path.join(repo, 'dist/cli/index.js');
  const tmp = path.join(repo, '.tmp', 'e2e');

  it('builds CLI, analyzes rows, imports normalized JSON, and exports CSV/XLSX', () => {
    fs.mkdirSync(tmp, { recursive: true });
    // Build first to ensure dist exists
    run('pnpm run -s build', { cwd: repo });

    // Analyze sample without network features; assert rows=2 in stdout
    const outAnalyze = run(`node ${distCli} analyze sample.csv`);
    expect(outAnalyze).toContain('rows=2');

    // Import normalized from fixture and write JSON
    const outJson = path.join(tmp, 'out.json');
    run(`node ${distCli} import tests/fixtures/generic-small.csv --pretty --output ${outJson}`);
    const parsed = JSON.parse(fs.readFileSync(outJson, 'utf8')) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect((parsed[0] as any).name).toBeTruthy();

    // Export to CSV and XLSX
    const outCsv = path.join(tmp, 'out.csv');
    const outXlsx = path.join(tmp, 'out.xlsx');
    run(`node ${distCli} export ${outJson} --format csv --output ${outCsv}`);
    run(`node ${distCli} export ${outJson} --format xlsx --output ${outXlsx}`);
    expect(fs.existsSync(outCsv)).toBe(true);
    expect(fs.existsSync(outXlsx)).toBe(true);
    const head = fs.readFileSync(outCsv, 'utf8').split(/\r?\n/)[0];
    expect(head.toLowerCase()).toContain('name');

    // Audit log got at least appended (fallback path in sandbox)
    const auditFallback = path.join(repo, '.tmp', 'audit.log');
    if (fs.existsSync(auditFallback)) {
      const sz = fs.statSync(auditFallback).size;
      expect(sz).toBeGreaterThan(0);
    }
  });
});

