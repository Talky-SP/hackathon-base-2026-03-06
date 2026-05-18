import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Receipt, Wallet, Truck, Users, Search,
  Filter, CheckCircle2, AlertCircle, FileText, Loader2, MapPin, Pin,
  Trash2, X, AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTestQueue } from '../context/TestQueueContext';
import { useDatasetDetail, useDeleteDataset } from '../hooks/useOcrTestingData';
import { getDocumentsForDataset } from '../data/goldenMockData';
import { authenticatedFetch } from '../services/authFetch';
import { config } from '../config/environment';
import {
  getDocumentFileUrl, parseDocDetailResponse,
  type DocType as ApiDocType,
} from '../services/docApiUrls';
import { ERROR_CATEGORY_LABELS, DOC_TYPE_LABELS } from '../types/golden';
import type { DocType, ErrorCategory, GoldenDocument } from '../types/golden';
import type { ApiDatasetDocument, ApiAnnotation } from '../services/ocrTestingApi';
import DocumentPreviewDrawer from '../components/golden/DocumentPreviewDrawer';

type ErrorFilter = 'all' | 'with_errors' | 'no_errors';

const TAB_CONFIG: { type: DocType; icon: typeof Receipt }[] = [
  { type: 'expense', icon: Receipt },
  { type: 'income', icon: Wallet },
  { type: 'payroll', icon: Users },
  { type: 'delivery_note', icon: Truck },
];

function DocCheckbox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
        checked ? 'bg-brand-500 border-brand-500' : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function CategoryBadge({ category, language }: { category: ErrorCategory; language: 'es' | 'en' }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded bg-red-50 text-red-600 whitespace-nowrap">
      {ERROR_CATEGORY_LABELS[category][language]}
    </span>
  );
}

// Map API document to local GoldenDocument for display
function apiDocToGoldenDoc(d: ApiDatasetDocument, datasetId: string): GoldenDocument {
  const docType = (d.documentType as DocType) ?? 'expense';
  // categoryDate format: "SUMINISTROS#2026-01-22#uuid"
  const parts = d.categoryDate.split('#');
  // Extract date (second part) and category (first part)
  const category = parts[0] ?? '';
  const date = parts.length > 1 ? parts[1] : '';
  const docId = parts.length > 2 ? parts[2]?.substring(0, 8) : '';
  return {
    id: `${d.locationId}||${d.SK || d.categoryDate}`,
    datasetId,
    docType,
    docNumber: `${category}${docId ? ` #${docId}` : ''}`,
    supplier: d.companyCif || d.locationId,
    date,
    totalAmount: 0,
    currency: 'EUR',
    hasErrors: false,
    errorCategories: [],
    humanChecked: false,
    confidence: 0,
  };
}

// Map golden docType to API doc type for detail URL
function toApiDocType(dt: DocType): ApiDocType {
  switch (dt) {
    case 'expense': return 'expenses';
    case 'income': return 'income-invoices';
    case 'payroll': return 'payrolls';
    case 'delivery_note': return 'delivery-notes';
  }
}

// Build the detail URL for a dataset document using the same pattern as the annotation page
function getDocDetailUrlForDatasetDoc(apiDoc: ApiDatasetDocument): string {
  const locId = apiDoc.locationId;
  const catDate = apiDoc.categoryDate;
  switch (apiDoc.documentType) {
    case 'expense':
      return `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${locId}?categoryDate=${encodeURIComponent(catDate)}`;
    case 'income':
      return `${config.talkyCombinedMetricsBaseUrl}/users/${locId}/invoice-incomes?categoryDate=${encodeURIComponent(catDate)}`;
    case 'payroll':
      return `${config.talkyPayrollsSearchBaseUrl}/locations/${locId}/payrolls?categoryDate=${encodeURIComponent(catDate)}`;
    case 'delivery_note':
      return `${config.talkyDeliveryNotesBaseUrl}/delivery-notes-get/${locId}?categoryDate=${encodeURIComponent(catDate)}`;
    default:
      return `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${locId}?categoryDate=${encodeURIComponent(catDate)}`;
  }
}

export default function GoldenDatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { toggleItem, isInQueue } = useTestQueue();

  const { dataset, documents: apiDocs, loading, error } = useDatasetDetail(id);
  const { deleteDataset, loading: deletingDataset, error: deleteError } = useDeleteDataset();

  // Convert API documents to local format, fall back to mock if no API docs
  const allDocs = useMemo(() => {
    if (apiDocs.length > 0 && id) {
      return apiDocs.map(d => apiDocToGoldenDoc(d, id));
    }
    if (!id) return [];
    return getDocumentsForDataset(id);
  }, [apiDocs, id]);

  // Keep a map from doc.id -> API document for annotation lookup
  const apiDocMap = useMemo(() => {
    const map = new Map<string, ApiDatasetDocument>();
    apiDocs.forEach(d => {
      const key = `${d.locationId}||${d.SK || d.categoryDate}`;
      map.set(key, d);
    });
    return map;
  }, [apiDocs]);

  const [activeTab, setActiveTab] = useState<DocType>('expense');
  const [search, setSearch] = useState('');
  const [errorFilter, setErrorFilter] = useState<ErrorFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<ErrorCategory | 'all'>('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<GoldenDocument | null>(null);
  const [annotationLoading, setAnnotationLoading] = useState(false);
  const [annotationData, setAnnotationData] = useState<ApiAnnotation | null>(null);
  const [pinnedDocs, setPinnedDocs] = useState<GoldenDocument[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const pinnedAnnotations = useRef<Map<string, Record<string, unknown>>>(new Map());
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch document detail (images, amounts) when a document is selected
  const handleSelectDoc = useCallback(async (doc: GoldenDocument) => {
    setSelectedDoc(doc);
    setAnnotationData(null);

    const apiDoc = apiDocMap.get(doc.id);
    if (!apiDoc) return;

    setAnnotationLoading(true);
    try {
      const url = getDocDetailUrlForDatasetDoc(apiDoc);
      const res = await authenticatedFetch(url);
      const data = await res.json();
      const apiDocType = toApiDocType(doc.docType);
      const detail = parseDocDetailResponse(apiDocType, data);

      if (detail) {
        setAnnotationData(detail);
        // Cache annotation for pinned docs
        if (pinnedDocs.some(p => p.id === doc.id)) {
          pinnedAnnotations.current.set(doc.id, detail);
        }
        const fileUrl = getDocumentFileUrl(detail);
        // Safely extract primitive values (some fields may be objects)
        const safeStr = (v: unknown) => (typeof v === 'string' ? v : '');
        const safeNum = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) || 0 : 0);
        setSelectedDoc(prev => prev ? {
          ...prev,
          supplier: safeStr(detail.supplier) || prev.supplier,
          docNumber: safeStr(detail.invoice_number) || safeStr(detail.delivery_note_number) || prev.docNumber,
          date: safeStr(detail.invoice_date) || safeStr(detail.delivery_note_date) || safeStr(detail.payroll_date) || prev.date,
          totalAmount: safeNum(detail.total) || prev.totalAmount,
          currency: safeStr(detail.currency) || prev.currency,
          imageUrl: fileUrl,
        } : prev);
      }
    } catch (err) {
      console.warn('Failed to fetch document detail:', err);
    } finally {
      setAnnotationLoading(false);
    }
  }, [apiDocMap, pinnedDocs]);

  const handlePin = useCallback((doc: GoldenDocument) => {
    setPinnedDocs(prev => {
      if (prev.some(d => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    if (annotationData) {
      pinnedAnnotations.current.set(doc.id, annotationData as Record<string, unknown>);
    }
  }, [annotationData]);

  const handleUnpin = useCallback((docId: string) => {
    setPinnedDocs(prev => prev.filter(d => d.id !== docId));
    pinnedAnnotations.current.delete(docId);
  }, []);

  // When navigating to a pinned doc, restore its cached annotation
  const handleNavigatePinned = useCallback((doc: GoldenDocument) => {
    const cached = pinnedAnnotations.current.get(doc.id);
    if (cached) {
      setSelectedDoc(doc);
      setAnnotationData(cached as ApiAnnotation);
      setAnnotationLoading(false);
    } else {
      handleSelectDoc(doc);
    }
  }, [handleSelectDoc]);

  const filteredDocs = useMemo(() => {
    let docs = allDocs.filter(d => d.docType === activeTab);

    if (search) {
      const q = search.toLowerCase();
      docs = docs.filter(d =>
        d.docNumber.toLowerCase().includes(q) ||
        d.supplier.toLowerCase().includes(q)
      );
    }

    if (errorFilter === 'with_errors') docs = docs.filter(d => d.hasErrors);
    if (errorFilter === 'no_errors') docs = docs.filter(d => !d.hasErrors);

    if (categoryFilter !== 'all') {
      docs = docs.filter(d => d.errorCategories.includes(categoryFilter));
    }

    return docs;
  }, [allDocs, activeTab, search, errorFilter, categoryFilter]);

  const allErrorCategories = useMemo(() => {
    const cats = new Set<ErrorCategory>();
    allDocs.filter(d => d.docType === activeTab).forEach(d => d.errorCategories.forEach(c => cats.add(c)));
    return Array.from(cats);
  }, [allDocs, activeTab]);

  const tabCounts = useMemo(() => {
    const counts: Record<DocType, number> = { expense: 0, income: 0, payroll: 0, delivery_note: 0 };
    allDocs.forEach(d => { counts[d.docType]++; });
    return counts;
  }, [allDocs]);

  const handleDeleteDataset = async () => {
    if (!dataset) return;
    try {
      await deleteDataset(dataset.id);
      navigate('/golden-dataset');
    } catch {
      // Error is rendered in the modal.
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">{error ?? 'Dataset not found'}</p>
        <button onClick={() => navigate('/golden-dataset')} className="mt-2 text-sm text-brand-500 hover:text-brand-600">
          {language === 'es' ? 'Volver a datasets' : 'Back to datasets'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/golden-dataset')}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 truncate">{dataset.name}</h1>
          <p className="text-sm text-gray-400">
            {dataset.totalDocs} {language === 'es' ? 'documentos' : 'documents'}
            {(dataset.locationCount ?? dataset.locationIds.length) > 0 && (
              <> &middot; <MapPin size={12} className="inline -mt-0.5" /> {dataset.locationCount ?? dataset.locationIds.length} locations</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-red-100 bg-white text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
        >
          <Trash2 size={14} />
          {language === 'es' ? 'Eliminar' : 'Delete'}
        </button>
      </div>

      {showDeleteModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={deletingDataset ? undefined : () => setShowDeleteModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3 px-6 py-5 border-b border-gray-100">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <AlertTriangle size={17} className="text-red-500" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900">
                    {language === 'es' ? 'Eliminar dataset' : 'Delete dataset'}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {language === 'es'
                      ? 'Volveras a la lista cuando se complete el borrado.'
                      : 'You will return to the list when deletion completes.'}
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingDataset}
                  className="ml-auto p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
                >
                  <X size={16} className="text-gray-400" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{dataset.name}</p>
                  <p className="text-xs text-gray-400 mt-1 truncate">{dataset.description || dataset.id}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[11px] text-gray-400">Docs</p>
                      <p className="text-sm font-semibold text-gray-900 tabular-nums">{dataset.totalDocs}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400">Locations</p>
                      <p className="text-sm font-semibold text-gray-900 tabular-nums">{dataset.locationCount ?? dataset.locationIds.length}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400">{language === 'es' ? 'Miembros' : 'Members'}</p>
                      <p className="text-sm font-semibold text-gray-900 tabular-nums">{apiDocs.length || dataset.totalDocs}</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs leading-5 text-gray-500">
                  {language === 'es'
                    ? 'Se elimina el dataset y sus relaciones con documentos. Las anotaciones originales se conservan.'
                    : 'The dataset and document membership are removed. Original annotations are preserved.'}
                </p>

                {deleteError && (
                  <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-xs text-red-600">{deleteError}</p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingDataset}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
                >
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={handleDeleteDataset}
                  disabled={deletingDataset}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {deletingDataset ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {language === 'es' ? 'Eliminar dataset' : 'Delete dataset'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {TAB_CONFIG.map(({ type, icon: Icon }) => {
          const count = tabCounts[type];
          return (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                activeTab === type
                  ? 'border-brand-300 bg-brand-50/50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <Icon size={16} className={activeTab === type ? 'text-brand-500' : 'text-gray-400'} />
              <div className="text-left">
                <p className="text-xs text-gray-500">{DOC_TYPE_LABELS[type][language]}</p>
                <p className="text-lg font-semibold text-gray-900">{count}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'es' ? 'Buscar por numero o proveedor...' : 'Search by number or supplier...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
          />
        </div>

        {/* Error filter toggles */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          {([
            { value: 'all', labelEs: 'Todos', labelEn: 'All' },
            { value: 'with_errors', labelEs: 'Con errores', labelEn: 'With errors' },
            { value: 'no_errors', labelEs: 'Sin errores', labelEn: 'No errors' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setErrorFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                errorFilter === opt.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {language === 'es' ? opt.labelEs : opt.labelEn}
            </button>
          ))}
        </div>

        {/* Category filter */}
        {allErrorCategories.length > 0 && (
          <div className="relative" ref={categoryRef}>
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                categoryFilter !== 'all'
                  ? 'border-brand-300 bg-brand-50 text-brand-600'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Filter size={12} />
              {categoryFilter === 'all'
                ? (language === 'es' ? 'Categoria' : 'Category')
                : ERROR_CATEGORY_LABELS[categoryFilter][language]
              }
            </button>
            {showCategoryDropdown && (
              <div className="absolute top-full mt-1 left-0 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => { setCategoryFilter('all'); setShowCategoryDropdown(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    categoryFilter === 'all' ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {language === 'es' ? 'Todas' : 'All'}
                </button>
                {allErrorCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      categoryFilter === cat ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {ERROR_CATEGORY_LABELS[cat][language]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {filteredDocs.length} {language === 'es' ? 'resultados' : 'results'}
        </span>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-10 px-4 py-3" />
              <th className="w-8 px-1 py-3" />
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Documento' : 'Document'}
              </th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Proveedor / Location' : 'Supplier / Location'}
              </th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Fecha' : 'Date'}
              </th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Tipo' : 'Type'}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Estado' : 'Status'}
              </th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Errores' : 'Errors'}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.slice(0, 100).map(doc => {
              const inQueue = isInQueue(doc.id);
              return (
                <tr key={doc.id} onClick={() => handleSelectDoc(doc)} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group cursor-pointer">
                  <td className="px-4 py-2.5">
                    <DocCheckbox
                      checked={inQueue}
                      onToggle={() => toggleItem({
                        type: 'document',
                        id: doc.id,
                        label: doc.docNumber,
                        sublabel: doc.supplier,
                        docCount: 1,
                      })}
                    />
                  </td>
                  <td className="px-1 py-2.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (pinnedDocs.some(p => p.id === doc.id)) {
                          handleUnpin(doc.id);
                        } else {
                          handlePin(doc);
                        }
                      }}
                      className={`p-1 rounded transition-colors ${
                        pinnedDocs.some(p => p.id === doc.id)
                          ? 'text-brand-500 bg-brand-50'
                          : 'text-gray-300 hover:text-gray-400 opacity-0 group-hover:opacity-100'
                      }`}
                      title={pinnedDocs.some(p => p.id === doc.id)
                        ? (language === 'es' ? 'Desfijar' : 'Unpin')
                        : (language === 'es' ? 'Fijar' : 'Pin')
                      }
                    >
                      <Pin size={13} className={pinnedDocs.some(p => p.id === doc.id) ? 'fill-current' : ''} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-900 font-mono">{doc.docNumber}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-gray-600 truncate block max-w-[200px]">{doc.supplier}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-gray-500">{doc.date}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded bg-gray-100 text-gray-600">
                      {DOC_TYPE_LABELS[doc.docType]?.[language] ?? doc.docType}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {doc.hasErrors ? (
                      <AlertCircle size={16} className="text-red-400 mx-auto" />
                    ) : (
                      <CheckCircle2 size={16} className="text-green-400 mx-auto" />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {doc.errorCategories.map(cat => (
                        <CategoryBadge key={cat} category={cat} language={language} />
                      ))}
                      {!doc.hasErrors && (
                        <span className="text-[11px] text-gray-300">&mdash;</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredDocs.length === 0 && (
          <div className="px-4 py-12 text-center">
            <FileText size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {language === 'es' ? 'No se encontraron documentos' : 'No documents found'}
            </p>
          </div>
        )}

        {filteredDocs.length > 100 && (
          <div className="px-4 py-3 text-center border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {language === 'es'
                ? `Mostrando 100 de ${filteredDocs.length} documentos`
                : `Showing 100 of ${filteredDocs.length} documents`
              }
            </p>
          </div>
        )}
      </div>

      {/* Document Preview Drawer */}
      {selectedDoc && (
        <DocumentPreviewDrawer
          doc={selectedDoc}
          allDocs={filteredDocs.slice(0, 100)}
          onClose={() => { setSelectedDoc(null); setAnnotationData(null); }}
          onNavigate={handleSelectDoc}
          annotationLoading={annotationLoading}
          annotationData={annotationData}
          pinnedDocs={pinnedDocs}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onNavigatePinned={handleNavigatePinned}
        />
      )}
    </div>
  );
}
