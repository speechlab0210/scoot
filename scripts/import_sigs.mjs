#!/usr/bin/env node
// Imports the ISCA SIG Atlas dataset into SCOOT 2.0.
// Truth source: ../isca-sig-atlas/data.json (research + adversarial verify, 2026-08-31).
// Applies the same verification patches + slimming as the Atlas's own build_site.js,
// so data/sigs.json here === the payload embedded in the (approved) public Atlas page.
// Deliberately excludes notes/verifyNotes/sources/corrections (internal fields that
// may contain person names never cleared for this page). Run: node scripts/import_sigs.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ATLAS = join(ROOT, '..', 'isca-sig-atlas', 'data.json');
const d = JSON.parse(readFileSync(ATLAS, 'utf8'));

// ---- patches from the Atlas verification pass (kept in lockstep with
//      isca-sig-atlas/build_site.js — update both or neither) ----
const PATCHES = [
  ['SIGUL', 0, { lastOrNext: 'SIGUL 2026 held 11-12 May 2026 at LREC 2026, Palma de Mallorca (proceedings published)' }],
  ['SIGUL', 2, { lastOrNext: 'SLTU 2018, Gurugram (Delhi NCR) - last standalone edition' }],
  ['SIGUL', 3, { lastOrNext: 'SLTU-CCURL 2020 (LREC 2020 itself was cancelled; joint proceedings published)' }],
  ['SpLC', 1, { url: 'https://mm.kaist.ac.kr/datasets/voxceleb/voxsrc/interspeech2023.html', lastOrNext: 'VoxSRC-23 (2023) - final edition; a retrospective paper closed the series' }],
  ['SProSIG', 2, { cadence: 'biennial in odd years since 2021 (as TAI)', lastOrNext: 'TAI 2025, Munich; next TAI 2027, Hong Kong, May 27-29, 2027' }],
  ['SIGdial', 3, { lastOrNext: "next: SemDial 2026 'LuffDial' (30th), Loughborough, UK, Sep 3-4, 2026" }],
  ['SIGdial', 4, { cadence: 'ongoing (open for submissions to issue 17(2), 2026)' }],
  ['SLaTE', 4, { cadence: 'historical/dormant (LTLT 2015, 2016)', lastOrNext: 'LTLT 2016' }],
  ['SIG-CSLP', 1, { url: 'https://iscslp.org/2026/CallForSpecialSessionPapers' }],
  ['SIGRU', 0, { url: null }],
  ['SLPAT', 2, { cadence: 'ongoing; roughly one thread per month (mostly CFPs/announcements)' }],
];
for (const [acr, i, patch] of PATCHES) {
  const s = d.sigs.find((x) => x.acronym === acr || (x.acronym || '').startsWith(acr));
  if (s && s.activities[i]) Object.assign(s.activities[i], patch);
  else throw new Error(`PATCH MISS ${acr} ${i}`);
}
const sigru = d.sigs.find((x) => x.acronym === 'SIGRU');
if (sigru) sigru.description = sigru.description.replace('Founded in 2008 and based', 'Based');

// ---- slim payload (same shape as the public Atlas page's embedded JSON) ----
const LANG = ['SIG-CSLP', 'AFCP', 'AISV', 'SIG-IL', 'SIG-ILSP', 'SIGRU'];
const ISCA_PATHS = {
  'SynSIG': '/Speech-Synthesis-SynSig', 'AVISA': '/Audio-Visual-Speech-AVISA', 'SIGUL': '/Under-resourced-Languages-SIGUL',
  'SpLC': '/Speaker-and-Language-Characterization-SpLC', 'SProSIG': '/Speech-Prosody-SProSIG', 'SIGdial': '/Discourse-and-Dialogue-SIGdial',
  'SLaTE': '/Speech-and-Language-Technology-in-Education-SLaTE', 'SIGML': '/Machine-Learning-SIGML',
  'SLPAT': '/Speech-and-Language-Processing-for-Assistive-Technologies-SLPAT', 'SIG-HIST': '/The-History-of-Speech-Communication-Sciences-SIG-HIST',
  'SIG-CHILD': '/Child-Computer-Interaction-SIG-CHILD', 'SIG-RoSP': '/Robust-Speech-Processing-SIG-RoSP',
  'SIG-SPSC': '/Security-and-Privacy-in-Speech-Communication-SIG-SPSC', 'SIG-SLT': '/Spoken-Language-Translation-SIG-SLT',
  'SIG-CSLP': '/Chinese-Spoken-Language-Processing-SIG-CSLP', 'AFCP': '/Association-Francophone-de-la-Communication-Parle-AFCP',
  'AISV': '/Associazione-Italiana-di-Scienze-della-Voce-AISV', 'SIG-IL': '/Iberian-Languages-SIG-IL',
  'SIG-ILSP': '/Indian-Language-Speech-Processing-SIG-ILSP', 'SIGRU': '/Russian-Speech-Analysis-SIGRU',
};
const sigs = d.sigs.map((s) => {
  let acr = s.acronym;
  if (/^synsig$/i.test(acr)) acr = 'SynSIG';
  if (/^sigdial$/i.test(acr)) acr = 'SIGdial';
  return {
    acronym: acr,
    fullName: s.fullName,
    kind: LANG.includes(acr) ? 'language' : 'topic',
    status: s.status,
    website: s.website && s.website.startsWith('http') ? s.website : null,
    iscaUrl: 'https://isca-speech.org' + (ISCA_PATHS[acr] || '/Special-Interest-Groups'),
    description: s.description,
    activities: (s.activities || []).map((a) => ({ name: a.name, type: a.type, cadence: a.cadence, last: a.lastOrNext, url: a.url && String(a.url).startsWith('http') ? a.url : null })),
    series: (s.webinarSeries || []).map((w) => ({ name: w.name, active: w.active, cadence: w.cadence, pageUrl: w.pageUrl, recUrl: w.recordingsUrl, platform: w.platform, notes: w.notes })),
    videos: (s.videoResources || []).map((v) => ({ title: v.title, url: v.url, kind: v.kind, what: v.what })),
    hasRec: !!s.hasRecordings,
    activeSeries: (s.webinarSeries || []).some((w) => w.active),
  };
});

// hijacked domain must never be *linked* from the output (Atlas board note)
const out = JSON.stringify({ generated: d.generated, sigs }, null, 1);
if (/https?:\/\/(www\.)?synsig\.org/i.test(out)) throw new Error('refusing to write: hijacked domain synsig.org linked in payload');

writeFileSync(join(ROOT, 'data', 'sigs.json'), out + '\n');
const stats = {
  sigCount: sigs.length,
  recCount: sigs.filter((s) => s.hasRec).length,
  liveSeries: sigs.filter((s) => s.activeSeries).length,
  videoLinks: sigs.reduce((n, s) => n + s.videos.length, 0),
};
console.log('[import_sigs] wrote data/sigs.json', JSON.stringify(stats));
