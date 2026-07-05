#!/usr/bin/env node
// SCOOT 2.0 daily updater — fetches latest speech papers (arXiv) and trending
// models (Hugging Face), writes data/latest.json, then rebuilds the site.
// Pure mechanical script: no AI, no credentials, read-only network calls.
// Run: node scripts/update_daily.mjs   (cwd-independent)

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const LOGS = join(ROOT, 'logs');
mkdirSync(LOGS, { recursive: true });

const TIMEOUT_MS = 25000;
const PAPER_WINDOW_DAYS = 10;
const PAPER_CAP = 40;
const HF_TAGS = ['automatic-speech-recognition', 'text-to-speech', 'audio-text-to-text'];
const SPEECH_KEYWORDS = /speech|audio|voice|spoken|speaker|tts|asr|phonet|prosod|dialog|listen|hearing|acoustic|codec|sing/i;

const nowIso = new Date().toISOString();
const warnings = [];

function unescapeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, '&');
}

async function fetchText(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'SCOOT2-daily-updater/1.0 (speech education platform)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

// ---------- arXiv: new speech/audio papers ----------
async function fetchArxiv() {
  const url = 'https://export.arxiv.org/api/query?search_query=' +
    encodeURIComponent('cat:eess.AS OR cat:cs.SD') +
    `&start=0&max_results=${PAPER_CAP * 2}&sortBy=submittedDate&sortOrder=descending`;
  const xml = await fetchText(url);
  const entries = xml.split('<entry>').slice(1);
  const cutoff = Date.now() - PAPER_WINDOW_DAYS * 86400 * 1000;
  const papers = [];
  for (const raw of entries) {
    const pick = (re) => { const m = raw.match(re); return m ? unescapeXml(m[1].trim()) : ''; };
    const id = pick(/<id>([^<]+)<\/id>/);
    const title = pick(/<title>([\s\S]*?)<\/title>/).replace(/\s+/g, ' ');
    const abstract = pick(/<summary>([\s\S]*?)<\/summary>/).replace(/\s+/g, ' ');
    const published = pick(/<published>([^<]+)<\/published>/);
    const authors = [...raw.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => unescapeXml(m[1]));
    const cats = [...raw.matchAll(/<category term="([^"]+)"/g)].map((m) => m[1])
      .filter((c) => /^(eess|cs)\./.test(c));
    if (!id || !title) continue;
    if (new Date(published).getTime() < cutoff) continue;
    papers.push({
      id: id.replace(/^http:/, 'https:'),
      title,
      authors: authors.slice(0, 8),
      abstract: abstract.length > 600 ? abstract.slice(0, 597) + '...' : abstract,
      published,
      cats: [...new Set(cats)].slice(0, 4),
    });
    if (papers.length >= PAPER_CAP) break;
  }
  if (!papers.length) throw new Error('arXiv returned 0 recent papers — likely a fetch/parse problem');
  return papers;
}

// ---------- Hugging Face: trending speech models + daily papers ----------
async function fetchHfModels() {
  const out = [];
  for (const tag of HF_TAGS) {
    const list = await fetchJson(
      `https://huggingface.co/api/models?pipeline_tag=${tag}&sort=trendingScore&direction=-1&limit=6`,
    );
    for (const m of list) {
      out.push({
        id: m.id || m.modelId,
        pipeline: tag,
        likes: m.likes ?? 0,
        downloads: m.downloads ?? 0,
        url: `https://huggingface.co/${m.id || m.modelId}`,
      });
    }
  }
  return out;
}

async function fetchHfDailyPapers() {
  try {
    const list = await fetchJson('https://huggingface.co/api/daily_papers?limit=50');
    return list
      .filter((p) => {
        const t = `${p.paper?.title || ''} ${p.paper?.summary || ''}`;
        return SPEECH_KEYWORDS.test(t);
      })
      .slice(0, 10)
      .map((p) => ({
        title: (p.paper?.title || '').replace(/\s+/g, ' ').trim(),
        url: `https://huggingface.co/papers/${p.paper?.id}`,
        upvotes: p.paper?.upvotes ?? 0,
        published: p.publishedAt || '',
      }));
  } catch (e) {
    warnings.push(`hf daily_papers: ${e.message}`);
    return [];
  }
}

// ---------- main ----------
const prevPath = join(DATA, 'latest.json');
const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, 'utf8')) : {};

let papers = prev.papers || [];
let models = prev.models || [];
let communityPicks = prev.community_picks || [];

try { papers = await fetchArxiv(); } catch (e) { warnings.push(`arxiv: ${e.message} (kept previous)`); }
try { models = await fetchHfModels(); } catch (e) { warnings.push(`hf models: ${e.message} (kept previous)`); }
const picks = await fetchHfDailyPapers();
if (picks.length) communityPicks = picks;

const latest = {
  fetched_at: nowIso,
  paper_window_days: PAPER_WINDOW_DAYS,
  papers,
  models,
  community_picks: communityPicks,
  warnings,
};
writeFileSync(prevPath, JSON.stringify(latest, null, 2));

// rolling archive of paper ids (dedup) so history survives the window
const archivePath = join(DATA, 'papers-archive.jsonl');
const seen = new Set(
  existsSync(archivePath)
    ? readFileSync(archivePath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id)
    : [],
);
const newLines = papers.filter((p) => !seen.has(p.id))
  .map((p) => JSON.stringify({ id: p.id, title: p.title, published: p.published }));
if (newLines.length) appendFileSync(archivePath, newLines.join('\n') + '\n');

// rebuild the site
execFileSync(process.execPath, [join(ROOT, 'scripts', 'build.mjs')], { stdio: 'inherit' });

const status = warnings.length ? `WARN(${warnings.join('; ')})` : 'OK';
appendFileSync(join(LOGS, 'update.log'),
  `${nowIso} papers=${papers.length} models=${models.length} picks=${communityPicks.length} new_archived=${newLines.length} ${status}\n`);
console.log(`[scoot] update done: ${papers.length} papers, ${models.length} models, ${communityPicks.length} community picks. ${status}`);
