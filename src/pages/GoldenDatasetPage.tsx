import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, Search, FileText, Receipt, Wallet, Truck, MapPin,
  Plus, ChevronDown, X, Loader2, Sparkles,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTestQueue } from '../context/TestQueueContext';
import { ERROR_CATEGORY_LABELS } from '../types/golden';
import type { GoldenDataset, ErrorCategory } from '../types/golden';
import MiniSparkline from '../components/golden/MiniSparkline';
import { useDatasets, useSeedDataset } from '../hooks/useOcrTestingData';
import { useLocations } from '../hooks/useLocations';

type FilterType = 'all' | 'expenses' | 'income' | 'payrolls' | 'delivery_notes';

const FILTER_OPTIONS: { value: FilterType; labelEs: string; labelEn: string }[] = [
  { value: 'all', labelEs: 'Todos', labelEn: 'All' },
  { value: 'expenses', labelEs: 'Gastos', labelEn: 'Expenses' },
  { value: 'income', labelEs: 'Ingresos', labelEn: 'Income' },
  { value: 'payrolls', labelEs: 'Nominas', labelEn: 'Payrolls' },
  { value: 'delivery_notes', labelEs: 'Albaranes', labelEn: 'Delivery Notes' },
];

function ErrorCategoryBadge({ category, language }: { category: ErrorCategory; language: 'es' | 'en' }) {
  const label = ERROR_CATEGORY_LABELS[category][language];
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded bg-gray-100 text-gray-600 whitespace-nowrap">
      {label}
    </span>
  );
}

function DatasetCheckbox({ dataset, selected, onToggle }: {
  dataset: GoldenDataset;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
        selected
          ? 'bg-brand-500 border-brand-500'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      {selected && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ─── Seed Dataset Modal ───────────────────────────────────────────────────

function SeedDatasetModal({ onClose, onSuccess, language }: {
  onClose: () => void;
  onSuccess: () => void;
  language: 'es' | 'en';
}) {
  const { locations, loading: locsLoading } = useLocations();
  const { seed, loading: seeding, error: seedError } = useSeedDataset();

  const [locationId, setLocationId] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [docTypes, setDocTypes] = useState<string[]>(['expense']);
  const [limit, setLimit] = useState(30);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [success, setSuccess] = useState<{ datasetId: string; count: number } | null>(null);

  const toggleDocType = (dt: string) => {
    setDocTypes(prev => prev.includes(dt) ? prev.filter(t => t !== dt) : [...prev, dt]);
  };

  const handleSeed = async () => {
    if (!locationId) return;
    try {
      const res = await seed({
        locationId,
        documentTypes: docTypes.length > 0 ? docTypes : undefined,
        limit,
        datasetName: datasetName || undefined,
        filterDateFrom: dateFrom || undefined,
        filterDateTo: dateTo || undefined,
      });
      setSuccess({ datasetId: res.datasetId, count: res.annotations });
    } catch {
      // error handled by hook
    }
  };

  const DOC_TYPE_OPTIONS = [
    { value: 'expense', labelEs: 'Gastos', labelEn: 'Expenses' },
    { value: 'income', labelEs: 'Ingresos', labelEn: 'Income' },
    { value: 'payroll', labelEs: 'Nominas', labelEn: 'Payrolls' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <Sparkles size={16} className="text-brand-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {language === 'es' ? 'Crear Dataset Sintetico' : 'Create Synthetic Dataset'}
                </h2>
                <p className="text-xs text-gray-400">
                  {language === 'es' ? 'Genera un dataset desde documentos reales' : 'Generate a dataset from real documents'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          {success ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <Database size={20} className="text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {language === 'es' ? 'Dataset creado correctamente' : 'Dataset created successfully'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {success.count} {language === 'es' ? 'documentos incluidos' : 'documents included'}
                </p>
              </div>
              <button
                onClick={() => { onSuccess(); onClose(); }}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {language === 'es' ? 'Ver dataset' : 'View dataset'}
              </button>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Location *
                </label>
                {locsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <Loader2 size={14} className="animate-spin" />
                    {language === 'es' ? 'Cargando locations...' : 'Loading locations...'}
                  </div>
                ) : (
                  <select
                    value={locationId}
                    onChange={e => setLocationId(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                  >
                    <option value="" className="text-gray-500">{language === 'es' ? 'Seleccionar location...' : 'Select location...'}</option>
                    {locations.map(loc => (
                      <option key={loc.locationId} value={loc.locationId} className="text-gray-900">
                        {loc.locationName || loc.locationId}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Dataset name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {language === 'es' ? 'Nombre del dataset' : 'Dataset name'}
                </label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={e => setDatasetName(e.target.value)}
                  placeholder={language === 'es' ? 'Nombre (opcional, se genera automaticamente)' : 'Name (optional, auto-generated)'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                />
              </div>

              {/* Document types */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {language === 'es' ? 'Tipos de documento' : 'Document types'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {DOC_TYPE_OPTIONS.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => toggleDocType(dt.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        docTypes.includes(dt.value)
                          ? 'bg-brand-50 border-brand-300 text-brand-600'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {language === 'es' ? dt.labelEs : dt.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Limit */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {language === 'es' ? 'Max documentos por tipo' : 'Max docs per type'}
                </label>
                <input
                  type="number"
                  value={limit}
                  onChange={e => setLimit(Math.min(200, Math.max(1, Number(e.target.value))))}
                  min={1}
                  max={200}
                  className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 tabular-nums"
                />
                <span className="ml-2 text-xs text-gray-400">max 200</span>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    {language === 'es' ? 'Desde' : 'From'}
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    {language === 'es' ? 'Hasta' : 'To'}
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                  />
                </div>
              </div>

              {/* Error */}
              {seedError && (
                <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-xs text-red-600">{seedError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={handleSeed}
                  disabled={!locationId || seeding}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {seeding && <Loader2 size={14} className="animate-spin" />}
                  {language === 'es' ? 'Crear Dataset' : 'Create Dataset'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function GoldenDatasetPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toggleItem, isInQueue } = useTestQueue();
  const { datasets: allDatasets, loading, refetch } = useDatasets();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);

  const datasets = useMemo(() => {
    let result = allDatasets;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
      );
    }

    if (filter !== 'all') {
      result = result.filter(d => {
        switch (filter) {
          case 'expenses': return d.expenseDocs > 0;
          case 'income': return d.incomeDocs > 0;
          case 'payrolls': return d.payrollDocs > 0;
          case 'delivery_notes': return d.deliveryNoteDocs > 0;
          default: return true;
        }
      });
    }

    return result;
  }, [allDatasets, search, filter]);

  const activeFilter = FILTER_OPTIONS.find(f => f.value === filter)!;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('golden.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('golden.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowSeedModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          {language === 'es' ? 'Nuevo Dataset' : 'New Dataset'}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'es' ? 'Buscar datasets...' : 'Search datasets...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <span className="text-gray-600">
              {language === 'es' ? activeFilter.labelEs : activeFilter.labelEn}
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {showFilterDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
              <div className="absolute top-full mt-1 left-0 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilter(opt.value); setShowFilterDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      filter === opt.value ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {language === 'es' ? opt.labelEs : opt.labelEn}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-10 px-4 py-3" />
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Dataset' : 'Dataset'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <FileText size={13} className="inline mr-1 -mt-0.5" />
                  {language === 'es' ? 'Docs' : 'Docs'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Receipt size={13} className="inline mr-1 -mt-0.5" />
                  {language === 'es' ? 'Gastos' : 'Expenses'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Wallet size={13} className="inline mr-1 -mt-0.5" />
                  {language === 'es' ? 'Ingresos' : 'Income'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Nominas' : 'Payrolls'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Truck size={13} className="inline mr-1 -mt-0.5" />
                  {language === 'es' ? 'Albaranes' : 'D. Notes'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <MapPin size={13} className="inline mr-1 -mt-0.5" />
                  Locations
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Evolucion' : 'Evolution'}
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Categorias' : 'Categories'}
                </th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((ds) => {
                const inQueue = isInQueue(ds.id);
                return (
                  <tr
                    key={ds.id}
                    onClick={() => navigate(`/golden-dataset/${ds.id}`)}
                    className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <DatasetCheckbox
                        dataset={ds}
                        selected={inQueue}
                        onToggle={() => toggleItem({
                          type: 'dataset',
                          id: ds.id,
                          label: ds.name,
                          sublabel: `${ds.totalDocs} docs`,
                          docCount: ds.totalDocs,
                        })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Database size={14} className="text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{ds.name}</p>
                          <p className="text-xs text-gray-400 truncate">{ds.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm font-medium text-gray-900">{ds.totalDocs.toLocaleString()}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-gray-600">{ds.expenseDocs}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-gray-600">{ds.incomeDocs}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-gray-600">{ds.payrollDocs}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-gray-600">{ds.deliveryNoteDocs}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        {ds.locationCount ?? ds.locationIds.length}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-center">
                        {ds.evolution.length > 0 ? (
                          <MiniSparkline data={ds.evolution} />
                        ) : (
                          <span className="text-xs text-gray-300">&mdash;</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {ds.errorCategories.slice(0, 3).map(cat => (
                          <ErrorCategoryBadge key={cat} category={cat} language={language} />
                        ))}
                        {ds.errorCategories.length > 3 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded bg-gray-50 text-gray-400">
                            +{ds.errorCategories.length - 3}
                          </span>
                        )}
                        {ds.errorCategories.length === 0 && (
                          <span className="text-xs text-gray-300">&mdash;</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {datasets.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Database size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {language === 'es' ? 'No se encontraron datasets' : 'No datasets found'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Seed Dataset Modal */}
      {showSeedModal && (
        <SeedDatasetModal
          language={language}
          onClose={() => setShowSeedModal(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
