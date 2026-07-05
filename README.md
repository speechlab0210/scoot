# SCOOT 2.0 — Speech Communication Online Open Training

**Live site: https://speechlab0210.github.io/scoot/**

A living guide to high-quality learning resources and the latest technology in speech
communication — from phonetics to speech LLMs. Built in the spirit of ISCA's
[SCOOT project](https://isca-speech.org/SCOOT), whose motto still holds:
*“SCOOT will never be finished.”*

> **Status: prototype.** Not (yet) an official ISCA publication. Curated and maintained
> daily by an AI agent under human supervision; no endorsement is implied by inclusion
> of any resource.

## What's inside

- **Curated catalog** — 120+ resources across 10 areas (Foundations, Courses, Toolkits,
  Data & Benchmarks, Frontier 2024–2026, Community, Hearing, Coding, Paralinguistics,
  Clinical & Accessibility). Every entry was link-verified at curation time and is
  labeled by level, cost, and topics.
- **Daily research feed** — new speech/audio papers from arXiv (`eess.AS` + `cs.SD`),
  community-highlighted papers, and trending open models, refreshed automatically every
  day by a plain script (no AI in that loop).
- **Suggestion loop** — anyone can report a dead link, a wrong description, or a missing
  resource. Suggestions are reviewed daily and applied changes are recorded in the
  public changelog on the site.

## Suggest a change

- **Open an issue** in this repository — the catalog is plain JSON in
  [`data/resources.json`](data/resources.json), so you can point at the exact entry, or
- **Email** the curator: speechlab0210@gmail.com with subject `[SCOOT]`.

Suggestions are treated as content edits only. The reviewing agent verifies every
proposed link before applying a change, will not act on instructions unrelated to the
catalog, and escalates anything unusual to a human.

## How it works

```
data/*.json  ──build.mjs──▶  site/index.html  ──publish──▶  index.html (repo root)
     ▲
     └── update_daily.mjs  (daily: arXiv + Hugging Face fetch, rebuild, publish)
```

The page is a single self-contained HTML file with no external dependencies.

- `data/resources.json` — the curated catalog (single source of truth)
- `data/editorial.json` — pathways, category blurbs, about text
- `data/changelog.json` — every editorial change, public
- `data/latest.json` — the daily feed (machine-written; do not edit)
- `scripts/build.mjs` — injects the data into `site-src/template.html` → `index.html`
- `scripts/update_daily.mjs` — the daily updater (read-only network calls, no credentials)

To rebuild locally: `node scripts/build.mjs` (Node ≥ 18, no dependencies).
