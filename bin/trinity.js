#!/usr/bin/env node

import { program } from 'commander';
import { runHealth } from '../src/commands/health.js';
import { runSync } from '../src/commands/sync.js';

program
  .name('trinity')
  .description('Maintenance runtime for Claude Code agent ecosystems')
  .version('0.2.0');

program
  .command('health')
  .description('Validate ecosystem integrity (read-only)')
  .option('--path <dir>', 'Project directory to check (default: cwd)')
  .option('--max-age-months <months>', 'Staleness threshold in months', '6')
  .action(async (options) => {
    try {
      await runHealth({
        projectDir: options.path,
        maxAgeMonths: parseFloat(options.maxAgeMonths),
      });
    } catch (err) {
      console.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('Push oracle output to .claude/knowledge/')
  .option('--from <dir>', 'Source directory (oracle output)')
  .option('--to <dir>', 'Target directory (.claude/knowledge/...)')
  .option('--path <dir>', 'Project root for .trinity.json and log (default: cwd)')
  .option('--dry-run', 'Show what would be synced without writing')
  .action(async (options) => {
    try {
      await runSync({
        from: options.from,
        to: options.to,
        dryRun: options.dryRun,
        projectDir: options.path,
      });
    } catch (err) {
      console.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
