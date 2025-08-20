#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

const GLOB_DIR = path.join('.github', 'workflows');
const reUses = /uses:\s*([^@\s]+)@([^\s#]+)/i;
const reSha = /^[a-f0-9]{40,}$/i;

let bad = [];
for (const f of fs.readdirSync(GLOB_DIR)) {
  const p = path.join(GLOB_DIR, f);
  if (!/\.ya?ml$/i.test(p)) continue;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(reUses);
    if (m) {
      const ref = m[2].trim();
      if (!reSha.test(ref)) {
        bad.push({ file: p, line: i + 1, ref: `${m[1]}@${ref}` });
      }
    }
  }
}

if (bad.length === 0) {
  console.log('All actions appear pinned to commit SHAs.');
  process.exit(0);
}

const header = 'Unpinned GitHub Actions references found (pin to commit SHA):\n';
console.log(header + bad.map(b => ` - ${b.file}:${b.line} -> ${b.ref}`).join('\n'));

if (process.env.PIN_ENFORCE === '1') {
  process.exit(2);
} else {
  process.exit(0);
}

