import type { TextractResult } from '../components/annotation/AnnotationPanel';

// ─── Types ─────────────────────────────────────────────────────────────────

export type BBox = { Left: number; Top: number; Width: number; Height: number };

export interface MetadataField {
  fieldName: string;  // full dot-path
  leafName: string;   // last key segment
  value: string;
  pageNumber: number;
  metadataBBox: BBox;
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
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const BBOX_PADDING = 1;
/** Max center-distance on either axis to accept a Textract LINE as a match */
export const MAX_AXIS_DIST = 0.01;

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

  // If this object itself looks like a field entry (has bounding_box + value)
  const rec = obj as Record<string, unknown>;
  const bb = rec.bounding_box as Record<string, number> | undefined;
  if (bb && typeof bb.Left === 'number' && rec.value !== undefined && rec.value !== null) {
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
      metadataBBox: { Left: bb.Left, Top: bb.Top, Width: bb.Width, Height: bb.Height },
    });
    return; // This is a leaf field entry — don't recurse into value/bbox
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

/** Extract all fields with bounding_box from textract_metadata at any depth */
export function extractFieldsWithBBox(detail: Record<string, unknown> | null | undefined): MetadataField[] {
  if (!detail) return [];
  const meta = detail.textract_metadata as Record<string, unknown> | undefined;
  if (!meta) return [];

  const results: MetadataField[] = [];
  collectBBoxEntries(meta, '', results);
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

/**
 * Match metadata fields to precise Textract LINE block bounding boxes.
 * - Finds the closest LINE block by center distance on the same page.
 * - If the closest block's center differs by more than MAX_AXIS_DIST on
 *   either axis, the match is rejected and the original metadata bbox is used.
 * - If two fields match the same LINE block, a warning is logged but both
 *   get the precise bbox (no "next closest" fallback).
 */
export function matchFieldsToBBoxes(
  detail: Record<string, unknown> | null | undefined,
  textractResult: TextractResult | null | undefined,
): MatchedBBox[] {
  const fields = extractFieldsWithBBox(detail);
  if (fields.length === 0) return [];

  const lineBlocks = extractLineBlocks(textractResult);

  // No raw Textract data → use rounded metadata bboxes as-is
  if (lineBlocks.length === 0) {
    return fields.map((f) => ({
      fieldName: f.fieldName,
      leafName: f.leafName,
      formFieldName: toFormFieldName(f.fieldName, f.leafName),
      value: f.value,
      pageNumber: f.pageNumber,
      box: f.metadataBBox,
    }));
  }

  const usedIndices = new Map<number, string>(); // lineBlock index → first field that claimed it
  const results: MatchedBBox[] = [];

  for (const field of fields) {
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let idx = 0; idx < lineBlocks.length; idx++) {
      const block = lineBlocks[idx];
      if (block.pageNumber !== field.pageNumber) continue;
      const dist = bboxCenterDist(field.metadataBBox, block.box);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    }

    if (bestIdx >= 0) {
      const precise = lineBlocks[bestIdx].box;
      const meta = field.metadataBBox;
      const dxCenter = Math.abs((meta.Left + meta.Width / 2) - (precise.Left + precise.Width / 2));
      const dyCenter = Math.abs((meta.Top + meta.Height / 2) - (precise.Top + precise.Height / 2));

      if (dxCenter > MAX_AXIS_DIST || dyCenter > MAX_AXIS_DIST) {
        console.warn(
          `[BBox] "${field.fieldName}" closest LINE too far (dx=${dxCenter.toFixed(4)}, dy=${dyCenter.toFixed(4)}), using metadata bbox`,
        );
        results.push({
          fieldName: field.fieldName,
          leafName: field.leafName,
          formFieldName: toFormFieldName(field.fieldName, field.leafName),
          value: field.value,
          pageNumber: field.pageNumber,
          box: field.metadataBBox,
        });
      } else {
        const prev = usedIndices.get(bestIdx);
        if (prev) {
          console.warn(
            `[BBox] "${field.fieldName}" matched same LINE block as "${prev}" (idx=${bestIdx})`,
          );
        }
        usedIndices.set(bestIdx, field.fieldName);
        results.push({
          fieldName: field.fieldName,
          leafName: field.leafName,
          formFieldName: toFormFieldName(field.fieldName, field.leafName),
          value: field.value,
          pageNumber: field.pageNumber,
          box: precise,
        });
      }
    } else {
      // No LINE blocks on this page at all
      results.push({
        fieldName: field.fieldName,
        leafName: field.leafName,
        formFieldName: toFormFieldName(field.fieldName, field.leafName),
        value: field.value,
        pageNumber: field.pageNumber,
        box: field.metadataBBox,
      });
    }
  }

  return results;
}
