#!/usr/bin/env node

import { program } from 'commander';
import { runHealth } from '../src/commands/health.js';

program
  .name('trinity')
  .description('Maintenance runtime for Claude Code agent ecosystems')
  .version('0.1.0');

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

program.parse();
