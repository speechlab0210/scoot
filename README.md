# SCOOT 2.0

**[Open the resource catalog](https://speechlab0210.github.io/scoot/)**

An independent rebuild of [ISCA's original SCOOT](https://isca-speech.org/SCOOT),
a guide to online training resources in speech communication.

> **Not an official ISCA publication.** This is an AI-maintained prototype whose
> content has not been independently verified by a human. The project began as
> Hung-yi Lee prompting an AI agent to explore what AI agents can do. Inclusion
> of a resource does not imply endorsement; check the linked sources.

## The catalog

The original topic hierarchy and **104 original resources** from the
31 August 2026 snapshot are preserved, alongside **118 marked extensions**.
Browse eight core topics or the additional topics: Paralinguistics & Emotion,
Clinical & Accessibility Speech, and Community, Conferences & Challenges.

- Search by topic, title, author or multiple keywords.
- Filter the original SCOOT catalog and 2.0 extensions separately.
- Share a search using its URL; Reset clears both text and source filters.
- Original and extension labels remain visible. Unavailable links retain
  archived copies where available.
- Content is rendered at build time and remains readable without JavaScript.

The 3 October 2026 interface update preserves every catalog entry and link.
It is not a fresh audit of all external resources. The footer gives the actual
link-audit timestamp. Catalog updates and link checks are not currently scheduled.

## Related websites

**[ISCA SIG Atlas](https://speechlab0210.github.io/isca-sig-directory/)** now holds
the SIG directory, seminars, events and recordings. As of 3 October 2026, SCOOT
links directly to that website; it no longer embeds the old SIG snapshot.
Legacy SIG section anchors land on the new website's entry card.

**[Spoken LLM Benchmark Atlas](https://speechlab0210.github.io/spoken-llm-benchmarks/)**
remains a separate directory linked from SCOOT. Its resource card refreshes
counts from the atlas when available and labels its dated fallback snapshot.

## Suggest a correction

Email **speechlab0210@gmail.com** with `[SCOOT]` in the subject, or open a GitHub
issue. Include the resource URL, its topic, and the suggested correction.

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
| `data/link-report.json` | Last link-audit results and archive fallbacks |
| `site-src/template.html` | Responsive layout and search controls |
| `scripts/build.mjs` | Deterministic, offline site builder |
| `data/latest.json` | Historical research-feed data; not displayed |

Edit source files and rebuild; do not edit generated HTML directly. Commit the
source changes and generated `index.html` together. Existing daily-feed scripts
are historical and must not be run or scheduled as part of an interface update.
