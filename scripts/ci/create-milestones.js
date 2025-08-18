#!/usr/bin/env node
/* eslint-disable no-console */
import https from 'node:https';
import fs from 'node:fs';

const REPO = process.env.CI_REPO || 'Kazu-dnssweeper/dnsweeper.ver2';
let TOKEN = process.env.GITHUB_TOKEN || '';
if (!TOKEN) {
  try { TOKEN = fs.readFileSync(`${process.env.HOME}/.config/dnsweeper/token`, 'utf8').trim(); } catch {}
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: 'api.github.com',
      path: `/repos/${REPO}/${path}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'dnsweeper-milestone',
        'Content-Type': 'application/json'
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
        else reject(new Error(`HTTP ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// Milestones to create (no due_on by default; can be set later)
const items = [
  { title: 'v0.1.0 Preview', description: '最小CLI公開（tasks/task022.md）' },
  { title: 'v0.3.0 Packaging', description: '配布/CI整備（tasks/task024.md）' },
  { title: 'v0.5.0 Performance Mid', description: '性能/NFR中間（tasks/task026.md）' },
];

async function main(){
  for (const m of items) {
    try {
      await post('milestones', { title: m.title, description: m.description });
      console.log(`Created milestone: ${m.title}`);
    } catch (e) {
      console.error(`[warn] ${m.title}: ${e.message}`);
    }
  }
}

await main();
