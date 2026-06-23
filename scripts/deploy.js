#!/usr/bin/env node
// Manual deploy to Netlify via the file-digest Deploys API.
// Usage:
//   NETLIFY_PAT=nfp_xxx SITE_ID=d99a416c-... node scripts/deploy.js
// Defaults: publish=public, functions=netlify/functions

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const PAT = process.env.NETLIFY_PAT;
const SITE_ID = process.env.SITE_ID;
const PUBLIC_DIR = process.env.PUBLIC_DIR || 'public';
const FUNCTIONS_DIR = process.env.FUNCTIONS_DIR || 'netlify/functions';

if (!PAT || !SITE_ID) {
  console.error('Set NETLIFY_PAT and SITE_ID env vars.');
  process.exit(1);
}

const API = 'https://api.netlify.com/api/v1';
const auth = { Authorization: `Bearer ${PAT}` };

const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

(async () => {
  const files = {}, fileBufs = {};
  for (const abs of walk(PUBLIC_DIR)) {
    const rel = '/' + path.relative(PUBLIC_DIR, abs).split(path.sep).join('/');
    const buf = fs.readFileSync(abs);
    files[rel] = sha1(buf);
    fileBufs[rel] = buf;
  }

  const functions = {}, fnBufs = {};
  const fnSrcs = fs.existsSync(FUNCTIONS_DIR)
    ? fs.readdirSync(FUNCTIONS_DIR).filter(f => /\.(js|mjs|ts)$/.test(f))
    : [];
  for (const f of fnSrcs) {
    const name = f.replace(/\.(js|mjs|ts)$/, '');
    const src = path.join(FUNCTIONS_DIR, f);
    const zip = path.join(require('os').tmpdir(), `fn-${name}-${Date.now()}.zip`);
    const r = spawnSync('zip', ['-j', zip, src], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`zip failed for ${name}`);
    const buf = fs.readFileSync(zip);
    fs.unlinkSync(zip);
    functions[name] = sha1(buf);
    fnBufs[name] = buf;
  }

  console.log(`Files: ${Object.keys(files).length}, Functions: ${Object.keys(functions).length}`);

  const createRes = await fetch(`${API}/sites/${SITE_ID}/deploys`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, functions, async: false }),
  });
  if (!createRes.ok) {
    console.error('Create deploy failed', createRes.status, await createRes.text());
    process.exit(1);
  }
  const deploy = await createRes.json();
  console.log('Deploy:', deploy.id, 'state:', deploy.state);

  for (const sha of deploy.required || []) {
    const rel = Object.keys(files).find(k => files[k] === sha);
    if (!rel) continue;
    process.stdout.write(`  ${rel} ... `);
    const r = await fetch(`${API}/deploys/${deploy.id}/files${rel}`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/octet-stream' },
      body: fileBufs[rel],
    });
    console.log(r.status);
    if (!r.ok) { console.error(await r.text()); process.exit(1); }
  }
  for (const sha of deploy.required_functions || []) {
    const name = Object.keys(functions).find(k => functions[k] === sha);
    if (!name) continue;
    process.stdout.write(`  fn ${name} ... `);
    const r = await fetch(`${API}/deploys/${deploy.id}/functions/${name}`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/zip' },
      body: fnBufs[name],
    });
    console.log(r.status);
    if (!r.ok) { console.error(await r.text()); process.exit(1); }
  }

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const s = await fetch(`${API}/sites/${SITE_ID}/deploys/${deploy.id}`, { headers: auth });
    const d = await s.json();
    console.log(`  [${i}] state=${d.state}`);
    if (d.state === 'ready') { console.log('LIVE:', d.ssl_url || d.url); return; }
    if (d.state === 'error') { console.error('Failed:', d.error_message); process.exit(1); }
  }
  console.error('Timed out');
  process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
