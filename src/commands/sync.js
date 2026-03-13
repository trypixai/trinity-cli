import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * trinity sync command (T-01).
 *
 * Pushes oracle output to the project's .claude/knowledge/ directory.
 * Delegates validation + writing to `oracle inject`.
 * Logs the sync event to .claude/trinity-log.md.
 *
 * Supports two modes:
 *   1. --from <dir> --to <dir>   (explicit paths)
 *   2. No flags                  (reads .trinity.json config)
 */
export async function runSync({ from, to, dryRun = false, projectDir } = {}) {
  const root = path.resolve(projectDir || process.cwd());

  // ─── Resolve sync pairs ──────────────────────────────────────────────────
  let syncPairs;

  if (from && to) {
    // Explicit mode: single pair
    syncPairs = [{
      name: path.basename(path.resolve(from)),
      from: path.resolve(from),
      to: path.resolve(to),
    }];
  } else {
    // Config mode: read .trinity.json
    syncPairs = await loadConfig(root);
  }

  console.log(chalk.bold.cyan(`\n  trinity sync${dryRun ? chalk.dim(' (dry run)') : ''}\n`));

  // ─── Process each sync pair ───────────────────────────────────────────────
  let totalSynced = 0;

  for (const pair of syncPairs) {
    const success = await syncPair(pair, root, dryRun);
    if (success) totalSynced++;
  }

  // ─── Final summary ───────────────────────────────────────────────────────
  if (syncPairs.length > 1) {
    console.log(chalk.bold(`  ${totalSynced}/${syncPairs.length} stacks synced\n`));
  }

  if (totalSynced < syncPairs.length && !dryRun) {
    process.exit(1);
  }
}

// ─── Single pair sync ────────────────────────────────────────────────────────

async function syncPair(pair, projectRoot, dryRun) {
  const { name, from: fromDir, to: toDir } = pair;
  const relFrom = fromDir.replace(process.env.HOME ?? '', '~');
  const relTo = toDir.replace(process.env.HOME ?? '', '~');

  console.log(chalk.bold(`  ${name}`));
  console.log(chalk.dim(`  From: ${relFrom}`));
  console.log(chalk.dim(`  To:   ${relTo}`));

  // ─── 1. Validate source exists ──────────────────────────────────────────
  if (!await fs.pathExists(fromDir)) {
    console.log(chalk.red(`  ✗  Source not found: ${relFrom}\n`));
    return false;
  }

  // ─── 2. Pre-compute stats ──────────────────────────────────────────────
  const sourceFiles = (await fs.readdir(fromDir))
    .filter(f => f.endsWith('.md') && f !== '_index.md')
    .sort();

  if (sourceFiles.length === 0) {
    console.log(chalk.red(`  ✗  No .md files in source\n`));
    return false;
  }

  // Count new vs existing
  let newCount = 0;
  let updateCount = 0;

  for (const filename of sourceFiles) {
    const targetPath = path.join(toDir, filename);
    if (await fs.pathExists(targetPath)) {
      updateCount++;
    } else {
      newCount++;
    }
  }

  const unchangedCount = sourceFiles.length - newCount;

  console.log(chalk.dim(`  Docs: ${sourceFiles.length} found (${newCount} new, ${updateCount} existing)`));

  // ─── 3. Dry run: print and exit ────────────────────────────────────────
  if (dryRun) {
    console.log(chalk.yellow(`\n  Dry run — no files written`));
    console.log(chalk.dim(`  Would call: oracle inject --from ${relFrom} --to ${relTo}`));
    if (newCount > 0) {
      console.log(chalk.dim(`  New files:`));
      for (const f of sourceFiles) {
        if (!await fs.pathExists(path.join(toDir, f))) {
          console.log(chalk.dim(`    + ${f}`));
        }
      }
    }
    console.log(chalk.dim(`  Log entry would be appended to .claude/trinity-log.md\n`));
    return true;
  }

  // ─── 4. Call oracle inject ─────────────────────────────────────────────
  try {
    await execFileAsync('oracle', ['inject', '--from', fromDir, '--to', toDir], {
      timeout: 30000,
      env: { ...process.env, FORCE_COLOR: '1' },
    });
  } catch (err) {
    // oracle inject exits with code 1 on validation failure
    const output = (err.stdout || '') + (err.stderr || '');
    console.log(chalk.red(`\n  ✗  oracle inject failed`));
    if (output.trim()) {
      // Print oracle's error output (stripped to last few lines)
      const lines = output.trim().split('\n').slice(-5);
      for (const line of lines) {
        console.log(chalk.dim(`    ${line}`));
      }
    }
    console.log('');
    return false;
  }

  console.log(chalk.green(`  ✓  Injected ${sourceFiles.length} docs`));

  // ─── 5. Read _index.md for confirmation ────────────────────────────────
  const indexPath = path.join(toDir, '_index.md');
  if (await fs.pathExists(indexPath)) {
    console.log(chalk.dim(`  _index.md written`));
  }

  // ─── 6. Append to trinity-log.md ──────────────────────────────────────
  const logEntry = buildLogEntry(name, relFrom, relTo, sourceFiles.length, newCount, updateCount);
  const logPath = path.join(projectRoot, '.claude', 'trinity-log.md');
  await appendLog(logPath, logEntry);
  console.log(chalk.dim(`  Logged to .claude/trinity-log.md\n`));

  return true;
}

// ─── Config loader ───────────────────────────────────────────────────────────

async function loadConfig(root) {
  const configPath = path.join(root, '.trinity.json');

  if (!await fs.pathExists(configPath)) {
    console.error(chalk.red(`  Error: No --from/--to flags and no .trinity.json found at ${root}`));
    console.error(chalk.dim(`  Usage: trinity sync --from <source> --to <target>`));
    console.error(chalk.dim(`  Or create .trinity.json with stack mappings\n`));
    process.exit(1);
  }

  const raw = await fs.readFile(configPath, 'utf8');
  let config;

  try {
    config = JSON.parse(raw);
  } catch {
    console.error(chalk.red(`  Error: Invalid JSON in .trinity.json\n`));
    process.exit(1);
  }

  if (!config.stacks || !Array.isArray(config.stacks) || config.stacks.length === 0) {
    console.error(chalk.red(`  Error: .trinity.json has no stacks defined\n`));
    process.exit(1);
  }

  // Resolve paths relative to project root
  return config.stacks.map(s => ({
    name: s.name || path.basename(s.from),
    from: path.resolve(root, s.from),
    to: path.resolve(root, s.to),
  }));
}

// ─── Log builder ─────────────────────────────────────────────────────────────

function buildLogEntry(name, from, to, total, newCount, updateCount) {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].slice(0, 5);

  const parts = [];
  if (newCount > 0) parts.push(`${newCount} new`);
  if (updateCount > 0) parts.push(`${updateCount} updated`);
  const unchanged = total - newCount;
  if (unchanged > 0 && newCount > 0) parts.push(`${unchanged} unchanged`);

  return `${date} ${time} | sync | ${name} → ${to} | ${total} docs | ${parts.join(', ')}`;
}

async function appendLog(logPath, entry) {
  await fs.ensureDir(path.dirname(logPath));

  if (await fs.pathExists(logPath)) {
    await fs.appendFile(logPath, `\n${entry}`, 'utf8');
  } else {
    // Create log file with header
    const header = [
      '# Trinity Sync Log',
      '',
      '> Auto-maintained by `trinity sync`. Each line is one sync event.',
      '',
      entry,
    ].join('\n');
    await fs.writeFile(logPath, header, 'utf8');
  }
}
