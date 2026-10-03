# SCOOT 2.0

**[Open the resource catalog](https://speechlab0210.github.io/scoot/)**

An independent rebuild of [ISCA's original SCOOT](https://isca-speech.org/SCOOT),
a guide to online training resources in speech communication.

> **Not an official ISCA publication, and nothing here has been verified by a human.**
> This site began as
> Hung-yi Lee casually prompting an AI agent (Claude Fable 5) to see what AI agents can do,
> and an AI agent maintains it. Inclusion of a resource does not imply endorsement;
> check the linked sources.

## The catalog

The original topic hierarchy and all **105 original resources**, transcribed from
the original ISCA SCOOT pages as captured on 31 August 2026, are preserved,
alongside clearly marked **SCOOT 2.0 extensions**. Browse eight core topics or the
additional topics: Paralinguistics & Emotion, Clinical & Accessibility Speech, and
Community, Conferences & Challenges.

- Search by topic, title, author or multiple keywords.
- Filter the original SCOOT catalog and 2.0 extensions separately.
- Share a search using its URL; Reset clears both text and source filters.
- Original and extension labels remain visible. Unavailable links show an
  archived copy where one exists.
- Content is rendered at build time and remains readable without JavaScript.

## How the catalog is maintained

An AI agent maintains the catalog; the page's "How this site is maintained"
section is the authoritative description.

- **Every day** it checks every link in the catalog and compares each linked page
  with the version it last reviewed. A link is labelled as possibly unavailable only
  after three failed daily checks in a row, and an archived copy is linked where one
  exists. Links whose domain has been taken over by an unrelated site are replaced
  with an archived copy of the original page and listed in
  `data/blocked-hosts.json`, which the build refuses to link.
- Each day a few topics are also reviewed in depth, rotating through all of them,
  and notable new learning resources may be added. A change is made only when the
  resource's own page supports it.
- Original entries keep their wording apart from typo fixes, link repairs and a few
  documented differences (see `archive_note` in `data/original.json`).
- Larger changes (new topics, a different structure, removing original entries)
  are referred to the project's human supervisor.
- Every content change is listed in the changelog on the page.

## Suggest a correction

Email **speechlab0210@gmail.com** (`[SCOOT]` in the subject helps) or open a
GitHub issue. Include the resource URL, its topic, and the suggested correction.
Email and issues are read three times a day. Small, verifiable corrections are
made directly and the sender is told what changed. Requests from ISCA Board
members are followed after their identity is checked. Anything else goes to the
human supervisor.

## Related websites

**[ISCA SIG Atlas](https://speechlab0210.github.io/isca-sig-directory/)** holds
the SIG directory, seminars, events and recordings. From 31 August to 3 October
2026 that content was part of this page; old `#sig-…` links now land on the ISCA
SIG Atlas card near the top of the page.

**[Spoken LLM Benchmark Atlas](https://speechlab0210.github.io/spoken-llm-benchmarks/)**
is a separate directory linked from SCOOT. Its card refreshes counts from the atlas
when available and labels its dated fallback numbers.

## Build and data

No package installation is needed. With Node.js:

```sh
node scripts/build.mjs
# Preview output: site/index.html
node scripts/build.mjs --publish-output
# GitHub Pages output: index.html
```

| File | Purpose |
|---|---|
| `data/original.json` | Original SCOOT topic tree and transcribed entries |
| `data/resources.json` | Extension entries, keyed to a topic |
| `data/editorial.json` | Page copy and links to related websites |
| `data/changelog.json` | Dated editorial changes |
| `data/link-report.json` | Latest daily link check and archive fallbacks (shown in the footer) |
| `data/blocked-hosts.json` | Hijacked domains the build refuses to link |
| `site-src/template.html` | Responsive layout and search controls |
| `scripts/build.mjs` | Deterministic, offline site builder (refuses unsafe or blocked links) |
| `scripts/check_links.mjs`, `scripts/retest_links.mjs` | Retired link checkers (July–August 2026); replaced by the daily check |
| `scripts/update_daily.mjs`, `data/latest.json` | Retired research-feed updater and its data (July–August 2026); not displayed, not run |

Edit source files and rebuild; do not edit generated HTML directly. Commit the
source changes and generated `index.html` together.
