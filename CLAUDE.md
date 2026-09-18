# Project context — READ THIS FIRST

RELEX "Memory With a Receipt" challenge, AaltoAI Hackathon 2026. Submissions close
Sunday 12:00. The deliverable is a deployed URL the judges use themselves, plus written
answers to the 9 practice questions in `corpus/acme/PRACTICE-QUESTIONS.md`.

Two teammates are each building a **complete independent version** in separate repos, then
comparing at a hard stop on Saturday evening and continuing with the stronger one. This repo
is one of those versions. There is no shared-file coordination to worry about — build the
whole thing.

## Scoring — optimise for this, not for elegance

| Weight | Criterion |
|---|---|
| 25% | Provenance — every claim cites a document and a position within it |
| 20% | Attribution — who proposed vs who agreed vs nobody did |
| 20% | Currency — superseded decisions flagged; never-true records not repeated |
| 20% | Deletion — a named person gone from index, embeddings and derived artefacts |
| 15% | Initiative — one capability beyond the four above, plus honest limitations |

## Corpus traps — the README documents these deliberately

- `corpus/` is read-only source data. Never modify or reformat it.
- Emails are reverse-chronological with every earlier message quoted beneath. Split threads
  into individual messages or quoted text will be duplicated and misattributed.
- `reports/` holds 2 files containing 25 separate dated updates (18 weekly, 7 monthly), newest
  first. Chunk per update, not per file.
- Image placeholders take four different forms, including Swedish. Do not match one string.
- Some speakers begin a number and get cut off. Completing it invents a source.
- Two practice questions have no clean answer. "The archive does not say" beats a guess.

## Architecture constraint

45 documents is small. No vector database — embeddings live in a JSON file we own, searched
by brute-force cosine similarity. This is deliberate: it makes deletion a filter over an array
rather than a fight with a vector store, which is 20% of the score.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
