# Team file ownership — READ THIS FIRST

Two people work on this repo at the same time, each with their own Claude Code session.
Editing a file outside your owner's lane causes merge conflicts that neither teammate can
resolve. Treat these boundaries as hard.

| Lane | Owner | Paths |
|---|---|---|
| Backend | Luan | `lib/`, `scripts/`, `app/api/`, `data/` |
| Frontend | Teammate | `app/page.js`, `app/layout.js`, `components/` |
| Shared | Both — ask in chat before editing | `package.json`, `CLAUDE.md`, `README.md` |

Rules for the agent:
- Before editing a file, check which lane it is in. If it is not your operator's lane, stop
  and tell them to ask their teammate instead. Do not edit it "just this once".
- Never install a dependency without saying so — `package.json` conflicts are the worst kind.
  Tell the operator to announce it to their teammate first.
- Prefer creating a new file in your own lane over editing a file in the other lane.
- `corpus/` is read-only source data for the challenge. Never modify or reformat it.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
