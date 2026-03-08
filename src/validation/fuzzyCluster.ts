/**
 * Centroid-based fuzzy clustering for supplier name validation.
 *
 * Used by batch validation to detect supplier name inconsistencies within
 * a CIF bucket. Algorithm:
 *   1. For each string, compute its average Fuse.js similarity to all others.
 *   2. The string with the highest average is the "centroid".
 *   3. Every string with similarity ≥ scoreThreshold to the centroid is
 *      "matched"; the rest are "outliers".
 *
 * This catches OCR/AI extraction typos where the same supplier gets slightly
 * different names across invoices.
 */

import Fuse from 'fuse.js';

// ─── Fuse-based similarity ──────────────────────────────────────────────────

/**
 * Returns a similarity score (0..1) between two strings using Fuse.js.
 * Fuse scores are inverted: Fuse 0 = perfect match → we return 1,
 * Fuse 1 = no match → we return 0. The threshold parameter controls
 * how strict Fuse's internal matching is.
 */
function fuseSimilarity(a: string, b: string, threshold: number): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 1;
  if (!na || !nb) return 0;

  const fuse = new Fuse([{ name: nb }], {
    keys: ['name'],
    includeScore: true,
    threshold,
    ignoreLocation: true,
  });

  const results = fuse.search(na);
  if (results.length === 0) return 0;
  return 1 - (results[0].score ?? 1);
}

// ─── Centroid clustering ────────────────────────────────────────────────────

export interface ClusterResult {
  centroid: string;
  matched: number[];    // indices of strings that match the centroid
  outliers: number[];   // indices of strings that don't match
}

/**
 * Finds the centroid of the given strings and clusters them.
 *
 * @param strings        - The strings to cluster
 * @param scoreThreshold - Minimum similarity to the centroid to be considered
 *                         a match (0..1). Default 0.9 (10% max dissimilarity).
 *                         Mapped to a Fuse threshold of `1 - scoreThreshold`.
 * @returns ClusterResult with centroid, matched indices, and outlier indices.
 */
export function centroidCluster(strings: string[], scoreThreshold = 0.9): ClusterResult {
  if (strings.length === 0) {
    return { centroid: '', matched: [], outliers: [] };
  }
  if (strings.length === 1) {
    return { centroid: strings[0], matched: [0], outliers: [] };
  }

  const fuseThreshold = 1 - scoreThreshold; // e.g. 0.9 similarity → 0.1 fuse threshold
  const n = strings.length;

  // Find the centroid: string with the highest average similarity to all others
  let bestIdx = 0;
  let bestAvg = -1;

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) sum += fuseSimilarity(strings[i], strings[j], fuseThreshold);
    }
    const avg = sum / (n - 1);
    if (avg > bestAvg) {
      bestAvg = avg;
      bestIdx = i;
    }
  }

  const centroid = strings[bestIdx];
  const matched: number[] = [];
  const outliers: number[] = [];

  // Match all strings against the centroid
  for (let i = 0; i < n; i++) {
    if (fuseSimilarity(strings[i], centroid, fuseThreshold) >= scoreThreshold) {
      matched.push(i);
    } else {
      outliers.push(i);
    }
  }

  return { centroid, matched, outliers };
}
