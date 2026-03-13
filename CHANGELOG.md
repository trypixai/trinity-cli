# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-03-13

### Added
- `trinity sync` command (T-01): push oracle output to `.claude/knowledge/` via `oracle inject`
- `.trinity.json` config file support: define stack mappings for zero-flag `trinity sync`
- `--dry-run` flag: preview what would be synced without writing
- `.claude/trinity-log.md` auto-maintained sync log with timestamped entries
- Multi-stack support: `.trinity.json` can define multiple stacks, all synced in one run

## [0.1.0] - 2026-03-12

### Added
- Initial release: `trinity health` command (T-02)
- Read-only ecosystem integrity validation: `.claude/` structure, knowledge doc freshness, EJS detection
- Staleness detection using `**Created**` or `**Last Updated**` frontmatter dates
- Configurable staleness threshold via `--max-age-months` (default: 6)
- Project path override via `--path <dir>`
- Exit code 0 for healthy/warnings, 1 for critical failures
