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

function renderOriginalEntries(entries, topicTitle) {
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
      e.text, topicTitle,
      ...(e.links ?? []).map((l) => l.label),
      ...(e.lectures ?? []).map((l) => l.title + ' slides audio'),
      currentGroup ?? '',
    ].join(' '));
    openList();
    html += `<li data-origin="original" data-search="${search}">${esc(e.text)}${renderLinks(e.links)}${renderLectures(e.lectures)}</li>`;
  }
  closeList();
  return html;
}

function renderExtEntry(e) {
  const meta = [e.type, e.level, e.cost, e.year].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('');
  const search = searchAttr([e.title, e.org, e.description, (e.topics ?? []).join(' | '), e.type, e.level, e.cost, topicNames[e.topic]].join(' '));
  const d = deadInfo(e.url);
  return `<div class="ext-item" data-origin="extension" data-search="${search}">` +
    `<a class="et" href="${esc(e.url)}" rel="noopener">${esc(e.title)}</a>` +
    (e.org ? ` <span class="eo">— ${esc(e.org)}</span>` : '') +
    (d ? ` <span class="deadnote">(link may be down)</span>` : '') +
    `<p class="ed">${esc(e.description)}</p>` +
    (meta ? `<div class="em">${meta}</div>` : '') +
    `</div>`;
}

const topicNames = {};
function indexTopics(sections) {
  for (const section of sections) {
    topicNames[section.key] = section.title;
    indexTopics(section.subsections ?? []);
  }
}
indexTopics(original.sections);
indexTopics(editorial.extended_topics);
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
    const seeAlso = `<p class="srcline">See also: ${section.intro_links.map((l) => `<a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a>`).join(' · ')}</p></div>`;
    html = html.replace('</div>', () => seeAlso);
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
    html += renderOriginalEntries(section.entries, section.title);
  }
  html += renderExtBlock(section.key);
  for (const sub of section.subsections ?? []) html += renderSection(sub, depth + 1);
  html += '</section>';
  return html;
}

// ---------- body ----------
const countOriginal = (s) => (s.entries?.length ?? 0) + (s.subsections ?? []).reduce((n, sub) => n + countOriginal(sub), 0);
const countExtensions = (s) => (extByTopic[s.key]?.length ?? 0) + (s.subsections ?? []).reduce((n, sub) => n + countExtensions(sub), 0);
const sigUrl = editorial.sig_atlas.url;
if (sigUrl !== 'https://speechlab0210.github.io/isca-sig-directory/') throw new Error('Unexpected SIG destination');
let body = `<section class="start-here" id="welcome" aria-labelledby="welcome-title">
  <p class="eyebrow">THE LEARNING DIRECTORY</p><h2 id="welcome-title">What would you like to learn?</h2>
  <p class="start-intro">Start with a topic, or search for a course, tool, author or idea. Original resources and later additions are labeled separately.</p>
  <div class="topic-grid">${original.sections.map((s, i) => `<a class="topic-card" href="#${esc(s.key)}"><span class="topic-number">${String(i + 1).padStart(2, '0')}</span><strong>${esc(s.title)}</strong><span>${countOriginal(s) + countExtensions(s)} resources <span aria-hidden="true">↗</span></span></a>`).join('')}</div>
  <div class="extra-topics"><span>Also explore</span>${editorial.extended_topics.map((t) => `<a href="#${esc(t.key)}">${esc(t.title)}</a>`).join('')}</div>
  <details class="original-welcome"><summary>About the original SCOOT catalog</summary>${original.welcome.map((p) => `<p>${esc(p)}</p>`).join('')}<p class="srcline">Original wording from the ${esc(original.archived_at)} snapshot · <a href="${esc(editorial.original_home)}">Visit the original SCOOT</a></p></details>
</section>
<div class="related-sites" aria-label="Related directories">
  <section class="related-card" id="sig-atlas"><p class="eyebrow">COMMUNITY &amp; EVENTS</p><h2><a href="${esc(sigUrl)}">ISCA SIG Atlas <span aria-hidden="true">↗</span></a></h2><p>SIGs, seminars, events and recordings now have their own website.</p><a class="text-link" href="${esc(sigUrl)}">Explore the SIG website →</a>${['series','upcoming','archives','directory','central','notes'].map((id) => `<span id="sig-${id}" class="legacy-anchor" aria-hidden="true"></span>`).join('')}</section>
  <section class="related-card"><p class="eyebrow">SPOKEN LANGUAGE MODELS</p><h2><a href="${esc(editorial.benchmark_atlas.url)}">Benchmark Atlas <span aria-hidden="true">↗</span></a></h2><p>Explore evaluation tasks, benchmark coverage and reported results.</p><a class="text-link" href="${esc(editorial.benchmark_atlas.url)}">Explore the benchmarks →</a></section>
</div>
<div class="catalog-heading" id="catalog"><p class="eyebrow">BROWSE THE COLLECTION</p><h2>The resource catalog</h2><p>Original SCOOT entries <span class="legend-dot original-dot"></span> &nbsp; / &nbsp; SCOOT 2.0 extensions <span class="legend-dot extension-dot"></span></p></div>
<div class="empty-state" id="emptyState" hidden><h2>No resources match these filters.</h2><p>Try a shorter phrase or choose All resources. For SIGs and events, <a href="${esc(sigUrl)}">visit the SIG Atlas</a>.</p><button type="button" id="resetEmpty">Reset search and filters</button></div>`;

for (const s of original.sections) body += renderSection(s, 0);

body += `<section class="extended-intro" id="extended"><h2>Beyond the original topics</h2><p>${esc(editorial.ext_blurb)} Three additional areas of speech communication.</p></section>`;
for (const t of editorial.extended_topics) {
  body += `<section class="topic" id="${esc(t.key)}"><h2>${esc(t.title)}</h2><div class="intro"><p>${esc(t.blurb)}</p></div>${renderExtBlock(t.key)}</section>`;
}

// orphan gate: every curated topic must have been rendered somewhere
const orphans = Object.keys(extByTopic).filter((k) => !renderedTopics.has(k));
if (orphans.length) throw new Error('curated topics with no home in the tree: ' + orphans.join(', '));

// ---------- Spoken LLM Benchmark Atlas (satellite page under SCOOT 2.0) ----------
const ba = editorial.benchmark_atlas;
if (ba) {
  for (const u of [ba.url, ba.stats_url, ba.repo_url, ba.paper_url]) {
    if (!/^https?:\/\//.test(u)) throw new Error('benchmark_atlas: non-http url: ' + u);
  }
  const baSearch = searchAttr([ba.title, ba.blurb, ba.stats.map((s) => s.label).join(' '), 'spoken llm benchmark atlas evaluation'].join(' '));
  body += `<section class="topic" id="benchmark-atlas"><h2>${esc(ba.title)}</h2>` +
    `<div class="intro"><p>${esc(ba.blurb)}</p></div>` +
    `<div class="callout ba-card" data-search="${baSearch}" data-stats-url="${esc(ba.stats_url)}">` +
    `<div class="atlas-stats">` +
    ba.stats.map((s, i) => `<div class="stat${i === 0 ? ' rec' : ''}"><b data-ba-stat="${esc(s.key)}">${esc(s.n)}</b>${esc(s.label)}</div>`).join('') +
    `</div>` +
    `<p class="srcline">Counts from the <span data-ba-asof>${esc(ba.asof)}</span> build; counts refresh from the linked atlas when available.</p>` +
    `<p><a class="contact-btn" href="${esc(ba.url)}" rel="noopener">Open the Benchmark Atlas →</a> · <a href="${esc(ba.paper_url)}" rel="noopener">overview paper</a> · <a href="${esc(ba.repo_url)}" rel="noopener">data + scripts</a></p>` +
    `<p class="srcline">${esc(ba.maintained)}</p>` +
    `</div></section>`;
}

// ---------- nav ----------
let nav = '<div class="toc-head">Browse topics</div>';
nav += `<a href="#welcome">Start here</a>`;
for (const s of original.sections) {
  nav += `<a href="#${esc(s.key)}">${esc(s.title)}</a>`;
  for (const sub of s.subsections ?? []) nav += `<a class="sub" href="#${esc(sub.key)}">${esc(sub.title)}</a>`;
}
nav += '<div class="toc-head">Extensions</div>';
for (const t of editorial.extended_topics) nav += `<a href="#${esc(t.key)}">${esc(t.title)}</a>`;
nav += `<div class="toc-head">Related directories</div><a href="${esc(sigUrl)}">ISCA SIG Atlas ↗</a>`;
if (editorial.benchmark_atlas) {
  nav += '<div class="toc-head">Benchmarks</div><a href="#benchmark-atlas">Spoken LLM Benchmark Atlas</a>';
}
nav += '<div class="toc-head">About</div><a href="#about">About this site</a><a href="#contribute">Suggest a resource</a><a href="#changelog">Changelog</a>';

// ---------- footer ----------
let footer = `<h2 id="about">About</h2>` + editorial.about.map((p) => `<p>${esc(p)}</p>`).join('');
footer += `<h2>How this site is maintained</h2>` + editorial.how_it_works.map((p) => `<p>${esc(p)}</p>`).join('');
footer += `<h2 id="contribute">Suggest a resource</h2>` + editorial.contribute.map((p) => `<p>${esc(p)}</p>`).join('');
footer += `<p><a class="contact-btn" href="mailto:${esc(editorial.contact_email)}?subject=%5BSCOOT%5D%20suggestion">✉ Email a suggestion</a> · <a href="https://github.com/speechlab0210/scoot/issues" rel="noopener">Open a GitHub issue</a></p>`;
footer += `<h2 id="changelog">Changelog</h2><ul class="changelog">` +
  [...changelog.entries].sort((a, b) => b.date.localeCompare(a.date)).map((c) => `<li><span class="cd">${esc(c.date)}</span> — ${esc(c.change)}</li>`).join('') + '</ul>';

const nOrig = (() => {
  let n = 0;
  const walk = (s) => { n += s.entries?.length ?? 0; (s.subsections ?? []).forEach(walk); };
  original.sections.forEach(walk);
  return n;
})();
const linkCheckedAt = linkReport.retested_at ?? linkReport.checked_at;
const linkCheckedLabel = linkCheckedAt?.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
const linkStatus = linkCheckedAt
  ? `${linkReport.total ?? Object.keys(linkReport.results ?? {}).length} unique catalog links; last checked ${linkCheckedLabel}`
  : 'link-check time not recorded';
footer += `<p class="built">${nOrig} original SCOOT entries (all preserved) + ${resources.entries.length} extension entries · ${esc(linkStatus)} · source data + build scripts: <a href="https://github.com/speechlab0210/scoot" rel="noopener">github.com/speechlab0210/scoot</a></p>`;

// ---------- assemble ----------
const template = readFileSync(join(ROOT, 'site-src', 'template.html'), 'utf8');
for (const ph of ['__TAGLINE__', '__BANNER__', '__ORIGINAL_HOME__', '__SCOOT_NAV__', '__SCOOT_BODY__', '__SCOOT_FOOTER__', '__CATALOG_COUNTS__']) {
  if (!template.includes(ph)) throw new Error('template.html missing placeholder ' + ph);
}
// function replacements: with a plain string, $&/$'/$`/$$ in data-derived
// content are ACTIVE replacement patterns and silently corrupt the output
const html = template
  .replace('__CATALOG_COUNTS__', () => `${nOrig} original resources · ${resources.entries.length} extensions · ${original.sections.length} core topics`)
  .replace('__TAGLINE__', () => esc(editorial.tagline))
  .replace('__BANNER__', () => esc(editorial.banner))
  .replace('__ORIGINAL_HOME__', () => esc(editorial.original_home))
  .replace('__SCOOT_NAV__', () => nav)
  .replace('__SCOOT_BODY__', () => body)
  .replace('__SCOOT_FOOTER__', () => footer);

const outDir = process.argv.includes('--publish-output') ? ROOT : join(ROOT, 'site');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
console.log(`[scoot] built ${process.argv.includes('--publish-output') ? 'index.html' : 'site/index.html'}: ${nOrig} original + ${resources.entries.length} extension entries, ${(html.length / 1024).toFixed(0)} KB`);
