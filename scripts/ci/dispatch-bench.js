#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const REPO = process.env.CI_REPO || 'Kazu-dnssweeper/dnsweeper.ver2';
let TOKEN = process.env.GITHUB_TOKEN || '';
if (!TOKEN) {
  try { TOKEN = fs.readFileSync(path.join(process.env.HOME || '.', '.config', 'dnsweeper', 'token'), 'utf8').trim(); } catch {}
}
if (!TOKEN) {
  console.error('GITHUB_TOKEN is required (env or ~/.config/dnsweeper/token)');
  process.exit(1);
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'dnsweeper-bench-dispatch',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString('utf8')}`));
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

const ref = process.env.BENCH_REF || 'feature/m4-hybrid';
const workflow = 'bench.yml';
const url = `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`;
await post(url, { ref });
console.log(`Dispatched bench workflow on ${ref}`);
