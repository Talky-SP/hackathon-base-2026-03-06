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
  value: string;
  pageNumber: number;
  box: BBox;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const BBOX_PADDING = 1;
export const MAX_SPATIAL_DIST = 0.1;

// ─── Functions ──────────────────────────────────────────────────────────────

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
 * Only fields with bounding_box in metadata are processed.
 * Uses spatial proximity to find the precise LINE block coords.
 * Falls back to rounded metadata coords if no close LINE block is found.
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
      value: f.value,
      pageNumber: f.pageNumber,
      box: f.metadataBBox,
    }));
  }

  const available = new Set(lineBlocks.map((_, i) => i));
  const results: MatchedBBox[] = [];

  for (const field of fields) {
    let bestIdx = -1;
    let bestDist = Infinity;

    for (const idx of available) {
      const block = lineBlocks[idx];
      if (block.pageNumber !== field.pageNumber) continue;
      const dist = bboxCenterDist(field.metadataBBox, block.box);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    }

    if (bestIdx >= 0 && bestDist < MAX_SPATIAL_DIST) {
      available.delete(bestIdx);
      results.push({
        fieldName: field.fieldName,
        leafName: field.leafName,
        value: field.value,
        pageNumber: field.pageNumber,
        box: lineBlocks[bestIdx].box,
      });
    } else {
      // Fallback to rounded metadata bbox
      results.push({
        fieldName: field.fieldName,
        leafName: field.leafName,
        value: field.value,
        pageNumber: field.pageNumber,
        box: field.metadataBBox,
      });
    }
  }

  return results;
}
