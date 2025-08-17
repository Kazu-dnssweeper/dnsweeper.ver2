import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';

vi.mock('../../src/core/http/probe.js', () => {
  return {
    probeUrl: async (url: string) => {
      if (url.startsWith('https://')) return { ok: false, status: 0, elapsedMs: 5 };
      if (url.startsWith('http://')) return { ok: true, status: 200, elapsedMs: 5 };
      return { ok: false, status: 0, elapsedMs: 5 };
    },
  };
});

import { registerAnalyzeCommand } from '../../src/cli/commands/analyze.js';

function writeTmpCsv(lines: string[]): string {
  const dir = path.join(process.cwd(), '.tmp', 'unit');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `http-${Date.now()}.csv`);
  fs.writeFileSync(f, lines.join('\n'), 'utf8');
  return f;
}

async function runAnalyze(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const program = new Command();
  registerAnalyzeCommand(program);
  let out = '';
  let err = '';
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a: any[]) => { out += a.join(' ') + '\n'; };
  console.error = (...a: any[]) => { err += a.join(' ') + '\n'; };
  try {
    await program.parseAsync(['analyze', ...args], { from: 'user' });
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  return { stdout: out, stderr: err };
}

describe('analyze (HTTP check only, mocked)', () => {
  it('https fails but http ok -> medium', async () => {
    const csv = writeTmpCsv(['domain', 'web.example']);
    const out = path.join(path.dirname(csv), 'http-out.json');
    const { stdout } = await runAnalyze(['--http-check', csv, '--output', out]);
    expect(stdout).toContain('rows=1');
    const arr = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(arr[0].risk).toBe('medium');
    expect(arr[0].https.ok).toBe(false);
    expect(arr[0].http.ok).toBe(true);
  });
});

