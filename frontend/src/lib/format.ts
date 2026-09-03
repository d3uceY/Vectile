/** Shared formatting helpers (bytes, path basenames). */

/** "12.4 MB" / "256 KB" for byte counts; these are approximate display sizes. */
export function fmtBytes(b: number): string {
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(b / 1024)} KB`;
}

/** Last path segment, handling both Windows and POSIX separators. */
export function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}
