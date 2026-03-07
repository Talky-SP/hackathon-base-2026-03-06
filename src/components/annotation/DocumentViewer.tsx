import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { pdfToImages, type PdfImages } from '../../utils/pdfToImages';
import type { UploadedFile } from './FileUploadZone';
import type { TextractResult } from './AnnotationPanel';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DocumentViewerProps {
  file: UploadedFile;
  zoom: number;
  rotation: number;
  fitMode: 'none' | 'width';
  currentPage: number;
  onTotalPagesChange: (total: number) => void;
  onZoomChange: (zoom: number) => void;
  onDisplayZoomChange: (zoom: number) => void;
  onCurrentPageChange: (page: number) => void;
  invoiceDetail?: Record<string, unknown> | null;
  textractResult?: TextractResult | null;
  activeFieldName?: string | null;
  onActiveFieldClear?: () => void;
}

const BBOX_PADDING = 1;

// ─── Bounding box matching system ───────────────────────────────────────────

type BBox = { Left: number; Top: number; Width: number; Height: number };

interface MetadataField {
  fieldName: string;  // full dot-path
  leafName: string;   // last key segment
  value: string;
  pageNumber: number;
  metadataBBox: BBox;
}

interface LineBlock {
  text: string;
  pageNumber: number;
  box: BBox;
}

interface MatchedBBox {
  fieldName: string;  // full dot-path (e.g. "invoice_details.invoice_number")
  leafName: string;   // last key segment (e.g. "invoice_number") — used for form linking
  value: string;
  pageNumber: number;
  box: BBox;
}

/**
 * Recursively walk any object tree looking for entries that have
 * `bounding_box` + `value` (the textract_metadata field pattern).
 * Handles: top-level fields, arrays (ivas[]), nested sub-fields, any depth.
 */
function collectBBoxEntries(
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
function extractFieldsWithBBox(detail: Record<string, unknown> | null | undefined): MetadataField[] {
  if (!detail) return [];
  const meta = detail.textract_metadata as Record<string, unknown> | undefined;
  if (!meta) return [];

  const results: MetadataField[] = [];
  collectBBoxEntries(meta, '', results);
  return results;
}

/** Extract LINE blocks from raw Textract result */
function extractLineBlocks(textractResult: TextractResult | null | undefined): LineBlock[] {
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
function bboxCenterDist(a: BBox, b: BBox): number {
  const acx = a.Left + a.Width / 2;
  const acy = a.Top + a.Height / 2;
  const bcx = b.Left + b.Width / 2;
  const bcy = b.Top + b.Height / 2;
  return Math.hypot(acx - bcx, acy - bcy);
}

const MAX_SPATIAL_DIST = 0.1;

/**
 * Match metadata fields to precise Textract LINE block bounding boxes.
 * Only fields with bounding_box in metadata are processed.
 * Uses spatial proximity to find the precise LINE block coords.
 * Falls back to rounded metadata coords if no close LINE block is found.
 */
function matchFieldsToBBoxes(
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

function BoundingBoxOverlay({ bboxes, pageNumber, highlightedField }: { bboxes: MatchedBBox[]; pageNumber: number; highlightedField: string | null }) {
  const pageBboxes = bboxes.filter((b) => b.pageNumber === pageNumber);
  if (pageBboxes.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      <style>{`
        @keyframes bbox-pulse {
          0%, 100% { box-shadow: 0 0 6px 2px rgba(59,130,246,0.6); background-color: rgba(59,130,246,0.25); }
          50% { box-shadow: 0 0 12px 4px rgba(59,130,246,0.8); background-color: rgba(59,130,246,0.35); }
        }
      `}</style>
      {pageBboxes.map((item, i) => {
        const isHighlighted = highlightedField !== null && (item.leafName === highlightedField || item.fieldName === highlightedField);
        return (
          <div
            key={`${item.fieldName}-${i}`}
            className={`absolute rounded transition-all duration-300 ${
              isHighlighted
                ? 'border-2 border-blue-500 z-20'
                : 'border border-blue-400/60 bg-blue-400/15'
            }`}
            style={{
              left: `calc(${item.box.Left * 100}% - ${BBOX_PADDING}px)`,
              top: `calc(${item.box.Top * 100}% - ${BBOX_PADDING}px)`,
              width: `calc(${item.box.Width * 100}% + ${BBOX_PADDING * 2}px)`,
              height: `calc(${item.box.Height * 100}% + ${BBOX_PADDING * 2}px)`,
              ...(isHighlighted ? { animation: 'bbox-pulse 0.6s ease-in-out 3' } : {}),
            }}
            title={`${item.fieldName}: ${item.value}`}
          />
        );
      })}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function DocumentViewer({
  file,
  zoom,
  rotation,
  fitMode,
  currentPage,
  onTotalPagesChange,
  onZoomChange,
  onDisplayZoomChange,
  onCurrentPageChange,
  invoiceDetail,
  textractResult,
  activeFieldName,
  onActiveFieldClear,
}: DocumentViewerProps) {
  const { t } = useLanguage();

  // Compute matched bounding boxes (precise Textract coords when available)
  const matchedBBoxes = useMemo(
    () => matchFieldsToBBoxes(invoiceDetail, textractResult),
    [invoiceDetail, textractResult],
  );

  // ─── Field highlight: scroll + animate ──────────────────────────────
  const [highlightedField, setHighlightedField] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFieldName) {
      setHighlightedField(null);
      return;
    }

    const bbox = matchedBBoxes.find((b) => b.leafName === activeFieldName || b.fieldName === activeFieldName);
    if (!bbox) {
      onActiveFieldClear?.();
      return;
    }

    const container = containerRef.current;
    const pageEl = pageRefs.current.get(bbox.pageNumber);
    if (!container || !pageEl) {
      onActiveFieldClear?.();
      return;
    }

    // Calculate target scroll position to center the bbox
    const targetY = pageEl.offsetTop + bbox.box.Top * pageEl.clientHeight;
    const targetX = pageEl.offsetLeft + bbox.box.Left * pageEl.clientWidth;
    scrollingToPage.current = true;
    container.scrollTo({
      top: targetY - container.clientHeight / 3,
      left: Math.max(0, targetX - container.clientWidth / 2),
      behavior: 'smooth',
    });
    setTimeout(() => { scrollingToPage.current = false; }, 600);

    // Trigger highlight animation
    setHighlightedField(activeFieldName);
    const timer = setTimeout(() => {
      setHighlightedField(null);
      onActiveFieldClear?.();
    }, 1800);
    return () => clearTimeout(timer);
  }, [activeFieldName]); // eslint-disable-line react-hooks/exhaustive-deps
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollingToPage = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const [containerWidth, setContainerWidth] = useState(0);

  // PDF-as-images state
  const [pdfImages, setPdfImages] = useState<PdfImages | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  // Intrinsic dimensions (PDF first page at scale=1, or image natural dimensions)
  const intrinsicWidth = useRef(0);
  const intrinsicHeight = useRef(0);

  // ─── Measure container ──────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });

    observer.observe(el);
    setContainerWidth(el.clientWidth);

    return () => observer.disconnect();
  }, []);

  // ─── Compute & report display zoom ──────────────────────────────────────

  const computeDisplayZoom = useCallback(() => {
    if (fitMode === 'none') return zoom;
    if (intrinsicWidth.current > 0 && containerWidth > 0) {
      return (containerWidth - 48) / intrinsicWidth.current;
    }
    return zoom;
  }, [fitMode, zoom, containerWidth]);

  const displayZoom = computeDisplayZoom();

  const prevDisplayZoom = useRef(displayZoom);
  useEffect(() => {
    if (displayZoom !== prevDisplayZoom.current) {
      prevDisplayZoom.current = displayZoom;
      onDisplayZoomChange(displayZoom);
    }
  }, [displayZoom, onDisplayZoomChange]);

  // ─── Convert PDF to images on file change ─────────────────────────────

  useEffect(() => {
    if (file.type !== 'pdf') {
      setPdfImages(null);
      setPdfLoading(false);
      setPdfError(false);
      intrinsicWidth.current = 0;
      intrinsicHeight.current = 0;
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfError(false);
    setPdfImages(null);
    intrinsicWidth.current = 0;
    intrinsicHeight.current = 0;

    // If the file has a URL (fetched from API), download it first
    const getFile = file.url
      ? fetch(file.url).then((r) => r.blob()).then((b) => new File([b], file.file.name, { type: 'application/pdf' }))
      : Promise.resolve(file.file);

    getFile.then((f) => pdfToImages(f))
      .then((result) => {
        if (cancelled) return;
        setPdfImages(result);
        setPdfLoading(false);
        onTotalPagesChange(result.pages.length);
        if (result.widths.length > 0) {
          intrinsicWidth.current = result.widths[0];
          onDisplayZoomChange(computeDisplayZoom());
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPdfError(true);
        setPdfLoading(false);
      });

    return () => { cancelled = true; };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Track intrinsic width for images ──────────────────────────────────

  useEffect(() => {
    if (file.type !== 'image' || !file.preview) {
      if (file.type !== 'pdf') {
        intrinsicWidth.current = 0;
        intrinsicHeight.current = 0;
      }
      return;
    }
    const img = new Image();
    img.onload = () => {
      intrinsicWidth.current = img.naturalWidth;
      intrinsicHeight.current = img.naturalHeight;
      onDisplayZoomChange(computeDisplayZoom());
    };
    img.src = file.preview;
  }, [file, computeDisplayZoom, onDisplayZoomChange]);

  // ─── Track current page from scroll position ────────────────────────────

  const numPages = pdfImages?.pages.length ?? 0;
  // Flag: true when the page change came from user scrolling (not toolbar)
  const pageChangeFromScroll = useRef(false);

  const handleScroll = useCallback(() => {
    if (scrollingToPage.current || numPages === 0) return;
    const container = containerRef.current;
    if (!container) return;

    const containerTop = container.scrollTop + container.clientHeight / 3;
    let closestPage = 1;
    let closestDist = Infinity;

    pageRefs.current.forEach((el, pageNum) => {
      const dist = Math.abs(el.offsetTop - containerTop);
      if (dist < closestDist) {
        closestDist = dist;
        closestPage = pageNum;
      }
    });

    if (closestPage !== currentPage) {
      pageChangeFromScroll.current = true;
      onCurrentPageChange(closestPage);
    }
  }, [numPages, currentPage, onCurrentPageChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // ─── Scroll to page when currentPage changes from toolbar ───────────────

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (!el) return;
    scrollingToPage.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      scrollingToPage.current = false;
    }, 600);
  }, []);

  const prevPageRef = useRef(currentPage);
  useEffect(() => {
    if (currentPage !== prevPageRef.current && numPages > 0) {
      // Only scroll to page if the change came from the toolbar, not from
      // the user scrolling (scrollbar drag, trackpad, wheel, etc.)
      if (pageChangeFromScroll.current) {
        pageChangeFromScroll.current = false;
      } else {
        scrollToPage(currentPage);
      }
    }
    prevPageRef.current = currentPage;
  }, [currentPage, numPages, scrollToPage]);

  // ─── Ctrl+Scroll zoom (stable handler via refs) ────────────────────────

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // Synchronously-updated ref so rapid wheel events accumulate correctly
  const liveZoomRef = useRef(zoom);
  useEffect(() => { liveZoomRef.current = zoom; }, [zoom]);

  const fitModeRef = useRef(fitMode);
  fitModeRef.current = fitMode;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  // Pending scroll correction: stored by wheel handler, applied in useLayoutEffect
  const pendingScroll = useRef<{
    img: Element; fracX: number; fracY: number; clientX: number; clientY: number;
  } | null>(null);

  // Apply scroll correction synchronously after React commits DOM (before paint).
  // Only runs when zoom changes (which is when pendingScroll is set).
  useLayoutEffect(() => {
    const p = pendingScroll.current;
    if (!p) return;
    pendingScroll.current = null;
    const el = containerRef.current;
    if (!el) return;

    // Suppress page-tracking while we adjust scroll programmatically,
    // otherwise handleScroll fires → onCurrentPageChange → scrollToPage fight.
    scrollingToPage.current = true;

    const newImgRect = p.img.getBoundingClientRect();
    // Where the target point currently is in viewport coords
    const pointViewX = newImgRect.left + p.fracX * newImgRect.width;
    const pointViewY = newImgRect.top + p.fracY * newImgRect.height;
    // Shift scroll so target point is back under the cursor
    el.scrollLeft += pointViewX - p.clientX;
    el.scrollTop += pointViewY - p.clientY;

    // Clear the flag after the scroll event has fired and been ignored
    requestAnimationFrame(() => { scrollingToPage.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      let base: number;
      if (fitModeRef.current === 'width' && intrinsicWidth.current > 0) {
        const cw = el.clientWidth;
        base = (cw - 48) / intrinsicWidth.current;
      } else {
        base = liveZoomRef.current;
      }
      const newZoom = Math.min(4, Math.max(0.25, base + delta));
      // Update synchronously so next wheel event (before React re-render) sees it
      liveZoomRef.current = newZoom;

      // Find the image closest to the cursor
      const imgs = Array.from(el.querySelectorAll('img'));
      let bestImg: Element | undefined;
      let minDist = Infinity;
      for (const img of imgs) {
        const r = img.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (d < minDist) { minDist = d; bestImg = img; }
      }

      // Record cursor position as fraction of image dimensions
      if (bestImg) {
        const imgRect = bestImg.getBoundingClientRect();
        pendingScroll.current = {
          img: bestImg,
          fracX: (e.clientX - imgRect.left) / imgRect.width,
          fracY: (e.clientY - imgRect.top) / imgRect.height,
          clientX: e.clientX,
          clientY: e.clientY,
        };
      }

      onZoomChangeRef.current(newZoom);
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // ─── Middle-mouse-button panning ──────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let panning = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return; // middle button only
      e.preventDefault();
      panning = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = el.scrollLeft;
      startScrollTop = el.scrollTop;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!panning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.scrollLeft = startScrollLeft - dx;
      el.scrollTop = startScrollTop - dy;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!panning) return;
      if (e.button !== 1) return;
      panning = false;
      el.style.cursor = '';
      el.style.userSelect = '';
    };

    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ─── Compute image width ──────────────────────────────────────────────

  const imgWidth = fitMode === 'width' && containerWidth > 0
    ? containerWidth - 48
    : intrinsicWidth.current > 0
      ? intrinsicWidth.current * zoom
      : undefined;

  // ─── PDF rendering (as images) ─────────────────────────────────────────

  if (file.type === 'pdf') {
    if (pdfLoading) {
      return (
        <div ref={containerRef} className="h-full overflow-auto bg-gray-100 flex items-center justify-center">
          <Loader2 size={32} className="text-brand-500 animate-spin" />
          <span className="ml-3 text-sm text-gray-500">{t('viewer.loading')}</span>
        </div>
      );
    }

    if (pdfError || !pdfImages) {
      return (
        <div ref={containerRef} className="h-full overflow-auto bg-gray-100 flex flex-col items-center justify-center text-gray-500">
          <AlertCircle size={32} className="mb-2 text-red-400" />
          <span className="text-sm">{t('viewer.error')}</span>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="h-full overflow-auto bg-gray-100"
      >
        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.5rem',
            minWidth: '100%',
            minHeight: '100%',
          }}
        >
          {pdfImages.pages.map((dataUrl, i) => {
            const pageNum = i + 1;
            const pageIntrinsicW = pdfImages.widths[i];
            const pageIntrinsicH = pdfImages.heights[i];
            const pageWidth = fitMode === 'width' && containerWidth > 0
              ? containerWidth - 48
              : pageIntrinsicW > 0
                ? pageIntrinsicW * zoom
                : undefined;
            const pageHeight = pageWidth && pageIntrinsicW > 0
              ? pageWidth * (pageIntrinsicH / pageIntrinsicW)
              : undefined;

            const isSwapped = rotation === 90 || rotation === 270;
            const wrapperW = isSwapped && pageWidth && pageHeight ? pageHeight : pageWidth;
            const wrapperH = isSwapped && pageWidth && pageHeight ? pageWidth : pageHeight;

            return (
              <div
                key={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                  else pageRefs.current.delete(pageNum);
                }}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: wrapperW ? `${wrapperW}px` : undefined,
                  height: wrapperH ? `${wrapperH}px` : undefined,
                }}
              >
                <img
                  src={dataUrl}
                  alt={`Page ${pageNum}`}
                  style={{
                    display: 'block',
                    width: pageWidth ? `${pageWidth}px` : undefined,
                    maxWidth: 'none',
                    height: 'auto',
                    ...(isSwapped ? {
                      position: 'absolute' as const,
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                      transformOrigin: 'center center',
                    } : {
                      transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
                      transformOrigin: 'center center',
                    }),
                  }}
                  className="shadow-lg rounded"
                  draggable={false}
                />
                {matchedBBoxes.length > 0 && (
                  <BoundingBoxOverlay bboxes={matchedBBoxes} pageNumber={pageNum} highlightedField={highlightedField} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Image rendering ───────────────────────────────────────────────────

  const isSwappedSingle = rotation === 90 || rotation === 270;
  const singleImgH = imgWidth && intrinsicWidth.current > 0 && intrinsicHeight.current > 0
    ? imgWidth * (intrinsicHeight.current / intrinsicWidth.current)
    : undefined;

  const imageStyle: React.CSSProperties = {
    width: imgWidth ? `${imgWidth}px` : undefined,
    maxWidth: 'none',
    height: 'auto',
    ...(isSwappedSingle ? {
      position: 'absolute' as const,
      left: '50%',
      top: '50%',
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      transformOrigin: 'center center',
    } : {
      transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
      transformOrigin: 'center center',
    }),
  };

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto bg-gray-100"
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          minWidth: '100%',
          minHeight: '100%',
        }}
      >
        <div style={{
          position: 'relative',
          display: 'inline-block',
          ...(isSwappedSingle && singleImgH ? {
            width: `${singleImgH}px`,
            height: `${imgWidth}px`,
          } : {}),
        }}>
          <img
            ref={imgRef}
            src={file.preview}
            alt={file.file.name}
            style={{ ...imageStyle, display: 'block' }}
            className="shadow-lg rounded"
            draggable={false}
          />
          {matchedBBoxes.length > 0 && (
            <BoundingBoxOverlay bboxes={matchedBBoxes} pageNumber={1} highlightedField={highlightedField} />
          )}
        </div>
      </div>
    </div>
  );
}
