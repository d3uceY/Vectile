/** Whole days since an ISO timestamp, or null when unparseable or in the
    future. Used for the stale-library hint and the status strip. */
export function daysSince(iso: string): number | null {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const days = Math.floor((Date.now() - ms) / 86400000);
  return days >= 0 ? days : null;
}

/** Compact "last indexed …" suffix for the status strip. */
export function lastIndexedLabel(iso: string): string {
  const d = daysSince(iso);
  if (d === null) return "";
  if (d === 0) return " · last indexed today";
  if (d === 1) return " · last indexed yesterday";
  return ` · last indexed ${d} days ago`;
}
