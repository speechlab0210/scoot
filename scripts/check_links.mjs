#!/usr/bin/env node
// Link checker for SCOOT data files. No credentials, read-only network.
// Checks every URL in data/original.json and data/resources.json.
// YouTube watch/playlist URLs get a body sniff (HEAD lies for deleted videos).
// Output: data/link-report.json  { checked_at, results: { url: {status, ok, note} } }
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const urls = new Set();

function harvestOriginal(o) {
  const fromSection = (s) => {
    for (const l of s.intro_links ?? []) urls.add(l.href);
    for (const e of s.entries ?? []) {
      for (const l of e.links ?? []) urls.add(l.href);
      for (const lec of e.lectures ?? []) { urls.add(lec.slides); urls.add(lec.audio); }
    }
    for (const sub of s.subsections ?? []) fromSection(sub);
  };
  for (const s of o.sections) fromSection(s);
}
harvestOriginal(read('data/original.json'));
const originalCount = urls.size;
for (const e of read('data/resources.json').entries) urls.add(e.url);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchWithTimeout(url, opts = {}, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: '*/*' }, signal: ctrl.signal, ...opts });
  } finally { clearTimeout(t); }
}

async function checkYouTube(url) {
  try {
    const r = await fetchWithTimeout(url, { method: 'GET' });
    if (!r.ok) return { status: r.status, ok: false, note: 'http error' };
    const body = (await r.text()).slice(0, 400000);
    if (/"status":"ERROR"|Video unavailable|"playabilityStatus":\{"status":"(ERROR|LOGIN_REQUIRED)"/.test(body) && !/"status":"OK"/.test(body)) {
      return { status: r.status, ok: false, note: 'video unavailable' };
    }
    if (/playlist/.test(url) && /does not exist/i.test(body)) return { status: r.status, ok: false, note: 'playlist gone' };
    return { status: r.status, ok: true };
  } catch (e) { return { status: 0, ok: false, note: e.name === 'AbortError' ? 'timeout' : e.message.slice(0, 80) }; }
}

async function checkOne(url) {
  if (/youtube\.com\/(watch|playlist)|youtu\.be\//.test(url)) return checkYouTube(url);
  try {
    let r = await fetchWithTimeout(url, { method: 'HEAD' });
    if (r.status === 405 || r.status === 403 || r.status === 404 || r.status >= 500) {
      // some servers reject HEAD; retry GET before declaring death
      r = await fetchWithTimeout(url, { method: 'GET' });
    }
    return { status: r.status, ok: r.ok, note: r.ok ? undefined : 'http error' };
  } catch (e) {
    // TLS/connection errors on old http sites: one GET retry
    try {
      const r = await fetchWithTimeout(url, { method: 'GET' });
      return { status: r.status, ok: r.ok, note: r.ok ? 'get-retry' : 'http error' };
    } catch (e2) {
      return { status: 0, ok: false, note: (e2.cause?.code || e2.name || e2.message).toString().slice(0, 80) };
    }
  }
}

const list = [...urls];
console.log(`checking ${list.length} unique urls (${originalCount} from original.json)...`);
const results = {};
const POOL = 12;
let i = 0;
async function worker() {
  while (i < list.length) {
    const url = list[i++];
    results[url] = await checkOne(url);
    if (!results[url].ok) console.log(`DEAD ${results[url].status} ${url} (${results[url].note ?? ''})`);
  }
}
await Promise.all(Array.from({ length: POOL }, worker));

const dead = Object.entries(results).filter(([, r]) => !r.ok);
writeFileSync(join(ROOT, 'data', 'link-report.json'), JSON.stringify({ checked_at: new Date().toISOString(), total: list.length, dead: dead.length, results }, null, 2));
console.log(`done: ${list.length - dead.length}/${list.length} alive, ${dead.length} dead -> data/link-report.json`);
