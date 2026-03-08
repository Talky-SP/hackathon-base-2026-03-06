// ─── Helpers ─────────────────────────────────────────────────────────────────

function isWhitespace(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}

/** Cost 0 pairs: . ↔ , and - ↔ / */
function charsEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  const p = a + b;
  return p === '.,' || p === ',.' || p === '-/' || p === '/-';
}

/** Deleting or inserting whitespace is free */
function charCost(c: string): number {
  return isWhitespace(c) ? 0 : 1;
}

// ─── Substring edit distance ─────────────────────────────────────────────────

/**
 * True substring edit distance: minimum edits to transform any contiguous
 * substring of `source` into `target`.
 *
 * - Prefix/suffix of source can be skipped at a tiny cost (0.01 per char)
 *   so shorter-match substrings are preferred over longer ones.
 * - Whitespace deletion/insertion costs 0.
 * - `.` ↔ `,` and `-` ↔ `/` substitutions cost 0.
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

  const SKIP_COST = 0.01; // tiny cost per prefix/suffix char skipped

  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);

  // dp[0][j] = cost of inserting first j chars of target (no source consumed)
  prev[0] = 0;
  for (let j = 1; j <= m; j++) {
    prev[j] = prev[j - 1] + charCost(b[j - 1]);
  }

  // result starts at dp[0][m] + suffix cost of skipping all n source chars
  let result = prev[m] + SKIP_COST * n;

  let prefixCost = 0;
  for (let i = 1; i <= n; i++) {
    prefixCost += SKIP_COST; // tiny prefix skip cost
    curr[0] = prefixCost;
    for (let j = 1; j <= m; j++) {
      if (charsEquivalent(a[i - 1], b[j - 1])) {
        curr[j] = prev[j - 1]; // match or equivalent pair
      } else {
        const subst = prev[j - 1] + 1;                   // substitution
        const del   = prev[j] + charCost(a[i - 1]);      // delete from source
        const ins   = curr[j - 1] + charCost(b[j - 1]);  // insert into source
        curr[j] = Math.min(subst, del, ins);
      }
    }
    // Free suffix skip: stopping here means skipping (n - i) source chars
    const total = curr[m] + SKIP_COST * (n - i);
    if (total < result) result = total;
    [prev, curr] = [curr, prev];
  }

  return result;
}

// ─── Standard edit distance ──────────────────────────────────────────────────

/**
 * Standard Levenshtein edit distance — no free prefix/suffix deletions.
 * - Whitespace deletion/insertion costs 0.
 * - `.` ↔ `,` and `-` ↔ `/` substitutions cost 0.
 *
 * Both strings are compared case-insensitively.
 */
export function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const n = s.length;
  const m = t.length;

  if (n === 0 && m === 0) return 0;

  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);

  // dp[0][j] = cost of inserting first j chars of t
  prev[0] = 0;
  for (let j = 1; j <= m; j++) {
    prev[j] = prev[j - 1] + charCost(t[j - 1]);
  }

  let prefixDelCost = 0;
  for (let i = 1; i <= n; i++) {
    prefixDelCost += charCost(s[i - 1]);
    curr[0] = prefixDelCost;
    for (let j = 1; j <= m; j++) {
      if (charsEquivalent(s[i - 1], t[j - 1])) {
        curr[j] = prev[j - 1];
      } else {
        const subst = prev[j - 1] + 1;
        const del   = prev[j] + charCost(s[i - 1]);
        const ins   = curr[j - 1] + charCost(t[j - 1]);
        curr[j] = Math.min(subst, del, ins);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}
