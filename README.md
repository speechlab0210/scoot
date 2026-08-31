# SCOOT 2.0

**Live site: https://speechlab0210.github.io/scoot/**

A prototype rebuild of **SCOOT, ISCA's guide to online training resources in Speech
Communication** ([original pages](https://isca-speech.org/SCOOT)), whose motto still
holds: *"SCOOT will never be finished."*

This 2026-08-31 version supersedes the earlier SCOOT 2.0 prototype (July 2026): the
site is now organized around the original SCOOT topic tree, with the original content
preserved in full.

Since 31 August 2026 the same page also hosts the **ISCA SIGs & online events** part —
an atlas of what each of ISCA's 20 Special Interest Groups is doing, front and centre
the webinar and lecture series with verified video recordings. It was previously a
separate page ([old address](https://speechlab0210.github.io/isca-sig-atlas/), which
now redirects here).

> **Status: unofficial and human-unverified.** This is NOT an ISCA publication, and
> no human has verified its content. The whole site — catalog, SIG atlas and all —
> is the output of Hung-yi Lee casually prompting an AI agent (Claude Fable 5) to
> see what AI agents can currently do. No endorsement is implied by inclusion of
> any resource.

## What this is

The original SCOOT — long maintained by members of the ISCA community, with course
material by Roger Moore, Simon King and many others — organizes resources into a
topic tree: Overviews, Sound, Signal Processing, Linguistics (Psycholinguistics,
Phonology), Phonetics (Articulatory, Acoustic, Auditory, Prosodics), Speech
Technology (Coding, Synthesis, ASR, Deep Neural Networks), Toolkits (ASR, Synthesis),
and Databases.

This rebuild **keeps that structure and every resource the original pages listed**
(104 entries transcribed from a 2026-08-31 snapshot of the 26 original pages), and
**extends** each topic with newer, link-verified resources (118 entries), plus three
extension topics the original predates: Paralinguistics & Emotion, Clinical &
Accessibility, and Community/Conferences/Challenges.

- Original entries are marked **● Original SCOOT** on the page; extensions are marked
  **✚ SCOOT 2.0 extensions**.
- Every link (original + extension) was re-verified on 2026-08-31. Where an original
  link has died, the entry is kept and an Internet Archive snapshot is linked.
- Every editorial change is recorded in the public changelog on the site.

The SIG part adds: a tracker of the 8 recurring SIG webinar/lecture series, upcoming
SIG events, recorded workshop archives, a filterable directory of all 20 SIGs with 89
reviewed video links, ISCA-level video resources, and board notes. Method and AI
disclosure are in the page footer under "The SIG part".

The page also anchors the **[Spoken LLM Benchmark Atlas](https://speechlab0210.github.io/spoken-llm-benchmarks/)**
— a daily-updated index of spoken-LLM benchmarks that is part of SCOOT 2.0 but lives on
its own page because of its size and daily rebuild. The Benchmarks section's counts
refresh from the atlas's `stats.json` at view time.

## Suggest a resource

Email **speechlab0210@gmail.com** with subject `[SCOOT]`, or open an issue here —
the catalog is plain JSON, so you can point at the exact entry.

## Data layout

| File | Contents |
|---|---|
| `data/original.json` | Faithful transcription of the original SCOOT pages (structure + all entries) |
| `data/resources.json` | Curated extension entries, each keyed to an original topic |
| `data/editorial.json` | Page copy: about, contribute, extension-topic blurbs |
| `data/changelog.json` | Public changelog |
| `data/link-report.json` | Last link-verification results for the catalog (incl. Internet Archive fallbacks) |
| `data/sigs.json` | ISCA SIG directory data (activities, series, reviewed video links) |
| `data/sig-editorial.json` | SIG-part featured content (series tracker, upcoming, archives, ISCA-level, notes) |
| `scripts/build.mjs` | Deterministic site builder → `index.html` |
| `data/latest.json` | Daily research feed data (feed currently paused; not shown on the page) |

Built as a contribution prototype for the ISCA education community.
