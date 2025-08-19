#!/usr/bin/env node
/* eslint-disable no-console */
import https from 'node:https';
import fs from 'node:fs';

const REPO = process.env.CI_REPO || 'Kazu-dnssweeper/dnsweeper.ver2';
let TOKEN = process.env.GITHUB_TOKEN || '';
if (!TOKEN) { try { TOKEN = fs.readFileSync(`${process.env.HOME}/.config/dnsweeper/token`, 'utf8').trim(); } catch {} }

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const r = https.request({ host: 'api.github.com', path: `/repos/${REPO}/${path}`, method, headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'dnsweeper-create-issues', 'Content-Type': 'application/json' } }, (res) => {
      const chunks=[]; res.on('data',c=>chunks.push(c)); res.on('end',()=>{ const s=Buffer.concat(chunks).toString('utf8'); if(res.statusCode>=200&&res.statusCode<300) resolve({status:res.statusCode, body:s}); else reject(new Error(`HTTP ${res.statusCode}: ${s}`)); });
    });
    r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
  });
}

const milestones = JSON.parse((await req('GET','milestones?state=open')).body);
const map = Object.fromEntries(milestones.map(m => [m.title, m.number]));

const items = [
  { title: 'Tracking: v0.1.0 Preview', milestone: 'v0.1.0 Preview', tasks: ['tasks/task022.md'] },
  { title: 'Tracking: v0.3.0 Packaging', milestone: 'v0.3.0 Packaging', tasks: ['tasks/task024.md'] },
  { title: 'Tracking: v0.5.0 Performance Mid', milestone: 'v0.5.0 Performance Mid', tasks: ['tasks/task026.md'] },
];

for (const it of items) {
  const ms = map[it.milestone];
  if (!ms) { console.error(`[warn] milestone not found: ${it.milestone}`); continue; }
  const body = `ロードマップのトラッキングIssueです。\n\n- Milestone: ${it.milestone}\n- Tasks:\n${it.tasks.map(t=>`  - [ ] ${t}`).join('\n')}\n\n関連: ROADMAP.md`;
  try {
    const r = await req('POST', 'issues', { title: it.title, body, milestone: ms });
    const j = JSON.parse(r.body);
    console.log(`Created issue #${j.number}: ${it.title}`);
  } catch (e) {
    console.error(`[warn] cannot create issue '${it.title}': ${e.message}`);
  }
}

