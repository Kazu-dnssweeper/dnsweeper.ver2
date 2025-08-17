import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function run(cmd: string, cwd?: string) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', cwd });
}

describe('E2E: export --verbose emits perf', () => {
  const repo = process.cwd();
  const distCli = path.join(repo, 'dist/cli/index.js');
  const tmp = path.join(repo, '.tmp', 'e2e-export');
  fs.mkdirSync(tmp, { recursive: true });

  it('prints perf line to stderr', () => {
    // ensure build exists
    run('pnpm run -s build', repo);
    const json = path.join(tmp, 'small.json');
    fs.writeFileSync(json, JSON.stringify([{ domain: 'a.example', risk: 'low' }]), 'utf8');
    const out = path.join(tmp, 'small.csv');
    const outStr = run(`node ${distCli} export ${json} --format csv --output ${out} --verbose 2>&1`, repo);
    expect(outStr).toMatch(/\[perf\]/);
    expect(fs.existsSync(out)).toBe(true);
  });
});

