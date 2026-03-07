import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
  textractResult?: TextractResult | null;
}

const BBOX_PADDING = 1; // px — adjustable padding around each bounding box

function BoundingBoxOverlay({ textractResult, pageNumber }: { textractResult: TextractResult; pageNumber: number }) {
  const page = textractResult.Pages?.find((p) => p.PageNumber === pageNumber);
  if (!page) return null;

  const blocks = page.TextractResponse?.Blocks?.filter(
    (b) => b.BlockType === 'LINE' && b.Geometry?.BoundingBox
  );
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {blocks.map((block, i) => {
        const bb = block.Geometry!.BoundingBox;
        return (
          <div
            key={block.Id || i}
            className="absolute border border-blue-400/60 bg-blue-400/15 rounded"
            style={{
              left: `calc(${bb.Left * 100}% - ${BBOX_PADDING}px)`,
              top: `calc(${bb.Top * 100}% - ${BBOX_PADDING}px)`,
              width: `calc(${bb.Width * 100}% + ${BBOX_PADDING * 2}px)`,
              height: `calc(${bb.Height * 100}% + ${BBOX_PADDING * 2}px)`,
            }}
            title={block.Text}
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
  textractResult,
}: DocumentViewerProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollingToPage = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const [containerWidth, setContainerWidth] = useState(0);

  // PDF-as-images state
  const [pdfImages, setPdfImages] = useState<PdfImages | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  // Intrinsic width (PDF first page at scale=1, or image naturalWidth)
  const intrinsicWidth = useRef(0);

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
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfError(false);
    setPdfImages(null);
    intrinsicWidth.current = 0;

    pdfToImages(file.file)
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
      if (file.type !== 'pdf') intrinsicWidth.current = 0;
      return;
    }
    const img = new Image();
    img.onload = () => {
      intrinsicWidth.current = img.naturalWidth;
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
            const pageWidth = fitMode === 'width' && containerWidth > 0
              ? containerWidth - 48
              : pageIntrinsicW > 0
                ? pageIntrinsicW * zoom
                : undefined;

            return (
              <div
                key={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                  else pageRefs.current.delete(pageNum);
                }}
              >
                <img
                  src={dataUrl}
                  alt={`Page ${pageNum}`}
                  style={{
                    width: pageWidth ? `${pageWidth}px` : undefined,
                    maxWidth: 'none',
                    height: 'auto',
                    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease',
                  }}
                  className="shadow-lg rounded"
                  draggable={false}
                />
                {textractResult && (
                  <BoundingBoxOverlay textractResult={textractResult} pageNumber={pageNum} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Image rendering ───────────────────────────────────────────────────

  const imageStyle: React.CSSProperties = {
    width: imgWidth ? `${imgWidth}px` : undefined,
    maxWidth: 'none',
    height: 'auto',
    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
    transformOrigin: 'center center',
    transition: 'transform 0.15s ease',
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
          position: 'relative',
        }}
      >
        <img
          ref={imgRef}
          src={file.preview}
          alt={file.file.name}
          style={imageStyle}
          className="shadow-lg rounded"
          draggable={false}
        />
        {textractResult && (
          <BoundingBoxOverlay textractResult={textractResult} pageNumber={1} />
        )}
      </div>
    </div>
  );
}
