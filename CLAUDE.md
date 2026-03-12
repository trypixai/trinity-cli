**Version**: 1.0
**Created**: 2026-03-12
**Last Updated**: 2026-03-12
**Authors:** Ömer Ufuk

---

# trinity-cli — Claude Code Instructions

Maintenance runtime for Claude Code agent ecosystems. Keeps `.claude/knowledge/` fresh after provisioning. Every trinity operation is fast, deterministic, and idempotent.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js ≥ 20 (ESM, `"type": "module"`) |
| CLI framework | commander v12 |
| File I/O | fs-extra v11 |
| Spinner | ora v8 |
| Colors | chalk v5 |

No build step. No TypeScript. Run directly with `node bin/trinity.js`.

---

## Commands

```bash
# Install and link globally
npm install && npm link

# Run a command
trinity health                          # Validate ecosystem integrity (read-only)
trinity health --path /path/to/project  # Check a specific project
trinity health --max-age-months 6       # Override staleness threshold

# During development (no npm link required)
node bin/trinity.js health
```

---

## Project Structure

```
trinity-cli/
├── bin/
│   └── trinity.js                     # CLI entry point (commander setup)
├── src/
│   ├── commands/
│   │   ├── health.js                  # trinity health (T-02)
│   │   ├── sync.js                    # trinity sync (T-01) — planned
│   │   └── refresh.js                 # trinity refresh (T-03) — planned
│   ├── readers/
│   │   ├── context-reader.js          # reads .claude/knowledge/ frontmatter
│   │   └── index-reader.js            # reads _index.md from knowledge dirs
│   └── utils/
│       ├── staleness.js               # staleness calculation (Created date → age)
│       └── validators.js              # doc validation (frontmatter, line count, EJS)
├── package.json
├── CLAUDE.md                          # This file
├── README.md
└── CHANGELOG.md
```

---

## Design Principles

1. **No wizard**: Trinity reads context from `.claude/` — it never asks questions
2. **Idempotent**: Every command is safe to run multiple times with no side effects
3. **Read before write**: `trinity health` is always read-only. `trinity sync` writes only after validation
4. **Fast**: Operations complete in seconds (except `trinity refresh` which triggers oracle)
5. **Standalone**: Works without neo. Can be called by `neo update` or run independently
6. **Atomic writes**: If any validation fails in a sync operation, nothing is written

---

## Key Design Decisions

- Trinity has no wizard and no setup phase — it reads from `.claude/` context
- `trinity health` is always read-only — safe to run in CI
- All staleness calculations use `**Created**:` frontmatter date, not filesystem mtime
- Exit codes: 0 = healthy (or warnings only), 1 = critical failure
- `.trinity.json` config file is optional — enables `trinity sync` with no flags

---

## Differences from Other Tools

| Tool | Role | Trinity's Relationship |
|------|------|----------------------|
| oracle | Researches stacks → knowledge docs | Trinity calls `oracle inject` to sync docs |
| morpheus | Scaffolds services (one-time) | Trinity maintains what morpheus created |
| neo | Orchestrates all tools | Neo calls `trinity sync`/`trinity health` |

---

## Critical Rules

- Trinity is NOT a scaffolder (that is morpheus)
- Trinity is NOT a researcher (that is oracle)
- Trinity is NOT a meta-orchestrator (that is neo)
- Trinity commands are one-shot CLI invocations, NOT persistent daemons
- Never auto-discover service paths — require explicit `.trinity.json` declarations

---

## Workflow Orchestration

### 1. Plan Mode Default

- Enter plan mode for ANY new command — sync and refresh run against real projects and have broad effects
- If a health check produces unexpected results, STOP and re-plan before adding validation logic
- Use plan mode for validation rule changes — false positives erode trust faster than false negatives
- Write action items to `.claude/tools/trinity-actions.md` before implementing new commands

### 2. Subagent Strategy

- Use Explore subagents to inspect target `.claude/knowledge/` directories — don't read them inline
- Offload frontmatter parsing and staleness calculations across multiple projects to parallel subagents
- For multi-project health checks, launch one subagent per project simultaneously
- Trinity's own design is delegation — apply the same principle when working on it

### 3. Self-Improvement Loop

- After ANY false positive in `trinity health`: update `tasks/lessons.md` with the edge case
- Idempotency bugs are the most common trinity failure mode — document every case found
- Review lessons before implementing `sync` or `refresh` logic
- Session lessons go to `tasks/lessons.md`; repeating patterns go to `trinity-actions.md`

### 4. Verification Before Done

- After any `trinity health` change: run it against at least 2 real `.claude/knowledge/` directories
- For sync changes: run twice against the same target — output must be identical (strict idempotency)
- After validation rule changes: test with a deliberately malformed doc to confirm detection works
- Ask yourself: "Would `trinity health` run cleanly in CI with no side effects?"

### 5. Demand Elegance (Balanced)

- For validation rules: ask "can this check be expressed as a one-line predicate?"
- If the health report output is hard to parse, fix the format — both humans and neo read it
- Skip elegance reviews for exit code fixes or threshold constant changes
- Trinity commands should feel like `git status` — clear, fast, composable, safe to run repeatedly

### 6. Autonomous Bug Fixing

- When `trinity health` reports a false positive: read the validation logic, find the edge case, fix it
- When an idempotency bug is found: write a reproducer first, then fix — never patch blind
- Read `trinity-actions.md` to understand the planned command contract before implementing

---

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go — also update `trinity-actions.md`
4. **Explain Changes**: State which action item (T-N) each change addresses
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

---

## Core Principles

- **Simplicity First**: Every trinity command does one thing. No hidden side effects.
- **No Laziness**: Read-only means read-only. Prove idempotency before shipping any write command.
- **Minimal Impact**: A health check must never mutate state. A sync must never overwrite valid data.
