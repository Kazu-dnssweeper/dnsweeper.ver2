#!/usr/bin/env node
/* eslint-disable no-console */
// Suggest rule weight tweaks from analyzed.json (with --include-evidence recommended)
// Usage: node scripts/analysis/weights-suggest.js <analyzed.json> [--top 8] [--out patch.json]
import fs from 'node:fs';
import path from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length || args[0].startsWith('-')) {
    console.error('Usage: weights-suggest.js <analyzed.json> [--top 8] [--out patch.json]');
    process.exit(2);
  }
  const out = { file: args[0], top: 8, outFile: '' };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--top') out.top = parseInt(args[++i], 10) || out.top;
    else if (a === '--out') out.outFile = args[++i];
  }
  return out;
}

function loadArray(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const json = JSON.parse(raw);
  if (!Array.isArray(json)) throw new Error('input must be an array of results');
  return json;
}

function main() {
  const { file, top, outFile } = parseArgs();
  const arr = loadArray(path.resolve(file));
  const counts = new Map();
  let evidenceCount = 0;
  for (const r of arr) {
    const ev = Array.isArray(r?.evidences) ? r.evidences : [];
    if (ev.length) evidenceCount += ev.length;
    for (const e of ev) {
      const id = e?.ruleId || e?.rule || 'UNKNOWN';
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  // Fallback heuristic when evidences missing: classify from http/dns
  if (evidenceCount === 0) {
    for (const r of arr) {
      if (r?.http && r?.http.ok === false && r?.https && r?.https.ok === false) counts.set('R-005', (counts.get('R-005') || 0) + 1);
      const s = String(r?.dns?.status || '').toUpperCase();
      if (s === 'SERVFAIL' || s === 'TIMEOUT') counts.set('R-002', (counts.get('R-002') || 0) + 1);
      if (s === 'NXDOMAIN') counts.set('R-001', (counts.get('R-001') || 0) + 1);
    }
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
  const ranked = Array.from(counts.entries())
    .map(([rule, c]) => ({ rule, count: c, share: c / total }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);

  // Simple heuristic: high-share rules +5, very low-share low-severity rules -5
  const weights = {};
  for (const item of ranked) {
    if (item.share >= 0.2) weights[item.rule] = (weights[item.rule] || 0) + 5;
    else if (item.share <= 0.02) weights[item.rule] = (weights[item.rule] || 0) - 5;
  }

  const patch = { risk: { rules: { weights } } };
  const report = {
    analyzed: path.basename(file),
    total_rules_considered: total,
    top_rules: ranked,
    suggested_patch: patch,
  };
  console.log(JSON.stringify(report, null, 2));
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(patch, null, 2));
}

main();

