import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import logger from '../../src/core/logger.js';

vi.mock('../../src/core/http/probe.js', () => {
  return {
    probeUrl: async (url: string) => {
      if (url.startsWith('https://')) return { ok: false, status: 0, elapsedMs: 5 };
      if (url.startsWith('http://')) return { ok: false, status: 404, elapsedMs: 5 };
      return { ok: false, status: 0, elapsedMs: 5 };
    },
  };
});

// Mock DoH to NOERROR with A record so heuristic does not override 404 to high
vi.mock('../../src/core/resolver/doh.js', () => ({
  resolveDoh: async (_qname: string, _qtype: string) => ({ status: 'NOERROR', chain: [], elapsedMs: 1 }),
  getDohStats: () => ({ hits: 0, misses: 0, timeSpentMs: 0 }),
  resetDohStats: () => {},
}));

import { registerAnalyzeCommand } from '../../src/cli/commands/analyze.js';

function writeTmpCsv(lines: string[]): string {
  const dir = path.join(process.cwd(), '.tmp', 'unit');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `ev-${Date.now()}.csv`);
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

describe('analyze evidences (--include-evidence)', () => {
  it('includes R-007 evidence on HTTP 404', async () => {
    const csv = writeTmpCsv(['domain', 'app.example']);
    const out = path.join(path.dirname(csv), 'ev-out.json');
    await runAnalyze(['--http-check', '--include-evidence', '--doh', '--dns-type', 'A', csv, '--output', out]);
    const arr = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(arr[0].riskScore).toBeDefined();
    const rules = (arr[0].evidences || []).map((e: any) => e.ruleId);
    expect(rules).toContain('R-007');
  });
});

