#!/usr/bin/env node
// SCOOT site builder (v2, 2026-08-31 rebuild) — renders the full page at build
// time from data/*.json into site/index.html via site-src/template.html.
// Structure = the ORIGINAL ISCA SCOOT topic tree (data/original.json), each
// topic showing original entries first, then curated 2.0 extensions
// (data/resources.json, entry.topic keys into the tree).
// Deterministic, no network. Run: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const original = read('data/original.json');
const resources = read('data/resources.json');
const editorial = read('data/editorial.json');
const changelog = read('data/changelog.json');
let linkReport = { results: {} };
try { linkReport = read('data/link-report.json'); } catch { /* optional */ }

// ---------- sanity gates ----------
if (!Array.isArray(resources.entries)) throw new Error('resources.json: entries must be an array');
for (const e of resources.entries) {
  for (const k of ['title', 'url', 'topic', 'description']) {
    if (!e[k]) throw new Error(`resources.json entry missing "${k}": ${JSON.stringify(e).slice(0, 120)}`);
  }
  if (!/^https?:\/\//.test(e.url)) throw new Error(`resources.json: non-http url: ${e.url}`);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const searchAttr = (s) => esc(s.toLowerCase().replace(/\s+/g, ' ').trim());

const deadInfo = (href) => {
  const r = linkReport.results?.[href];
  if (!r || r.ok) return null;
  return r; // { status, ok:false, note, archive? }
};

function renderLinks(links) {
  if (!links?.length) return '';
  const parts = links.map((l) => {
    let out = `<a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a>`;
    const d = deadInfo(l.href);
    if (d) {
      out += d.archive
        ? ` <span class="archived">(<a href="${esc(d.archive)}" rel="noopener">archived copy</a>)</span>`
        : ` <span class="deadnote">(link may be down)</span>`;
    }
    return out;
  });
  return ` <span class="res-links">[${parts.join(' ')}]</span>`;
}

function renderLectures(lectures) {
  if (!lectures?.length) return '';
  const cells = lectures.map((lec) => {
    const dS = deadInfo(lec.slides); const dA = deadInfo(lec.audio);
    return `<div class="lecture">` +
      `<span class="lt">${esc(lec.title)}</span>` +
      `<a href="${esc(lec.slides)}" rel="noopener">Slides</a><a href="${esc(lec.audio)}" rel="noopener">Audio</a>` +
      `${(dS || dA) ? ' <span class="deadnote">⚠</span>' : ''}</div>`;
  });
  return `<div class="lectures">${cells.join('')}</div>`;
}

function renderOriginalEntries(entries) {
  if (!entries?.length) return '';
  let html = '';
  let currentGroup = null;
  let listOpen = false;
  const openList = () => { if (!listOpen) { html += '<ul class="orig">'; listOpen = true; } };
  const closeList = () => { if (listOpen) { html += '</ul>'; listOpen = false; } };
  for (const e of entries) {
    if ((e.group ?? null) !== currentGroup) {
      closeList();
      currentGroup = e.group ?? null;
      if (currentGroup) html += `<div class="group-head">${esc(currentGroup)}</div>`;
    }
    // A lecture grid belongs to its parent resource. Include lecture titles in
    // the parent index so a matching lecture never survives inside a hidden <li>.
    const search = searchAttr([
      e.text,
      ...(e.links ?? []).map((l) => l.label),
      ...(e.lectures ?? []).map((l) => l.title + ' slides audio'),
      currentGroup ?? '',
    ].join(' '));
    openList();
    html += `<li data-search="${search}">${esc(e.text)}${renderLinks(e.links)}${renderLectures(e.lectures)}</li>`;
  }
  closeList();
  return html;
}

function renderExtEntry(e) {
  const meta = [e.type, e.level, e.cost, e.year].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('');
  const search = searchAttr([e.title, e.org, e.description, (e.topics ?? []).join(' | '), e.type].join(' '));
  const d = deadInfo(e.url);
  return `<div class="ext-item" data-search="${search}">` +
    `<a class="et" href="${esc(e.url)}" rel="noopener">${esc(e.title)}</a>` +
    (e.org ? ` <span class="eo">— ${esc(e.org)}</span>` : '') +
    (d ? ` <span class="deadnote">(link may be down)</span>` : '') +
    `<p class="ed">${esc(e.description)}</p>` +
    (meta ? `<div class="em">${meta}</div>` : '') +
    `</div>`;
}

const extByTopic = {};
for (const e of resources.entries) (extByTopic[e.topic] ||= []).push(e);
const renderedTopics = new Set();

function renderExtBlock(key) {
  renderedTopics.add(key);
  const list = extByTopic[key];
  if (!list?.length) return '';
  return `<div class="ext-head">✚ ${esc(editorial.ext_label)} · ${list.length}</div>` +
    `<div class="ext-list">${list.map(renderExtEntry).join('')}</div>`;
}

function renderIntro(section) {
  let html = '';
  if (section.intro?.length) {
    html += '<div class="intro">' + section.intro.map((p) => `<p>${esc(p)}</p>`).join('') + '</div>';
  }
  if (section.intro_links?.length) {
    html = html.replace('</div>', `<p class="srcline">See also: ${section.intro_links.map((l) => `<a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a>`).join(' · ')}</p></div>`);
  }
  return html;
}

function renderSection(section, depth) {
  const tag = depth === 0 ? 'h2' : 'h3';
  const cls = depth === 0 ? 'topic' : 'subtopic';
  let html = `<section class="${cls}" id="${esc(section.key)}">`;
  html += `<${tag}>${esc(section.title)}</${tag}>`;
  html += `<p class="srcline">Original SCOOT page: <a href="${esc(section.source_page)}" rel="noopener">${esc(section.source_page.replace('https://', ''))}</a></p>`;
  html += renderIntro(section);
  if (section.entries?.length) {
    html += `<div class="orig-head">● Original SCOOT · ${section.entries.length}</div>`;
    html += renderOriginalEntries(section.entries);
  }
  html += renderExtBlock(section.key);
  for (const sub of section.subsections ?? []) html += renderSection(sub, depth + 1);
  html += '</section>';
  return html;
}

// ---------- body ----------
let body = '';
body += `<section class="topic" id="welcome"><h2>Welcome</h2><div class="intro">` +
  original.welcome.map((p) => `<p>${esc(p)}</p>`).join('') +
  `<p class="srcline">Transcribed from the original SCOOT pages (${esc(original.archived_at)} snapshot) — <a href="${esc(editorial.original_home)}" rel="noopener">original site</a>.</p></div></section>`;

for (const s of original.sections) body += renderSection(s, 0);

body += `<section class="extended-intro" id="extended"><h2>Beyond the original topics</h2><p>${esc(editorial.ext_blurb)} Three areas of speech communication the original SCOOT never covered.</p></section>`;
for (const t of editorial.extended_topics) {
  body += `<section class="topic" id="${esc(t.key)}"><h2>${esc(t.title)}</h2><div class="intro"><p>${esc(t.blurb)}</p></div>${renderExtBlock(t.key)}</section>`;
}

// orphan gate: every curated topic must have been rendered somewhere
const orphans = Object.keys(extByTopic).filter((k) => !renderedTopics.has(k));
if (orphans.length) throw new Error('curated topics with no home in the tree: ' + orphans.join(', '));

// ---------- nav ----------
let nav = '<div class="toc-head">Scoot Topics</div>';
nav += `<a href="#welcome">Welcome</a>`;
for (const s of original.sections) {
  nav += `<a href="#${esc(s.key)}">${esc(s.title)}</a>`;
  for (const sub of s.subsections ?? []) nav += `<a class="sub" href="#${esc(sub.key)}">${esc(sub.title)}</a>`;
}
nav += '<div class="toc-head">Extensions</div>';
for (const t of editorial.extended_topics) nav += `<a href="#${esc(t.key)}">${esc(t.title)}</a>`;
nav += '<div class="toc-head">About</div><a href="#about">About this site</a><a href="#contribute">Suggest a resource</a><a href="#changelog">Changelog</a>';

// ---------- footer ----------
let footer = `<h2 id="about">About</h2>` + editorial.about.map((p) => `<p>${esc(p)}</p>`).join('');
footer += `<h2>How this site is maintained</h2>` + editorial.how_it_works.map((p) => `<p>${esc(p)}</p>`).join('');
footer += `<h2 id="contribute">Suggest a resource</h2>` + editorial.contribute.map((p) => `<p>${esc(p)}</p>`).join('');
footer += `<p><a class="contact-btn" href="mailto:${esc(editorial.contact_email)}?subject=%5BSCOOT%5D%20suggestion">✉ Email a suggestion</a> · <a href="https://github.com/speechlab0210/scoot/issues" rel="noopener">Open a GitHub issue</a></p>`;
footer += `<h2 id="changelog">Changelog</h2><ul class="changelog">` +
  [...changelog.entries].reverse().map((c) => `<li><span class="cd">${esc(c.date)}</span> — ${esc(c.change)}</li>`).join('') + '</ul>';

const nOrig = (() => {
  let n = 0;
  const walk = (s) => { n += s.entries?.length ?? 0; (s.subsections ?? []).forEach(walk); };
  original.sections.forEach(walk);
  return n;
})();
const linkCheckedAt = linkReport.retested_at ?? linkReport.checked_at;
const linkCheckedLabel = linkCheckedAt?.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
const linkStatus = linkCheckedAt
  ? `${linkReport.total ?? Object.keys(linkReport.results ?? {}).length} unique links; last checked ${linkCheckedLabel}`
  : 'link-check time not recorded';
footer += `<p class="built">${nOrig} original SCOOT entries (all preserved) + ${resources.entries.length} extension entries · ${esc(linkStatus)} · source data + build scripts: <a href="https://github.com/speechlab0210/scoot" rel="noopener">github.com/speechlab0210/scoot</a></p>`;

// ---------- assemble ----------
const template = readFileSync(join(ROOT, 'site-src', 'template.html'), 'utf8');
for (const ph of ['__TAGLINE__', '__BANNER__', '__ORIGINAL_HOME__', '__SCOOT_NAV__', '__SCOOT_BODY__', '__SCOOT_FOOTER__']) {
  if (!template.includes(ph)) throw new Error('template.html missing placeholder ' + ph);
}
const html = template
  .replace('__TAGLINE__', esc(editorial.tagline))
  .replace('__BANNER__', esc(editorial.banner))
  .replace('__ORIGINAL_HOME__', esc(editorial.original_home))
  .replace('__SCOOT_NAV__', nav)
  .replace('__SCOOT_BODY__', body)
  .replace('__SCOOT_FOOTER__', footer);

mkdirSync(join(ROOT, 'site'), { recursive: true });
writeFileSync(join(ROOT, 'site', 'index.html'), html);
console.log(`[scoot] built site/index.html: ${nOrig} original + ${resources.entries.length} extension entries, ${(html.length / 1024).toFixed(0)} KB`);
