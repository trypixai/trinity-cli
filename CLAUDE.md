**Version**: 1.1
**Created**: 2026-03-12
**Last Updated**: 2026-03-13
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

trinity sync --from output/go/ --to .claude/knowledge/go-rules/  # Explicit paths
trinity sync                            # Read from .trinity.json config
trinity sync --dry-run                  # Preview without writing

# During development (no npm link required)
node bin/trinity.js health
node bin/trinity.js sync --from ... --to ...
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
│   └── utils/
│       ├── staleness.js               # staleness calculation (Created date → age)
│       └── validators.js              # doc validation (frontmatter, line count, EJS)
├── package.json
├── CLAUDE.md                          # This file
├── README.md
└── CHANGELOG.md
```

---

## How It Works

Trinity is a read-first maintenance tool. It inspects `.claude/knowledge/` directories and reports on ecosystem health without modifying anything (unless explicitly running `sync` or `refresh`).

1. **`trinity health`** reads all docs in `.claude/knowledge/`, parses frontmatter, checks staleness via `**Created**:` date, validates structure (line count, frontmatter fields, no raw EJS tags). Output: tabular report with fresh/stale/invalid counts. Exit 0 if healthy, exit 1 if critical.
2. **`trinity sync`** (planned) — validates oracle output, then atomically writes to `.claude/knowledge/`. Idempotent — running twice produces identical results.
3. **`trinity refresh`** (planned) — triggers `oracle research` for stale topics, then `oracle inject` to update.

---

## Key Design Decisions

- Trinity has no wizard and no setup phase — it reads from `.claude/` context
- `trinity health` is always read-only — safe to run in CI
- All staleness calculations use `**Created**:` frontmatter date, not filesystem mtime
- Exit codes: 0 = healthy (or warnings only), 1 = critical failure
- `.trinity.json` config file is optional — enables `trinity sync` with no flags
- Every command is idempotent — safe to run multiple times with no side effects
- Fast: operations complete in seconds (except `trinity refresh` which triggers oracle)
- Standalone: works without neo. Can be called by `neo update` or run independently
- Atomic writes: if any validation fails in a sync operation, nothing is written

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

- Enter plan mode for ANY non-trivial change (3+ steps, architectural decisions, or cascading effects)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification sequences, not just building
- New commands are always non-trivial — sync and refresh run against real projects with broad effects

### 2. Subagent Strategy

- Use subagents liberally to keep the main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One bounded scope per subagent — don't mix concerns in a single agent
- For multi-project health checks, launch one subagent per project simultaneously

### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake — be specific, not vague
- Review lessons at session start before touching code
- Session lessons go to `tasks/lessons.md`; repeating patterns go to `trinity-actions.md`

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Run tests, check logs, demonstrate correctness — not just "it compiles"
- Ask yourself: "Would a staff engineer approve this?"
- For sync changes: run twice against the same target — output must be identical (strict idempotency)

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "Is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Trinity commands should feel like `git status` — clear, fast, composable, safe to run repeatedly

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- When `trinity health` reports a false positive: read the validation logic, find the edge case, fix it

---

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go — also update `trinity-actions.md`
4. **Explain Changes**: State which action item (`T-N`) each change addresses
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

---

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Every trinity command does one thing — no hidden side effects.
- **No Laziness**: Find root causes. No temporary fixes. Read-only means read-only — prove idempotency before shipping any write command.
- **Minimal Impact**: Changes should only touch what's necessary. A health check must never mutate state — a sync must never overwrite valid data.
