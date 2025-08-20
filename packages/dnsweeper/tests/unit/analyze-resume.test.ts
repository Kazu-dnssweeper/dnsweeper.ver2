import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import logger from '../../src/core/logger.js';

// Mock DoH resolver with call counter
let calls: any[] = [];
vi.mock('../../src/core/resolver/doh.js', () => ({
  resolveDoh: async (qname: string, qtype: string) => {
    calls.push({ qname, qtype });
    return { qname, qtype, status: 'NOERROR', chain: [], elapsedMs: 1 };
  },
  getDohStats: () => ({ hits: 0, misses: 0, timeSpentMs: 0 }),
  resetDohStats: () => { calls = []; },
}));

import { registerAnalyzeCommand } from '../../src/cli/commands/analyze.js';

function writeCsv(domains: string[]): string {
  const dir = path.join(process.cwd(), '.tmp', 'unit');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `resume-${Date.now()}.csv`);
  const lines = ['domain', ...domains];
  fs.writeFileSync(f, lines.join('\n'), 'utf8');
  return f;
}

async function runAnalyze(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const program = new Command();
  registerAnalyzeCommand(program);
  let out = '';
  let err = '';
  const origInfo = logger.info;
  const origErr = logger.error;
  logger.info = ((...a: any[]) => { out += a.join(' ') + '\n'; }) as any;
  logger.error = ((...a: any[]) => { err += a.join(' ') + '\n'; }) as any;
  try {
    await program.parseAsync(['analyze', ...args], { from: 'user' });
  } finally {
    logger.info = origInfo;
    logger.error = origErr;
  }
  return { stdout: out, stderr: err };
}

describe('analyze resume (snapshot)', () => {
  beforeEach(() => { calls = []; });

  it('does not re-resolve already processed domains when --resume', async () => {
    const csv = writeCsv(['a.example', 'b.example']);
    const snap = path.join(path.dirname(csv), 'snap.json');
    // first run processes both domains
    await runAnalyze(['--doh', '--dns-type', 'A', '--snapshot', snap, csv, '--output', path.join(path.dirname(csv), 'out1.json')]);
    expect(calls.length).toBe(2);
    calls = [];
    // second run resumes; should skip both (no new DoH calls)
    await runAnalyze(['--doh', '--dns-type', 'A', '--resume', '--snapshot', snap, csv, '--output', path.join(path.dirname(csv), 'out2.json')]);
    expect(calls.length).toBe(0);
  });
});

