import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { parseDateFromFrontmatter, monthsAgo, formatAge } from '../utils/staleness.js';
import { validateDoc } from '../utils/validators.js';

/**
 * trinity health command (T-02).
 *
 * Read-only validation of the entire agent ecosystem.
 * Answers: "Is the ecosystem healthy and current?"
 *
 * Exit codes: 0 = healthy (or warnings only), 1 = any critical failure.
 */
export async function runHealth({ projectDir, maxAgeMonths = 6 } = {}) {
  const root = path.resolve(projectDir || process.cwd());
  const relRoot = root.replace(process.env.HOME ?? '', '~');

  console.log(chalk.bold.cyan(`\n  trinity health — ${relRoot}\n`));

  const results = { pass: 0, fail: 0, warn: 0 };

  // ─── 1. .claude/ directory exists ──────────────────────────────────────────
  const claudeDir = path.join(root, '.claude');
  if (!await fs.pathExists(claudeDir)) {
    printLine('fail', '.claude/', 'missing');
    results.fail++;
    printSummary(results);
    process.exit(1);
  }
  printLine('pass', '.claude/', 'exists');
  results.pass++;

  // ─── 2. CLAUDE.md exists at project root ───────────────────────────────────
  const claudeMd = path.join(root, 'CLAUDE.md');
  if (await fs.pathExists(claudeMd)) {
    printLine('pass', 'CLAUDE.md', 'exists');
    results.pass++;
  } else {
    printLine('fail', 'CLAUDE.md', 'missing');
    results.fail++;
  }

  // ─── 3. .claude/knowledge/ directory exists ────────────────────────────────
  const knowledgeDir = path.join(claudeDir, 'knowledge');
  if (!await fs.pathExists(knowledgeDir)) {
    printLine('fail', '.claude/knowledge/', 'missing');
    results.fail++;
    // Check remaining non-knowledge items, then exit
    await checkContextFiles(root, results);
    await checkTrinityLog(root, results);
    printSummary(results);
    process.exit(results.fail > 0 ? 1 : 0);
  }
  printLine('pass', '.claude/knowledge/', 'exists');
  results.pass++;

  // ─── 4. Scan knowledge subdirectories ──────────────────────────────────────
  const knowledgeEntries = await fs.readdir(knowledgeDir);
  const knowledgeSubdirs = [];

  for (const entry of knowledgeEntries.sort()) {
    const entryPath = path.join(knowledgeDir, entry);
    const stat = await fs.stat(entryPath);
    if (stat.isDirectory()) {
      knowledgeSubdirs.push({ name: entry, path: entryPath });
    }
  }

  if (knowledgeSubdirs.length === 0) {
    printLine('warn', '.claude/knowledge/', 'no subdirectories found');
    results.warn++;
  }

  for (const subdir of knowledgeSubdirs) {
    await checkKnowledgeDir(subdir, maxAgeMonths, results);
  }

  // ─── 5. Context files ─────────────────────────────────────────────────────
  await checkContextFiles(root, results);

  // ─── 6. Trinity log ───────────────────────────────────────────────────────
  await checkTrinityLog(root, results);

  // ─── Summary ──────────────────────────────────────────────────────────────
  printSummary(results);
  process.exit(results.fail > 0 ? 1 : 0);
}

// ─── Knowledge directory checker ─────────────────────────────────────────────

async function checkKnowledgeDir(subdir, maxAgeMonths, results) {
  const entries = await fs.readdir(subdir.path);
  const mdFiles = entries.filter(f => f.endsWith('.md') && f !== '_index.md').sort();
  const relPath = `.claude/knowledge/${subdir.name}/`;

  if (mdFiles.length === 0) {
    printLine('warn', relPath, 'empty — no .md files');
    results.warn++;
    return;
  }

  printLine('pass', relPath, `${mdFiles.length} docs`);
  results.pass++;

  // Check _index.md
  const indexPath = path.join(subdir.path, '_index.md');
  if (await fs.pathExists(indexPath)) {
    printLine('pass', `${relPath}_index.md`, 'exists');
    results.pass++;
  } else {
    printLine('warn', `${relPath}_index.md`, 'missing');
    results.warn++;
  }

  // Validate each doc
  for (const filename of mdFiles) {
    const filePath = path.join(subdir.path, filename);
    const content = await fs.readFile(filePath, 'utf8');

    // Frontmatter + EJS validation
    const errors = validateDoc(filename, content);
    if (errors.length > 0) {
      printLine('fail', `  ${filename}`, errors[0]);
      results.fail++;
      continue;
    }

    // Staleness check
    const created = parseDateFromFrontmatter(content);
    if (!created) {
      printLine('warn', `  ${filename}`, 'no Created date');
      results.warn++;
      continue;
    }

    const age = monthsAgo(created);
    const ageStr = formatAge(created);
    const dateStr = created.toISOString().split('T')[0];

    if (age >= maxAgeMonths) {
      printLine('warn', `  ${filename}`, `stale (${dateStr}, ${ageStr})`);
      results.warn++;
    } else {
      printLine('pass', `  ${filename}`, `fresh (${dateStr}, ${ageStr})`);
      results.pass++;
    }
  }
}

// ─── Context file checks ────────────────────────────────────────────────────

async function checkContextFiles(root, results) {
  const contextFiles = [
    { rel: '.claude/SERVICE_CONTEXT.md', label: 'SERVICE_CONTEXT.md' },
    { rel: '.claude/NEXT_STEPS.md', label: 'NEXT_STEPS.md' },
  ];

  for (const { rel, label } of contextFiles) {
    const filePath = path.join(root, rel);
    if (await fs.pathExists(filePath)) {
      printLine('pass', label, 'exists');
      results.pass++;
    } else {
      printLine('warn', label, 'missing');
      results.warn++;
    }
  }
}

// ─── Trinity log check ──────────────────────────────────────────────────────

async function checkTrinityLog(root, results) {
  const logPath = path.join(root, '.claude', 'trinity-log.md');
  if (await fs.pathExists(logPath)) {
    printLine('pass', 'trinity-log.md', 'exists');
    results.pass++;
  } else {
    printLine('warn', 'trinity-log.md', 'missing — trinity sync has not been run');
    results.warn++;
  }
}

// ─── Output helpers ─────────────────────────────────────────────────────────

function printLine(level, label, detail) {
  const icons = {
    pass: chalk.green('✓'),
    fail: chalk.red('✗'),
    warn: chalk.yellow('⚠'),
  };
  const icon = icons[level] || ' ';
  const detailStr = detail ? chalk.dim(`  ${detail}`) : '';
  console.log(`  ${icon}  ${label}${detailStr}`);
}

function printSummary(results) {
  const parts = [];
  if (results.fail > 0) parts.push(chalk.red(`${results.fail} critical`));
  if (results.warn > 0) parts.push(chalk.yellow(`${results.warn} warning${results.warn > 1 ? 's' : ''}`));
  if (results.pass > 0) parts.push(chalk.green(`${results.pass} passed`));

  console.log(`\n  Status: ${parts.join(', ')}`);

  if (results.warn > 0) {
    console.log(chalk.dim('  Run: trinity refresh --stale-only to update stale docs'));
    console.log(chalk.dim('  Run: trinity sync to regenerate missing _index.md'));
  }
  console.log('');
}
