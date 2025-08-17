/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import https from 'node:https';

const REPO = process.env.CI_REPO || 'Kazu-dnssweeper/dnsweeper.ver2';
let TOKEN = process.env.GITHUB_TOKEN || '';
if (!TOKEN) {
  try {
    const p = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.config', 'dnsweeper', 'token');
    TOKEN = fs.readFileSync(p, 'utf8').trim();
  } catch {}
}
if (!TOKEN) {
  console.error('GITHUB_TOKEN is required (env GITHUB_TOKEN or ~/.config/dnsweeper/token).');
  process.exit(1);
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'dnsweeper-ci-status',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(body);
          else reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

const tmp = path.join(process.cwd(), '.tmp');
fs.mkdirSync(tmp, { recursive: true });

const runsUrl = `https://api.github.com/repos/${REPO}/actions/runs?per_page=1`;
const runs = JSON.parse(await get(runsUrl));
const run = runs.workflow_runs?.[0];
if (!run) {
  console.log('No runs found');
  process.exit(0);
}
console.log(`Latest run: id=${run.id} status=${run.status} conclusion=${run.conclusion} url=${run.html_url}`);

const jobsUrl = `https://api.github.com/repos/${REPO}/actions/runs/${run.id}/jobs`;
const jobs = JSON.parse(await get(jobsUrl));
for (const job of jobs.jobs || []) {
  console.log(`JOB: ${job.name} | status=${job.status} conclusion=${job.conclusion}`);
  if (job.conclusion !== 'success') {
    for (const s of job.steps || []) {
      if (['failure', 'timed_out', 'cancelled'].includes(s.conclusion)) {
        console.log(`  FAIL: ${s.name} | ${s.status}/${s.conclusion}`);
      }
    }
  }
}
