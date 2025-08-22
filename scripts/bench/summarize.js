#!/usr/bin/env node
/**
 * Summarize bench logs produced by scripts/bench/bench.js.
 * Usage:
 *   node scripts/bench/summarize.js --log <file> [--out-json <file>] [--md]
 */
import fs from 'node:fs';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { log: '', outJson: '', md: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--log') out.log = args[++i];
    else if (a === '--out-json') out.outJson = args[++i];
    else if (a === '--md') out.md = true;
  }
  if (!out.log) {
    console.error('Usage: summarize.js --log <file> [--out-json <file>] [--md]');
    process.exit(2);
  }
  return out;
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function main() {
  const { log, outJson, md } = parseArgs();
  const txt = fs.readFileSync(log, 'utf8');
  const lines = txt.split(/\r?\n/);
  const entries = [];
  for (const ln of lines) {
    const m = ln.match(/\[bench\]\s*size=(\d+)\s+elapsed_ms=(\d+)\s+rps=([0-9.]+)/);
    if (m) {
      entries.push({ size: Number(m[1]), elapsed_ms: Number(m[2]), rps: Number(m[3]) });
    }
  }
  const sizes = [...new Set(entries.map(e => e.size))].sort((a, b) => a - b);
  const summary = { total_runs: entries.length, sizes: {} };
  const thresholds = { 100000: 900000 };
  for (const sz of sizes) {
    const arr = entries.filter(e => e.size === sz);
    const medElapsed = median(arr.map(e => e.elapsed_ms));
    const medRps = median(arr.map(e => e.rps));
    const threshold = thresholds[sz] ?? null;
    const pass = threshold ? medElapsed <= threshold : null;
    summary.sizes[sz] = {
      runs: arr.length,
      elapsed_ms: arr.map(e => e.elapsed_ms),
      rps: arr.map(e => e.rps),
      median_elapsed_ms: medElapsed,
      median_rps: medRps,
      threshold_ms: threshold,
      pass
    };
  }
  if (outJson) fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));
  if (md) {
    let out = '';
    out += `Bench Summary (from ${log})\n\n`;
    for (const sz of sizes) {
      const s = summary.sizes[sz];
      const status = s.pass === null ? '' : (s.pass ? ' PASS' : ' FAIL');
      out += `- size=${sz}: runs=${s.runs}, median_elapsed_ms=${s.median_elapsed_ms}, median_rps=${s.median_rps.toFixed(1)}${status}\n`;
    }
    process.stdout.write(out);
  } else if (!outJson) {
    process.stdout.write(JSON.stringify(summary, null, 2));
  }
}

main();

