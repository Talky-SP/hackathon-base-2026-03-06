/**
 * Simple fuzzy substring matcher.
 * Checks if all characters of `query` appear in order in `target` (case-insensitive).
 * Returns match info with score (lower = better) and highlight ranges.
 */
export function fuzzyMatch(
  query: string,
  target: string,
): { matches: boolean; score: number; ranges: [number, number][] } {
  if (!query) return { matches: true, score: 0, ranges: [] };

  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const ranges: [number, number][] = [];

  let qi = 0;
  let score = 0;
  let lastMatchIdx = -2; // track consecutiveness
  let rangeStart = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (ti === lastMatchIdx + 1) {
        // consecutive — extend current range
      } else {
        // gap — close previous range and start new one
        if (rangeStart >= 0) ranges.push([rangeStart, lastMatchIdx + 1]);
        rangeStart = ti;
        score += (ti - (lastMatchIdx + 1)); // penalize gaps
      }
      lastMatchIdx = ti;
      qi++;
    }
  }

  if (qi < q.length) {
    return { matches: false, score: Infinity, ranges: [] };
  }

  // close last range
  if (rangeStart >= 0) ranges.push([rangeStart, lastMatchIdx + 1]);

  return { matches: true, score, ranges };
}
