/* eslint-disable no-console */
import https from 'node:https';
import process from 'node:process';

const REPO = process.env.CI_REPO || 'Kazu-dnssweeper/dnsweeper.ver2';
const OWNER_REPO = REPO.split('/');
if (OWNER_REPO.length !== 2) {
  console.error('CI_REPO must be in the form owner/repo');
  process.exit(1);
}

function readToken() {
  let t = process.env.GITHUB_TOKEN || '';
  if (t) return t.trim();
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const p = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.config', 'dnsweeper', 'token');
    t = fs.readFileSync(p, 'utf8').trim();
  } catch {}
  return t;
}

function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'dnsweeper-ci-rerun',
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const txt = Buffer.concat(chunks).toString('utf8');
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          if (!ok) {
            reject(new Error(`HTTP ${res.statusCode}: ${txt}`));
          } else resolve(txt);
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function get(url, token) {
  return request('GET', url, null, token);
}

function post(url, body, token) {
  return request('POST', url, body, token);
}

async function main() {
  const token = readToken();
  if (!token) {
    console.error('GITHUB_TOKEN required (env or ~/.config/dnsweeper/token).');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let runId = '';
  let mode = 'full'; // or 'failed'
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--run' && i + 1 < args.length) {
      runId = args[++i];
    } else if (a === '--failed') {
      mode = 'failed';
    }
  }

  if (!runId) {
    const runsUrl = `https://api.github.com/repos/${REPO}/actions/runs?per_page=1`;
    const runs = JSON.parse(await get(runsUrl, token));
    const run = runs.workflow_runs?.[0];
    if (!run) {
      console.error('No workflow runs found');
      process.exit(1);
    }
    runId = String(run.id);
  }

  const base = `https://api.github.com/repos/${REPO}/actions/runs/${runId}`;
  try {
    if (mode === 'failed') {
      await post(base + '/rerun-failed-jobs', {}, token);
      console.log(`Requested rerun of FAILED jobs for run ${runId}`);
    } else {
      await post(base + '/rerun', {}, token);
      console.log(`Requested FULL rerun for run ${runId}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/403/.test(msg)) {
      console.error('Permission denied (Actions: Write required on token).');
    }
    console.error(msg);
    process.exit(1);
  }
}

main();

