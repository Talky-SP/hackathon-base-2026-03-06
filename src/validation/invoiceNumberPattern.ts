/**
 * Invoice number pattern validation using trie-based pattern matching.
 *
 * Given a list of invoice numbers from the same supplier, detects the
 * dominant pattern using 5 progressively refined strategies. An invoice
 * number is flagged as an outlier only if it doesn't match the dominant
 * pattern in ANY of the 5 strategies.
 *
 * Convention: input is normalized to uppercase for case-insensitive matching.
 * Template tokens use lowercase to avoid collisions with fixed characters:
 *   x = any alphanumeric, d = any digit, a = any alpha
 * Fixed characters are uppercase: e.g. 'F', '-', '/'
 */

// ─── Trie ───────────────────────────────────────────────────────────────────
// Each strategy converts invoice numbers into template patterns, then inserts
// them into a trie. The trie leaf with the highest count is the "dominant
// pattern". Indices stored at leaves allow mapping back to the original invoices.

interface TrieNode {
  children: Map<string, TrieNode>;
  endCount: number;
  endIndices: number[];
}

function createNode(): TrieNode {
  return { children: new Map(), endCount: 0, endIndices: [] };
}

function trieInsert(root: TrieNode, pattern: string, index: number) {
  let node = root;
  for (const ch of pattern) {
    let child = node.children.get(ch);
    if (!child) {
      child = createNode();
      node.children.set(ch, child);
    }
    node = child;
  }
  node.endCount++;
  node.endIndices.push(index);
}

function trieFindDominant(root: TrieNode): { pattern: string; indices: number[] } {
  let bestPattern = '';
  let bestIndices: number[] = [];

  function walk(node: TrieNode, path: string) {
    if (node.endCount > bestIndices.length) {
      bestPattern = path;
      bestIndices = node.endIndices;
    }
    for (const [ch, child] of node.children) {
      walk(child, path + ch);
    }
  }

  walk(root, '');
  return { pattern: bestPattern, indices: bestIndices };
}

// ─── Character helpers ──────────────────────────────────────────────────────

const isDigit = (c: string) => c >= '0' && c <= '9';
const isAlpha = (c: string) => (c >= 'A' && c <= 'Z'); // input is already uppercased
const isAlnum = (c: string) => isDigit(c) || isAlpha(c);

// ─── Normalize ──────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toUpperCase();
}

// ─── Positional analysis (runs on normalized strings) ───────────────────────

interface PosStats {
  total: number;
  digits: number;
  alpha: number;
  charCounts: Map<string, number>;
}

function analyzePositions(strings: string[]): PosStats[] {
  const maxLen = Math.max(...strings.map((s) => s.length), 0);
  const stats: PosStats[] = [];

  for (let pos = 0; pos < maxLen; pos++) {
    const ps: PosStats = { total: 0, digits: 0, alpha: 0, charCounts: new Map() };
    for (const s of strings) {
      if (pos >= s.length) continue;
      const c = s[pos];
      ps.total++;
      if (isDigit(c)) ps.digits++;
      if (isAlpha(c)) ps.alpha++;
      ps.charCounts.set(c, (ps.charCounts.get(c) ?? 0) + 1);
    }
    stats.push(ps);
  }

  return stats;
}

// ─── Strategy 1: Coarse ─────────────────────────────────────────────────────
// Most lenient. Collapses all alphanumeric characters into 'x', preserving
// only structural separators (-/. etc). Catches gross format differences
// like "INV-001" vs "20240101" (different separator structure).

function patternS1(s: string): string {
  return Array.from(s).map((c) => (isAlnum(c) ? 'x' : c)).join('');
}

// ─── Strategy 2: Medium ─────────────────────────────────────────────────────
// Distinguishes digits from letters. Catches cases where a digit slot
// gets an alpha character or vice versa (e.g. "F-123" vs "F-12A").

function patternS2(s: string): string {
  return Array.from(s).map((c) => {
    if (isDigit(c)) return 'd';
    if (isAlpha(c)) return 'a';
    return c;
  }).join('');
}

// ─── Strategy 2b: Medium + majority fix ─────────────────────────────────────
// Builds on S2 but locks positions where >80% of invoices share the exact
// same character (requires >10 invoices for statistical confidence).
// E.g. if position 0 is always 'F', the template becomes "Fddd" instead of "addd".

function patternS2b(s: string, stats: PosStats[]): string {
  return Array.from(s).map((c, pos) => {
    if (pos >= stats.length) {
      if (isDigit(c)) return 'd';
      if (isAlpha(c)) return 'a';
      return c;
    }

    const ps = stats[pos];
    if (ps.total > 10) {
      for (const [ch, count] of ps.charCounts) {
        if (count / ps.total > 0.8) return ch; // uppercase fixed char
      }
    }

    if (isDigit(c)) return 'd';
    if (isAlpha(c)) return 'a';
    return c;
  }).join('');
}

// ─── Strategy 3: Probabilistic ──────────────────────────────────────────────
// Uses a Bayesian-inspired approach with a digit prior of 10/36 ≈ 0.278
// (uniform over alphanumeric). Positions where the observed digit fraction
// deviates significantly from the prior get classified as 'd' or 'a';
// ambiguous positions stay 'x'. Handles mixed-type positions gracefully.

const DIGIT_PRIOR = 10 / 36; // ~0.278

function patternS3(s: string, stats: PosStats[]): string {
  return Array.from(s).map((c, pos) => {
    if (!isAlnum(c)) return c;
    if (pos >= stats.length) return isDigit(c) ? 'd' : 'a';

    const ps = stats[pos];
    const alnum = ps.digits + ps.alpha;
    if (alnum === 0) return isDigit(c) ? 'd' : 'a';

    const digitFrac = ps.digits / alnum;
    if (digitFrac > DIGIT_PRIOR + 0.22) return 'd';  // >50% digits → confident it's d
    if (digitFrac < DIGIT_PRIOR) return 'a';          // below prior → confident it's a
    return 'x';                                        // within confidence interval
  }).join('');
}

// ─── Strategy 4: Specific characters ────────────────────────────────────────
// Extends S3 with fixed-character detection. If >75% of invoices share the
// same character at a position, that position is locked to the literal
// character. Catches format prefixes like "B-" or separators that are
// consistent across invoices.

const SPECIFIC_CHAR_THRESHOLD_S4 = 0.75;

function patternS4(s: string, stats: PosStats[]): string {
  return Array.from(s).map((c, pos) => {
    if (pos >= stats.length) return isDigit(c) ? 'd' : isAlpha(c) ? 'a' : c;

    const ps = stats[pos];

    // Check for a dominant specific character (uppercase)
    for (const [ch, count] of ps.charCounts) {
      if (count / ps.total > SPECIFIC_CHAR_THRESHOLD_S4) return ch;
    }

    if (!isAlnum(c)) return c;
    const alnum = ps.digits + ps.alpha;
    if (alnum === 0) return isDigit(c) ? 'd' : 'a';

    const digitFrac = ps.digits / alnum;
    if (digitFrac > DIGIT_PRIOR + 0.22) return 'd';
    if (digitFrac < DIGIT_PRIOR) return 'a';
    return 'x';
  }).join('');
}

// ─── Strategy 5: Handcrafted ────────────────────────────────────────────────
// Most aggressive strategy. Lowers the fixed-character threshold to >50%,
// tightens the digit/alpha split to 80/20, and adds two-character dominance
// detection: if the top 2 characters cover >90% of a position and are the
// same class (both digits or both alpha), the position is classified
// accordingly. Last resort to catch subtle deviations.

const SPECIFIC_CHAR_THRESHOLD_S5 = 0.5;

function patternS5(s: string, stats: PosStats[]): string {
  return Array.from(s).map((c, pos) => {
    if (pos >= stats.length) return isDigit(c) ? 'd' : isAlpha(c) ? 'a' : c;

    const ps = stats[pos];

    // Check for a dominant specific character (uppercase, lower threshold)
    for (const [ch, count] of ps.charCounts) {
      if (count / ps.total > SPECIFIC_CHAR_THRESHOLD_S5) return ch;
    }

    // Check if top-2 chars are all same class (digits or alpha)
    const sorted = [...ps.charCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length >= 2) {
      const top2Count = sorted[0][1] + sorted[1][1];
      if (top2Count / ps.total > 0.9) {
        const allDigits = sorted.slice(0, 2).every(([ch]) => isDigit(ch));
        const allAlpha = sorted.slice(0, 2).every(([ch]) => isAlpha(ch));
        if (allDigits) return 'd';
        if (allAlpha) return 'a';
      }
    }

    if (!isAlnum(c)) return c;
    const alnum = ps.digits + ps.alpha;
    if (alnum === 0) return isDigit(c) ? 'd' : 'a';

    const digitFrac = ps.digits / alnum;
    if (digitFrac > 0.8) return 'd';
    if (digitFrac < 0.2) return 'a';
    return 'x';
  }).join('');
}

// ─── Run a strategy through the trie ────────────────────────────────────────

type PatternFn = (s: string, stats: PosStats[]) => string;

export interface StrategySummary {
  name: string;
  dominantPattern: string;
  matched: number;
  outliers: number;
  total: number;
}

function runStrategy(
  numbers: string[],
  fn: PatternFn,
  stats: PosStats[],
): { matchedSet: Set<number>; summary: StrategySummary; name: string } & { dominantPattern: string } {
  const root = createNode();
  for (let i = 0; i < numbers.length; i++) {
    trieInsert(root, fn(numbers[i], stats), i);
  }
  const dominant = trieFindDominant(root);
  const matchedSet = new Set(dominant.indices);
  return {
    matchedSet,
    dominantPattern: dominant.pattern,
    name: '',
    summary: {
      name: '',
      dominantPattern: dominant.pattern,
      matched: dominant.indices.length,
      outliers: numbers.length - dominant.indices.length,
      total: numbers.length,
    },
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface PatternDetectionResult {
  outlierIndices: number[];
  strategySummaries: StrategySummary[];
}

const STRATEGY_NAMES = [
  'S1 Coarse (alnum→x)',
  'S2 Medium (digit→d, alpha→a)',
  'S2b Medium + majority fix (>10 inv, >80% char)',
  'S3 Probabilistic (confidence intervals)',
  'S4 Specific chars (>75% fixed)',
  'S5 Handcrafted (>50% fixed, tight split)',
];

/**
 * Detects outlier invoice numbers within a supplier bucket.
 * Runs all 5 strategies (coarse → aggressive). An invoice number is only
 * flagged as an outlier if it fails to match the dominant pattern in ALL
 * strategies — this union approach minimises false positives.
 * Input is normalized to uppercase for case-insensitive matching.
 */
export function detectInvoiceNumberOutliers(numbers: string[]): PatternDetectionResult {
  if (numbers.length <= 1) {
    return { outlierIndices: [], strategySummaries: [] };
  }

  // Normalize all input to uppercase
  const normalized = numbers.map(normalize);
  const stats = analyzePositions(normalized);
  const passed = new Set<number>();

  const strategies: PatternFn[] = [
    (s) => patternS1(s),
    (s) => patternS2(s),
    (s, st) => patternS2b(s, st),
    (s, st) => patternS3(s, st),
    (s, st) => patternS4(s, st),
    (s, st) => patternS5(s, st),
  ];

  const strategySummaries: StrategySummary[] = [];

  for (let si = 0; si < strategies.length; si++) {
    const result = runStrategy(normalized, strategies[si], stats);
    result.summary.name = STRATEGY_NAMES[si];
    strategySummaries.push(result.summary);
    for (const idx of result.matchedSet) {
      passed.add(idx);
    }
  }

  const outlierIndices: number[] = [];
  for (let i = 0; i < numbers.length; i++) {
    if (!passed.has(i)) outlierIndices.push(i);
  }
  return { outlierIndices, strategySummaries };
}
