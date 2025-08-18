#!/usr/bin/env node
/**
 * Simple benchmark runner.
 * Usage:
 *   node scripts/bench/bench.js --size 10000 --preset examples/presets/low-latency.json [--http] [--doh] [--timeout 1000]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { size: 100, preset: '', http: false, doh: false, timeout: 0 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--size') out.size = parseInt(args[++i], 10);
    else if (a === '--preset') out.preset = args[++i];
    else if (a === '--http') out.http = true;
    else if (a === '--doh') out.doh = true;
    else if (a === '--timeout') out.timeout = parseInt(args[++i], 10);
  }
  return out;
}

function genCsv(n, dir) {
  const lines = ['domain'];
  for (let i = 0; i < n; i++) lines.push(`host${i}.example.com`);
  const f = path.join(dir, `bench-${n}.csv`);
  fs.writeFileSync(f, lines.join('\n'), 'utf8');
  return f;
}

function main() {
  const { size, preset, http, doh, timeout } = parseArgs();
  const repo = path.resolve('.');
  const outDir = path.join(repo, '.tmp', 'bench');
  fs.mkdirSync(outDir, { recursive: true });
  const input = genCsv(size, outDir);
  const outJson = path.join(outDir, `out-${size}.json`);

  // Apply preset if provided
  if (preset) {
    const cfgDst = path.join(repo, 'dnsweeper.config.json');
    fs.copyFileSync(path.resolve(preset), cfgDst);
    console.error(`[bench] applied preset: ${preset}`);
  }

  // Build
  execSync('pnpm -C packages/dnsweeper run build', { stdio: 'inherit' });

  // Run analyze
  const cli = path.join(repo, 'packages/dnsweeper/dist/cli/index.js');
  const args = ['analyze', input, '--concurrency', '40', '--qps', '0', '--include-original', '--output', outJson];
  if (http) args.push('--http-check');
  if (doh) args.push('--doh');
  if (timeout && Number.isFinite(timeout) && timeout > 0) args.push('--timeout', String(timeout));
  const t0 = Date.now();
  const res = spawnSync('node', [cli, ...args], { encoding: 'utf8' });
  const elapsed = Date.now() - t0;
  process.stdout.write(res.stdout || '');
  process.stderr.write(res.stderr || '');

  let count = 0; try { count = JSON.parse(fs.readFileSync(outJson, 'utf8')).length; } catch{}
  const rps = count > 0 ? (count / (elapsed / 1000)) : 0;
  console.error(`[bench] size=${size} elapsed_ms=${elapsed} rps=${rps.toFixed(1)} output=${outJson}`);
}

main();
