import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import logger from '../../src/core/logger.js';

// Mock DoH module to control DNS responses
vi.mock('../../src/core/resolver/doh.js', () => {
  let calls: any[] = [];
  const impl = {
    resolveDoh: async (qname: string, qtype: string) => {
      calls.push({ qname, qtype });
      const key = `${qname}|${qtype}`;
      const map: Record<string, any> = (global as any).__DOH_RESP__ || {};
      const res = map[key];
      if (res) return res;
      return { qname, qtype, status: 'NOERROR', chain: [], elapsedMs: 1 };
    },
    getDohStats: () => ({ hits: 0, misses: 0, timeSpentMs: 0 }),
    resetDohStats: () => {
      calls = [];
    },
  };
  return impl;
});

import { registerAnalyzeCommand } from '../../src/cli/commands/analyze.js';

function writeTmpCsv(lines: string[]): string {
  const dir = path.join(process.cwd(), '.tmp', 'unit');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `in-${Date.now()}.csv`);
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

describe('analyze (DoH only, mocked)', () => {
  beforeEach(() => {
    (global as any).__DOH_RESP__ = {};
  });
  afterEach(() => {
    delete (global as any).__DOH_RESP__;
  });

  it('NOERROR yields low risk', async () => {
    const csv = writeTmpCsv(['domain', 'example.com']);
    (global as any).__DOH_RESP__ = {
      'example.com.|A': { qname: 'example.com.', qtype: 'A', status: 'NOERROR', chain: [{ type: 'A', data: '93.184.216.34', TTL: 60 }], elapsedMs: 5 },
    };
    const out = path.join(path.dirname(csv), 'out1.json');
    const { stdout } = await runAnalyze(['--doh', '--dns-type', 'A', csv, '--output', out]);
    expect(stdout).toContain('rows=1');
    const arr = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(arr[0].risk).toBe('low');
    expect(arr[0].dns.status).toBe('NOERROR');
  });

  it('all NXDOMAIN yields high risk', async () => {
    const csv = writeTmpCsv(['domain', 'nope.invalid']);
    (global as any).__DOH_RESP__ = {
      'nope.invalid.|A': { qname: 'nope.invalid.', qtype: 'A', status: 'NXDOMAIN', chain: [], elapsedMs: 3 },
      'nope.invalid.|AAAA': { qname: 'nope.invalid.', qtype: 'AAAA', status: 'NXDOMAIN', chain: [], elapsedMs: 3 },
    };
    const out = path.join(path.dirname(csv), 'out2.json');
    const { stdout } = await runAnalyze(['--doh', '--dns-type', 'A,AAAA', csv, '--output', out]);
    expect(stdout).toContain('rows=1');
    const arr = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(arr[0].risk).toBe('high');
    expect(arr[0].dns.status).toBe('NXDOMAIN');
  });

  it('private IPs cause skip (skipped=true) unless allow-private set', async () => {
    const csv = writeTmpCsv(['domain', 'internal.example.local']);
    (global as any).__DOH_RESP__ = {
      'internal.example.local.|A': { qname: 'internal.example.local.', qtype: 'A', status: 'NOERROR', chain: [{ type: 'A', data: '10.0.0.5', TTL: 120 }], elapsedMs: 2 },
    };
    const out = path.join(path.dirname(csv), 'out3.json');
    await runAnalyze(['--doh', '--dns-type', 'A', csv, '--output', out]);
    const arr = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(arr[0].skipped).toBe(true);
    expect(arr[0].skipReason).toBeTruthy();

    const out2 = path.join(path.dirname(csv), 'out4.json');
    await runAnalyze(['--doh', '--dns-type', 'A', '--allow-private', csv, '--output', out2]);
    const arr2 = JSON.parse(fs.readFileSync(out2, 'utf8'));
    expect(arr2[0].skipped).toBeFalsy();
  });
});
