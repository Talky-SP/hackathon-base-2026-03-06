import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, FileText, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { config } from '../../config/environment';
import { authenticatedFetch } from '../../services/authFetch';
import type { OcrBBox } from '../../data/stockAnnotationsMockData';

interface DeliveryNoteImage {
  key: string;
  page: number | string;
  url: string;
}

export interface DeliveryNoteViewerProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
  /** delivery_note_category_date from stock entry (e.g. "COMPRAS#2025-12-20#uuid") */
  categoryDate: string;
  deliveryNoteNumber: string;
  /** Direct URL to the page image (Camino A — skip API call if provided) */
  pageImageUrl?: string | null;
  ocrBBox?: OcrBBox | null;
  ocrPageNumber?: string | null;
  language: 'es' | 'en';
}

// ─── Image extraction: 5 formats in cascade ────────────────────────────────

interface RawGenImage {
  image_key?: string;
  key?: string;
  page_number?: number | string;
  page?: number | string;
  image_url?: string;
  url?: string;
}

function extractImages(data: Record<string, unknown>): DeliveryNoteImage[] {
  const dn = data.delivery_note as Record<string, unknown> | undefined;

  // 1. data.delivery_note.frontend_images[]
  const fi1 = dn?.frontend_images as RawGenImage[] | undefined;
  if (Array.isArray(fi1) && fi1.length > 0) return mapImages(fi1);

  // 2. data.frontend_images[]
  const fi2 = data.frontend_images as RawGenImage[] | undefined;
  if (Array.isArray(fi2) && fi2.length > 0) return mapImages(fi2);

  // 3. data.generated_images[] (or nested)
  const gi = (dn?.generated_images ?? data.generated_images) as RawGenImage[] | undefined;
  if (Array.isArray(gi) && gi.length > 0) return mapImages(gi);

  // 4. data.delivery_note_url (single string)
  const singleUrl = (dn?.delivery_note_url ?? data.delivery_note_url) as string | undefined;
  if (typeof singleUrl === 'string' && singleUrl.startsWith('http')) {
    return [{ key: 'single', page: 0, url: singleUrl }];
  }

  // 5. Deep scan recursivo — last resort
  const found: DeliveryNoteImage[] = [];
  const visited = new WeakSet();
  const scan = (obj: unknown, depth: number) => {
    if (depth > 5 || !obj || typeof obj !== 'object') return;
    if (visited.has(obj as object)) return;
    visited.add(obj as object);
    const rec = obj as Record<string, unknown>;
    const urlVal = rec.url ?? rec.image_url;
    if (typeof urlVal === 'string' && urlVal.startsWith('http')) {
      found.push({ key: `deep-${found.length}`, page: rec.page ?? rec.page_number ?? found.length, url: urlVal });
    }
    for (const v of Object.values(rec)) {
      if (Array.isArray(v)) v.forEach(item => scan(item, depth + 1));
      else if (v && typeof v === 'object') scan(v, depth + 1);
    }
  };
  scan(data, 0);
  return found;
}

function mapImages(raw: RawGenImage[]): DeliveryNoteImage[] {
  return raw
    .map((img, i) => ({
      key: img.key ?? img.image_key ?? `p-${i}`,
      page: img.page ?? img.page_number ?? i,
      url: (img.url ?? img.image_url ?? '') as string,
    }))
    .filter(img => img.url)
    .sort((a, b) => Number(a.page) - Number(b.page));
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DeliveryNoteViewer({
  isOpen,
  onClose,
  locationId,
  categoryDate,
  deliveryNoteNumber,
  pageImageUrl,
  ocrBBox,
  ocrPageNumber,
  language,
}: DeliveryNoteViewerProps) {
  const [images, setImages] = useState<DeliveryNoteImage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!isOpen) return;

    // ── Camino A: direct pageImageUrl ──
    if (pageImageUrl) {
      setImages([{ key: 'direct', page: ocrPageNumber ?? 0, url: pageImageUrl }]);
      setCurrentPage(0);
      setLoading(false);
      setError(null);
      return;
    }

    // ── Camino B: fetch from delivery-notes API ──
    if (!categoryDate) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setImages([]);
    setCurrentPage(0);
    setZoom(1);

    // Use delivery-notes-api (NOT delivery-note-viewer-api)
    const url = `${config.talkyDeliveryNotesBaseUrl}/delivery-note-by-id/${encodeURIComponent(locationId)}/${encodeURIComponent(categoryDate)}`;

    authenticatedFetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data: Record<string, unknown>) => {
        if (cancelled) return;
        const imgs = extractImages(data);
        if (imgs.length === 0) {
          setError(language === 'es' ? 'No se encontraron imagenes del albaran' : 'No delivery note images found');
        }
        setImages(imgs);

        // Auto-navigate to page with bbox
        if (ocrPageNumber && imgs.length > 1) {
          const targetIdx = imgs.findIndex(img => String(img.page) === String(ocrPageNumber));
          if (targetIdx >= 0) setCurrentPage(targetIdx);
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, locationId, categoryDate, pageImageUrl, ocrPageNumber, language]);

  if (!isOpen) return null;

  const currentImage = images[currentPage];
  const showBBox = ocrBBox && currentImage && (!ocrPageNumber || String(ocrPageNumber) === String(currentImage.page));

  const isDirectImage = !!pageImageUrl;
  const headerLabel = isDirectImage
    ? (pageImageUrl!.includes('delivery_notes')
      ? (language === 'es' ? 'Albaran' : 'Delivery Note')
      : (language === 'es' ? 'Factura' : 'Invoice'))
    : (language === 'es' ? 'Albaran' : 'Delivery Note');

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={onClose} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDirectImage && !pageImageUrl!.includes('delivery_notes') ? 'bg-green-50' : 'bg-blue-50'}`}>
                <FileText size={16} className={isDirectImage && !pageImageUrl!.includes('delivery_notes') ? 'text-green-500' : 'text-blue-500'} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900">
                  {headerLabel} {deliveryNoteNumber}
                </h2>
                <p className="text-[11px] text-gray-400 font-mono truncate max-w-[350px]">{categoryDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Zoom controls */}
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Zoom out">
                <ZoomOut size={14} className="text-gray-400" />
              </button>
              <span className="text-[10px] text-gray-400 tabular-nums w-8 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Zoom in">
                <ZoomIn size={14} className="text-gray-400" />
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-3">
                  <Loader2 size={20} className="text-blue-500 animate-spin" />
                  <span className="text-sm text-gray-500">{language === 'es' ? 'Cargando albaran...' : 'Loading delivery note...'}</span>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <AlertCircle size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-1">{error}</p>
                  <p className="text-xs text-gray-400 font-mono">{categoryDate}</p>
                </div>
              </div>
            )}

            {!loading && !error && images.length > 0 && (
              <>
                {/* Image area */}
                <div className="flex-1 overflow-auto p-4 bg-gray-50 min-h-0">
                  <div className="relative mx-auto" style={{ maxWidth: 700 * zoom, transition: 'max-width 0.2s ease' }}>
                    <img
                      src={currentImage.url}
                      alt={`Page ${currentPage + 1}`}
                      className="w-full rounded-lg shadow-sm border border-gray-200"
                      draggable={false}
                    />
                    {/* Bbox overlay */}
                    {showBBox && ocrBBox && (
                      <div
                        className="absolute pointer-events-none animate-pulse"
                        style={{
                          left: `${parseFloat(ocrBBox.Left) * 100}%`,
                          top: `${parseFloat(ocrBBox.Top) * 100}%`,
                          width: `${parseFloat(ocrBBox.Width) * 100}%`,
                          height: `${parseFloat(ocrBBox.Height) * 100}%`,
                          border: '2.5px solid #ef4444',
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          borderRadius: 3,
                          boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.08)',
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Page controls */}
                {images.length > 1 && (
                  <div className="flex items-center justify-center gap-3 px-4 py-2.5 border-t border-gray-100 shrink-0">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={16} className="text-gray-500" />
                    </button>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {currentPage + 1} / {images.length}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(images.length - 1, p + 1))}
                      disabled={currentPage === images.length - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight size={16} className="text-gray-500" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
