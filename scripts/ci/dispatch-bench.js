#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import pino from 'pino';

const logger = pino();

const REPO = process.env.CI_REPO || 'Kazu-dnssweeper/dnsweeper.ver2';
let TOKEN = process.env.GITHUB_TOKEN || '';
if (!TOKEN) {
  try { TOKEN = fs.readFileSync(path.join(process.env.HOME || '.', '.config', 'dnsweeper', 'token'), 'utf8').trim(); } catch {}
}
if (!TOKEN) {
  logger.error('GITHUB_TOKEN is required (env or ~/.config/dnsweeper/token)');
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

async function dispatch() {
  // Try full path first
  let workflow = '.github/workflows/bench.yml';
  let url = `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`;
  try {
    await post(url, { ref });
    logger.info(`Dispatched bench workflow on ${ref} via ${workflow}`);
    return;
  } catch (e) {
    logger.error(`[warn] direct dispatch failed: ${e.message}`);
  }
  // Fallback: list workflows and find id
  const listUrl = `https://api.github.com/repos/${REPO}/actions/workflows`;
  const body = await new Promise((resolve, reject) => {
    const req = https.request(listUrl, {
      method: 'GET', headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'dnsweeper-bench-dispatch' }
    }, (res) => { const chunks=[]; res.on('data',(c)=>chunks.push(c)); res.on('end',()=> resolve(Buffer.concat(chunks).toString('utf8'))); });
    req.on('error', reject); req.end();
  });
  let id = null;
  try {
    const j = JSON.parse(body);
    for (const wf of j.workflows || []) {
      if (String(wf.path || '').endsWith('bench.yml') || String(wf.name||'') === 'Bench (HTTP+DoH)') { id = wf.id; break; }
    }
  } catch {}
  if (!id) throw new Error('bench workflow not found in repository');
  url = `https://api.github.com/repos/${REPO}/actions/workflows/${id}/dispatches`;
  await post(url, { ref });
  logger.info(`Dispatched bench workflow on ${ref} via id=${id}`);
}

await dispatch();

