/**
 * Parses a date from markdown frontmatter.
 *
 * Tries **Created**: YYYY-MM-DD first (oracle convention),
 * then falls back to **Last Updated**: YYYY-MM-DD (hand-written docs).
 *
 * Returns a Date (UTC midnight) or null if neither found / invalid.
 */
export function parseDateFromFrontmatter(content) {
  // Try **Created** first (oracle convention)
  const createdMatch = content.match(/\*\*Created\*\*:\s*(\d{4}-\d{2}-\d{2})/);
  if (createdMatch) {
    const d = new Date(createdMatch[1] + 'T00:00:00Z');
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback to **Last Updated** (hand-written docs)
  const updatedMatch = content.match(/\*\*Last Updated\*\*:\s*(\d{4}-\d{2}-\d{2})/);
  if (updatedMatch) {
    const d = new Date(updatedMatch[1] + 'T00:00:00Z');
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Returns how many whole months have elapsed since `date`.
 * Uses a 30.44-day average month for human-readable display.
 */
export function monthsAgo(date) {
  const diffMs = Date.now() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 30.44);
}

/**
 * Returns a human-readable age string for a date.
 * e.g. "2 days ago", "3 months ago"
 */
export function formatAge(date) {
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30.44);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
}
