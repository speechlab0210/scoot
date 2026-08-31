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
const sigsData = read('data/sigs.json');       // ISCA SIG directory (import_sigs.mjs)
const sigEd = read('data/sig-editorial.json'); // hand-authored SIG featured content
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

// ---------- SIG part (ISCA SIGs & online events, merged from the SIG Atlas) ----------
const sigStats = {
  sigCount: sigsData.sigs.length,
  recCount: sigsData.sigs.filter((s) => s.hasRec).length,
  liveSeries: sigsData.sigs.filter((s) => s.activeSeries).length,
  videoLinks: sigsData.sigs.reduce((n, s) => n + s.videos.length, 0),
};
// the hijacked domain may be *mentioned* (board-note warning) but never linked
if (/https?:\/\/(www\.)?synsig\.org/i.test(JSON.stringify(sigsData) + JSON.stringify(sigEd))) {
  throw new Error('hijacked domain synsig.org must never be linked from SIG data');
}
// every SIG-part URL must be http(s) — same sanity gate as resources.json
{
  const sigUrls = [];
  for (const s of sigsData.sigs) {
    if (s.website) sigUrls.push(s.website);
    sigUrls.push(s.iscaUrl);
    for (const a of s.activities) if (a.url) sigUrls.push(a.url);
    for (const w of s.series) { if (w.pageUrl) sigUrls.push(w.pageUrl); if (w.recUrl) sigUrls.push(w.recUrl); }
    for (const v of s.videos) sigUrls.push(v.url);
  }
  for (const c of sigEd.series) for (const l of c.links ?? []) sigUrls.push(l.href);
  for (const a of sigEd.archives) for (const l of a.links) sigUrls.push(l.href);
  for (const c of sigEd.central) { if (c.url) sigUrls.push(c.url); for (const l of c.links ?? []) sigUrls.push(l.href); }
  for (const u of sigUrls) if (!/^https?:\/\//.test(u)) throw new Error('SIG data: non-http url: ' + u);
}

const linkRow = (links) => links?.length
  ? `<div class="linkrow">${links.map((l) => `<a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a>`).join('')}</div>`
  : '';

body += `<section class="extended-intro" id="sig-atlas"><h2>${esc(sigEd.part_title)}</h2><p>${esc(sigEd.part_blurb)}</p>` +
  `<div class="sig-stats">` +
  `<div class="stat"><b>${sigStats.sigCount}</b>SIGs</div>` +
  `<div class="stat rec"><b>${sigStats.recCount}</b>with recording links</div>` +
  `<div class="stat"><b>${sigStats.liveSeries}</b>live webinar / lecture series</div>` +
  `<div class="stat"><b>${sigStats.videoLinks}</b>video links reviewed</div>` +
  `</div></section>`;

// 1. webinar & lecture series
body += `<section class="topic" id="sig-series"><h2>${esc(sigEd.series_title)}</h2>` +
  `<div class="intro"><p>${esc(sigEd.series_intro)}</p></div><div class="series-grid">` +
  sigEd.series.map((c) => {
    const search = searchAttr([c.name, c.sig, c.cad, c.text, c.next ?? '', (c.links ?? []).map((l) => l.label).join(' ')].join(' '));
    return `<div class="series-card" data-search="${search}">` +
      `<div class="top"><h4>${esc(c.name)}</h4><span class="pill ${esc(c.pill)}">${esc(c.pill)}</span></div>` +
      `<div class="cad"><span class="sigtag">${esc(c.sig)}</span> · ${esc(c.cad)}</div>` +
      `<p>${esc(c.text)}${c.next ? ` <strong>${esc(c.next)}</strong>` : ''}</p>` +
      linkRow(c.links) + `</div>`;
  }).join('') + `</div></section>`;

// 2. coming up
body += `<section class="topic" id="sig-upcoming"><h2>${esc(sigEd.upcoming_title)}</h2>` +
  `<p class="srcline">${esc(sigEd.upcoming_asof)}</p>` +
  `<div class="intro"><p>${esc(sigEd.upcoming_intro)}</p></div><div class="up-list">` +
  sigEd.upcoming.map((u) => `<div class="up-row" data-search="${searchAttr([u.d, u.what, u.who].join(' '))}">` +
    `<span class="d">${esc(u.d)}</span><span>${esc(u.what)}</span><span class="who">${esc(u.who)}</span></div>`).join('') +
  `</div></section>`;

// 3. recorded workshop archives
body += `<section class="topic" id="sig-archives"><h2>${esc(sigEd.archives_title)} <span class="rec-badge">REC</span></h2>` +
  `<div class="intro"><p>${esc(sigEd.archives_intro)}</p></div><div class="arch-list">` +
  sigEd.archives.map((a) => `<div class="arch-row" data-search="${searchAttr([a.name, a.sig, a.links.map((l) => l.label).join(' ')].join(' '))}">` +
    `<span class="nm">${esc(a.name)}</span><span class="sigtag">${esc(a.sig)}</span>` +
    `<span class="links">${a.links.map((l) => `<a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a>`).join('')}</span></div>`).join('') +
  `</div></section>`;

// 4. SIG directory (build-time rendered; chips are a JS enhancement)
const SIG_STATUS = { 'active': ['st-active', 'active'], 'low-activity': ['st-low', 'low activity'], 'dormant': ['st-dormant', 'dormant'], 'unknown': ['st-unknown', 'unknown'] };
const KIND_TAG = { 'youtube-channel': 'channel', 'youtube-playlist': 'playlist', 'youtube-video': 'video', 'vimeo': 'vimeo', 'video-page': 'page', 'other': 'video' };
const kindCount = (k) => sigsData.sigs.filter((s) => s.kind === k).length;

function renderSigCard(s) {
  const st = SIG_STATUS[s.status] ?? SIG_STATUS.unknown;
  const search = searchAttr([
    s.acronym, s.fullName, s.description, s.kind, s.status,
    s.activities.map((a) => [a.name, a.type, a.cadence, a.last].filter(Boolean).join(' ')).join(' '),
    s.series.map((x) => [x.name, x.cadence, x.platform, x.notes].filter(Boolean).join(' ')).join(' '),
    s.videos.map((v) => [v.title, v.kind, v.what].filter(Boolean).join(' ')).join(' '),
  ].join(' '));
  let h = `<article class="sig-card" data-kind="${esc(s.kind)}" data-rec="${s.hasRec ? '1' : ''}" data-live="${s.activeSeries ? '1' : ''}" data-search="${search}">` +
    `<div class="head"><span class="acr">${esc(s.acronym)}</span>` +
    `<span class="pill ${st[0]}">${st[1]}</span>` +
    (s.hasRec ? `<span class="rec-badge" title="recording links available">REC</span>` : '') +
    `</div><h4>${esc(s.fullName)}</h4><p class="desc">${esc(s.description)}</p>`;
  if (s.activities.length) {
    h += `<details><summary>activities <span class="cnt">${s.activities.length}</span></summary><div class="items">` +
      s.activities.map((a) => {
        const nm = a.url ? `<a href="${esc(a.url)}" rel="noopener">${esc(a.name)}</a>` : esc(a.name);
        const meta = [a.cadence, a.last].filter(Boolean).join(' · ');
        return `<div class="item"><span class="t">${esc(a.type)}</span>${nm}${meta ? `<span class="meta">${esc(meta)}</span>` : ''}</div>`;
      }).join('') + `</div></details>`;
  }
  if (s.videos.length) {
    h += `<details><summary>recordings <span class="cnt">${s.videos.length}</span></summary><div class="items">` +
      s.videos.map((v) => `<div class="item vid"><span class="t">${esc(KIND_TAG[v.kind] ?? 'video')}</span>` +
        `<a href="${esc(v.url)}" rel="noopener">${esc(v.title)}</a><span class="meta">${esc(v.what)}</span></div>`).join('') +
      `</div></details>`;
  }
  h += `<div class="foot">` +
    (s.website ? `<a href="${esc(s.website)}" rel="noopener">Website ↗</a>` : '') +
    `<a href="${esc(s.iscaUrl)}" rel="noopener">ISCA page ↗</a></div></article>`;
  return h;
}

body += `<section class="topic" id="sig-directory"><h2>${esc(sigEd.directory_title)}</h2>` +
  `<div class="intro"><p>${esc(sigEd.directory_intro)}</p></div>` +
  `<div class="sig-filters" role="group" aria-label="Filter SIGs">` +
  `<button class="chip" type="button" data-f="all" aria-pressed="true">All <span class="n">${sigStats.sigCount}</span></button>` +
  `<button class="chip" type="button" data-f="rec" aria-pressed="false">● Recordings <span class="n">${sigStats.recCount}</span></button>` +
  `<button class="chip" type="button" data-f="live" aria-pressed="false">Live series <span class="n">${sigStats.liveSeries}</span></button>` +
  `<button class="chip" type="button" data-f="topic" aria-pressed="false">Topic <span class="n">${kindCount('topic')}</span></button>` +
  `<button class="chip" type="button" data-f="language" aria-pressed="false">Language <span class="n">${kindCount('language')}</span></button>` +
  `</div><div class="sig-note" id="sigDirNote" role="status" aria-live="polite"></div>` +
  `<div class="sig-dir">${sigsData.sigs.map(renderSigCard).join('')}</div></section>`;

// 5. ISCA-level video
body += `<section class="topic" id="sig-central"><h2>${esc(sigEd.central_title)}</h2>` +
  `<div class="intro"><p>${esc(sigEd.central_intro)}</p></div><div class="cent-list">` +
  sigEd.central.map((c) => {
    const search = searchAttr([c.name, c.what, (c.links ?? []).map((l) => l.label).join(' ')].join(' '));
    const nm = c.url ? `<a href="${esc(c.url)}" rel="noopener">${esc(c.name)}</a>` : esc(c.name);
    const extra = c.links?.length ? `<span class="cent-links">${c.links.map((l) => `<a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a>`).join('')}</span>` : '';
    return `<div class="cent-row" data-search="${search}"><span class="nm">${nm}</span><span class="what">${esc(c.what)}</span>${extra}</div>`;
  }).join('') + `</div></section>`;

// 6. board notes
body += `<section class="topic" id="sig-notes"><h2>${esc(sigEd.notes_title)}</h2>` +
  `<div class="callout"><h4>${esc(sigEd.notes_head)}</h4><ul>` +
  sigEd.notes.map((n) => `<li class="note-item" data-search="${searchAttr(n.text)}">${n.warn ? '<span class="warn-ico">⚠</span> ' : ''}${esc(n.text)}</li>`).join('') +
  `</ul></div></section>`;

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
    `<div class="sig-stats">` +
    ba.stats.map((s, i) => `<div class="stat${i === 0 ? ' rec' : ''}"><b data-ba-stat="${esc(s.key)}">${esc(s.n)}</b>${esc(s.label)}</div>`).join('') +
    `</div>` +
    `<p class="srcline">Counts from the <span data-ba-asof>${esc(ba.asof)}</span> build; the atlas rebuilds daily.</p>` +
    `<p><a class="contact-btn" href="${esc(ba.url)}" rel="noopener">Open the Benchmark Atlas →</a> · <a href="${esc(ba.paper_url)}" rel="noopener">overview paper</a> · <a href="${esc(ba.repo_url)}" rel="noopener">data + scripts</a></p>` +
    `<p class="srcline">${esc(ba.maintained)}</p>` +
    `</div></section>`;
}

// ---------- nav ----------
let nav = '<div class="toc-head">Scoot Topics</div>';
nav += `<a href="#welcome">Welcome</a>`;
for (const s of original.sections) {
  nav += `<a href="#${esc(s.key)}">${esc(s.title)}</a>`;
  for (const sub of s.subsections ?? []) nav += `<a class="sub" href="#${esc(sub.key)}">${esc(sub.title)}</a>`;
}
nav += '<div class="toc-head">Extensions</div>';
for (const t of editorial.extended_topics) nav += `<a href="#${esc(t.key)}">${esc(t.title)}</a>`;
nav += '<div class="toc-head">SIGs &amp; Online Events</div>' +
  '<a href="#sig-series">Webinar &amp; lecture series</a>' +
  '<a href="#sig-upcoming">Coming up</a>' +
  '<a href="#sig-archives">Workshop archives</a>' +
  '<a href="#sig-directory">SIG directory</a>' +
  '<a href="#sig-central">ISCA-level video</a>' +
  '<a href="#sig-notes">Board notes</a>';
if (editorial.benchmark_atlas) {
  nav += '<div class="toc-head">Benchmarks</div><a href="#benchmark-atlas">Spoken LLM Benchmark Atlas</a>';
}
nav += '<div class="toc-head">About</div><a href="#about">About this site</a><a href="#contribute">Suggest a resource</a><a href="#changelog">Changelog</a>';

// ---------- footer ----------
let footer = `<h2 id="about">About</h2>` + editorial.about.map((p) => `<p>${esc(p)}</p>`).join('');
footer += `<h2>How this site is maintained</h2>` + editorial.how_it_works.map((p) => `<p>${esc(p)}</p>`).join('');
footer += `<h2>The SIG part</h2><p>${esc(sigEd.method)}</p><p>${esc(sigEd.disclosure)}</p>`;
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
  ? `${linkReport.total ?? Object.keys(linkReport.results ?? {}).length} unique catalog links; last checked ${linkCheckedLabel}`
  : 'link-check time not recorded';
footer += `<p class="built">${nOrig} original SCOOT entries (all preserved) + ${resources.entries.length} extension entries · ${esc(linkStatus)} · ${sigStats.sigCount} ISCA SIGs with ${sigStats.videoLinks} video links, each reviewed ${esc(sigEd.reviewed)} · source data + build scripts: <a href="https://github.com/speechlab0210/scoot" rel="noopener">github.com/speechlab0210/scoot</a></p>`;

// ---------- assemble ----------
const template = readFileSync(join(ROOT, 'site-src', 'template.html'), 'utf8');
for (const ph of ['__TAGLINE__', '__BANNER__', '__ORIGINAL_HOME__', '__SCOOT_NAV__', '__SCOOT_BODY__', '__SCOOT_FOOTER__']) {
  if (!template.includes(ph)) throw new Error('template.html missing placeholder ' + ph);
}
// function replacements: with a plain string, $&/$'/$`/$$ in data-derived
// content are ACTIVE replacement patterns and silently corrupt the output
const html = template
  .replace('__TAGLINE__', () => esc(editorial.tagline))
  .replace('__BANNER__', () => esc(editorial.banner))
  .replace('__ORIGINAL_HOME__', () => esc(editorial.original_home))
  .replace('__SCOOT_NAV__', () => nav)
  .replace('__SCOOT_BODY__', () => body)
  .replace('__SCOOT_FOOTER__', () => footer);

mkdirSync(join(ROOT, 'site'), { recursive: true });
writeFileSync(join(ROOT, 'site', 'index.html'), html);
console.log(`[scoot] built site/index.html: ${nOrig} original + ${resources.entries.length} extension entries, ${(html.length / 1024).toFixed(0)} KB`);
