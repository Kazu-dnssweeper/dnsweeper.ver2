#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

function findSummaryFiles(root) {
  const out = [];
  function walk(p) {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    } else if (/bench-100000\.summary\.json$/i.test(p)) {
      out.push(p);
    }
  }
  walk(root);
  return out;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function main() {
  const root = process.argv[2] || 'bench-artifacts';
  const files = findSummaryFiles(root);
  const values = [];
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      const r = Number(j?.rps);
      if (Number.isFinite(r) && r > 0) values.push(r);
    } catch {}
  }
  const med = Number(median(values).toFixed(2));
  const needed = 100000 / 900; // ~111.11 rps
  const pass = med >= needed;

  // Step summary
  const ss = process.env.GITHUB_STEP_SUMMARY;
  if (ss) {
    const lines = [];
    lines.push('### M7 Bench Aggregate');
    lines.push(`- values: ${values.map((v) => v.toFixed(2)).join(', ') || '(none)'}`);
    lines.push(`- median_rps: ${med.toFixed(2)}`);
    lines.push(`- target_rps (100k<=15m): ~${needed.toFixed(2)} → ${pass ? 'PASS' : 'FAIL'}`);
    fs.appendFileSync(ss, lines.join('\n') + '\n');
  }

  // Outputs
  const go = process.env.GITHUB_OUTPUT;
  if (go) {
    fs.appendFileSync(go, `values=${values.join(',')}\n`);
    fs.appendFileSync(go, `median=${med}\n`);
    fs.appendFileSync(go, `needed=${needed}\n`);
    fs.appendFileSync(go, `pass=${pass ? 'true' : 'false'}\n`);
  }
}

main();

