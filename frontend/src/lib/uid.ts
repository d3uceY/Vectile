let seq = 0;

/** Generate a unique DOM id with a readable prefix (e.g. "grid-3-a1b2c"). */
export const uid = (prefix: string) => `${prefix}-${++seq}-${Math.random().toString(36).slice(2, 7)}`;
