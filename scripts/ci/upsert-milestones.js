#!/usr/bin/env node
/* eslint-disable no-console */
import https from 'node:https';
import fs from 'node:fs';

const REPO = process.env.CI_REPO || 'Kazu-dnssweeper/dnsweeper.ver2';
let TOKEN = process.env.GITHUB_TOKEN || '';
if (!TOKEN) { try { TOKEN = fs.readFileSync(`${process.env.HOME}/.config/dnsweeper/token`, 'utf8').trim(); } catch {} }

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const r = https.request({ host: 'api.github.com', path: `/repos/${REPO}/${path}`, method, headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'dnsweeper-upsert-milestones', 'Content-Type': 'application/json' } }, (res) => {
      const chunks=[]; res.on('data',c=>chunks.push(c)); res.on('end',()=>{ const s=Buffer.concat(chunks).toString('utf8'); if(res.statusCode>=200&&res.statusCode<300) resolve({status:res.statusCode, body:s}); else reject(new Error(`HTTP ${res.statusCode}: ${s}`)); });
    });
    r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
  });
}

function isoPlusDays(days) { const d = new Date(); d.setUTCDate(d.getUTCDate()+days); return d.toISOString(); }

const targets = [
  { title: 'v0.1.0 Preview', description: '最小CLI公開（tasks/task022.md）', dueDays: 14 },
  { title: 'v0.3.0 Packaging', description: '配布/CI整備（tasks/task024.md）', dueDays: 28 },
  { title: 'v0.5.0 Performance Mid', description: '性能/NFR中間（tasks/task026.md）', dueDays: 56 },
];

const list = JSON.parse((await req('GET','milestones?state=all')).body);

for (const t of targets) {
  const exist = (list || []).find(m => m.title === t.title);
  const body = { title: t.title, description: t.description, due_on: isoPlusDays(t.dueDays) };
  if (exist) {
    await req('PATCH', `milestones/${exist.number}`, body).then(()=>console.log(`Updated milestone: ${t.title}`)).catch(e=>console.error(`[warn] ${t.title}: ${e.message}`));
  } else {
    await req('POST', 'milestones', body).then(()=>console.log(`Created milestone: ${t.title}`)).catch(e=>console.error(`[warn] ${t.title}: ${e.message}`));
  }
}

