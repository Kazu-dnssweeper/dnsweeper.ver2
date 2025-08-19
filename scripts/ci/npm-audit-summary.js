#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function toArray(x) { return Array.isArray(x) ? x : x ? [x] : []; }

const repo = process.cwd();
const file = process.argv[2] || path.join(repo, 'npm-audit.json');
const data = loadJson(file);
if (!data) {
  console.log('No npm audit JSON found.');
  process.exit(0);
}

// npm v8/v9 format compatibility
const meta = data.metadata || data.meta || {};
const counts = meta.vulnerabilities || meta.vulns || {};

// Collect actionable upgrades
const fixes = [];
const vulns = data.vulnerabilities || data.advisories || {};
if (Array.isArray(vulns)) {
  for (const v of vulns) {
    if (v?.fixAvailable) {
      const name = v.name || v.module_name || 'unknown';
      const via = v.via || [];
      const target = typeof v.fixAvailable === 'object' ? (v.fixAvailable.version || v.fixAvailable.name || '') : '';
      fixes.push({ name, current: v?.range || v?.version || '', target, severity: v.severity || v.severityOfVuln || 'unknown', title: v.title || '' });
    }
  }
} else {
  // npm v9: vulnerabilities keyed by package name
  for (const [name, v] of Object.entries(vulns)) {
    const fix = v && v.fixAvailable;
    if (fix) {
      const target = typeof fix === 'object' ? (fix.version || '') : '';
      fixes.push({ name, current: v?.via?.[0]?.range || '', target, severity: v.severity || 'unknown', title: toArray(v.via).map((x) => (x.title || x.name || '')).filter(Boolean).join('; ') });
    }
  }
}

const sev = (k) => counts[k] || 0;
const total = (['critical','high','moderate','low'].map(sev).reduce((a,b)=>a+b,0));

let md = '';
md += '### Dependency Vulnerabilities (npm audit)\n\n';
md += `- Critical: ${sev('critical')} | High: ${sev('high')} | Moderate: ${sev('moderate')} | Low: ${sev('low')} | Total: ${total}\n`;
if (fixes.length) {
  md += '\n#### Suggested Upgrades\n';
  for (const f of fixes.slice(0, 20)) {
    const tgt = f.target ? ` → upgrade to ${f.target}` : '';
    md += `- ${f.name} ${f.current || ''}${tgt} (${f.severity}) ${f.title ? '- ' + f.title : ''}\n`;
  }
  if (fixes.length > 20) md += `- ...and ${fixes.length - 20} more.\n`;
} else {
  md += '\nNo direct fix suggestions available from npm audit.\n';
}

console.log(md.trim());

