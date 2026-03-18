import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle,
  FileText, Calendar, Building2, Hash, DollarSign, ShieldCheck, Tag, Loader2, Pin,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ERROR_CATEGORY_LABELS, DOC_TYPE_LABELS } from '../../types/golden';
import type { GoldenDocument } from '../../types/golden';
import DocumentViewer from '../annotation/DocumentViewer';
import type { UploadedFile } from '../annotation/FileUploadZone';
import type { ViewerState } from '../annotation/ViewerToolbar';
import ViewerToolbar from '../annotation/ViewerToolbar';

interface Props {
  doc: GoldenDocument;
  allDocs: GoldenDocument[];
  onClose: () => void;
  onNavigate: (doc: GoldenDocument) => void;
  annotationLoading?: boolean;
  annotationData?: Record<string, unknown> | null;
  pinnedDocs?: GoldenDocument[];
  onPin?: (doc: GoldenDocument) => void;
  onUnpin?: (docId: string) => void;
  onNavigatePinned?: (doc: GoldenDocument) => void;
}

function proxyS3Url(url: string): string {
  return url
    .replace('https://talky-invoice-v2-dev-6136.s3.amazonaws.com', '/s3-dev')
    .replace('https://talky-invoice-v2-prod-6136.s3.amazonaws.com', '/s3-prod');
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|tiff?)(\?|$)/i;

function detectFileType(url: string): { type: 'pdf' | 'image'; validatedType: string } {
  if (IMAGE_EXTENSIONS.test(url)) {
    const ext = url.match(IMAGE_EXTENSIONS)?.[1]?.toLowerCase() ?? 'png';
    return { type: 'image', validatedType: ext };
  }
  return { type: 'pdf', validatedType: 'pdf' };
}

function createUploadedFile(doc: GoldenDocument): UploadedFile | null {
  if (!doc.imageUrl) return null;
  const proxiedUrl = proxyS3Url(doc.imageUrl);
  const { type, validatedType } = detectFileType(doc.imageUrl);
  return {
    id: doc.id,
    file: new File([], doc.docNumber, { type: type === 'image' ? 'image/jpeg' : 'application/pdf' }),
    type,
    validatedType,
    url: proxiedUrl,
    preview: type === 'image' ? proxiedUrl : undefined,
  };
}

function MockInvoicePlaceholder({ doc }: { doc: GoldenDocument }) {
  const { language } = useLanguage();
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
          <div className="flex justify-between"><div className="w-40 h-2 bg-gray-100 rounded" /><div className="w-16 h-2 bg-gray-100 rounded" /></div>
          <div className="flex justify-between"><div className="w-32 h-2 bg-gray-100 rounded" /><div className="w-12 h-2 bg-gray-100 rounded" /></div>
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

// Safely format a value for display — skip objects/arrays
function formatFieldValue(val: unknown): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (typeof val === 'boolean') return val ? 'Si' : 'No';
  return null; // skip objects/arrays
}

// Extract key fields from annotation data for display
function extractAnnotationFields(data: Record<string, unknown>): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  const fieldMap: Record<string, string> = {
    supplier: 'Proveedor',
    invoice_number: 'N Factura',
    invoice_date: 'Fecha',
    total: 'Total',
    subtotal: 'Subtotal',
    tax_amount: 'Impuestos',
    tax_rate: 'Tipo IVA',
    currency: 'Moneda',
    category: 'Categoria',
    payment_method: 'Metodo pago',
    description: 'Descripcion',
    employee_name: 'Empleado',
    employee_nif: 'NIF Empleado',
  };

  for (const [key, label] of Object.entries(fieldMap)) {
    const formatted = formatFieldValue(data[key]);
    if (formatted) {
      fields.push({ label, value: formatted });
    }
  }
  return fields;
}

export default function DocumentPreviewDrawer({ doc, allDocs, onClose, onNavigate, annotationLoading, annotationData, pinnedDocs = [], onPin, onUnpin, onNavigatePinned }: Props) {
  const { language } = useLanguage();
  const isPinned = pinnedDocs.some(d => d.id === doc.id);

  const currentIndex = allDocs.findIndex(d => d.id === doc.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allDocs.length - 1;

  const uploadedFile = useMemo(() => createUploadedFile(doc), [doc]);

  const [viewerState, setViewerState] = useState<ViewerState>({
    zoom: 0.9,
    rotation: 0,
    fitMode: 'none',
    currentPage: 1,
    totalPages: 1,
    bboxMode: 2,
  });
  const [displayZoom, setDisplayZoom] = useState(0.9);

  const handleViewerStateChange = useCallback((partial: Partial<ViewerState>) => {
    setViewerState(prev => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(allDocs[currentIndex - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(allDocs[currentIndex + 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hasPrev, hasNext, currentIndex, allDocs, onNavigate]);

  const annotationFields = useMemo(
    () => annotationData ? extractAnnotationFields(annotationData as Record<string, unknown>) : [],
    [annotationData],
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-[900px] max-w-[92vw] bg-white z-50 shadow-2xl flex flex-col border-l border-gray-200">
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
            {onPin && onUnpin && (
              <button
                onClick={() => isPinned ? onUnpin(doc.id) : onPin(doc)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isPinned
                    ? 'text-brand-500 bg-brand-50 hover:bg-brand-100'
                    : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'
                }`}
                title={isPinned
                  ? (language === 'es' ? 'Desfijar' : 'Unpin')
                  : (language === 'es' ? 'Fijar documento' : 'Pin document')
                }
              >
                <Pin size={14} className={isPinned ? 'fill-current' : ''} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => hasPrev && onNavigate(allDocs[currentIndex - 1])}
              disabled={!hasPrev}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <span className="text-xs text-gray-400 tabular-nums px-1">
              {currentIndex + 1} / {allDocs.length}
            </span>
            <button
              onClick={() => hasNext && onNavigate(allDocs[currentIndex + 1])}
              disabled={!hasNext}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Pinned tabs */}
        {pinnedDocs.length > 0 && (
          <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-100 bg-gray-50/50 shrink-0 overflow-x-auto">
            {pinnedDocs.map(p => {
              const isActive = p.id === doc.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onNavigatePinned?.(p)}
                  className={`group/tab flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-md text-xs font-medium transition-colors max-w-[180px] ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:bg-white/80 hover:text-gray-700'
                  }`}
                >
                  <Pin size={10} className={`shrink-0 ${isActive ? 'text-brand-500 fill-current' : 'text-gray-400'}`} />
                  <span className="truncate">{p.docNumber}</span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); onUnpin?.(p.id); }}
                    className={`shrink-0 p-0.5 rounded hover:bg-gray-200 transition-colors ${
                      isActive ? 'text-gray-400' : 'text-gray-300 opacity-0 group-hover/tab:opacity-100'
                    }`}
                  >
                    <X size={10} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          {/* Viewer area */}
          <div className="flex-1 flex flex-col min-w-0">
            {annotationLoading && (
              <div className="flex items-center justify-center py-4 border-b border-gray-100">
                <Loader2 size={16} className="animate-spin text-gray-300 mr-2" />
                <span className="text-xs text-gray-400">
                  {language === 'es' ? 'Cargando documento...' : 'Loading document...'}
                </span>
              </div>
            )}
            {uploadedFile && (
              <div className="shrink-0 border-b border-gray-100">
                <ViewerToolbar
                  viewerState={viewerState}
                  displayZoom={displayZoom}
                  onViewerStateChange={handleViewerStateChange}
                  isPdf={uploadedFile.type === 'pdf'}
                />
              </div>
            )}
            <div className="flex-1 min-h-0">
              {uploadedFile ? (
                <DocumentViewer
                  file={uploadedFile}
                  zoom={viewerState.zoom}
                  rotation={viewerState.rotation}
                  fitMode={viewerState.fitMode}
                  currentPage={viewerState.currentPage}
                  bboxMode={viewerState.bboxMode}
                  onTotalPagesChange={(total) => handleViewerStateChange({ totalPages: total })}
                  onZoomChange={(zoom) => handleViewerStateChange({ zoom })}
                  onDisplayZoomChange={setDisplayZoom}
                  onCurrentPageChange={(page) => handleViewerStateChange({ currentPage: page })}
                />
              ) : (
                <MockInvoicePlaceholder doc={doc} />
              )}
            </div>
          </div>

          {/* Metadata panel */}
          <div className="w-72 shrink-0 border-l border-gray-100 overflow-y-auto">
            <div className="p-4 space-y-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Detalles' : 'Details'}
              </h3>

              <MetadataRow icon={Hash} label={language === 'es' ? 'Numero' : 'Number'} value={doc.docNumber} />
              <MetadataRow icon={Building2} label={language === 'es' ? 'Proveedor' : 'Supplier'} value={doc.supplier} />
              <MetadataRow icon={Calendar} label={language === 'es' ? 'Fecha' : 'Date'} value={doc.date} />
              <MetadataRow
                icon={DollarSign}
                label={language === 'es' ? 'Importe' : 'Amount'}
                value={doc.totalAmount ? `${doc.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}${typeof doc.currency === 'string' && doc.currency ? ` ${doc.currency}` : ' EUR'}` : '-'}
                bold
              />
              <MetadataRow icon={FileText} label={language === 'es' ? 'Tipo' : 'Type'} value={DOC_TYPE_LABELS[doc.docType][language]} />

              {/* Annotation fields from API */}
              {annotationFields.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                    {language === 'es' ? 'Datos del documento' : 'Document data'}
                  </h3>
                  <div className="space-y-2.5">
                    {annotationFields.map(f => (
                      <div key={f.label}>
                        <p className="text-[11px] text-gray-400">{f.label}</p>
                        <p className="text-sm text-gray-700 font-medium">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{language === 'es' ? 'Confianza' : 'Confidence'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        doc.confidence >= 90 ? 'bg-green-500' : doc.confidence >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${doc.confidence}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 tabular-nums">{doc.confidence.toFixed(0)}%</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-2">
                  {doc.hasErrors ? (
                    <AlertCircle size={14} className="text-red-400" />
                  ) : (
                    <CheckCircle2 size={14} className="text-green-400" />
                  )}
                  <span className="text-xs text-gray-500">{language === 'es' ? 'Estado' : 'Status'}</span>
                </div>
                <p className="text-sm text-gray-700">
                  {doc.hasErrors
                    ? (language === 'es' ? 'Con errores' : 'Has errors')
                    : (language === 'es' ? 'Sin errores' : 'No errors')
                  }
                </p>
                {doc.humanChecked && (
                  <p className="text-xs text-green-600 mt-1">
                    {language === 'es' ? 'Verificado por humano' : 'Human verified'}
                  </p>
                )}
              </div>

              {doc.errorCategories.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {language === 'es' ? 'Categorias de error' : 'Error categories'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {doc.errorCategories.map(cat => (
                      <span key={cat} className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded bg-red-50 text-red-600">
                        {ERROR_CATEGORY_LABELS[cat][language]}
                      </span>
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

function MetadataRow({ icon: Icon, label, value, bold }: {
  icon: typeof Hash;
  label: string;
  value: string;
  bold?: boolean;
}) {
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
