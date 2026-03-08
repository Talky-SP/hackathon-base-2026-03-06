import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Receipt, Wallet, Truck, Users, Search,
  Filter, CheckCircle2, AlertCircle, FileText, Image,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTestQueue } from '../context/TestQueueContext';
import { MOCK_DATASETS, getDocumentsForDataset } from '../data/goldenMockData';
import { ERROR_CATEGORY_LABELS, DOC_TYPE_LABELS } from '../types/golden';
import type { DocType, ErrorCategory, GoldenDocument } from '../types/golden';

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

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 90 ? 'text-green-600 bg-green-50' : value >= 75 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded ${color}`}>
      {value.toFixed(0)}%
    </span>
  );
}

function CategoryBadge({ category, language }: { category: ErrorCategory; language: 'es' | 'en' }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded bg-red-50 text-red-600 whitespace-nowrap">
      {ERROR_CATEGORY_LABELS[category][language]}
    </span>
  );
}

export default function GoldenDatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { toggleItem, isInQueue } = useTestQueue();

  const dataset = MOCK_DATASETS.find(d => d.id === id);

  const allDocs = useMemo(() => {
    if (!id) return [];
    return getDocumentsForDataset(id);
  }, [id]);

  const [activeTab, setActiveTab] = useState<DocType>('expense');
  const [search, setSearch] = useState('');
  const [errorFilter, setErrorFilter] = useState<ErrorFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<ErrorCategory | 'all'>('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
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

  if (!dataset) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Dataset not found</p>
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
          <p className="text-sm text-gray-400">{dataset.totalDocs} {language === 'es' ? 'documentos' : 'documents'} &middot; {dataset.locationIds.length} locations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {TAB_CONFIG.map(({ type, icon: Icon }) => {
            const isActive = activeTab === type;
            const count = tabCounts[type];
            return (
              <button
                key={type}
                onClick={() => { setActiveTab(type); setSearch(''); setErrorFilter('all'); setCategoryFilter('all'); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={15} />
                {DOC_TYPE_LABELS[type][language]}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
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
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Documento' : 'Document'}
              </th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Proveedor' : 'Supplier'}
              </th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Fecha' : 'Date'}
              </th>
              <th className="text-right px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Importe' : 'Amount'}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Confianza' : 'Confidence'}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Estado' : 'Status'}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <Image size={13} className="inline -mt-0.5" />
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
                <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
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
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-900">{doc.docNumber}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-gray-600 truncate block max-w-[180px]">{doc.supplier}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-gray-500">{doc.date}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {doc.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} {doc.currency}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ConfidenceBadge value={doc.confidence} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {doc.hasErrors ? (
                      <AlertCircle size={16} className="text-red-400 mx-auto" />
                    ) : (
                      <CheckCircle2 size={16} className="text-green-400 mx-auto" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {doc.imageUrl ? (
                      <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 mx-auto flex items-center justify-center">
                        <Image size={12} className="text-gray-400" />
                      </div>
                    ) : (
                      <FileText size={14} className="text-gray-300 mx-auto" />
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
    </div>
  );
}
