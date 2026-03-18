import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, CheckCircle2, XCircle, Loader2,
  AlertCircle, X, ChevronLeft, ChevronRight,
  Hash, Building2, Package, AlertTriangle, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { getStockErrorLabel } from './StockTestPage';
import {
  getStockTestRun, getStockTestRunDocument,
  type StockTestRun, type StockTestRunDoc,
  type StockTestDocDetail, type StockProductResult,
} from '../services/stockTestingApi';
import { config } from '../config/environment';
import { authenticatedFetch } from '../services/authFetch';

// ─── Types ───────────────────────────────────────────────────────────────

type DocVerdict = 'PASS' | 'FAIL' | 'TIMEOUT' | 'PIPELINE_ERROR' | 'COPY_FAILED';
type ResultFilter = 'all' | 'passed' | 'failed';

// ─── Verdict config ──────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<DocVerdict, {
  icon: typeof CheckCircle2;
  color: string;
  dotClass: string;
  labelEs: string;
  labelEn: string;
}> = {
  PASS: { icon: CheckCircle2, color: 'text-green-500', dotClass: 'bg-green-500', labelEs: 'OK', labelEn: 'Pass' },
  FAIL: { icon: XCircle, color: 'text-red-500', dotClass: 'bg-red-500', labelEs: 'Error', labelEn: 'Fail' },
  TIMEOUT: { icon: AlertCircle, color: 'text-orange-500', dotClass: 'bg-orange-500', labelEs: 'Timeout', labelEn: 'Timeout' },
  PIPELINE_ERROR: { icon: AlertCircle, color: 'text-red-500', dotClass: 'bg-red-500', labelEs: 'Error pipeline', labelEn: 'Pipeline error' },
  COPY_FAILED: { icon: AlertCircle, color: 'text-orange-500', dotClass: 'bg-orange-500', labelEs: 'Copia fallida', labelEn: 'Copy failed' },
};

const ERROR_SEVERITY: Record<string, { color: string; bg: string }> = {
  DUPLICATE_INGREDIENT: { color: 'text-red-600', bg: 'bg-red-50' },
  PACK_TYPE_MISMATCH: { color: 'text-red-600', bg: 'bg-red-50' },
  UNITS_PER_PACK_WRONG: { color: 'text-red-600', bg: 'bg-red-50' },
  STOCK_QUANTITY_MISMATCH: { color: 'text-red-600', bg: 'bg-red-50' },
  PRICE_OUTLIER: { color: 'text-yellow-700', bg: 'bg-yellow-50' },
  UOM_MISMATCH: { color: 'text-yellow-700', bg: 'bg-yellow-50' },
  DUPLICATE_STOCK_ENTRY: { color: 'text-red-600', bg: 'bg-red-50' },
  MISSING_STOCK_ENTRY: { color: 'text-red-600', bg: 'bg-red-50' },
  PRODUCT_ID_LOST: { color: 'text-gray-600', bg: 'bg-gray-50' },
  PRODUCT_ID_COLLISION: { color: 'text-yellow-700', bg: 'bg-yellow-50' },
};

function getErrorStyle(type: string) {
  return ERROR_SEVERITY[type] ?? { color: 'text-gray-600', bg: 'bg-gray-50' };
}

// ─── Hooks ───────────────────────────────────────────────────────────────

function useStockTestRunDetail(testRunId: string | undefined) {
  const [run, setRun] = useState<StockTestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!testRunId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getStockTestRun(testRunId);
      setRun(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch test run');
    } finally {
      setLoading(false);
    }
  }, [testRunId]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { run, loading, error, refetch: fetch_ };
}

// ─── Textract types ───────────────────────────────────────────────────────

interface BBox { Height: number; Left: number; Top: number; Width: number }

interface TextractField {
  bounding_box: BBox | null;
  value: unknown;
  confidence: number | null;
  page_number?: number | null;
}

interface TextractProduct {
  product_name: TextractField;
  product_id: TextractField;
  quantity: TextractField;
  unit_price: TextractField;
  final_price: TextractField;
  delivery_note: TextractField;
  delivery_note_date: TextractField;
  [key: string]: TextractField;
}

interface TextractMetadata {
  products: TextractProduct[];
  invoice_details: Record<string, TextractField>;
  client_details: Record<string, TextractField>;
  invoice_amounts: Record<string, TextractField>;
}

interface DNFetchResult {
  images: string[];
  textract: TextractMetadata | null;
}

// ─── Image extraction (5-format cascade, same as DeliveryNoteViewer) ──────

interface RawGenImage {
  image_key?: string;
  key?: string;
  page_number?: number | string;
  page?: number | string;
  image_url?: string;
  url?: string;
}

function mapImages(raw: RawGenImage[]): string[] {
  return raw
    .map(img => (img.url ?? img.image_url ?? '') as string)
    .filter(url => !!url);
}

function extractImagesFromDN(data: Record<string, unknown>): string[] {
  const dn = data.delivery_note as Record<string, unknown> | undefined;

  const fi1 = dn?.frontend_images as RawGenImage[] | undefined;
  if (Array.isArray(fi1) && fi1.length > 0) return mapImages(fi1);

  const fi2 = data.frontend_images as RawGenImage[] | undefined;
  if (Array.isArray(fi2) && fi2.length > 0) return mapImages(fi2);

  const gi = (dn?.generated_images ?? data.generated_images) as RawGenImage[] | undefined;
  if (Array.isArray(gi) && gi.length > 0) return mapImages(gi);

  const singleUrl = (dn?.delivery_note_url ?? data.delivery_note_url) as string | undefined;
  if (typeof singleUrl === 'string' && singleUrl.startsWith('http')) return [singleUrl];

  const found: string[] = [];
  const visited = new WeakSet();
  const scan = (obj: unknown, depth: number) => {
    if (depth > 5 || !obj || typeof obj !== 'object') return;
    if (visited.has(obj as object)) return;
    visited.add(obj as object);
    const rec = obj as Record<string, unknown>;
    const urlVal = rec.url ?? rec.image_url;
    if (typeof urlVal === 'string' && urlVal.startsWith('http')) found.push(urlVal);
    for (const v of Object.values(rec)) {
      if (Array.isArray(v)) v.forEach(item => scan(item, depth + 1));
      else if (v && typeof v === 'object') scan(v, depth + 1);
    }
  };
  scan(data, 0);
  return found;
}

function proxyS3Url(url: string): string {
  return url
    .replace('https://talky-invoice-v2-dev-6136.s3.amazonaws.com', '/s3-dev')
    .replace('https://talky-invoice-v2-prod-6136.s3.amazonaws.com', '/s3-prod');
}

function extractTextract(data: Record<string, unknown>): TextractMetadata | null {
  const dn = data.delivery_note as Record<string, unknown> | undefined;
  const tm = dn?.textract_metadata as TextractMetadata | undefined;
  if (!tm || !Array.isArray(tm.products)) return null;
  return tm;
}

async function fetchDNData(locationId: string, categoryDate: string): Promise<DNFetchResult> {
  try {
    const url = `${config.talkyDeliveryNotesBaseUrl}/delivery-note-by-id/${encodeURIComponent(locationId)}/${encodeURIComponent(categoryDate)}`;
    const res = await authenticatedFetch(url);
    if (!res.ok) return { images: [], textract: null };
    const data = await res.json();
    return {
      images: extractImagesFromDN(data).map(proxyS3Url),
      textract: extractTextract(data),
    };
  } catch {
    return { images: [], textract: null };
  }
}

// ─── Fuzzy product matching ───────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fuzzyMatch(testName: string, ocrName: string): boolean {
  const a = normalize(testName);
  const b = normalize(ocrName);
  if (a === b) return true;
  if (b.includes(a) || a.includes(b)) return true;
  // word overlap: at least 60% of test words present in OCR
  const wordsA = a.split(' ').filter(w => w.length > 1);
  const wordsB = new Set(b.split(' ').filter(w => w.length > 1));
  if (wordsA.length === 0) return false;
  const matched = wordsA.filter(w => wordsB.has(w) || [...wordsB].some(wb => wb.includes(w) || w.includes(wb)));
  return matched.length / wordsA.length >= 0.6;
}

function findTextractProduct(testProduct: StockProductResult, textract: TextractMetadata | null): TextractProduct | null {
  if (!textract) return null;
  const name = testProduct.expectedProductName || testProduct.actualProductName || '';
  if (!name) return null;
  // Try matching by product name
  for (const tp of textract.products) {
    const ocrName = String(tp.product_name?.value ?? '');
    if (ocrName && fuzzyMatch(name, ocrName)) return tp;
  }
  // Try matching by product ID
  const pid = testProduct.expectedProductId;
  if (pid) {
    for (const tp of textract.products) {
      const ocrPid = String(tp.product_id?.value ?? '');
      if (ocrPid && ocrPid === pid) return tp;
    }
  }
  return null;
}

// ─── Document Drawer ─────────────────────────────────────────────────────

// ─── BBox overlay component ───────────────────────────────────────────────

function BBoxOverlay({ bbox, color, label }: { bbox: BBox; color: string; label?: string }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${bbox.Left * 100}%`,
        top: `${bbox.Top * 100}%`,
        width: `${bbox.Width * 100}%`,
        height: `${bbox.Height * 100}%`,
        border: `2px solid ${color}`,
        backgroundColor: `${color}18`,
        borderRadius: 2,
      }}
    >
      {label && (
        <span
          className="absolute -top-4 left-0 px-1 py-px text-[8px] font-medium rounded-sm whitespace-nowrap"
          style={{ backgroundColor: color, color: '#fff' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// ─── Document Drawer ─────────────────────────────────────────────────────

function DocDetailDrawer({ doc, allDocs, testRunId, onClose, onNavigate, language }: {
  doc: StockTestRunDoc;
  allDocs: StockTestRunDoc[];
  testRunId: string;
  onClose: () => void;
  onNavigate: (d: StockTestRunDoc) => void;
  language: 'es' | 'en';
}) {
  const currentIndex = allDocs.findIndex(d => d.docKey === doc.docKey);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allDocs.length - 1;

  const [detail, setDetail] = useState<StockTestDocDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [textract, setTextract] = useState<TextractMetadata | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [hoveredProduct, setHoveredProduct] = useState<StockProductResult | null>(null);
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDetail(null);
    setImages([]);
    setTextract(null);
    setCurrentImageIdx(0);
    setHoveredProduct(null);
    setZoom(1);
    if (!doc.docKey || !testRunId) return;
    let cancelled = false;

    setDetailLoading(true);
    getStockTestRunDocument(testRunId, doc.docKey)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetailLoading(false); });

    // Extract locationId and categoryDate from docKey
    // docKey format: "loc#delivery_note#COMPRAS#2025-12-22#uuid"
    // API expects categoryDate = "COMPRAS#2025-12-22#uuid" (skip "delivery_note" prefix)
    const parts = doc.docKey.split('#');
    if (parts.length >= 4) {
      const locationId = doc.locationId || parts[0];
      const categoryDate = parts.slice(2).join('#');
      setImageLoading(true);
      fetchDNData(locationId, categoryDate)
        .then(result => {
          if (cancelled) return;
          setImages(result.images);
          setTextract(result.textract);
        })
        .finally(() => { if (!cancelled) setImageLoading(false); });
    }

    return () => { cancelled = true; };
  }, [doc.docKey, doc.locationId, testRunId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(allDocs[currentIndex - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(allDocs[currentIndex + 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hasPrev, hasNext, currentIndex, allDocs, onNavigate]);

  const vCfg = VERDICT_CONFIG[doc.verdict] ?? VERDICT_CONFIG.FAIL;
  const productResults = detail?.productResults ?? [];
  const passedProducts = productResults.filter(p => p.verdict === 'PASS');
  const failedProducts = productResults.filter(p => p.verdict === 'FAIL');

  // Collect bboxes for the currently hovered product
  const highlightedBBoxes = useMemo(() => {
    if (!hoveredProduct || !textract) return [];
    const tp = findTextractProduct(hoveredProduct, textract);
    if (!tp) return [];
    const bboxes: { bbox: BBox; label: string }[] = [];
    const fields = ['product_name', 'product_id', 'quantity', 'unit_price', 'final_price'] as const;
    const fieldLabels: Record<string, string> = {
      product_name: 'Producto',
      product_id: 'ID',
      quantity: 'Cantidad',
      unit_price: 'Precio ud.',
      final_price: 'Total',
    };
    for (const f of fields) {
      const field = tp[f];
      if (field?.bounding_box) {
        bboxes.push({ bbox: field.bounding_box, label: fieldLabels[f] ?? f });
      }
    }
    return bboxes;
  }, [hoveredProduct, textract]);

  // Collect all textract product bboxes (dim, for context)
  const allTextractBBoxes = useMemo(() => {
    if (!textract) return [];
    const bboxes: { bbox: BBox; productName: string }[] = [];
    for (const tp of textract.products) {
      // Use the product_name bbox as the main locator, or fallback to product_id
      const nameBox = tp.product_name?.bounding_box ?? tp.product_id?.bounding_box;
      if (nameBox) {
        bboxes.push({ bbox: nameBox, productName: String(tp.product_name?.value ?? '') });
      }
    }
    return bboxes;
  }, [textract]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 bg-white z-50 shadow-2xl flex flex-col border-l border-gray-200" style={{ width: 960 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.deliveryNoteNumber || doc.docKey.slice(0, 20)}
                </p>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                  doc.verdict === 'PASS' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {language === 'es' ? vCfg.labelEs : vCfg.labelEn}
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate">
                {doc.supplierName || doc.supplierCif || ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Zoom controls */}
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ZoomOut size={14} className="text-gray-400" />
            </button>
            <span className="text-[10px] text-gray-400 tabular-nums w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ZoomIn size={14} className="text-gray-400" />
            </button>
            <div className="w-px h-5 bg-gray-200 mx-1.5" />
            <button onClick={() => hasPrev && onNavigate(allDocs[currentIndex - 1])} disabled={!hasPrev}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <span className="text-xs text-gray-400 tabular-nums px-1">{currentIndex + 1} / {allDocs.length}</span>
            <button onClick={() => hasNext && onNavigate(allDocs[currentIndex + 1])} disabled={!hasNext}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Image viewer with bbox overlays */}
          <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
            {imageLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-gray-300 mr-2" />
                <span className="text-xs text-gray-400">
                  {language === 'es' ? 'Cargando albaran...' : 'Loading delivery note...'}
                </span>
              </div>
            )}
            {images.length > 0 ? (
              <div className="flex-1 overflow-auto p-4">
                {images.length > 1 && (
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <button
                      onClick={() => setCurrentImageIdx(i => Math.max(0, i - 1))}
                      disabled={currentImageIdx === 0}
                      className="p-1 hover:bg-white rounded disabled:opacity-30"
                    >
                      <ChevronLeft size={14} className="text-gray-500" />
                    </button>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {currentImageIdx + 1} / {images.length}
                    </span>
                    <button
                      onClick={() => setCurrentImageIdx(i => Math.min(images.length - 1, i + 1))}
                      disabled={currentImageIdx === images.length - 1}
                      className="p-1 hover:bg-white rounded disabled:opacity-30"
                    >
                      <ChevronRight size={14} className="text-gray-500" />
                    </button>
                  </div>
                )}
                <div
                  ref={imgRef}
                  className="relative mx-auto"
                  style={{ maxWidth: 600 * zoom, transition: 'max-width 0.2s ease' }}
                >
                  <img
                    src={images[currentImageIdx]}
                    alt="Delivery note"
                    className="w-full rounded-lg shadow-sm border border-gray-200"
                    draggable={false}
                  />
                  {/* Dim textract product bboxes (all products) */}
                  {allTextractBBoxes.map((item, i) => (
                    <BBoxOverlay key={`all-${i}`} bbox={item.bbox} color="#6b7280" />
                  ))}
                  {/* Highlighted product bboxes */}
                  {highlightedBBoxes.map((item, i) => (
                    <BBoxOverlay key={`hl-${i}`} bbox={item.bbox} color="#f59e0b" label={item.label} />
                  ))}
                </div>
              </div>
            ) : !imageLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Package size={28} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">
                    {language === 'es' ? 'Vista previa no disponible' : 'Preview not available'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Product results panel */}
          <div className="w-[360px] shrink-0 border-l border-gray-100 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* Summary */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                  {language === 'es' ? 'Resultado del Test' : 'Test Result'}
                </h3>

                <div className="flex items-center gap-2 mb-2">
                  <vCfg.icon size={16} className={vCfg.color} />
                  <span className="text-sm font-medium text-gray-700">
                    {language === 'es' ? vCfg.labelEs : vCfg.labelEn}
                  </span>
                  <span className={`ml-auto text-sm font-semibold tabular-nums ${
                    Math.round(doc.productAccuracy * 100) >= 90 ? 'text-green-600' :
                    Math.round(doc.productAccuracy * 100) >= 75 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {Math.round(doc.productAccuracy * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span className="text-green-500">{doc.productsCorrect} {language === 'es' ? 'correctos' : 'correct'}</span>
                  <span>&middot;</span>
                  <span className="text-red-400">{doc.productsTotal - doc.productsCorrect} {language === 'es' ? 'errores' : 'errors'}</span>
                  <span>&middot;</span>
                  <span>{doc.productsTotal} {language === 'es' ? 'productos' : 'products'}</span>
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-2.5 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <Hash size={13} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{language === 'es' ? 'Albaran' : 'DN Number'}</span>
                  <span className="text-xs text-gray-700 ml-auto">{doc.deliveryNoteNumber || '\u2014'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 size={13} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{language === 'es' ? 'Proveedor' : 'Supplier'}</span>
                  <span className="text-xs text-gray-700 ml-auto truncate max-w-[140px]">
                    {doc.supplierName || doc.supplierCif || '\u2014'}
                  </span>
                </div>
              </div>

              {/* Doc-level error message */}
              {detail?.errorMessage && (
                <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-[11px] font-medium text-red-600 mb-0.5">
                    {language === 'es' ? 'Error del documento' : 'Document error'}
                  </p>
                  <p className="text-[10px] text-red-500">{detail.errorMessage}</p>
                </div>
              )}

              {/* Error summary */}
              {detail && Object.keys(detail.errorSummary ?? {}).length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} className="text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {language === 'es' ? 'Errores por tipo' : 'Errors by type'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(detail.errorSummary).map(([type, count]) => {
                      const style = getErrorStyle(type);
                      return (
                        <div key={type} className={`flex items-center justify-between px-2 py-1.5 rounded ${style.bg}`}>
                          <span className={`text-[11px] font-medium ${style.color}`}>
                            {getStockErrorLabel(type, language)}
                          </span>
                          <span className={`text-[11px] tabular-nums font-medium ${style.color}`}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Product results */}
              {detailLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={16} className="animate-spin text-gray-300" />
                </div>
              )}

              {!detailLoading && productResults.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    {language === 'es' ? 'Productos' : 'Products'}
                    <span className="ml-2 text-gray-400 normal-case font-normal">
                      {passedProducts.length}/{productResults.length}
                    </span>
                  </h3>
                  <div className="space-y-1.5">
                    {[...failedProducts, ...passedProducts].map((product, idx) => (
                      <ProductResultCard
                        key={idx}
                        product={product}
                        language={language}
                        isHighlighted={hoveredProduct === product}
                        hasTextractMatch={!!findTextractProduct(product, textract)}
                        onHover={setHoveredProduct}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ProductResultCard({ product, language, isHighlighted, hasTextractMatch, onHover }: {
  product: StockProductResult;
  language: 'es' | 'en';
  isHighlighted: boolean;
  hasTextractMatch: boolean;
  onHover: (p: StockProductResult | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPassed = product.verdict === 'PASS';

  return (
    <div
      className={`rounded-lg border transition-all ${
        isHighlighted
          ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
          : isPassed ? 'border-green-100 bg-green-50/50' : 'border-red-100 bg-red-50/50'
      } ${hasTextractMatch ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => hasTextractMatch && onHover(product)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 px-2.5 py-2 text-left"
      >
        {isPassed ? (
          <CheckCircle2 size={13} className="text-green-500 shrink-0 mt-0.5" />
        ) : (
          <XCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-gray-700 truncate">
              {product.expectedProductName}
            </p>
            {hasTextractMatch && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="OCR bbox available" />
            )}
          </div>
          {product.actualProductName && product.actualProductName !== product.expectedProductName && (
            <p className="text-[10px] text-gray-400 truncate mt-0.5">
              &rarr; {product.actualProductName}
            </p>
          )}
          {!isPassed && product.errors.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {product.errors.slice(0, 2).map((err, i) => {
                const style = getErrorStyle(err.type);
                return (
                  <span key={i} className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded ${style.bg} ${style.color}`}>
                    {getStockErrorLabel(err.type, language)}
                  </span>
                );
              })}
              {product.errors.length > 2 && (
                <span className="text-[9px] text-gray-400">+{product.errors.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </button>

      {expanded && !isPassed && product.errors.length > 0 && (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-red-100 pt-2 ml-5">
          {product.errors.map((err, i) => (
            <div key={i} className="bg-white rounded px-2 py-1.5 border border-gray-100">
              <p className="text-[10px] font-medium text-red-600 mb-1">
                {getStockErrorLabel(err.type, language)}
              </p>
              {err.message && (
                <p className="text-[10px] text-gray-500">{err.message}</p>
              )}
              {err.expected != null && (
                <div className="flex gap-3 mt-1">
                  <div>
                    <span className="text-[9px] text-gray-400">{language === 'es' ? 'Esperado' : 'Expected'}:</span>
                    <span className="text-[10px] text-gray-700 ml-1 font-mono">{String(err.expected)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-red-400">{language === 'es' ? 'Obtenido' : 'Actual'}:</span>
                    <span className="text-[10px] text-red-600 ml-1 font-mono">{String(err.actual)}</span>
                  </div>
                </div>
              )}
              {err.diffPercent != null && (
                <p className="text-[9px] text-gray-400 mt-0.5">
                  {language === 'es' ? 'Diferencia' : 'Diff'}: {err.diffPercent.toFixed(1)}%
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function StockTestRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();

  const { run, loading, error } = useStockTestRunDetail(id);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [errorFilter, setErrorFilter] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<StockTestRunDoc | null>(null);

  const docs = useMemo(() => {
    let items = run?.documents ?? [];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(d =>
        (d.deliveryNoteNumber ?? '').toLowerCase().includes(q) ||
        (d.supplierName ?? '').toLowerCase().includes(q) ||
        (d.supplierCif ?? '').toLowerCase().includes(q)
      );
    }

    if (resultFilter === 'passed') items = items.filter(d => d.verdict === 'PASS');
    if (resultFilter === 'failed') items = items.filter(d => d.verdict !== 'PASS');

    if (errorFilter !== 'all') {
      items = items.filter(d => d.errorSummary && d.errorSummary[errorFilter]);
    }

    return items;
  }, [run, search, resultFilter, errorFilter]);

  const allErrorTypes = useMemo(() => {
    const types = new Set<string>();
    (run?.documents ?? []).forEach(d => {
      Object.keys(d.errorSummary ?? {}).forEach(t => types.add(t));
    });
    return Array.from(types).sort();
  }, [run]);

  const runStatus = run?.runStatus ?? 'INITIALIZING';
  const isCompleted = runStatus === 'COMPLETED';
  const isFailed = runStatus === 'FAILED';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">{error || 'Test run not found'}</p>
        <button onClick={() => navigate('/stock-test')} className="mt-2 text-sm text-brand-500 hover:text-brand-600">
          {language === 'es' ? 'Volver a tests' : 'Back to tests'}
        </button>
      </div>
    );
  }

  const progress = run.totalDocs > 0 ? Math.round((run.processedDocs / run.totalDocs) * 100) : 0;
  const productPct = Math.round(run.productAccuracy * 100);
  const docPct = Math.round(run.docAccuracy * 100);
  const failedDocs = run.totalDocs - run.perfectDocs;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/stock-test')} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900 truncate">
              {run.runName || `Test ${run.testRunId.slice(0, 8)}`}
            </h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`w-1.5 h-1.5 rounded-full ${
                isCompleted ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-blue-500 animate-pulse'
              }`} />
              {runStatus}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded ${
              run.mode === 'compare' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
            }`}>
              {run.mode}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {run.totalDocs} docs &middot; {run.mode}
            {run.date && <> &middot; {new Date(run.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}</>}
          </p>
        </div>
      </div>

      {/* FAILED banner */}
      {isFailed && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-700">
              {language === 'es' ? 'Test fallido' : 'Test failed'}
            </p>
            {run.errorMessage ? (
              <p className="text-xs text-red-500 mt-0.5">{run.errorMessage}</p>
            ) : (
              <p className="text-xs text-red-500 mt-0.5">
                {language === 'es'
                  ? `El test proceso ${run.processedDocs} de ${run.totalDocs} documentos pero termino con errores. Product accuracy: ${productPct}%, Perfect docs: ${run.perfectDocs}/${run.totalDocs}. Revisa los documentos individuales para ver los errores de cada producto.`
                  : `The test processed ${run.processedDocs} of ${run.totalDocs} documents but ended with errors. Product accuracy: ${productPct}%, Perfect docs: ${run.perfectDocs}/${run.totalDocs}. Check individual documents for product-level errors.`}
              </p>
            )}
            <p className="text-[10px] text-red-400 mt-1 font-mono">
              testRunId: {run.testRunId}
            </p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label={language === 'es' ? 'Progreso' : 'Progress'} value={`${progress}%`}
          sub={`${run.processedDocs}/${run.totalDocs}`} color="text-gray-900" />
        <StatCard label={language === 'es' ? 'Precision productos' : 'Product accuracy'} value={`${productPct}%`}
          color={productPct >= 90 ? 'text-green-600' : productPct >= 75 ? 'text-yellow-600' : 'text-red-600'} />
        <StatCard label={language === 'es' ? 'Docs perfectos' : 'Perfect docs'} value={`${docPct}%`}
          sub={`${run.perfectDocs}/${run.totalDocs}`}
          color={run.perfectDocs === run.totalDocs ? 'text-green-600' : 'text-yellow-600'} />
        <StatCard label={language === 'es' ? 'Pasados' : 'Passed'} value={String(run.perfectDocs)} color="text-green-600" />
        <StatCard label={language === 'es' ? 'Fallidos' : 'Failed'} value={String(failedDocs)} color="text-red-500" />
      </div>

      {/* Error breakdown */}
      {Object.keys(run.byErrorType ?? {}).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              {language === 'es' ? 'Errores por tipo' : 'Errors by type'}
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-gray-100">
            {Object.entries(run.byErrorType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const style = getErrorStyle(type);
              return (
                <div key={type} className="bg-white px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-medium truncate ${style.color}`}>
                      {getStockErrorLabel(type, language)}
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ml-2 ${style.color}`}>{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress bar (if not completed) */}
      {!isCompleted && !isFailed && (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400">
              {language === 'es' ? 'Procesando...' : 'Processing...'}
              <span className="ml-1 text-gray-300">({runStatus})</span>
            </span>
            <span className="text-[11px] font-medium text-gray-600 tabular-nums">{progress}%</span>
          </div>
          <div className="h-1 bg-gray-100 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={language === 'es' ? 'Buscar albaran o proveedor...' : 'Search DN or supplier...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors" />
        </div>

        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          {([
            { value: 'all' as const, labelEs: 'Todos', labelEn: 'All' },
            { value: 'passed' as const, labelEs: 'OK', labelEn: 'Passed' },
            { value: 'failed' as const, labelEs: 'Error', labelEn: 'Failed' },
          ]).map(opt => (
            <button key={opt.value} onClick={() => setResultFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                resultFilter === opt.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}>
              {language === 'es' ? opt.labelEs : opt.labelEn}
            </button>
          ))}
        </div>

        {allErrorTypes.length > 0 && (
          <select
            value={errorFilter}
            onChange={e => setErrorFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
          >
            <option value="all">{language === 'es' ? 'Todos los errores' : 'All errors'}</option>
            {allErrorTypes.map(t => (
              <option key={t} value={t}>{getStockErrorLabel(t, language)}</option>
            ))}
          </select>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {docs.length} {language === 'es' ? 'documentos' : 'documents'}
        </span>
      </div>

      {/* Documents table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Albaran' : 'Delivery Note'}
              </th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Proveedor' : 'Supplier'}
              </th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Veredicto' : 'Verdict'}
              </th>
              <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Precision' : 'Accuracy'}
              </th>
              <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Productos' : 'Products'}
              </th>
              <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Errores' : 'Errors'}
              </th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Tipos de error' : 'Error types'}
              </th>
            </tr>
          </thead>
          <tbody>
            {docs.map(doc => {
              const vCfg = VERDICT_CONFIG[doc.verdict] ?? VERDICT_CONFIG.FAIL;
              const accPct = Math.round(doc.productAccuracy * 100);
              const errorEntries = Object.entries(doc.errorSummary ?? {});

              return (
                <tr
                  key={doc.docKey}
                  onClick={() => setSelectedDoc(doc)}
                  className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-900">
                      {doc.deliveryNoteNumber || doc.docKey.split('#').slice(-1)[0]?.slice(0, 8) || '\u2014'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-gray-600 truncate block max-w-[160px]">
                      {doc.supplierName || doc.supplierCif || '\u2014'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <span className={`w-1.5 h-1.5 rounded-full ${vCfg.dotClass}`} />
                      {language === 'es' ? vCfg.labelEs : vCfg.labelEn}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {accPct > 0 ? (
                      <span className={`text-sm tabular-nums font-medium ${
                        accPct >= 90 ? 'text-green-600' : accPct >= 75 ? 'text-yellow-600' : 'text-red-600'
                      }`}>{accPct}%</span>
                    ) : (
                      <span className="text-xs text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="text-sm tabular-nums text-gray-500">
                      <span className="text-green-600">{doc.productsCorrect}</span>
                      <span className="text-gray-300">/{doc.productsTotal}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {doc.errorCount > 0 ? (
                      <span className="text-sm tabular-nums text-red-500">{doc.errorCount}</span>
                    ) : (
                      <span className="text-xs text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {errorEntries.slice(0, 2).map(([type, count]) => {
                        const style = getErrorStyle(type);
                        return (
                          <span key={type} className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${style.bg} ${style.color}`}>
                            {getStockErrorLabel(type, language)}
                            <span className="opacity-60">{count}</span>
                          </span>
                        );
                      })}
                      {errorEntries.length > 2 && (
                        <span className="text-[10px] text-gray-300">+{errorEntries.length - 2}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {docs.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Package size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {language === 'es' ? 'No se encontraron documentos' : 'No documents found'}
            </p>
          </div>
        )}
      </div>

      {/* Document detail drawer */}
      {selectedDoc && run && (
        <DocDetailDrawer
          doc={selectedDoc}
          allDocs={docs}
          testRunId={run.testRunId}
          onClose={() => setSelectedDoc(null)}
          onNavigate={d => setSelectedDoc(d)}
          language={language}
        />
      )}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
