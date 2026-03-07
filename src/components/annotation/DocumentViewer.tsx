import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { pdfToImages, type PdfImages } from '../../utils/pdfToImages';
import { matchFieldsToBBoxes, BBOX_PADDING, type MatchedBBox, type BBox } from '../../utils/bboxMatching';
import { useContainerSize } from '../../hooks/useContainerSize';
import { useMiddleMousePan } from '../../hooks/useMiddleMousePan';
import { usePageTracking } from '../../hooks/usePageTracking';
import { useCtrlWheelZoom } from '../../hooks/useCtrlWheelZoom';
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
  onBBoxClick?: (leafNames: string[]) => void;
}

/**
 * Build the set of formFieldName values the form actually renders.
 * Only bboxes whose formFieldName is in this set should be shown.
 */
function knownFormFieldNames(detail: Record<string, unknown> | null | undefined): Set<string> {
  const names = new Set<string>();
  if (!detail) return names;

  // Static top-level fields (rendered via extractField with leafName as fieldName)
  for (const f of [
    'invoice_number', 'supplier', 'supplier_cif', 'supplier_province',
    'supplier_address', 'invoice_date', 'due_date', 'period', 'concept',
    'category', 'importe', 'total', 'retencion', 'retencion_type',
    'documentKind', 'documentKindConfidence', 'multiInvoiceDetected',
    'needsReview', 'talkyVerified', 'needsReviewReason', 'needsReviewReasons',
  ]) {
    names.add(f);
  }

  // IBANs
  const ibans = detail.ibans as unknown[] | undefined;
  if (Array.isArray(ibans)) {
    ibans.forEach((_, i) => {
      names.add(`ibans[${i}].iban_normalized`);
      names.add(`ibans[${i}].owner`);
      names.add(`ibans[${i}].role`);
    });
  }

  // IVAs — from textract_metadata or direct
  const meta = detail.textract_metadata as Record<string, unknown> | undefined;
  const amounts = meta?.invoice_amounts as Record<string, unknown> | undefined;
  const metaIvas = amounts?.ivas as unknown[] | undefined;
  const directIvas = detail.ivas as unknown[] | undefined;
  const ivaCount = (metaIvas ?? directIvas)?.length ?? 0;
  for (let i = 0; i < ivaCount; i++) {
    names.add(`invoice_amounts.ivas[${i}].base_imponible`);
    names.add(`invoice_amounts.ivas[${i}].type`);
    names.add(`invoice_amounts.ivas[${i}].amount`);
  }

  // Descuentos generales — from textract_metadata or direct
  const metaDesc = amounts?.descuentos_generales as unknown[] | undefined;
  const directDesc = detail.descuentos_generales as unknown[] | undefined;
  const descCount = (metaDesc ?? directDesc)?.length ?? 0;
  for (let i = 0; i < descCount; i++) {
    names.add(`invoice_amounts.descuentos_generales[${i}].discount_name`);
    names.add(`invoice_amounts.descuentos_generales[${i}].discount_amount`);
  }

  // Products
  const products = detail.all_products as unknown[] | undefined;
  if (Array.isArray(products)) {
    products.forEach((_, i) => {
      for (const f of ['product_name', 'quantity', 'unit_price', 'final_price', 'discount', 'category', 'product_id']) {
        names.add(`all_products[${i}].${f}`);
      }
    });
  }

  return names;
}

interface MergedBBox {
  fieldNames: string[];
  leafNames: string[];
  formFieldNames: string[];
  values: string[];
  box: BBox;
}

/** Round to 4 decimal places so near-identical boxes merge */
function bboxKey(b: BBox): string {
  const r = (n: number) => n.toFixed(4);
  return `${r(b.Left)},${r(b.Top)},${r(b.Width)},${r(b.Height)}`;
}

// ─── BoundingBoxOverlay (private) ──────────────────────────────────────────

function BoundingBoxOverlay({ bboxes, pageNumber, highlightedField, onBoxClick }: { bboxes: MatchedBBox[]; pageNumber: number; highlightedField: string | null; onBoxClick?: (leafNames: string[]) => void }) {
  const pageBboxes = bboxes.filter((b) => b.pageNumber === pageNumber);
  if (pageBboxes.length === 0) return null;

  // Deduplicate: merge entries whose boxes overlap at the same position
  const mergedMap = new Map<string, MergedBBox>();
  for (const item of pageBboxes) {
    const key = bboxKey(item.box);
    const existing = mergedMap.get(key);
    if (existing) {
      existing.fieldNames.push(item.fieldName);
      existing.leafNames.push(item.leafName);
      existing.formFieldNames.push(item.formFieldName);
      existing.values.push(item.value);
    } else {
      mergedMap.set(key, {
        fieldNames: [item.fieldName],
        leafNames: [item.leafName],
        formFieldNames: [item.formFieldName],
        values: [item.value],
        box: item.box,
      });
    }
  }
  const merged = Array.from(mergedMap.values());

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      <style>{`
        @keyframes bbox-pulse {
          0%, 100% { box-shadow: 0 0 6px 2px rgba(59,130,246,0.6); background-color: rgba(59,130,246,0.25); }
          50% { box-shadow: 0 0 12px 4px rgba(59,130,246,0.8); background-color: rgba(59,130,246,0.35); }
        }
      `}</style>
      {merged.map((item, i) => {
        const isHighlighted = highlightedField !== null && (
          item.fieldNames.includes(highlightedField) || item.formFieldNames.includes(highlightedField) || item.leafNames.includes(highlightedField)
        );
        const title = item.fieldNames.map((fn, j) => `${fn}: ${item.values[j]}`).join('\n');
        return (
          <div
            key={`merged-${i}`}
            className={`absolute rounded transition-all duration-300 ${
              onBoxClick ? 'pointer-events-auto cursor-pointer hover:bg-blue-400/30' : ''
            } ${
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
            title={title}
            onClick={onBoxClick ? () => onBoxClick(item.formFieldNames) : undefined}
          />
        );
      })}
    </div>
  );
}

// ─── Rotation style helper ─────────────────────────────────────────────────

function computeRotatedStyle(
  rotation: number,
  pageWidth: number | undefined,
): React.CSSProperties {
  const isSwapped = rotation === 90 || rotation === 270;
  return {
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
  };
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
  onBBoxClick,
}: DocumentViewerProps) {
  const { t } = useLanguage();

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollingToPage = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const intrinsicWidth = useRef(0);
  const intrinsicHeight = useRef(0);

  // ─── Extracted hooks ────────────────────────────────────────────────────

  const containerWidth = useContainerSize(containerRef);
  useMiddleMousePan(containerRef);

  // PDF-as-images state
  const [pdfImages, setPdfImages] = useState<PdfImages | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const numPages = pdfImages?.pages.length ?? 0;

  usePageTracking({
    containerRef, pageRefs, scrollingToPage,
    numPages, currentPage, onCurrentPageChange,
  });

  useCtrlWheelZoom({
    containerRef, scrollingToPage,
    zoom, fitMode, intrinsicWidth, onZoomChange,
  });

  // ─── Matched bounding boxes ─────────────────────────────────────────────

  const matchedBBoxes = useMemo(() => {
    const all = matchFieldsToBBoxes(invoiceDetail, textractResult);
    const known = knownFormFieldNames(invoiceDetail);
    return all.filter((b) => known.has(b.formFieldName));
  }, [invoiceDetail, textractResult]);

  // ─── Field highlight: scroll + animate ──────────────────────────────────

  const [highlightedField, setHighlightedField] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFieldName) {
      setHighlightedField(null);
      return;
    }

    const bbox = matchedBBoxes.find((b) => b.fieldName === activeFieldName)
      ?? matchedBBoxes.find((b) => b.formFieldName === activeFieldName)
      ?? matchedBBoxes.find((b) => b.leafName === activeFieldName);
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

    const targetY = pageEl.offsetTop + bbox.box.Top * pageEl.clientHeight;
    const targetX = pageEl.offsetLeft + bbox.box.Left * pageEl.clientWidth;
    scrollingToPage.current = true;
    container.scrollTo({
      top: targetY - container.clientHeight / 3,
      left: Math.max(0, targetX - container.clientWidth / 2),
      behavior: 'smooth',
    });
    setTimeout(() => { scrollingToPage.current = false; }, 600);

    setHighlightedField(activeFieldName);
    const timer = setTimeout(() => {
      setHighlightedField(null);
      onActiveFieldClear?.();
    }, 1800);
    return () => clearTimeout(timer);
  }, [activeFieldName]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── Compute image width ──────────────────────────────────────────────

  const imgWidth = fitMode === 'width' && containerWidth > 0
    ? containerWidth - 48
    : intrinsicWidth.current > 0
      ? intrinsicWidth.current * zoom
      : undefined;

  // ─── PDF rendering ────────────────────────────────────────────────────

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
      <div ref={containerRef} className="h-full overflow-auto bg-gray-100">
        <div style={{
          display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
          gap: '1rem', padding: '1.5rem', minWidth: '100%', minHeight: '100%',
        }}>
          {pdfImages.pages.map((dataUrl, i) => {
            const pageNum = i + 1;
            const pageIntrinsicW = pdfImages.widths[i];
            const pageIntrinsicH = pdfImages.heights[i];
            const pageWidth = fitMode === 'width' && containerWidth > 0
              ? containerWidth - 48
              : pageIntrinsicW > 0 ? pageIntrinsicW * zoom : undefined;
            const pageHeight = pageWidth && pageIntrinsicW > 0
              ? pageWidth * (pageIntrinsicH / pageIntrinsicW) : undefined;

            const isSwapped = rotation === 90 || rotation === 270;
            const wrapperW = isSwapped && pageWidth && pageHeight ? pageHeight : pageWidth;
            const wrapperH = isSwapped && pageWidth && pageHeight ? pageWidth : pageHeight;

            return (
              <div
                key={pageNum}
                ref={(el) => { if (el) pageRefs.current.set(pageNum, el); else pageRefs.current.delete(pageNum); }}
                style={{
                  position: 'relative', display: 'inline-block',
                  width: wrapperW ? `${wrapperW}px` : undefined,
                  height: wrapperH ? `${wrapperH}px` : undefined,
                }}
              >
                <img
                  src={dataUrl}
                  alt={`Page ${pageNum}`}
                  style={computeRotatedStyle(rotation, pageWidth)}
                  className="shadow-lg rounded"
                  draggable={false}
                />
                {matchedBBoxes.length > 0 && (
                  <BoundingBoxOverlay bboxes={matchedBBoxes} pageNumber={pageNum} highlightedField={highlightedField} onBoxClick={onBBoxClick} />
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
    ? imgWidth * (intrinsicHeight.current / intrinsicWidth.current) : undefined;

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-gray-100">
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem', minWidth: '100%', minHeight: '100%',
      }}>
        <div style={{
          position: 'relative', display: 'inline-block',
          ...(isSwappedSingle && singleImgH ? {
            width: `${singleImgH}px`, height: `${imgWidth}px`,
          } : {}),
        }}>
          <img
            ref={imgRef}
            src={file.preview}
            alt={file.file.name}
            style={computeRotatedStyle(rotation, imgWidth)}
            className="shadow-lg rounded"
            draggable={false}
          />
          {matchedBBoxes.length > 0 && (
            <BoundingBoxOverlay bboxes={matchedBBoxes} pageNumber={1} highlightedField={highlightedField} onBoxClick={onBBoxClick} />
          )}
        </div>
      </div>
    </div>
  );
}
