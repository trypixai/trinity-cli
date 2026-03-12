/**
 * Validates a knowledge doc's content. Returns array of error strings (empty = valid).
 *
 * Critical checks (fail):
 *   - No raw EJS tags (unrendered template)
 *   - Minimum line count (50 lines — prevents truncated docs)
 *
 * Non-critical: frontmatter date presence is checked separately by staleness logic.
 * We don't require **Version** or **Authors:** because hand-written docs may predate
 * oracle's frontmatter conventions.
 */
export function validateDoc(filename, content) {
  const errors = [];
  const lines = content.split('\n');

  // Rule 1: minimum line count
  if (lines.length < 50) {
    errors.push(`Too short: ${lines.length} lines (minimum 50)`);
  }

  // Rule 2: no raw EJS tags (unrendered template)
  if (content.includes('<%')) {
    const ejsLines = lines
      .map((line, i) => ({ line, num: i + 1 }))
      .filter(({ line }) => line.includes('<%'))
      .map(({ num }) => `line ${num}`)
      .slice(0, 3);
    errors.push(`Raw EJS tags (<%) at: ${ejsLines.join(', ')}`);
  }

  return errors;
}
