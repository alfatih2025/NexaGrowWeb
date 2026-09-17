/**
 * Returns the first non-empty (trimmed) value among the provided environment
 * variable names, or an empty string when none are set.
 */
export function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
