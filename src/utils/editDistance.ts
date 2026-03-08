/**
 * Custom edit distance where deletion from `source` costs 0.
 * Insert into source and substitute both cost 1.
 *
 * This means if `target` is a subsequence of `source`, the distance is 0.
 * (Subsequence is a superset of substring, so substrings also yield 0.)
 *
 * Equivalent to: len(target) - LCS(source, target).
 *
 * Uses the Hunt-Szymanski algorithm for LCS: O((r + n) log n)
 * where r = number of matching character pairs and n = max(|source|, |target|).
 * This beats standard O(n·m) DP when the alphabet is not tiny relative to
 * string length (i.e. matches are sparse), which is typical for OCR text.
 *
 * Both strings are compared case-insensitively.
 */
export function substringEditDistance(source: string, target: string): number {
  const a = source.toLowerCase();
  const b = target.toLowerCase();
  const n = a.length;
  const m = b.length;

  if (m === 0) return 0;
  if (n === 0) return m;

  // Build match lists: for each character, positions in `a` in decreasing order.
  // Decreasing order is required so that processing multiple matches for the
  // same j doesn't cause cascading updates in the threshold array.
  const matchList = new Map<string, number[]>();
  for (let i = n - 1; i >= 0; i--) {
    const c = a[i];
    let list = matchList.get(c);
    if (!list) {
      list = [];
      matchList.set(c, list);
    }
    list.push(i);
  }

  // thresh[k] = smallest position i in `a` such that there exists an LCS
  // of length (k+1) ending at position i.  Always sorted in increasing order.
  const thresh: number[] = [];

  for (let j = 0; j < m; j++) {
    const positions = matchList.get(b[j]);
    if (!positions) continue;

    for (const i of positions) {
      // Binary search: find leftmost index where thresh[idx] >= i
      let lo = 0;
      let hi = thresh.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (thresh[mid] < i) lo = mid + 1;
        else hi = mid;
      }
      if (lo === thresh.length) {
        thresh.push(i);
      } else {
        thresh[lo] = i;
      }
    }
  }

  return m - thresh.length;
}
