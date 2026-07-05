#!/usr/bin/env node
// SCOOT 2.0 site builder — injects data/*.json into site-src/template.html
// and writes site/index.html. Deterministic, no network.
// Run: node scripts/build.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const resources = read('data/resources.json');
const latest = read('data/latest.json');
const editorial = read('data/editorial.json');
const changelog = read('data/changelog.json');

// sanity gates — refuse to build a broken site
if (!Array.isArray(resources.entries)) throw new Error('resources.json: entries must be an array');
for (const e of resources.entries) {
  for (const k of ['title', 'url', 'category', 'description']) {
    if (!e[k]) throw new Error(`resources.json entry missing "${k}": ${JSON.stringify(e).slice(0, 120)}`);
  }
  if (!/^https?:\/\//.test(e.url)) throw new Error(`resources.json: non-http url: ${e.url}`);
}

const data = {
  built_at: new Date().toISOString(),
  resources,
  latest,
  editorial,
  changelog,
};

const template = readFileSync(join(ROOT, 'site-src', 'template.html'), 'utf8');
// </ must be escaped so embedded JSON can never close the script tag
const payload = JSON.stringify(data).replace(/</g, '\\u003c');
if (!template.includes('__SCOOT_DATA__')) throw new Error('template.html missing __SCOOT_DATA__ placeholder');
const html = template.replace('"__SCOOT_DATA__"', payload);

mkdirSync(join(ROOT, 'site'), { recursive: true });
writeFileSync(join(ROOT, 'site', 'index.html'), html);
console.log(`[scoot] built site/index.html: ${resources.entries.length} resources, ${latest.papers?.length ?? 0} papers, ${(html.length / 1024).toFixed(0)} KB`);
