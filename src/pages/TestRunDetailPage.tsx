import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Receipt, Wallet, Truck, Users, Search,
  Filter, CheckCircle2, XCircle, Loader2, Clock,
  AlertCircle, FileText, Image, X, ChevronLeft, ChevronRight,
  Hash, Building2, Calendar, DollarSign, ShieldCheck, Tag, Ban,
  Sparkles, ChevronDown,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { ERROR_CATEGORY_LABELS, DOC_TYPE_LABELS } from '../types/golden';
import { useTestRunDetail } from '../hooks/useOcrTestingData';
import { getTestRunDocument, type ApiDocDetail, type ApiTraceParams } from '../services/ocrTestingApi';
import { authenticatedFetch } from '../services/authFetch';
import { config, getCurrentEnvironment } from '../config/environment';
import { getDocumentFileUrl, parseDocDetailResponse } from '../services/docApiUrls';
import type { DocType, ErrorCategory } from '../types/golden';
import type { DocTestResult, DocTestStatus, TestRunStatus } from '../types/testRun';
import type { FieldComparison } from '../types/testRun';
import DocumentViewer from '../components/annotation/DocumentViewer';
import type { UploadedFile } from '../components/annotation/FileUploadZone';
import type { ViewerState } from '../components/annotation/ViewerToolbar';
import ViewerToolbar from '../components/annotation/ViewerToolbar';
import { useResizable } from '../hooks/useResizable';

type ResultFilter = 'all' | 'passed' | 'failed' | 'processing';

const TAB_CONFIG: { type: DocType; icon: typeof Receipt }[] = [
  { type: 'expense', icon: Receipt },
  { type: 'income', icon: Wallet },
  { type: 'payroll', icon: Users },
  { type: 'delivery_note', icon: Truck },
];

const DOC_STATUS_CONFIG: Record<DocTestStatus, {
  icon: typeof CheckCircle2; color: string; labelEs: string; labelEn: string;
}> = {
  passed: { icon: CheckCircle2, color: 'text-green-500', labelEs: 'OK', labelEn: 'Pass' },
  failed: { icon: XCircle, color: 'text-red-500', labelEs: 'Error', labelEn: 'Fail' },
  no_output: { icon: Ban, color: 'text-orange-500', labelEs: 'Sin salida', labelEn: 'No output' },
  copy_failed: { icon: Ban, color: 'text-orange-500', labelEs: 'Copia fallida', labelEn: 'Copy failed' },
  ocr_error: { icon: AlertCircle, color: 'text-red-500', labelEs: 'Error OCR', labelEn: 'OCR error' },
  timeout: { icon: Clock, color: 'text-orange-500', labelEs: 'Timeout', labelEn: 'Timeout' },
  processing: { icon: Loader2, color: 'text-blue-500', labelEs: 'Procesando', labelEn: 'Processing' },
  pending: { icon: Clock, color: 'text-gray-400', labelEs: 'Pendiente', labelEn: 'Pending' },
};

const RUN_STATUS_CONFIG: Record<TestRunStatus, {
  colorClass: string; bgClass: string; labelEs: string; labelEn: string;
}> = {
  completed: { colorClass: 'text-green-700', bgClass: 'bg-green-50', labelEs: 'Completado', labelEn: 'Completed' },
  in_progress: { colorClass: 'text-blue-700', bgClass: 'bg-blue-50', labelEs: 'En progreso', labelEn: 'In progress' },
  failed: { colorClass: 'text-red-700', bgClass: 'bg-red-50', labelEs: 'Fallido', labelEn: 'Failed' },
  queued: { colorClass: 'text-gray-500', bgClass: 'bg-gray-50', labelEs: 'En cola', labelEn: 'Queued' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function proxyS3Url(url: string): string {
  return url
    .replace('https://talky-invoice-v2-dev-6136.s3.amazonaws.com', '/s3-dev')
    .replace('https://talky-invoice-v2-prod-6136.s3.amazonaws.com', '/s3-prod');
}

type ApiDocType = 'expenses' | 'delivery-notes' | 'income-invoices' | 'payrolls';

function toApiDocType(dt: DocType): ApiDocType {
  switch (dt) {
    case 'expense': return 'expenses';
    case 'income': return 'income-invoices';
    case 'payroll': return 'payrolls';
    case 'delivery_note': return 'delivery-notes';
  }
}

function getDocDetailUrlForTestDoc(locationId: string, categoryDate: string, documentType: string): string {
  switch (documentType) {
    case 'expense':
      return `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${locationId}?categoryDate=${encodeURIComponent(categoryDate)}`;
    case 'income':
      return `${config.talkyCombinedMetricsBaseUrl}/users/${locationId}/invoice-incomes?categoryDate=${encodeURIComponent(categoryDate)}`;
    case 'payroll':
      return `${config.talkyPayrollsSearchBaseUrl}/locations/${locationId}/payrolls?categoryDate=${encodeURIComponent(categoryDate)}`;
    case 'delivery_note':
      return `${config.talkyDeliveryNotesBaseUrl}/delivery-notes-get/${locationId}?categoryDate=${encodeURIComponent(categoryDate)}`;
    default:
      return `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${locationId}?categoryDate=${encodeURIComponent(categoryDate)}`;
  }
}

interface DocFetchResult {
  imageUrl?: string;
  invoiceDetail?: Record<string, unknown>;
}

async function fetchDocData(locationId: string, categoryDate: string, docType: DocType): Promise<DocFetchResult> {
  try {
    const url = getDocDetailUrlForTestDoc(locationId, categoryDate, docType);
    const res = await authenticatedFetch(url);
    const data = await res.json();
    const detail = parseDocDetailResponse(toApiDocType(docType), data);
    if (!detail) return {};
    const fileUrl = getDocumentFileUrl(detail);
    return {
      imageUrl: fileUrl ? proxyS3Url(fileUrl) : undefined,
      invoiceDetail: detail,
    };
  } catch {
    return {};
  }
}

// ─── AI Traces ───────────────────────────────────────────────────────────

interface AiTraceStep {
  index: number;
  promptName?: string;
  provider?: string;
  model?: string;
  prompt?: string;
  response?: { text?: string | null };
}

interface AiTracesResponse {
  steps: AiTraceStep[];
}

function getEnvParam(): string {
  const env = getCurrentEnvironment();
  if (env === 'development') return 'dev';
  if (env === 'preproduction') return 'pre';
  return 'prod';
}

async function fetchAiTraces(userId: string, docId: string): Promise<AiTracesResponse> {
  const params = new URLSearchParams({
    docId,
    env: getEnvParam(),
    paged: 'true',
    stepsPageSize: '50',
    stepsIncludePrompt: 'true',
    stepsIncludeResponseText: 'true',
    stepsIncludeResponseRaw: 'false',
    flattenResponseText: 'true',
  });
  const url = `${config.talkyCombinedMetricsBaseUrl}/users/${userId}/ai-traces?${params}`;
  const res = await authenticatedFetch(url);
  if (res.status === 404) return { steps: [] };
  if (!res.ok) throw new Error(`AI traces request failed (${res.status})`);
  return res.json();
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|tiff?)(\?|$)/i;

// ─── Error reason display ────────────────────────────────────────────────

const REASON_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  string_mismatch: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
  one_side_missing: { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
  partial_match: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  type_mismatch: { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-500' },
  _default: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

function formatReasonLabel(reason: string): string {
  // numeric_diff_12% → numeric diff 12%
  // length_diff_5_vs_3 → length diff 5 vs 3
  return reason.replace(/_/g, ' ');
}

// Color for numeric_diff_X% and length_diff_N_vs_M based on prefix
function getReasonColor(reason: string): { bg: string; text: string; dot: string } {
  if (reason.startsWith('numeric_diff')) return { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' };
  if (reason.startsWith('length_diff')) return { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500' };
  return REASON_COLOR[reason] ?? REASON_COLOR._default;
}

// ─── AI Trace display helpers ─────────────────────────────────────────────

/** Highlight occurrences of `term` in `text` with a colored background */
function HighlightedText({ text, term }: { text: string; term: string }) {
  if (!term || !text) return <>{text}</>;
  const parts: { text: string; highlight: boolean }[] = [];
  const lower = text.toLowerCase();
  const termLower = term.toLowerCase();
  let idx = 0;
  while (idx < text.length) {
    const found = lower.indexOf(termLower, idx);
    if (found === -1) {
      parts.push({ text: text.slice(idx), highlight: false });
      break;
    }
    if (found > idx) parts.push({ text: text.slice(idx, found), highlight: false });
    parts.push({ text: text.slice(found, found + term.length), highlight: true });
    idx = found + term.length;
  }
  return (
    <>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{p.text}</mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

/** Find the most relevant AI step for a field name */
function findRelevantSteps(steps: AiTraceStep[], fieldName: string): AiTraceStep[] {
  const fn = fieldName.toLowerCase();
  return steps.filter(s => {
    const prompt = (s.prompt ?? '').toLowerCase();
    const response = (s.response?.text ?? '').toLowerCase();
    return prompt.includes(fn) || response.includes(fn);
  });
}

/** Truncate text around the first occurrence of a term, showing context */
function truncateAround(text: string, term: string, contextChars = 300): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return text.slice(0, contextChars * 2) + (text.length > contextChars * 2 ? '...' : '');
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + term.length + contextChars);
  let result = text.slice(start, end);
  if (start > 0) result = '...' + result;
  if (end < text.length) result = result + '...';
  return result;
}

// ─── Document Drawer ──────────────────────────────────────────────────────

// Convert API detail field results to FieldComparison[]
function detailToComparisons(detail: ApiDocDetail): FieldComparison[] {
  return Object.entries(detail.fieldResults ?? {}).map(([name, r]) => ({
    fieldName: name,
    expected: r.expectedDisplay ?? String(r.expected ?? ''),
    actual: r.actualDisplay ?? String(r.actual ?? ''),
    result: r.match ? 'match' as const : 'mismatch' as const,
    similarity: r.similarity,
    reason: r.reason || undefined,
  }));
}

function TestDocDrawer({ doc, allDocs, testRunId, onClose, onNavigate, language }: {
  doc: DocTestResult;
  allDocs: DocTestResult[];
  testRunId: string;
  onClose: () => void;
  onNavigate: (d: DocTestResult) => void;
  language: 'es' | 'en';
}) {
  const { width: drawerWidth, dragging, startResize } = useResizable({
    initialWidth: 780,
    minWidth: 480,
    maxWidth: Math.min(1400, typeof window !== 'undefined' ? window.innerWidth * 0.92 : 1400),
    side: 'right',
  });

  const currentIndex = allDocs.findIndex(d => d.id === doc.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allDocs.length - 1;

  // Fetch full document detail for richer field comparisons
  const [detailComparisons, setDetailComparisons] = useState<FieldComparison[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTraceParams, setDetailTraceParams] = useState<ApiTraceParams | undefined>(undefined);

  // Fetch document image URL and invoice detail from Talky API
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imageLoading, setImageLoading] = useState(false);
  const [invoiceDetail, setInvoiceDetail] = useState<Record<string, unknown> | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);

  // AI Traces state (lazy loaded on demand) — separate for original and test run
  type TraceSource = 'original' | 'testRun';
  const [aiTracesOriginal, setAiTracesOriginal] = useState<AiTraceStep[] | null>(null);
  const [aiTracesTestRun, setAiTracesTestRun] = useState<AiTraceStep[] | null>(null);
  const [aiTracesLoading, setAiTracesLoading] = useState<TraceSource | null>(null);
  const [aiTracesError, setAiTracesError] = useState<string | null>(null);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [activeTraceSource, setActiveTraceSource] = useState<TraceSource>('original');

  useEffect(() => {
    setDetailComparisons(null);
    setDetailTraceParams(undefined);
    setImageUrl(undefined);
    setInvoiceDetail(null);
    setActiveField(null);
    setAiTracesOriginal(null);
    setAiTracesTestRun(null);
    setAiTracesError(null);
    setAiTracesLoading(null);
    setExpandedField(null);
    setActiveTraceSource('original');
    if (!doc.docId || !testRunId) return;
    let cancelled = false;

    // Fetch field comparisons detail
    setDetailLoading(true);
    getTestRunDocument(testRunId, doc.docId)
      .then(detail => {
        if (!cancelled) {
          setDetailComparisons(detailToComparisons(detail));
          setDetailTraceParams(detail.traceParams);
        }
      })
      .catch(() => { /* use compact data from list */ })
      .finally(() => { if (!cancelled) setDetailLoading(false); });

    // Fetch document image URL + invoice detail (for bounding boxes)
    if (doc.locationId && doc.categoryDate) {
      setImageLoading(true);
      fetchDocData(doc.locationId, doc.categoryDate, doc.docType)
        .then(result => {
          if (!cancelled) {
            setImageUrl(result.imageUrl);
            setInvoiceDetail(result.invoiceDetail ?? null);
          }
        })
        .finally(() => { if (!cancelled) setImageLoading(false); });
    }

    return () => { cancelled = true; };
  }, [doc.docId, doc.locationId, doc.categoryDate, doc.docType, testRunId]);

  // Trace params from API — prefer detail endpoint (always has traceParams) over list endpoint
  const effectiveTraceParams = detailTraceParams ?? doc.traceParams;
  const traceOriginal = effectiveTraceParams?.original ?? null;
  const traceTestRun = effectiveTraceParams?.testRun ?? null;
  const hasTraceOriginal = !!(traceOriginal?.userId && traceOriginal?.docId);
  const hasTraceTestRun = !!(traceTestRun?.userId && traceTestRun?.docId);
  const canShowTraces = hasTraceOriginal || hasTraceTestRun;

  // Lazy-load AI traces for a given source (original or testRun)
  const loadAiTraces = useCallback(async (source: TraceSource) => {
    const tp = source === 'original' ? traceOriginal : traceTestRun;
    if (!tp?.userId || !tp?.docId) return;
    const existing = source === 'original' ? aiTracesOriginal : aiTracesTestRun;
    if (existing) return; // already loaded
    if (aiTracesLoading === source) return; // already loading this source

    setAiTracesLoading(source);
    setAiTracesError(null);
    try {
      const data = await fetchAiTraces(tp.userId, tp.docId);
      const steps = data.steps ?? [];
      if (source === 'original') setAiTracesOriginal(steps);
      else setAiTracesTestRun(steps);
    } catch (err) {
      setAiTracesError(err instanceof Error ? err.message : 'Failed to load AI traces');
    } finally {
      setAiTracesLoading(null);
    }
  }, [traceOriginal, traceTestRun, aiTracesOriginal, aiTracesTestRun, aiTracesLoading]);

  // Toggle field AI trace view — load both sources at once
  const handleFieldExpand = useCallback((fieldName: string) => {
    if (expandedField === fieldName) {
      setExpandedField(null);
    } else {
      setExpandedField(fieldName);
      loadAiTraces('original');
      loadAiTraces('testRun');
    }
  }, [expandedField, loadAiTraces]);

  // Switch between original and test run traces
  const handleTraceSourceSwitch = useCallback((source: TraceSource) => {
    setActiveTraceSource(source);
    loadAiTraces(source);
  }, [loadAiTraces]);

  // Use detail comparisons if available, otherwise fall back to compact list data
  const fieldComparisons = detailComparisons ?? doc.fieldComparisons;

  const uploadedFile = useMemo<UploadedFile | null>(() => {
    const url = imageUrl || doc.imageUrl;
    if (!url) return null;
    const isImg = IMAGE_EXTENSIONS.test(url);
    return {
      id: doc.id,
      file: new File([], doc.docNumber, { type: isImg ? 'image/jpeg' : 'application/pdf' }),
      type: isImg ? 'image' : 'pdf',
      validatedType: isImg ? 'image/jpeg' : 'application/pdf',
      url,
      preview: isImg ? url : undefined,
    };
  }, [doc.id, doc.docNumber, doc.imageUrl, imageUrl]);

  const [viewerState, setViewerState] = useState<ViewerState>({
    zoom: 1, rotation: 0, fitMode: 'width', currentPage: 1, totalPages: 1, bboxMode: 1,
  });
  const [displayZoom, setDisplayZoom] = useState(1);
  const handleVS = useCallback((p: Partial<ViewerState>) => setViewerState(prev => ({ ...prev, ...p })), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(allDocs[currentIndex - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(allDocs[currentIndex + 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hasPrev, hasNext, currentIndex, allDocs, onNavigate]);

  const statusCfg = DOC_STATUS_CONFIG[doc.status];
  const StatusIcon = statusCfg.icon;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      {/* Prevent text selection while dragging */}
      {dragging && <div className="fixed inset-0 z-[51] cursor-col-resize" />}
      <div className="fixed inset-y-0 right-0 bg-white z-50 shadow-2xl flex flex-col border-l border-gray-200"
        style={{ width: drawerWidth }}>
        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          className={`absolute inset-y-0 -left-1 w-2 cursor-col-resize z-10 group hover:bg-brand-500/20 transition-colors ${dragging ? 'bg-brand-500/30' : ''}`}
        >
          <div className={`absolute inset-y-0 left-[3px] w-px ${dragging ? 'bg-brand-500' : 'bg-transparent group-hover:bg-brand-500/50'} transition-colors`} />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{doc.docNumber}</p>
              <p className="text-xs text-gray-400 truncate">{doc.supplier}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
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
          {/* Viewer */}
          <div className="flex-1 flex flex-col min-w-0">
            {uploadedFile && (
              <div className="shrink-0 border-b border-gray-100">
                <ViewerToolbar viewerState={viewerState} displayZoom={displayZoom} onViewerStateChange={handleVS} isPdf={uploadedFile.type === 'pdf'} />
              </div>
            )}
            {imageLoading && !uploadedFile && (
              <div className="flex items-center justify-center py-4 border-b border-gray-100">
                <Loader2 size={16} className="animate-spin text-gray-300 mr-2" />
                <span className="text-xs text-gray-400">
                  {language === 'es' ? 'Cargando documento...' : 'Loading document...'}
                </span>
              </div>
            )}
            <div className="flex-1 min-h-0">
              {uploadedFile ? (
                <DocumentViewer file={uploadedFile} zoom={viewerState.zoom} rotation={viewerState.rotation}
                  fitMode={viewerState.fitMode} currentPage={viewerState.currentPage} bboxMode={viewerState.bboxMode}
                  invoiceDetail={invoiceDetail} activeFieldName={activeField}
                  onActiveFieldClear={() => setActiveField(null)}
                  onTotalPagesChange={t => handleVS({ totalPages: t })} onZoomChange={z => handleVS({ zoom: z })}
                  onDisplayZoomChange={setDisplayZoom} onCurrentPageChange={p => handleVS({ currentPage: p })} />
              ) : !imageLoading ? (
                <MockDocPlaceholder doc={doc} language={language} />
              ) : null}
            </div>
          </div>

          {/* Metadata + Field comparisons */}
          <div className="w-80 shrink-0 border-l border-gray-100 overflow-y-auto">
            <div className="p-4 space-y-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Resultado del Test' : 'Test Result'}
              </h3>

              {/* Status + accuracy */}
              <div className="flex items-center gap-2">
                <StatusIcon size={16} className={`${statusCfg.color} ${doc.status === 'processing' ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium text-gray-700">
                  {language === 'es' ? statusCfg.labelEs : statusCfg.labelEn}
                </span>
                <span className={`ml-auto text-sm font-semibold tabular-nums ${doc.accuracy >= 90 ? 'text-green-600' : doc.accuracy >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {doc.accuracy}%
                </span>
              </div>
              {fieldComparisons.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span>{fieldComparisons.filter(f => f.result === 'match').length} {language === 'es' ? 'correctos' : 'correct'}</span>
                  <span>&middot;</span>
                  <span className="text-red-400">{fieldComparisons.filter(f => f.result !== 'match').length} {language === 'es' ? 'errores' : 'errors'}</span>
                  <span>&middot;</span>
                  <span>{fieldComparisons.length} {language === 'es' ? 'campos' : 'fields'}</span>
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <MetaRow icon={Hash} label={language === 'es' ? 'Numero' : 'Number'} value={doc.docNumber} />
                <MetaRow icon={Building2} label={language === 'es' ? 'Proveedor' : 'Supplier'} value={doc.supplier} />
                <MetaRow icon={Calendar} label={language === 'es' ? 'Fecha' : 'Date'} value={doc.date} />
                <MetaRow icon={DollarSign} label={language === 'es' ? 'Importe' : 'Amount'}
                  value={`${doc.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${doc.currency}`} bold />
                <MetaRow icon={FileText} label={language === 'es' ? 'Tipo' : 'Type'} value={DOC_TYPE_LABELS[doc.docType][language]} />
              </div>

              {/* Error categories */}
              {doc.errorCategories.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag size={13} className="text-gray-400" />
                    <span className="text-xs text-gray-500">{language === 'es' ? 'Categorias de error' : 'Error categories'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {doc.errorCategories.map(cat => (
                      <span key={cat} className="px-2 py-0.5 text-[11px] font-medium rounded bg-red-50 text-red-600">
                        {ERROR_CATEGORY_LABELS[cat][language]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Field comparisons */}
              {doc.status !== 'pending' && doc.status !== 'processing' && (() => {
                const sorted = [...fieldComparisons].sort((a, b) => {
                  if (a.result === 'match' && b.result !== 'match') return 1;
                  if (a.result !== 'match' && b.result === 'match') return -1;
                  return (a.similarity ?? 1) - (b.similarity ?? 1);
                });
                const matchCount = sorted.filter(f => f.result === 'match').length;
                return (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck size={13} className="text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {language === 'es' ? 'Comparacion de campos' : 'Field comparison'}
                      </span>
                      {detailLoading && <Loader2 size={11} className="animate-spin text-gray-300" />}
                      <span className={`text-[10px] ml-auto tabular-nums font-medium ${
                        matchCount === sorted.length ? 'text-green-500' : 'text-gray-400'
                      }`}>
                        {matchCount}/{sorted.length}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {sorted.map(fc => {
                        const isExpanded = expandedField === fc.fieldName;
                        return (
                        <div key={fc.fieldName} className={`px-2 py-1.5 rounded text-xs ${
                          fc.result === 'match' ? 'bg-green-50/50' : 'bg-red-50/50'
                        }`}>
                          <div className="flex items-center gap-2">
                            {fc.result === 'match' ? (
                              <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                            ) : (
                              <XCircle size={12} className="text-red-500 shrink-0" />
                            )}
                            <span
                              className="text-gray-700 font-mono truncate flex-1 cursor-pointer hover:text-brand-600 transition-colors"
                              onClick={() => setActiveField(fc.fieldName)}
                              title={language === 'es' ? 'Ver en documento' : 'Show in document'}
                            >{fc.fieldName}</span>
                            {fc.similarity != null && fc.result !== 'match' && (
                              <span className={`text-[10px] tabular-nums font-medium shrink-0 ${
                                fc.similarity >= 0.8 ? 'text-yellow-500' : 'text-red-400'
                              }`}>
                                {Math.round(fc.similarity * 100)}%
                              </span>
                            )}
                            {/* AI Trace toggle button */}
                            {fc.result !== 'match' && canShowTraces && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleFieldExpand(fc.fieldName); }}
                                className={`shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                  isExpanded
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-purple-50 text-purple-500 hover:bg-purple-100 hover:text-purple-600'
                                }`}
                                title={language === 'es' ? 'Ver logs IA' : 'View AI logs'}
                              >
                                <Sparkles size={9} />
                                IA
                                <ChevronDown size={9} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>
                          {fc.result === 'match' && (
                            <p className="mt-0.5 pl-5 text-[10px] text-green-600 break-words">{fc.actual || fc.expected}</p>
                          )}
                          {fc.result !== 'match' && (
                            <div className="mt-1 pl-5 space-y-1">
                              {fc.reason && (
                                <span className="inline-block text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-medium">
                                  {fc.reason.replace(/_/g, ' ')}
                                </span>
                              )}
                              <div>
                                <p className="text-[10px] text-gray-500 mb-0.5">{language === 'es' ? 'Esperado' : 'Expected'}:</p>
                                <p className="text-[10px] text-gray-700 break-words bg-white rounded px-1.5 py-1 border border-gray-100">
                                  {fc.expected || <span className="text-gray-300 italic">(vacio)</span>}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-red-500 mb-0.5">{language === 'es' ? 'Obtenido' : 'Actual'}:</p>
                                <p className="text-[10px] text-red-600 break-words bg-red-50/50 rounded px-1.5 py-1 border border-red-100">
                                  {fc.actual || <span className="text-red-300 italic">(vacio)</span>}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* AI Trace expanded panel */}
                          {isExpanded && (() => {
                            const currentTraces = activeTraceSource === 'original' ? aiTracesOriginal : aiTracesTestRun;
                            const currentRelevant = currentTraces ? findRelevantSteps(currentTraces, fc.fieldName) : [];
                            const isLoading = aiTracesLoading === activeTraceSource;
                            return (
                            <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                              {/* Source toggle tabs */}
                              <div className="flex border-b border-gray-200 bg-white">
                                {hasTraceOriginal && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleTraceSourceSwitch('original'); }}
                                    className={`flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2 ${
                                      activeTraceSource === 'original'
                                        ? 'border-gray-800 text-gray-800'
                                        : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                                  >
                                    {language === 'es' ? 'Trazas originales' : 'Original traces'}
                                  </button>
                                )}
                                {hasTraceTestRun && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleTraceSourceSwitch('testRun'); }}
                                    className={`flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2 ${
                                      activeTraceSource === 'testRun'
                                        ? 'border-gray-800 text-gray-800'
                                        : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                                  >
                                    {language === 'es' ? 'Trazas del test' : 'Test run traces'}
                                  </button>
                                )}
                              </div>
                              <div className="p-2.5 space-y-2.5">
                                {isLoading && (
                                  <div className="flex items-center gap-2 py-3 justify-center">
                                    <Loader2 size={12} className="animate-spin text-gray-400" />
                                    <span className="text-xs text-gray-400">
                                      {language === 'es' ? 'Cargando logs IA...' : 'Loading AI logs...'}
                                    </span>
                                  </div>
                                )}
                                {aiTracesError && (
                                  <p className="text-xs text-red-500 py-2 text-center">{aiTracesError}</p>
                                )}
                                {currentTraces && currentTraces.length === 0 && !isLoading && (
                                  <p className="text-xs text-gray-400 py-3 text-center italic">
                                    {language === 'es'
                                      ? 'No hay trazas disponibles'
                                      : 'No traces available'}
                                  </p>
                                )}
                                {currentTraces && currentTraces.length > 0 && currentRelevant.length === 0 && !isLoading && (
                                  <p className="text-xs text-gray-400 py-3 text-center italic">
                                    {language === 'es'
                                      ? `"${fc.fieldName}" no encontrado en los logs`
                                      : `"${fc.fieldName}" not found in logs`}
                                  </p>
                                )}
                                {currentRelevant.map((step, i) => (
                                  <div key={i} className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-semibold text-gray-700">
                                        Step {step.index}
                                      </span>
                                      {step.promptName && (
                                        <span className="text-[11px] text-gray-500 truncate">{step.promptName}</span>
                                      )}
                                      {step.model && (
                                        <span className="text-[10px] text-gray-400 ml-auto shrink-0">{step.model}</span>
                                      )}
                                    </div>
                                    {step.prompt && (
                                      <div>
                                        <p className="text-[10px] text-gray-500 font-medium mb-1">
                                          {language === 'es' ? 'PROMPT' : 'PROMPT'}
                                        </p>
                                        <pre className="text-[11px] text-gray-700 bg-white rounded-md px-3 py-2 border border-gray-200 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                                          <HighlightedText text={truncateAround(step.prompt, fc.fieldName, 500)} term={fc.fieldName} />
                                        </pre>
                                      </div>
                                    )}
                                    {step.response?.text && (
                                      <div>
                                        <p className="text-[10px] text-gray-500 font-medium mb-1">
                                          {language === 'es' ? 'RESPUESTA IA' : 'AI RESPONSE'}
                                        </p>
                                        <pre className="text-[11px] text-gray-700 bg-white rounded-md px-3 py-2 border border-gray-200 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                                          <HighlightedText text={truncateAround(step.response.text, fc.fieldName, 500)} term={fc.fieldName} />
                                        </pre>
                                      </div>
                                    )}
                                    {i < currentRelevant.length - 1 && <div className="border-t border-gray-200" />}
                                  </div>
                                ))}
                              </div>
                            </div>
                            );
                          })()}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MetaRow({ icon: Icon, label, value, bold }: { icon: typeof Hash; label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <Icon size={13} className="text-gray-400" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`text-sm pl-5 ${bold ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{value}</p>
    </div>
  );
}

function MockDocPlaceholder({ doc, language }: { doc: DocTestResult; language: 'es' | 'en' }) {
  return (
    <div className="h-full flex items-center justify-center bg-gray-100 p-8">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="w-20 h-3 bg-gray-200 rounded mb-2" />
            <div className="w-32 h-2 bg-gray-100 rounded" />
          </div>
          <div className="text-right">
            <p className="text-xs font-mono text-gray-500">{doc.docNumber}</p>
            <p className="text-xs text-gray-400">{doc.date}</p>
          </div>
        </div>
        <div className="border-t border-gray-100" />
        <div>
          <div className="w-16 h-2 bg-gray-100 rounded mb-1.5" />
          <p className="text-sm text-gray-700">{doc.supplier}</p>
        </div>
        <div className="space-y-2">
          {[40, 32, 36].map((w, i) => (
            <div key={i} className="flex justify-between">
              <div className={`w-${w} h-2 bg-gray-100 rounded`} style={{ width: `${w * 4}px` }} />
              <div className="w-16 h-2 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100" />
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-500 uppercase">Total</span>
          <span className="text-base font-semibold text-gray-900">
            {doc.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} {doc.currency}
          </span>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <FileText size={20} className="text-gray-300 mx-auto mb-1" />
          <p className="text-xs text-gray-400">
            {language === 'es' ? 'Vista previa no disponible' : 'Preview not available'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function TestRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();

  const { testRun: run, results: allResults, loading: detailLoading } = useTestRunDetail(id);

  const [activeTab, setActiveTab] = useState<DocType>('expense');
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocTestResult | null>(null);
  const reasonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (reasonRef.current && !reasonRef.current.contains(e.target as Node)) setShowReasonDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredResults = useMemo(() => {
    let docs = allResults.filter(d => d.docType === activeTab);
    if (search) {
      const q = search.toLowerCase();
      docs = docs.filter(d => d.docNumber.toLowerCase().includes(q) || d.supplier.toLowerCase().includes(q));
    }
    if (resultFilter === 'passed') docs = docs.filter(d => d.status === 'passed');
    if (resultFilter === 'failed') docs = docs.filter(d => d.status === 'failed');
    if (resultFilter === 'processing') docs = docs.filter(d => d.status === 'processing' || d.status === 'pending');
    if (reasonFilter !== 'all') docs = docs.filter(d => d.errorReasons.includes(reasonFilter));
    return docs;
  }, [allResults, activeTab, search, resultFilter, reasonFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<DocType, number> = { expense: 0, income: 0, payroll: 0, delivery_note: 0 };
    allResults.forEach(d => { counts[d.docType]++; });
    return counts;
  }, [allResults]);

  const tabFailCounts = useMemo(() => {
    const counts: Record<DocType, number> = { expense: 0, income: 0, payroll: 0, delivery_note: 0 };
    allResults.filter(d => d.status === 'failed').forEach(d => { counts[d.docType]++; });
    return counts;
  }, [allResults]);

  const allErrorReasons = useMemo(() => {
    const reasons = new Set<string>();
    allResults.filter(d => d.docType === activeTab).forEach(d => d.errorReasons.forEach(r => reasons.add(r)));
    return Array.from(reasons).sort();
  }, [allResults, activeTab]);

  if (detailLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Test run not found</p>
        <button onClick={() => navigate('/test')} className="mt-2 text-sm text-brand-500 hover:text-brand-600">
          {language === 'es' ? 'Volver a tests' : 'Back to tests'}
        </button>
      </div>
    );
  }

  const statusCfg = RUN_STATUS_CONFIG[run.status];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/test')} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900 truncate">{run.name}</h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`w-1.5 h-1.5 rounded-full ${
                run.status === 'completed' ? 'bg-green-500' :
                run.status === 'in_progress' ? 'bg-blue-500 animate-pulse' :
                run.status === 'failed' ? 'bg-red-500' : 'bg-gray-300'
              }`} />
              {language === 'es' ? statusCfg.labelEs : statusCfg.labelEn}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {run.datasetName} &middot; {run.totalDocs} docs &middot; {run.model}
            {run.duration && <> &middot; {run.duration}</>}
          </p>
        </div>
      </div>

      {/* Error banner */}
      {run.status === 'failed' && run._raw?.errorMessage && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">
              {language === 'es' ? 'Error en el test' : 'Test error'}
            </p>
            <p className="text-xs text-red-500 mt-0.5">{run._raw.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label={language === 'es' ? 'Progreso' : 'Progress'} value={`${run.progress}%`}
          sub={`${run.processedDocs}/${run.totalDocs}`} color="text-gray-900" />
        <StatCard label={language === 'es' ? 'Precision campos' : 'Field accuracy'} value={`${run.accuracy}%`}
          color={run.accuracy >= 90 ? 'text-green-600' : run.accuracy >= 75 ? 'text-yellow-600' : 'text-red-600'} />
        <StatCard label={language === 'es' ? 'Docs perfectos' : 'Perfect docs'}
          value={`${run._raw?.docAccuracy != null ? Math.round(run._raw.docAccuracy * 100) : 0}%`}
          sub={`${run.passedDocs}/${run.processedDocs}`}
          color={run.passedDocs === run.processedDocs ? 'text-green-600' : 'text-yellow-600'} />
        <StatCard label={language === 'es' ? 'Pasados' : 'Passed'} value={String(run.passedDocs)} color="text-green-600" />
        <StatCard label={language === 'es' ? 'Fallidos' : 'Failed'} value={String(run.failedDocs)} color="text-red-500" />
      </div>

      {/* Field accuracy breakdown */}
      {run._raw?.byField && Object.keys(run._raw.byField).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              {language === 'es' ? 'Precision por campo' : 'Accuracy by field'}
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-gray-100">
            {Object.entries(run._raw.byField).sort((a, b) => a[1].accuracy - b[1].accuracy).map(([field, stats]) => {
              const pct = Math.round(stats.accuracy);
              const color = pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-yellow-600' : 'text-red-600';
              const barColor = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-red-500';
              return (
                <div key={field} className="bg-white px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-700 truncate">{field}</span>
                    <span className={`text-xs font-medium tabular-nums ${color}`}>{pct}%</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">{stats.correct}/{stats.total}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress bar (if in progress) */}
      {run.status === 'in_progress' && (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400">
              {language === 'es' ? 'Procesando...' : 'Processing...'}
              {run._raw?.runStatus && <span className="ml-1 text-gray-300">({run._raw.runStatus})</span>}
            </span>
            <span className="text-[11px] font-medium text-gray-600 tabular-nums">{run.progress}%</span>
          </div>
          <div className="h-1 bg-gray-100 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${run.progress}%` }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {TAB_CONFIG.map(({ type, icon: Icon }) => {
            const isActive = activeTab === type;
            const count = tabCounts[type];
            const fails = tabFailCounts[type];
            return (
              <button
                key={type}
                onClick={() => { setActiveTab(type); setSearch(''); setResultFilter('all'); setReasonFilter('all'); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={15} />
                {DOC_TYPE_LABELS[type][language]}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
                {fails > 0 && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-red-50 text-red-500">{fails}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={language === 'es' ? 'Buscar por numero o proveedor...' : 'Search by number or supplier...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors" />
        </div>

        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          {([
            { value: 'all', labelEs: 'Todos', labelEn: 'All' },
            { value: 'passed', labelEs: 'OK', labelEn: 'Passed' },
            { value: 'failed', labelEs: 'Error', labelEn: 'Failed' },
            { value: 'processing', labelEs: 'Pendiente', labelEn: 'Pending' },
          ] as const).map(opt => (
            <button key={opt.value} onClick={() => setResultFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                resultFilter === opt.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}>
              {language === 'es' ? opt.labelEs : opt.labelEn}
            </button>
          ))}
        </div>

        {allErrorReasons.length > 0 && (
          <div className="relative" ref={reasonRef}>
            <button onClick={() => setShowReasonDropdown(!showReasonDropdown)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                reasonFilter !== 'all' ? 'border-brand-300 bg-brand-50 text-brand-600' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}>
              <Filter size={12} />
              {reasonFilter === 'all'
                ? (language === 'es' ? 'Tipo error' : 'Error type')
                : formatReasonLabel(reasonFilter)}
            </button>
            {showReasonDropdown && (
              <div className="absolute top-full mt-1 left-0 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                <button onClick={() => { setReasonFilter('all'); setShowReasonDropdown(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${reasonFilter === 'all' ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {language === 'es' ? 'Todos' : 'All'}
                </button>
                {allErrorReasons.map(reason => (
                  <button key={reason} onClick={() => { setReasonFilter(reason); setShowReasonDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${reasonFilter === reason ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getReasonColor(reason).dot}`} />
                    {formatReasonLabel(reason)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {filteredResults.length} {language === 'es' ? 'resultados' : 'results'}
        </span>
      </div>

      {/* Results table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Documento' : 'Document'}
              </th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Proveedor' : 'Supplier'}
              </th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Fecha' : 'Date'}
              </th>
              <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Importe' : 'Amount'}
              </th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Estado' : 'Status'}
              </th>
              <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Precision' : 'Accuracy'}
              </th>
              <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Campos' : 'Fields'}
              </th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                {language === 'es' ? 'Tipo error' : 'Error type'}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.slice(0, 100).map(doc => {
              const sCfg = DOC_STATUS_CONFIG[doc.status];
              const matchFields = doc.fieldComparisons.filter(f => f.result === 'match').length;
              const totalFields = doc.fieldComparisons.length;
              return (
                <tr key={doc.id} onClick={() => setSelectedDoc(doc)}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer group">
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-900">{doc.docNumber}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-gray-600 truncate block max-w-[160px]">{doc.supplier}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-gray-500">{doc.date}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {doc.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} {doc.currency}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        doc.status === 'passed' ? 'bg-green-500' :
                        doc.status === 'failed' ? 'bg-red-500' :
                        doc.status === 'processing' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                      }`} />
                      {language === 'es' ? sCfg.labelEs : sCfg.labelEn}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {doc.accuracy > 0 ? (
                      <span className={`text-sm tabular-nums font-medium ${
                        doc.accuracy >= 90 ? 'text-green-600' : doc.accuracy >= 75 ? 'text-yellow-600' : 'text-red-600'
                      }`}>{doc.accuracy}%</span>
                    ) : (
                      <span className="text-xs text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {doc.status === 'passed' || doc.status === 'failed' ? (
                      <span className="text-sm tabular-nums text-gray-500">
                        <span className="text-green-600">{matchFields}</span>
                        <span className="text-gray-300">/{totalFields}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1 max-w-[240px]">
                      {doc.errorReasons.slice(0, 3).map(reason => {
                        const rc = getReasonColor(reason);
                        return (
                          <span key={reason} className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded whitespace-nowrap ${rc.bg} ${rc.text}`}>
                            {formatReasonLabel(reason)}
                          </span>
                        );
                      })}
                      {doc.errorReasons.length > 3 && (
                        <span className="text-[10px] text-gray-300">+{doc.errorReasons.length - 3}</span>
                      )}
                      {doc.errorReasons.length === 0 && doc.status !== 'pending' && doc.status !== 'processing' && (
                        doc.status === 'passed'
                          ? <span className="text-[10px] text-green-400">OK</span>
                          : <span className="text-[11px] text-gray-300">&mdash;</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredResults.length === 0 && (
          <div className="px-4 py-12 text-center">
            <FileText size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{language === 'es' ? 'No se encontraron resultados' : 'No results found'}</p>
          </div>
        )}

        {filteredResults.length > 100 && (
          <div className="px-4 py-3 text-center border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {language === 'es' ? `Mostrando 100 de ${filteredResults.length} resultados` : `Showing 100 of ${filteredResults.length} results`}
            </p>
          </div>
        )}
      </div>

      {/* Document Drawer */}
      {selectedDoc && (
        <TestDocDrawer
          doc={selectedDoc}
          allDocs={filteredResults.slice(0, 100)}
          testRunId={run.id}
          onClose={() => setSelectedDoc(null)}
          onNavigate={d => setSelectedDoc(d)}
          language={language}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-300 mt-0.5 tabular-nums">{sub}</p>}
    </div>
  );
}
