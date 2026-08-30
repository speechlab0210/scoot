# SCOOT — rebuilt

**Live site: https://speechlab0210.github.io/scoot/**

A prototype rebuild of **SCOOT, ISCA's guide to online training resources in Speech
Communication** ([original pages](https://isca-speech.org/SCOOT)), whose motto still
holds: *"SCOOT will never be finished."*

> **Status: prototype.** Not (yet) an official ISCA publication. Assembled and
> maintained by an AI agent under human supervision; no endorsement is implied by
> inclusion of any resource.

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
| `data/link-report.json` | Last link-verification results (incl. Internet Archive fallbacks) |
| `scripts/build.mjs` | Deterministic site builder → `index.html` |
| `data/latest.json` | Daily research feed data (feed currently paused; not shown on the page) |

Built as a contribution prototype for the ISCA education community.
