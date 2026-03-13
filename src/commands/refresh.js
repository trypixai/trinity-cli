import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { parseDateFromFrontmatter, monthsAgo, formatAge } from '../utils/staleness.js';

/**
 * trinity refresh command (T-03).
 *
 * Detects stale knowledge docs and guides the user through refreshing them.
 * Full automation (re-trigger oracle automatically) requires O-04 (oracle update),
 * which does not exist yet. Until then, refresh identifies stale topics and
 * prints the manual workflow.
 */
export async function runRefresh({ projectDir, maxAgeMonths = 6, topics, dryRun = false, staleOnly = false } = {}) {
  const root = path.resolve(projectDir || process.cwd());
  const relRoot = root.replace(process.env.HOME ?? '', '~');

  console.log(chalk.bold.cyan(`\n  trinity refresh${dryRun ? chalk.dim(' (dry run)') : ''} — ${relRoot}\n`));

  // ─── 1. Find knowledge directories ────────────────────────────────────────
  const knowledgeDir = path.join(root, '.claude', 'knowledge');

  if (!await fs.pathExists(knowledgeDir)) {
    console.log(chalk.red(`  ✗  .claude/knowledge/ not found\n`));
    process.exit(1);
  }

  const entries = await fs.readdir(knowledgeDir);
  const subdirs = [];
  for (const entry of entries.sort()) {
    const entryPath = path.join(knowledgeDir, entry);
    const stat = await fs.stat(entryPath);
    if (stat.isDirectory()) {
      subdirs.push({ name: entry, path: entryPath });
    }
  }

  if (subdirs.length === 0) {
    console.log(chalk.yellow(`  No knowledge subdirectories found\n`));
    process.exit(0);
  }

  // ─── 2. Scan for stale docs ───────────────────────────────────────────────
  const allStale = [];

  for (const subdir of subdirs) {
    const staleInDir = await findStaleDocs(subdir, maxAgeMonths, topics);
    if (staleInDir.length > 0) {
      allStale.push({ dir: subdir, docs: staleInDir });
    }
  }

  // ─── 3. Report ────────────────────────────────────────────────────────────
  if (allStale.length === 0) {
    if (topics) {
      console.log(chalk.green(`  ✓  No matching stale topics found\n`));
    } else {
      console.log(chalk.green(`  ✓  All knowledge docs are fresh (threshold: ${maxAgeMonths} months)\n`));
    }
    process.exit(0);
  }

  // Print stale docs grouped by directory
  let totalStale = 0;

  for (const { dir, docs } of allStale) {
    console.log(chalk.bold(`  .claude/knowledge/${dir.name}/`));
    for (const doc of docs) {
      console.log(chalk.yellow(`    ⚠  ${doc.filename}`) + chalk.dim(`  ${doc.dateStr}, ${doc.ageStr}`));
      totalStale++;
    }
    console.log('');
  }

  console.log(chalk.bold(`  ${totalStale} stale doc${totalStale > 1 ? 's' : ''} found\n`));

  // ─── 4. Stale topic slugs ────────────────────────────────────────────────
  const staleTopics = allStale.flatMap(({ docs }) =>
    docs.map(d => d.filename.replace('.md', ''))
  );

  console.log(chalk.dim(`  Stale topics: ${staleTopics.join(', ')}\n`));

  // ─── 5. Check if oracle update exists ─────────────────────────────────────
  const hasOracleUpdate = await checkOracleUpdate();

  if (hasOracleUpdate) {
    // Future: call oracle update --topics <list> --stack <name>
    // Then trinity sync
    console.log(chalk.dim(`  oracle update available — automated refresh supported`));
    console.log(chalk.dim(`  (Not yet implemented — waiting for O-04 integration)\n`));
  } else {
    // Fallback: print manual workflow
    console.log(chalk.yellow(`  ⚠  oracle update not available (requires oracle >= 1.3.0)`));
    console.log(chalk.dim(`  Automated topic-level refresh is not yet supported.`));
    console.log(chalk.dim(`  Manual workflow:\n`));

    // Load .trinity.json for context if available
    const config = await loadTrinityConfig(root);

    if (config) {
      for (const { dir } of allStale) {
        const stack = config.stacks?.find(s => s.to?.includes(dir.name));
        if (stack) {
          console.log(chalk.dim(`  # Re-research ${stack.name}:`));
          console.log(chalk.white(`  oracle research`));
          console.log(chalk.dim(`  # Then sync:`));
          console.log(chalk.white(`  trinity sync --from ${stack.from} --to ${stack.to} --path ${relRoot}`));
        } else {
          console.log(chalk.dim(`  # Re-research ${dir.name}:`));
          console.log(chalk.white(`  oracle research`));
          console.log(chalk.dim(`  # Then sync results to .claude/knowledge/${dir.name}/`));
        }
        console.log('');
      }
    } else {
      console.log(chalk.white(`  1. oracle research              # re-research the stack`));
      console.log(chalk.white(`  2. trinity sync --from <output> --to <knowledge-dir>`));
      console.log('');
    }
  }
}

// ─── Staleness scanner ───────────────────────────────────────────────────────

async function findStaleDocs(subdir, maxAgeMonths, topicFilter) {
  const entries = await fs.readdir(subdir.path);
  const mdFiles = entries.filter(f => f.endsWith('.md') && f !== '_index.md').sort();

  const stale = [];

  for (const filename of mdFiles) {
    // Filter by topic if specified
    if (topicFilter) {
      const slug = filename.replace('.md', '');
      const matchesFilter = topicFilter.some(t => slug.includes(t));
      if (!matchesFilter) continue;
    }

    const filePath = path.join(subdir.path, filename);
    const content = await fs.readFile(filePath, 'utf8');
    const created = parseDateFromFrontmatter(content);

    if (!created) {
      // No date = can't determine freshness, treat as potentially stale
      stale.push({
        filename,
        dateStr: '?',
        ageStr: 'no date found',
      });
      continue;
    }

    const age = monthsAgo(created);
    if (age >= maxAgeMonths) {
      stale.push({
        filename,
        dateStr: created.toISOString().split('T')[0],
        ageStr: formatAge(created),
      });
    }
  }

  return stale;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checkOracleUpdate() {
  // Check if oracle CLI supports the 'update' command
  // For now, this is always false — O-04 is not built yet
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const exec = promisify(execFile);
    const { stdout } = await exec('oracle', ['--help'], { timeout: 5000 });
    return stdout.includes('update');
  } catch {
    return false;
  }
}

async function loadTrinityConfig(root) {
  const configPath = path.join(root, '.trinity.json');
  if (!await fs.pathExists(configPath)) return null;

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
