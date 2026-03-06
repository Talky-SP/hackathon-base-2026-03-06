import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { UploadedFile } from './FileUploadZone';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Types ─────────────────────────────────────────────────────────────────

interface DocumentViewerProps {
  file: UploadedFile;
  zoom: number;
  rotation: number;
  fitMode: 'none' | 'width' | 'page';
  currentPage: number;
  onTotalPagesChange: (total: number) => void;
  onZoomChange: (zoom: number) => void;
  onCurrentPageChange: (page: number) => void;
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
  onCurrentPageChange,
}: DocumentViewerProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const scrollingToPage = useRef(false);

  // ─── Measure container ─────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ─── Create blob URL for PDFs ──────────────────────────────────────────

  useEffect(() => {
    if (file.type !== 'pdf') {
      setPdfUrl(null);
      return;
    }
    const url = URL.createObjectURL(file.file);
    setPdfUrl(url);
    setPdfError(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // ─── Track current page from scroll position ────────────────────────────

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

  // Track the previous page to detect toolbar-driven changes
  const prevPageRef = useRef(currentPage);
  useEffect(() => {
    if (currentPage !== prevPageRef.current && numPages > 0) {
      scrollToPage(currentPage);
    }
    prevPageRef.current = currentPage;
  }, [currentPage, numPages, scrollToPage]);

  // ─── Ctrl+Scroll zoom ─────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.min(4, Math.max(0.25, zoom + delta));
        onZoomChange(newZoom);
      }
    },
    [zoom, onZoomChange]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ─── Compute effective scale for fit modes ─────────────────────────────

  const effectiveZoom = fitMode === 'none' ? zoom : 1;

  // ─── PDF rendering (continuous scroll) ─────────────────────────────────

  if (file.type === 'pdf') {
    const pdfWidth =
      fitMode === 'width'
        ? containerWidth - 48
        : fitMode === 'page'
          ? Math.min(containerWidth - 48, containerHeight - 48)
          : undefined;

    return (
      <div
        ref={containerRef}
        className="h-full overflow-auto bg-gray-100"
      >
        {pdfUrl && !pdfError ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              onTotalPagesChange(n);
            }}
            onLoadError={() => setPdfError(true)}
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 size={32} className="text-brand-500 animate-spin" />
                <span className="ml-3 text-sm text-gray-500">{t('viewer.loading')}</span>
              </div>
            }
          >
            <div className="flex flex-col items-center gap-4 p-6">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  ref={(el) => {
                    if (el) pageRefs.current.set(pageNum, el);
                    else pageRefs.current.delete(pageNum);
                  }}
                >
                  <Page
                    pageNumber={pageNum}
                    scale={fitMode === 'none' ? effectiveZoom : undefined}
                    width={pdfWidth}
                    rotate={rotation}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </div>
              ))}
            </div>
          </Document>
        ) : pdfError ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <AlertCircle size={32} className="mb-2 text-red-400" />
            <span className="text-sm">{t('viewer.error')}</span>
          </div>
        ) : null}
      </div>
    );
  }

  // ─── Image rendering ───────────────────────────────────────────────────

  const imageStyle: React.CSSProperties = {
    transform: `scale(${effectiveZoom}) rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    maxWidth: fitMode === 'width' ? '100%' : fitMode === 'page' ? '100%' : 'none',
    maxHeight: fitMode === 'page' ? '100%' : 'none',
    transition: 'transform 0.15s ease',
  };

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto bg-gray-100 flex items-center justify-center p-6"
    >
      <img
        src={file.preview}
        alt={file.file.name}
        style={imageStyle}
        className="shadow-lg rounded"
        draggable={false}
      />
    </div>
  );
}
