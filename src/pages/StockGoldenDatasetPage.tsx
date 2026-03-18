import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, Search, Package, Plus, Loader2, Trash2,
  FileText, X, ChevronDown, Sparkles,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useStockDatasets } from '../hooks/useStockAnnotations';
import { useLocations } from '../hooks/useLocations';
import * as stockApi from '../services/stockTestingApi';

// Enriched dataset with ingredient/entry counts
interface EnrichedDataset {
  datasetId: string;
  datasetName: string;
  documentCount: number;
  ingredientCount: number;
  entryCount: number;
  createdAt: string;
}

// ─── Seed Modal ───────────────────────────────────────────────────────────

function SeedStockDatasetModal({ onClose, onSuccess, language }: {
  onClose: () => void;
  onSuccess: () => void;
  language: 'es' | 'en';
}) {
  const { locations, loading: locsLoading } = useLocations();
  const [locationId, setLocationId] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [limit, setLimit] = useState(30);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ datasetId: string; count: number } | null>(null);

  const handleSeed = async () => {
    if (!locationId) return;
    setSeeding(true);
    setError(null);
    try {
      const res = await stockApi.seedStockDataset({
        locationId,
        limit,
        datasetName: datasetName || undefined,
      });
      setSuccess({ datasetId: res.datasetId, count: res.created });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dataset');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <Sparkles size={16} className="text-brand-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {language === 'es' ? 'Crear Dataset de Stock' : 'Create Stock Dataset'}
                </h2>
                <p className="text-xs text-gray-400">
                  {language === 'es' ? 'Genera un golden dataset desde datos de stock' : 'Generate a golden dataset from stock data'}
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
                  {success.count} {language === 'es' ? 'entradas incluidas' : 'entries included'}
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
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Location *</label>
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
                    <option value="">{language === 'es' ? 'Seleccionar location...' : 'Select location...'}</option>
                    {locations.map(loc => (
                      <option key={loc.locationId} value={loc.locationId}>
                        {loc.locationName || loc.locationId}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {language === 'es' ? 'Nombre del dataset' : 'Dataset name'}
                </label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={e => setDatasetName(e.target.value)}
                  placeholder={language === 'es' ? 'Nombre (opcional)' : 'Name (optional)'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {language === 'es' ? 'Max entradas' : 'Max entries'}
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

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

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

// ─── Create Dataset Modal (simple name-only) ─────────────────────────────

function CreateDatasetModal({ onClose, onCreate, language }: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  language: 'es' | 'en';
}) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await onCreate(name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm" onClick={e => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              {language === 'es' ? 'Nuevo Dataset' : 'New Dataset'}
            </h3>
          </div>
          <div className="p-5 space-y-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder={language === 'es' ? 'Nombre del dataset...' : 'Dataset name...'}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
              autoFocus
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {creating && <Loader2 size={12} className="animate-spin" />}
                {language === 'es' ? 'Crear' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function StockGoldenDatasetPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { datasets, loading, createDataset, deleteDataset, refresh } = useStockDatasets();

  const [search, setSearch] = useState('');
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [enrichedMap, setEnrichedMap] = useState<Map<string, { ingredientCount: number; entryCount: number }>>(new Map());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Enrich datasets with ingredient/entry counts
  useEffect(() => {
    if (datasets.length === 0) return;
    let cancelled = false;

    const enrichAll = async () => {
      const newMap = new Map<string, { ingredientCount: number; entryCount: number }>();
      await Promise.allSettled(
        datasets.map(async (ds) => {
          try {
            const res = await stockApi.getDatasetIngredients(ds.datasetId);
            if (!cancelled) {
              newMap.set(ds.datasetId, {
                ingredientCount: res.totalIngredients ?? res.ingredients?.length ?? 0,
                entryCount: res.totalEntries ?? 0,
              });
            }
          } catch {
            // Non-blocking
          }
        })
      );
      if (!cancelled) setEnrichedMap(newMap);
    };
    enrichAll();
    return () => { cancelled = true; };
  }, [datasets]);

  const enrichedDatasets: EnrichedDataset[] = useMemo(() => {
    return datasets.map(ds => {
      const extra = enrichedMap.get(ds.datasetId);
      return {
        datasetId: ds.datasetId,
        datasetName: ds.datasetName,
        documentCount: ds.documentCount,
        ingredientCount: extra?.ingredientCount ?? 0,
        entryCount: extra?.entryCount ?? 0,
        createdAt: ds.createdAt ?? '',
      };
    });
  }, [datasets, enrichedMap]);

  const filtered = useMemo(() => {
    if (!search) return enrichedDatasets;
    const q = search.toLowerCase();
    return enrichedDatasets.filter(d => d.datasetName.toLowerCase().includes(q));
  }, [enrichedDatasets, search]);

  const handleDelete = async (datasetId: string) => {
    if (!confirm(language === 'es' ? 'Eliminar este dataset?' : 'Delete this dataset?')) return;
    setDeletingId(datasetId);
    try {
      await deleteDataset(datasetId);
    } catch {
      // handled by hook
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateDataset = async (name: string) => {
    await createDataset(name);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {language === 'es' ? 'Stock Golden Datasets' : 'Stock Golden Datasets'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {language === 'es'
              ? 'Gestiona datasets curados de entradas de stock verificadas.'
              : 'Manage curated datasets of verified stock entries.'}
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowNewDropdown(!showNewDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            {language === 'es' ? 'Nuevo Dataset' : 'New Dataset'}
            <ChevronDown size={14} />
          </button>
          {showNewDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNewDropdown(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => { setShowNewDropdown(false); setShowCreateModal(true); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Plus size={14} className="text-gray-400" />
                  {language === 'es' ? 'Crear vacio' : 'Create empty'}
                </button>
                <button
                  onClick={() => { setShowNewDropdown(false); setShowSeedModal(true); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Sparkles size={14} className="text-gray-400" />
                  {language === 'es' ? 'Generar desde stock' : 'Generate from stock'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search */}
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
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} {language === 'es' ? 'datasets' : 'datasets'}
        </span>
      </div>

      {/* Loading */}
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Dataset' : 'Dataset'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <FileText size={13} className="inline mr-1 -mt-0.5" />
                  {language === 'es' ? 'Docs' : 'Docs'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Package size={13} className="inline mr-1 -mt-0.5" />
                  {language === 'es' ? 'Ingredientes' : 'Ingredients'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Entradas' : 'Entries'}
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Creado' : 'Created'}
                </th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(ds => (
                <tr
                  key={ds.datasetId}
                  onClick={() => navigate(`/stock-golden-datasets/${ds.datasetId}`)}
                  className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Database size={14} className="text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{ds.datasetName}</p>
                        <p className="text-[11px] text-gray-400 font-mono truncate max-w-[220px]">{ds.datasetId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="text-sm font-medium text-gray-900">{ds.documentCount}</span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="text-sm text-gray-600">{ds.ingredientCount}</span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="text-sm text-gray-600">{ds.entryCount}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-gray-500">
                      {ds.createdAt ? new Date(ds.createdAt).toLocaleDateString() : '\u2014'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(ds.datasetId); }}
                      disabled={deletingId === ds.datasetId}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                      title={language === 'es' ? 'Eliminar' : 'Delete'}
                    >
                      {deletingId === ds.datasetId
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Database size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {language === 'es' ? 'No se encontraron datasets' : 'No datasets found'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showSeedModal && (
        <SeedStockDatasetModal
          language={language}
          onClose={() => setShowSeedModal(false)}
          onSuccess={() => refresh()}
        />
      )}
      {showCreateModal && (
        <CreateDatasetModal
          language={language}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateDataset}
        />
      )}
    </div>
  );
}
