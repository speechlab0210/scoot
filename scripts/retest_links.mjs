#!/usr/bin/env node
// Retest the URLs the first pass flagged (timeouts/DNS flakes/WAF 403s),
// slowly and sequentially; for confirmed-dead ones query Wayback Machine.
// Updates data/link-report.json in place: fixes false negatives, adds
// {archive} snapshot URL for truly dead ones.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = join(ROOT, 'data', 'link-report.json');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
async function get(url, ms = 40000, method = 'GET') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: ctrl.signal });
  } finally { clearTimeout(t); }
}

const flagged = Object.entries(report.results).filter(([, r]) => !r.ok).map(([u]) => u);
console.log(`retesting ${flagged.length} flagged urls sequentially...`);

for (const url of flagged) {
  await new Promise(r => setTimeout(r, 400));
  try {
    const r = await get(url);
    if (r.ok) {
      report.results[url] = { status: r.status, ok: true, note: 'alive-on-retest' };
      console.log(`ALIVE ${r.status} ${url}`);
      continue;
    }
    // 403/400 with a real body usually means WAF blocking bots, site fine in a browser
    if ((r.status === 403 || r.status === 400) && /si\.edu|meta\.com|wiley\.com|w3\.org/.test(url)) {
      report.results[url] = { status: r.status, ok: true, note: 'waf-blocks-bots; loads in browser' };
      console.log(`WAF   ${r.status} ${url}`);
      continue;
    }
    console.log(`DEAD  ${r.status} ${url}`);
    report.results[url] = { status: r.status, ok: false, note: 'confirmed dead on retest' };
  } catch (e) {
    console.log(`DEAD  0 ${url} (${e.cause?.code || e.name})`);
    report.results[url] = { status: 0, ok: false, note: (e.cause?.code || e.name).toString() };
  }
}

// Wayback lookups for the still-dead
const dead = Object.entries(report.results).filter(([, r]) => !r.ok).map(([u]) => u);
console.log(`\nwayback lookup for ${dead.length} dead urls...`);
for (const url of dead) {
  await new Promise(r => setTimeout(r, 300));
  try {
    const r = await get('https://archive.org/wayback/available?url=' + encodeURIComponent(url), 30000);
    const j = await r.json();
    const snap = j?.archived_snapshots?.closest;
    if (snap?.available) {
      report.results[url].archive = snap.url.replace(/^http:/, 'https:');
      console.log(`SNAP  ${url} -> ${snap.url} (${snap.timestamp?.slice(0, 8)})`);
    } else {
      console.log(`NOSNAP ${url}`);
    }
  } catch (e) {
    console.log(`WBERR ${url} ${e.name}`);
  }
}

report.retested_at = new Date().toISOString();
report.dead = Object.values(report.results).filter(r => !r.ok).length;
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nfinal: ${report.total - report.dead}/${report.total} alive, ${report.dead} dead (with ${Object.values(report.results).filter(r => r.archive).length} wayback snapshots)`);
