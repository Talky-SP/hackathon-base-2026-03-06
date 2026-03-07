/**
 * Centroid-based fuzzy clustering for supplier name validation.
 *
 * Uses Fuse.js for fuzzy matching. Finds the "centroid" (the string with the
 * most fuzzy matches to all others) and clusters strings that match it.
 */

import Fuse from 'fuse.js';

// ─── Fuse-based similarity ──────────────────────────────────────────────────

/**
 * Returns a similarity score (0..1) between two strings using Fuse.js.
 * A Fuse score of 0 = perfect match, 1 = no match. We invert it.
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
