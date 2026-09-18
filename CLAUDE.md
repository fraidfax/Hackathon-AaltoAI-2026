# Project context — READ THIS FIRST

RELEX "Memory With a Receipt" challenge, AaltoAI Hackathon 2026. Submissions close
Sunday 12:00. The deliverable is a deployed URL the judges use themselves, plus written
answers to the 9 practice questions in `corpus/acme/PRACTICE-QUESTIONS.md`.

## Git protocol — MANDATORY, both teammates share this repo

Two people work on this one repo at the same time, each with their own Claude Code session.
Neither agent can see what the other just did. These steps are not optional.

**Before writing or editing any code, every time:**

1. `git pull --rebase` — get the teammate's latest work.
2. Read the files you are about to change, as they are *now*. Do not rely on anything you
   remember from earlier in the session; the teammate may have rewritten it since.
3. If the pull brought in changes that overlap what the operator asked for, say so before
   editing — the work may already be done, or done differently.

**After any change that works:**

4. `git add` the specific files, commit with a clear message, and `git push` immediately.
   Never leave working code uncommitted while the teammate is active. Small, frequent pushes
   are what keep the two sessions from colliding.

**If a push is rejected** ("fetch first" / non-fast-forward): stop. Run `git pull --rebase`,
re-read the conflicting file, and resolve it deliberately. Never use `git push --force`, and
never discard the teammate's commits to make an error go away. If the conflict is not
trivially resolvable, tell the operator to coordinate with their teammate in chat.

Announce dependency changes (`package.json`) to the teammate before installing.

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
