# trinity-cli

Maintenance runtime for Claude Code agent ecosystems. Keeps `.claude/knowledge/` fresh after provisioning.

Part of [the-matrix](https://github.com/trypixai) autonomous agent ecosystem.

## Install

```bash
npm install && npm link
```

## Commands

### trinity health

Read-only validation of the entire agent ecosystem. Safe to run in CI.

```bash
trinity health                          # check cwd
trinity health --path /path/to/project  # check a specific project
trinity health --max-age-months 3       # stricter staleness threshold
```

### trinity sync (planned)

Push oracle output to `.claude/knowledge/` with validation.

### trinity refresh (planned)

Detect stale knowledge docs and re-trigger oracle research.

## Requirements

- Node.js >= 20
