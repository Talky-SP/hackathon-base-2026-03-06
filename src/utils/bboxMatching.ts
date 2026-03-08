import type { TextractResult } from '../components/annotation/AnnotationPanel';
import { substringEditDistance, editDistance } from './editDistance';

// ─── Types ─────────────────────────────────────────────────────────────────

export type BBox = { Left: number; Top: number; Width: number; Height: number };

export interface MetadataField {
  fieldName: string;  // full dot-path
  leafName: string;   // last key segment
  value: string;
  pageNumber: number;
  metadataBBox: BBox | null; // null when field has no bounding_box (e.g. ibans)
  confidence: number | null;
}

export interface LineBlock {
  text: string;
  pageNumber: number;
  box: BBox;
}

export interface MatchedBBox {
  fieldName: string;  // full dot-path (e.g. "invoice_details.invoice_number")
  leafName: string;   // last key segment (e.g. "invoice_number") — used for form linking
  formFieldName: string; // path matching the form's data-field-name (e.g. "all_products[0].quantity")
  value: string;
  pageNumber: number;
  box: BBox;
  matchConfidence?: number; // Pass 1: from metadata, Pass 2: 0.9 = unique fuzzy match, 0.5 = ambiguous
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const BBOX_PADDING = 1;
/** Max center-distance on either axis to accept a Textract LINE as a match */
export const MAX_AXIS_DIST = 0.1;
/** Max edit distance to accept a fuzzy match in Pass 2 (substring mode) */
const P2_MAX_EDIT_DIST = 2.01;
/** For short alphanumeric values: max edit distance = min(P2_MAX_EDIT_DIST, floor(len / P2_SHORT_ALNUM_LEN_DIVISOR)) */
const P2_SHORT_ALNUM_LEN_DIVISOR = 3;
/** Max length to treat a purely alphanumeric value as "short" (strict edit distance) */
const P2_SHORT_ALNUM_MAX_LEN = 5;
/** Pass 2 confidence when exactly one LINE block matches within threshold */
const P2_CONFIDENCE_UNIQUE = 0.9;
/** Pass 2 confidence when multiple LINE blocks match within threshold */
const P2_CONFIDENCE_AMBIGUOUS = 0.5;

/** BBox sort order: leafName → sort priority within group. Lower = earlier. */
const BBOX_FIELD_ORDER: Record<string, number> = {
  // Invoice Header
  invoice_number: 10, supplier: 20, supplier_cif: 30, supplier_province: 40,
  supplier_address: 50, invoice_date: 60, due_date: 70, period: 80, concept: 90, category: 100,
  // IBANs
  iban_normalized: 110, owner: 112, role: 114,
  // Amounts
  importe: 120, total: 130, retencion: 140, retencion_type: 150,
  // Discounts
  discount_name: 160, discount_amount: 170,
  // Products
  product_name: 210, quantity: 220, unit_price: 230, final_price: 240, discount: 250,
  product_id: 270,
  // IVA lines (after products — typically at bottom of invoice)
  base_imponible: 310, type: 320, amount: 330,
};

/** BBox group priority by formFieldName prefix. Lower = earlier. */
function fieldGroupOrder(formFieldName: string): number {
  if (formFieldName.startsWith('ibans[')) return 2;
  if (formFieldName.startsWith('invoice_amounts.descuentos_generales[')) return 4;
  if (formFieldName.startsWith('all_products[')) return 5;
  if (formFieldName.startsWith('invoice_amounts.ivas[')) return 6;
  // Amounts section fields
  if (['importe', 'total', 'retencion', 'retencion_type'].includes(formFieldName)) return 3;
  // Header fields
  return 1;
}

/** Extract array index from formFieldName like "ibans[2].owner" → 2, or -1 */
function fieldArrayIndex(formFieldName: string): number {
  const m = formFieldName.match(/\[(\d+)\]/);
  return m ? parseInt(m[1], 10) : -1;
}

// ─── Functions ──────────────────────────────────────────────────────────────

/**
 * Convert a textract_metadata path to the form's fieldPath convention.
 * textract_metadata:  "invoice_details.supplier_cif" → "supplier_cif"
 *                     "invoice_amounts.ivas[0].base_imponible" → "invoice_amounts.ivas[0].base_imponible"
 *                     "products[1].quantity" → "all_products[1].quantity"
 */
export function toFormFieldName(metaPath: string, leafName: string): string {
  // Products: textract uses "products[i].field", form uses "all_products[i].field"
  if (metaPath.startsWith('products[')) {
    return 'all_' + metaPath;
  }
  // IVAs, IBANs, descuentos_generales: form uses the same paths as textract_metadata
  if (metaPath.startsWith('invoice_amounts.ivas[') || metaPath.startsWith('ibans[') || metaPath.startsWith('invoice_amounts.descuentos_generales[')) {
    return metaPath;
  }
  // Top-level fields nested under invoice_details/invoice_amounts: use just the leaf
  if (metaPath.startsWith('invoice_details.') || metaPath.startsWith('invoice_amounts.')) {
    return leafName;
  }
  // Everything else: use the leaf name (top-level fields)
  return leafName;
}

/**
 * Recursively walk any object tree looking for entries that have
 * `bounding_box` + `value` (the textract_metadata field pattern).
 * Handles: top-level fields, arrays (ivas[]), nested sub-fields, any depth.
 */
export function collectBBoxEntries(
  obj: unknown,
  path: string,
  results: MetadataField[],
): void {
  if (!obj || typeof obj !== 'object') return;

  const rec = obj as Record<string, unknown>;
  const bb = rec.bounding_box as Record<string, number> | undefined;
  const hasBBox = bb && typeof bb.Left === 'number';

  // If this object has `value` it's a field entry (with or without bounding_box)
  if (rec.value !== undefined && rec.value !== null) {
    let strVal: string;
    const val = rec.value;
    if (typeof val === 'string') strVal = val;
    else if (typeof val === 'number') strVal = String(val);
    else if (typeof val === 'boolean') strVal = String(val);
    else strVal = JSON.stringify(val);

    // Extract leaf name: last key segment from dot-path (strip array indices)
    const segments = path.split('.');
    const leaf = segments[segments.length - 1].replace(/\[\d+\]$/, '');

    results.push({
      fieldName: path,
      leafName: leaf,
      value: strVal,
      pageNumber: typeof rec.page_number === 'number' ? rec.page_number : 1,
      metadataBBox: hasBBox ? { Left: bb.Left, Top: bb.Top, Width: bb.Width, Height: bb.Height } : null,
      confidence: typeof rec.confidence === 'number' ? rec.confidence : null,
    });

    // For entries without bounding_box, also collect string sub-fields
    // (e.g. ibans[0] has iban_normalized, owner, role as plain strings)
    if (!hasBBox) {
      for (const [key, child] of Object.entries(rec)) {
        if (key === 'value' || key === 'confidence' || key === 'page_number') continue;
        if (typeof child === 'string' && child.length > 0) {
          const childPath = path ? `${path}.${key}` : key;
          const childLeaf = key;
          results.push({
            fieldName: childPath,
            leafName: childLeaf,
            value: child,
            pageNumber: typeof rec.page_number === 'number' ? rec.page_number : 1,
            metadataBBox: null,
            confidence: typeof rec.confidence === 'number' ? rec.confidence : null,
          });
        }
      }
    }
    return; // This is a leaf field entry — don't recurse further
  }

  // Otherwise recurse into children
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => collectBBoxEntries(item, `${path}[${i}]`, results));
  } else {
    for (const [key, child] of Object.entries(rec)) {
      if (key === 'bounding_box' || key === 'image_key') continue; // skip non-field keys
      const childPath = path ? `${path}.${key}` : key;
      collectBBoxEntries(child, childPath, results);
    }
  }
}

/**
 * Collect string fields from a top-level flat array (e.g. detail.ibans).
 * Each array item is a flat object like { iban_normalized, owner, role, confidence }.
 * Produces entries like ibans[0].iban_normalized, ibans[0].owner, etc.
 */
function collectFlatArrayEntries(
  detail: Record<string, unknown>,
  key: string,
  results: MetadataField[],
): void {
  const arr = detail[key];
  if (!Array.isArray(arr)) return;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i] as Record<string, unknown> | undefined;
    if (!item || typeof item !== 'object') continue;
    const conf = typeof item.confidence === 'number' ? item.confidence : null;
    const page = typeof item.page_number === 'number' ? item.page_number : 1;
    const bb = item.bounding_box as Record<string, number> | undefined;
    const hasBBox = bb && typeof bb.Left === 'number';
    for (const [field, val] of Object.entries(item)) {
      if (typeof val !== 'string' || val.length === 0) continue;
      // Skip meta keys that aren't real fields
      if (field === 'confidence' || field === 'page_number' || field === 'bounding_box' || field === 'image_key') continue;
      results.push({
        fieldName: `${key}[${i}].${field}`,
        leafName: field,
        value: val,
        pageNumber: page,
        metadataBBox: hasBBox ? { Left: bb.Left, Top: bb.Top, Width: bb.Width, Height: bb.Height } : null,
        confidence: conf,
      });
    }
  }
}

/** Extract all fields with bounding_box from textract_metadata + top-level arrays (ibans, etc.) */
export function extractFieldsWithBBox(detail: Record<string, unknown> | null | undefined): MetadataField[] {
  if (!detail) return [];
  const results: MetadataField[] = [];

  // Primary source: textract_metadata
  const meta = detail.textract_metadata as Record<string, unknown> | undefined;
  if (meta) {
    collectBBoxEntries(meta, '', results);
  }

  // Top-level arrays outside textract_metadata (flat items without bounding_box)
  collectFlatArrayEntries(detail, 'ibans', results);

  return results;
}

/** Extract LINE blocks from raw Textract result */
export function extractLineBlocks(textractResult: TextractResult | null | undefined): LineBlock[] {
  if (!textractResult?.Pages) return [];
  const blocks: LineBlock[] = [];
  for (const page of textractResult.Pages) {
    for (const block of page.TextractResponse.Blocks) {
      if (block.BlockType === 'LINE' && block.Text && block.Geometry?.BoundingBox) {
        const bb = block.Geometry.BoundingBox;
        blocks.push({
          text: block.Text,
          pageNumber: page.PageNumber,
          box: { Left: bb.Left, Top: bb.Top, Width: bb.Width, Height: bb.Height },
        });
      }
    }
  }
  return blocks;
}

/** Euclidean distance between bbox centers */
export function bboxCenterDist(a: BBox, b: BBox): number {
  const acx = a.Left + a.Width / 2;
  const acy = a.Top + a.Height / 2;
  const bcx = b.Left + b.Width / 2;
  const bcy = b.Top + b.Height / 2;
  return Math.hypot(acx - bcx, acy - bcy);
}

/** Whether a value is short alphanumeric (use strict editDistance instead of substring) */
function isShortAlphanumeric(value: string): boolean {
  return /^[a-z0-9]+$/i.test(value) && value.length <= P2_SHORT_ALNUM_MAX_LEN;
}

/**
 * For a deferred field with no unclaimed fuzzy match, find the best claimed
 * LINE block within spatial range (the Pass 1 winner for that area) and
 * return its box. This allows multiple fields to share a LINE block bbox
 * rather than falling back to the imprecise metadata bbox.
 */
function findPass1BoxForField(
  field: MetadataField,
  lineBlocks: LineBlock[],
  claimedIndices: Set<number>,
): BBox | null {
  const meta = field.metadataBBox;
  if (!meta) return null;
  const metaCx = meta.Left + meta.Width / 2;
  const metaCy = meta.Top + meta.Height / 2;

  let bestIdx = -1;
  let bestEdit = Infinity;
  let bestCenter = Infinity;

  for (const idx of claimedIndices) {
    const block = lineBlocks[idx];
    if (block.pageNumber !== field.pageNumber) continue;
    const box = block.box;
    const dx = Math.abs(metaCx - (box.Left + box.Width / 2));
    const dy = Math.abs(metaCy - (box.Top + box.Height / 2));
    if (dx > MAX_AXIS_DIST || dy > MAX_AXIS_DIST) continue;

    const ed = substringEditDistance(block.text, field.value);
    const cd = bboxCenterDist(meta, box);
    if (ed < bestEdit || (ed === bestEdit && cd < bestCenter)) {
      bestIdx = idx;
      bestEdit = ed;
      bestCenter = cd;
    }
  }

  return bestIdx >= 0 ? lineBlocks[bestIdx].box : null;
}

function sortBBoxResults(arr: MatchedBBox[]): void {
  arr.sort((a, b) => {
    const ga = fieldGroupOrder(a.formFieldName);
    const gb = fieldGroupOrder(b.formFieldName);
    if (ga !== gb) return ga - gb;
    const ia = fieldArrayIndex(a.formFieldName);
    const ib = fieldArrayIndex(b.formFieldName);
    if (ia !== ib) return ia - ib;
    const oa = BBOX_FIELD_ORDER[a.leafName] ?? 999;
    const ob = BBOX_FIELD_ORDER[b.leafName] ?? 999;
    return oa - ob;
  });
}

/**
 * Match metadata fields to precise Textract LINE block bounding boxes.
 *
 * Two-pass algorithm:
 * - Pass 1: Metadata-guided precise matching (spatial + text proximity).
 *   Each field finds the best LINE block within MAX_AXIS_DIST. If the best
 *   block is unclaimed, assign it. If claimed or no candidates, defer.
 * - Pass 2: Fuzzy fallback for deferred fields. Search ALL unclaimed LINE
 *   blocks (no spatial filter) using edit distance. Short alphanumeric values
 *   use strict Levenshtein; others use substring edit distance.
 */
export function matchFieldsToBBoxes(
  detail: Record<string, unknown> | null | undefined,
  textractResult: TextractResult | null | undefined,
): MatchedBBox[] {
  const fields = extractFieldsWithBBox(detail);
  if (fields.length === 0) return [];

  const lineBlocks = extractLineBlocks(textractResult);

  // No raw Textract data → use metadata bboxes as-is (skip fields without bbox)
  if (lineBlocks.length === 0) {
    const mapped = fields
      .filter((f) => f.metadataBBox !== null)
      .map((f) => ({
        fieldName: f.fieldName,
        leafName: f.leafName,
        formFieldName: toFormFieldName(f.fieldName, f.leafName),
        value: f.value,
        pageNumber: f.pageNumber,
        box: f.metadataBBox!,
      }));
    sortBBoxResults(mapped);
    return mapped;
  }

  const claimedIndices = new Set<number>(); // LINE block indices claimed in Pass 1
  const results: MatchedBBox[] = [];
  const deferred: MetadataField[] = [];

  // Sort fields so products are matched before IVAs (claim LINE blocks first)
  const matchFields = [...fields];
  matchFields.sort((a, b) => {
    const fa = toFormFieldName(a.fieldName, a.leafName);
    const fb = toFormFieldName(b.fieldName, b.leafName);
    const ga = fieldGroupOrder(fa);
    const gb = fieldGroupOrder(fb);
    if (ga !== gb) return ga - gb;
    const ia = fieldArrayIndex(fa);
    const ib = fieldArrayIndex(fb);
    if (ia !== ib) return ia - ib;
    const oa = BBOX_FIELD_ORDER[a.leafName] ?? 999;
    const ob = BBOX_FIELD_ORDER[b.leafName] ?? 999;
    return oa - ob;
  });

  // ── Pass 1: Metadata-guided precise matching ──────────────────────────

  for (const field of matchFields) {
    const meta = field.metadataBBox;
    if (!meta) {
      console.info(
        `[BBox P1] DEFER "${field.fieldName}" val="${field.value}" → no metadata bbox`,
      );
      deferred.push(field);
      continue;
    }
    const metaCx = meta.Left + meta.Width / 2;
    const metaCy = meta.Top + meta.Height / 2;

    const candidates: { idx: number; centerDist: number }[] = [];
    for (let idx = 0; idx < lineBlocks.length; idx++) {
      const block = lineBlocks[idx];
      if (block.pageNumber !== field.pageNumber) continue;
      const box = block.box;
      const dx = Math.abs(metaCx - (box.Left + box.Width / 2));
      const dy = Math.abs(metaCy - (box.Top + box.Height / 2));
      if (dx <= MAX_AXIS_DIST && dy <= MAX_AXIS_DIST) {
        candidates.push({ idx, centerDist: bboxCenterDist(meta, box) });
      }
    }

    if (candidates.length === 0) {
      console.info(
        `[BBox P1] DEFER "${field.fieldName}" val="${field.value}" → no candidates in range`,
      );
      deferred.push(field);
      continue;
    }

    // Rank by edit distance, ties broken by center distance
    const useStrict = isShortAlphanumeric(field.value);
    const distFn = useStrict ? editDistance : substringEditDistance;
    let bestIdx = candidates[0].idx;
    let bestEdit = distFn(lineBlocks[candidates[0].idx].text, field.value);
    let bestCenter = candidates[0].centerDist;

    for (let c = 1; c < candidates.length; c++) {
      const ed = distFn(lineBlocks[candidates[c].idx].text, field.value);
      if (ed < bestEdit || (ed === bestEdit && candidates[c].centerDist < bestCenter)) {
        bestIdx = candidates[c].idx;
        bestEdit = ed;
        bestCenter = candidates[c].centerDist;
      }
    }

    // Reject if best edit distance exceeds threshold
    const maxDist = useStrict
      ? Math.min(P2_MAX_EDIT_DIST, Math.floor(field.value.length / P2_SHORT_ALNUM_LEN_DIVISOR))
      : P2_MAX_EDIT_DIST;
    if (bestEdit > maxDist) {
      console.info(
        `[BBox P1] DEFER "${field.fieldName}" val="${field.value}" → best dist ${bestEdit.toFixed(2)} >= threshold ${maxDist} ("${lineBlocks[bestIdx].text}")`,
      );
      deferred.push(field);
      continue;
    }

    // If best block is already claimed, defer this field
    if (claimedIndices.has(bestIdx)) {
      console.info(
        `[BBox P1] DEFER "${field.fieldName}" val="${field.value}" → best LINE already claimed (idx=${bestIdx}, "${lineBlocks[bestIdx].text}")`,
      );
      deferred.push(field);
      continue;
    }

    console.info(
      `[BBox P1] OK "${field.fieldName}" val="${field.value}" → "${lineBlocks[bestIdx].text}" (dist=${bestEdit.toFixed(2)}, candidates=${candidates.length})`,
    );
    claimedIndices.add(bestIdx);
    const formFieldName = toFormFieldName(field.fieldName, field.leafName);
    results.push({
      fieldName: field.fieldName, leafName: field.leafName, formFieldName,
      value: field.value, pageNumber: field.pageNumber, box: lineBlocks[bestIdx].box,
      matchConfidence: field.confidence ?? undefined,
    });
  }

  // ── Pass 2: Fuzzy fallback for deferred fields ────────────────────────

  if (deferred.length > 0) {
    // Collect unclaimed LINE block indices
    const unclaimedIndices: number[] = [];
    for (let idx = 0; idx < lineBlocks.length; idx++) {
      if (!claimedIndices.has(idx)) unclaimedIndices.push(idx);
    }

    for (const field of deferred) {
      const formFieldName = toFormFieldName(field.fieldName, field.leafName);
      const useStrict = isShortAlphanumeric(field.value);
      const distFn = useStrict ? editDistance : substringEditDistance;
      const maxDist = useStrict
        ? Math.min(P2_MAX_EDIT_DIST, Math.floor(field.value.length / P2_SHORT_ALNUM_LEN_DIVISOR))
        : P2_MAX_EDIT_DIST;

      // Compute distance against all unclaimed LINE blocks (no spatial filter)
      // Track top 2 candidates for logging
      let best1 = { idx: -1, dist: Infinity, top: Infinity, text: '' };
      let best2 = { idx: -1, dist: Infinity, top: Infinity, text: '' };
      let closeMatchCount = 0;

      for (const idx of unclaimedIndices) {
        const block = lineBlocks[idx];
        if (block.pageNumber !== field.pageNumber) continue;
        const d = distFn(block.text, field.value);
        const top = block.box.Top;

        if (d <= maxDist) closeMatchCount++;

        if (d < best1.dist || (d === best1.dist && top < best1.top)) {
          best2 = { ...best1 };
          best1 = { idx, dist: d, top, text: block.text };
        } else if (d < best2.dist || (d === best2.dist && top < best2.top)) {
          best2 = { idx, dist: d, top, text: block.text };
        }
      }

      const candLog = [
        best1.idx >= 0 ? `"${best1.text}" (dist=${best1.dist.toFixed(2)})` : null,
        best2.idx >= 0 ? `"${best2.text}" (dist=${best2.dist.toFixed(2)})` : null,
      ].filter(Boolean).join(', ');

      if (best1.idx === -1 || best1.dist > maxDist) {
        // No close unclaimed match → try the Pass 1 winner for this field's
        // spatial area, otherwise fall back to metadata bbox
        const fallbackBox = findPass1BoxForField(field, lineBlocks, claimedIndices) ?? field.metadataBBox;
        const fallbackSource = fallbackBox ? (fallbackBox === field.metadataBBox ? 'metadata' : 'pass1-shared') : 'none';
        console.info(
          `[BBox P2] FAIL "${field.fieldName}" val="${field.value}" → ${fallbackSource} bbox | best candidates: ${candLog || 'none'}`,
        );
        if (fallbackBox) {
          results.push({
            fieldName: field.fieldName, leafName: field.leafName, formFieldName,
            value: field.value, pageNumber: field.pageNumber,
            box: fallbackBox,
            matchConfidence: field.confidence ?? undefined,
          });
        }
        continue;
      }

      const metaConf = field.confidence ?? 1;
      const confidence = closeMatchCount === 1
        ? Math.min(metaConf, P2_CONFIDENCE_UNIQUE)
        : Math.min(metaConf, P2_CONFIDENCE_AMBIGUOUS);
      console.info(
        `[BBox P2] OK "${field.fieldName}" val="${field.value}" → "${best1.text}" (dist=${best1.dist.toFixed(2)}, conf=${confidence}, ${useStrict ? 'strict' : 'substr'}) | runner-up: ${best2.idx >= 0 ? `"${best2.text}" (dist=${best2.dist.toFixed(2)})` : 'none'}`,
      );

      // Claim this block so subsequent deferred fields won't reuse it
      claimedIndices.add(best1.idx);
      unclaimedIndices.splice(unclaimedIndices.indexOf(best1.idx), 1);

      results.push({
        fieldName: field.fieldName, leafName: field.leafName, formFieldName,
        value: field.value, pageNumber: field.pageNumber, box: lineBlocks[best1.idx].box,
        matchConfidence: confidence,
      });
    }
  }

  sortBBoxResults(results);

  return results;
}
