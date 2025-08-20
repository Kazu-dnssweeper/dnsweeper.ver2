import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { registerListCommand } from '../../src/cli/commands/list.js';

function writeTmpJson(data: any[]): string {
  const dir = path.join(process.cwd(), '.tmp', 'unit');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `in-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(data), 'utf8');
  return f;
}

async function runList(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const program = new Command();
  registerListCommand(program);
  let out = '';
  let err = '';
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a: any[]) => {
    out += a.join(' ') + '\n';
  };
  console.error = (...a: any[]) => {
    err += a.join(' ') + '\n';
  };
  try {
    await program.parseAsync(['list', ...args], { from: 'user' });
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  return { stdout: out, stderr: err };
}

describe('list command sorting', () => {
  it('sorts by risk ascending by default', async () => {
    const json = writeTmpJson([
      { domain: 'a.test', risk: 'high' },
      { domain: 'b.test', risk: 'low' },
      { domain: 'c.test', risk: 'medium' },
    ]);
    const { stdout } = await runList([json, '--format', 'json']);
    const arr = JSON.parse(stdout);
    expect(arr.map((r: any) => r.risk)).toEqual(['low', 'medium', 'high']);
  });

  it('sorts by risk descending with --desc', async () => {
    const json = writeTmpJson([
      { domain: 'a.test', risk: 'high' },
      { domain: 'b.test', risk: 'low' },
      { domain: 'c.test', risk: 'medium' },
    ]);
    const { stdout } = await runList([json, '--format', 'json', '--desc']);
    const arr = JSON.parse(stdout);
    expect(arr.map((r: any) => r.risk)).toEqual(['high', 'medium', 'low']);
  });
});

