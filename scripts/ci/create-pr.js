#!/usr/bin/env node
/* eslint-disable no-console */
import https from 'node:https';
import fs from 'node:fs';

const REPO = process.env.CI_REPO || 'Kazu-dnssweeper/dnsweeper.ver2';
let TOKEN = process.env.GITHUB_TOKEN || '';
if (!TOKEN) { try { TOKEN = fs.readFileSync(`${process.env.HOME}/.config/dnsweeper/token`, 'utf8').trim(); } catch {} }

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const r = https.request({ host: 'api.github.com', path: `/repos/${REPO}/${path}`, method, headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'dnsweeper-create-pr', 'Content-Type': 'application/json' } }, (res) => {
      const chunks=[]; res.on('data',c=>chunks.push(c)); res.on('end',()=>{ const s=Buffer.concat(chunks).toString('utf8'); if(res.statusCode>=200&&res.statusCode<300) resolve({status:res.statusCode, body:s}); else reject(new Error(`HTTP ${res.statusCode}: ${s}`)); });
    });
    r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
  });
}

// Create PR from branch to main and assign milestone v0.1.0
const head = process.env.PR_HEAD || 'chore/bench-fix';
const base = process.env.PR_BASE || 'main';
const title = process.env.PR_TITLE || 'v0.1.0 Preview';
const body = '初回プレビューに向けた変更の集約PRです。\n\n関連タスク: tasks/task022.md\nMilestone: v0.1.0 Preview';

const pr = JSON.parse((await req('POST','pulls', { title, head, base, body })).body);
console.log(`Created PR #${pr.number}`);

// Assign milestone to PR (PR is also an issue)
const milestones = JSON.parse((await req('GET','milestones?state=open')).body);
const ms = milestones.find(m=>m.title==='v0.1.0 Preview');
if (ms) {
  await req('PATCH', `issues/${pr.number}`, { milestone: ms.number });
  console.log(`Assigned milestone '${ms.title}' to PR #${pr.number}`);
}

