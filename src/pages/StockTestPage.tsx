import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, Search, Play, XCircle,
  Loader2, ChevronDown, X, Package, Filter,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTestQueue } from '../context/TestQueueContext';
import {
  listStockTestRuns, listStockDatasets, startStockTestRun, getStockTestRunStatus,
  type StockTestRun, type StockTestRunStatus, type StockDataset,
} from '../services/stockTestingApi';

// ─── Error type labels ───────────────────────────────────────────────────

const STOCK_ERROR_LABELS: Record<string, { es: string; en: string }> = {
  DUPLICATE_INGREDIENT: { es: 'Ingrediente duplicado', en: 'Duplicate ingredient' },
  PACK_TYPE_MISMATCH: { es: 'Tipo pack incorrecto', en: 'Pack type mismatch' },
  UNITS_PER_PACK_WRONG: { es: 'Uds/pack incorrecto', en: 'Units/pack wrong' },
  STOCK_QUANTITY_MISMATCH: { es: 'Cantidad incorrecta', en: 'Quantity mismatch' },
  PRICE_OUTLIER: { es: 'Precio anomalo', en: 'Price outlier' },
  UOM_MISMATCH: { es: 'UdM incorrecta', en: 'UoM mismatch' },
  DUPLICATE_STOCK_ENTRY: { es: 'Entry duplicado', en: 'Duplicate entry' },
  MISSING_STOCK_ENTRY: { es: 'Entry faltante', en: 'Missing entry' },
  PRODUCT_ID_LOST: { es: 'Product ID perdido', en: 'Product ID lost' },
  PRODUCT_ID_COLLISION: { es: 'Colision product ID', en: 'Product ID collision' },
};

export function getStockErrorLabel(type: string, language: 'es' | 'en'): string {
  return STOCK_ERROR_LABELS[type]?.[language] ?? type.replace(/_/g, ' ');
}

// ─── Status types ────────────────────────────────────────────────────────

type RunStatus = 'completed' | 'in_progress' | 'failed' | 'queued';
type StatusFilter = 'all' | RunStatus;

const STATUS_CONFIG: Record<RunStatus, {
  colorClass: string;
  dotClass: string;
  labelEs: string;
  labelEn: string;
}> = {
  completed: { colorClass: 'text-green-500', dotClass: 'bg-green-500', labelEs: 'Completado', labelEn: 'Completed' },
  in_progress: { colorClass: 'text-blue-500', dotClass: 'bg-blue-500 animate-pulse', labelEs: 'En progreso', labelEn: 'In progress' },
  failed: { colorClass: 'text-red-500', dotClass: 'bg-red-500', labelEs: 'Fallido', labelEn: 'Failed' },
  queued: { colorClass: 'text-gray-400', dotClass: 'bg-gray-300', labelEs: 'En cola', labelEn: 'Queued' },
};

function mapRunStatus(apiStatus: string): RunStatus {
  const map: Record<string, RunStatus> = {
    COMPLETED: 'completed',
    RUNNING: 'in_progress',
    PROCESSING_PIPELINE: 'in_progress',
    PROCESSING_OCR: 'in_progress',
    COMPARING: 'in_progress',
    FIRING_OCR: 'in_progress',
    COPYING_PDFS: 'in_progress',
    INITIALIZING: 'queued',
    FAILED: 'failed',
  };
  return map[apiStatus] ?? 'queued';
}

// ─── Hooks ───────────────────────────────────────────────────────────────

function useStockTestRuns() {
  const [runs, setRuns] = useState<StockTestRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      // API filters by status — fetch all statuses in parallel
      const [completed, failed, running] = await Promise.all([
        listStockTestRuns({ status: 'COMPLETED', limit: 50 }),
        listStockTestRuns({ status: 'FAILED', limit: 50 }),
        listStockTestRuns({ status: 'RUNNING', limit: 50 }),
      ]);
      const all = [...completed.runs, ...failed.runs, ...running.runs];
      // Deduplicate by testRunId
      const seen = new Set<string>();
      const deduped = all.filter(r => {
        if (seen.has(r.testRunId)) return false;
        seen.add(r.testRunId);
        return true;
      });
      setRuns(deduped);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { runs, loading, refetch: fetch_ };
}

function useStockDatasets() {
  const [datasets, setDatasets] = useState<StockDataset[]>([]);

  useEffect(() => {
    listStockDatasets()
      .then(d => setDatasets(d.datasets))
      .catch(() => setDatasets([]));
  }, []);

  return datasets;
}

function useStockTestRunPolling(testRunId: string | null) {
  const [status, setStatus] = useState<StockTestRunStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!testRunId) { setStatus(null); return; }

    const poll = async () => {
      try {
        const s = await getStockTestRunStatus(testRunId);
        setStatus(s);
        if (s.runStatus === 'COMPLETED' || s.runStatus === 'FAILED') {
          clearInterval(intervalRef.current);
        }
      } catch { /* ignore */ }
    };

    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => clearInterval(intervalRef.current);
  }, [testRunId]);

  return status;
}

// ─── Components ──────────────────────────────────────────────────────────

function StatusBadge({ status, language }: { status: RunStatus; language: 'es' | 'en' }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {language === 'es' ? cfg.labelEs : cfg.labelEn}
    </span>
  );
}

function ProgressBar({ value, status }: { value: number; status: RunStatus }) {
  const colorMap: Record<RunStatus, string> = {
    completed: 'bg-gray-900',
    in_progress: 'bg-blue-500',
    failed: 'bg-red-500',
    queued: 'bg-gray-200',
  };
  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <div className="flex-1 h-1 bg-gray-100 overflow-hidden">
        <div className={`h-full transition-all ${colorMap[status]}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] text-gray-400 tabular-nums w-7 text-right">{value}%</span>
    </div>
  );
}

function AccuracyValue({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-gray-300">&mdash;</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`text-sm tabular-nums font-medium ${color}`}>{pct}%</span>;
}

// ─── Run Test Modal ──────────────────────────────────────────────────────

function RunTestModal({ onClose, onSuccess, language }: {
  onClose: () => void;
  onSuccess: (testRunId: string) => void;
  language: 'es' | 'en';
}) {
  const datasets = useStockDatasets();
  const { items: queueItems, clearQueue } = useTestQueue();
  const stockQueueItems = queueItems.filter(i => i.source === 'stock');

  // Pre-populate from queue
  const queueDatasetId = stockQueueItems.find(i => i.stockDatasetId)?.stockDatasetId ?? '';
  const queueDocKeys = stockQueueItems.flatMap(i => i.stockDocKeys ?? []);
  const queueSupplierCif = stockQueueItems.find(i => i.stockSupplierCif)?.stockSupplierCif ?? '';
  const queueIngredientId = stockQueueItems.find(i => i.stockIngredientId)?.stockIngredientId ?? '';

  const [datasetId, setDatasetId] = useState(queueDatasetId);
  const [testName, setTestName] = useState('');
  const mode = 'reprocess' as const;
  const [showFilters, setShowFilters] = useState(queueDocKeys.length > 0 || !!queueSupplierCif || !!queueIngredientId);
  const [docKeysText, setDocKeysText] = useState(queueDocKeys.join('\n'));
  const [supplierCif, setSupplierCif] = useState(queueSupplierCif);
  const [ingredientId, setIngredientId] = useState(queueIngredientId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedDocKeys = docKeysText.split('\n').map(s => s.trim()).filter(Boolean);
  const hasFilters = parsedDocKeys.length > 0 || !!supplierCif || !!ingredientId;

  const handleStart = async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await startStockTestRun({
        datasetId,
        mode,
        name: testName || undefined,
        docKeys: parsedDocKeys.length > 0 ? parsedDocKeys : undefined,
        supplierCif: supplierCif || undefined,
        ingredientId: ingredientId || undefined,
      });
      // Clear stock items from queue after successful launch
      stockQueueItems.forEach(i => queueItems.includes(i) && clearQueue());
      onSuccess(res.testRunId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <Play size={16} className="text-brand-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {language === 'es' ? 'Lanzar Test de Stock' : 'Run Stock Test'}
                </h2>
                <p className="text-xs text-gray-400">
                  {language === 'es' ? 'Ejecuta un test sobre un dataset de stock' : 'Run a test against a stock dataset'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Dataset *</label>
              <select
                value={datasetId}
                onChange={e => setDatasetId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
              >
                <option value="">{language === 'es' ? 'Seleccionar dataset...' : 'Select dataset...'}</option>
                {datasets.map(ds => (
                  <option key={ds.datasetId} value={ds.datasetId}>
                    {ds.datasetName} ({ds.documentCount} docs)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {language === 'es' ? 'Nombre del test' : 'Test name'}
              </label>
              <input
                type="text"
                value={testName}
                onChange={e => setTestName(e.target.value)}
                placeholder={language === 'es' ? 'Nombre (opcional)' : 'Name (optional)'}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                hasFilters ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Filter size={13} />
              {language === 'es' ? 'Filtros avanzados' : 'Advanced filters'}
              {hasFilters && (
                <span className="bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded text-[10px]">
                  {[parsedDocKeys.length > 0 && `${parsedDocKeys.length} docs`, supplierCif && 'CIF', ingredientId && 'ING'].filter(Boolean).join(', ')}
                </span>
              )}
              <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {showFilters && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    {language === 'es' ? 'Documentos especificos (docKeys, uno por linea)' : 'Specific documents (docKeys, one per line)'}
                  </label>
                  <textarea
                    value={docKeysText}
                    onChange={e => setDocKeysText(e.target.value)}
                    placeholder="prueba-stock-122#delivery_note#COMPRAS#2025-12-01#uuid..."
                    rows={3}
                    className="w-full px-2.5 py-1.5 text-xs font-mono border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 resize-none"
                  />
                  {parsedDocKeys.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {parsedDocKeys.length} {language === 'es' ? 'documentos seleccionados' : 'documents selected'}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">
                      {language === 'es' ? 'CIF proveedor' : 'Supplier CIF'}
                    </label>
                    <input
                      type="text"
                      value={supplierCif}
                      onChange={e => setSupplierCif(e.target.value)}
                      placeholder="A41182114"
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">
                      {language === 'es' ? 'Ingrediente ID' : 'Ingredient ID'}
                    </label>
                    <input
                      type="text"
                      value={ingredientId}
                      onChange={e => setIngredientId(e.target.value)}
                      placeholder="ING-84395e03..."
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                    />
                  </div>
                </div>
                {hasFilters && (
                  <p className="text-[10px] text-gray-400">
                    {language === 'es'
                      ? 'Los filtros son aditivos (AND). Solo se procesaran los docs que cumplan todos.'
                      : 'Filters are additive (AND). Only docs matching all filters will be processed.'}
                  </p>
                )}
              </div>
            )}

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
                onClick={handleStart}
                disabled={!datasetId || loading}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                <Play size={14} />
                {language === 'es' ? 'Lanzar Test' : 'Run Test'}
                {hasFilters && (
                  <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
                    {language === 'es' ? 'filtrado' : 'filtered'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function StockTestPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { runs: allRuns, loading, refetch } = useStockTestRuns();
  const { items: queueItems } = useTestQueue();
  const hasStockQueue = queueItems.some(i => i.source === 'stock');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);

  // Auto-open modal when navigating here with stock items in queue
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (hasStockQueue && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setShowRunModal(true);
    }
  }, [hasStockQueue]);

  const pollingStatus = useStockTestRunPolling(pollingRunId);
  const prevPollingRef = useRef(pollingStatus?.runStatus);
  useEffect(() => {
    if (
      pollingStatus &&
      (pollingStatus.runStatus === 'COMPLETED' || pollingStatus.runStatus === 'FAILED') &&
      prevPollingRef.current !== pollingStatus.runStatus
    ) {
      setPollingRunId(null);
      refetch();
    }
    prevPollingRef.current = pollingStatus?.runStatus;
  }, [pollingStatus, refetch]);

  const runs = useMemo(() => {
    let result = [...allRuns];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        (r.runName ?? '').toLowerCase().includes(q) || r.testRunId.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(r => mapRunStatus(r.runStatus) === statusFilter);
    }

    result.sort((a, b) => {
      const dateA = a.date ?? '';
      const dateB = b.date ?? '';
      return dateB.localeCompare(dateA);
    });
    return result;
  }, [allRuns, search, statusFilter]);

  const counts = useMemo(() => ({
    total: allRuns.length,
    in_progress: allRuns.filter(r => mapRunStatus(r.runStatus) === 'in_progress').length,
    completed: allRuns.filter(r => mapRunStatus(r.runStatus) === 'completed').length,
    failed: allRuns.filter(r => mapRunStatus(r.runStatus) === 'failed').length,
  }), [allRuns]);

  const statusFilterLabel = statusFilter === 'all'
    ? (language === 'es' ? 'Todos' : 'All')
    : (language === 'es' ? STATUS_CONFIG[statusFilter].labelEs : STATUS_CONFIG[statusFilter].labelEn);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Package size={20} className="text-brand-500" />
            <h1 className="text-2xl font-semibold text-gray-900">
              {language === 'es' ? 'Test de Stock' : 'Stock Test'}
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {language === 'es'
              ? 'Ejecuta y compara tests sobre los datasets de stock'
              : 'Run and compare tests against stock datasets'}
          </p>
        </div>
        <button
          onClick={() => setShowRunModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Play size={16} />
          {language === 'es' ? 'Nuevo Test' : 'New Test'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { label: 'Total', value: counts.total, color: 'text-gray-900' },
          { label: language === 'es' ? 'En progreso' : 'In progress', value: counts.in_progress, color: 'text-blue-600' },
          { label: language === 'es' ? 'Completados' : 'Completed', value: counts.completed, color: 'text-green-600' },
          { label: language === 'es' ? 'Fallidos' : 'Failed', value: counts.failed, color: 'text-red-600' },
        ]).map(stat => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-[11px] text-gray-400 mb-0.5">{stat.label}</p>
            <p className={`text-2xl font-semibold tabular-nums ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Polling indicator */}
      {pollingRunId && pollingStatus && (
        <div className={`rounded-lg px-4 py-3 flex items-center gap-3 ${
          pollingStatus.runStatus === 'FAILED'
            ? 'bg-red-50 border border-red-100'
            : 'bg-blue-50 border border-blue-100'
        }`}>
          {pollingStatus.runStatus === 'FAILED' ? (
            <XCircle size={16} className="text-red-500 shrink-0" />
          ) : (
            <Loader2 size={16} className="animate-spin text-blue-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${pollingStatus.runStatus === 'FAILED' ? 'text-red-700' : 'text-blue-700'}`}>
              {pollingStatus.runStatus === 'FAILED'
                ? (language === 'es' ? 'Test fallido' : 'Test failed')
                : (language === 'es' ? 'Test en ejecucion...' : 'Test running...')}
            </p>
            {pollingStatus.runStatus === 'FAILED' && pollingStatus.errorMessage ? (
              <p className="text-xs text-red-500">{pollingStatus.errorMessage}</p>
            ) : (
              <p className={`text-xs ${pollingStatus.runStatus === 'FAILED' ? 'text-red-500' : 'text-blue-500'}`}>
                {pollingStatus.runStatus} &middot; {pollingStatus.processedDocs}/{pollingStatus.totalDocs} docs &middot; {Math.round(pollingStatus.progress)}%
                {pollingStatus.productAccuracy > 0 && (
                  <> &middot; {language === 'es' ? 'Precision' : 'Accuracy'}: {Math.round(pollingStatus.productAccuracy * 100)}%</>
                )}
              </p>
            )}
          </div>
          {pollingStatus.runStatus !== 'FAILED' && (
            <div className="w-32 h-1.5 bg-blue-100 overflow-hidden rounded-sm shrink-0">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${pollingStatus.progress}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'es' ? 'Buscar tests...' : 'Search tests...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <span className="text-gray-600">{statusFilterLabel}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {showStatusDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
              <div className="absolute top-full mt-1 left-0 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => { setStatusFilter('all'); setShowStatusDropdown(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    statusFilter === 'all' ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {language === 'es' ? 'Todos' : 'All'}
                </button>
                {(Object.keys(STATUS_CONFIG) as RunStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setShowStatusDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      statusFilter === s ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {language === 'es' ? STATUS_CONFIG[s].labelEs : STATUS_CONFIG[s].labelEn}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400">Test</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Modo' : 'Mode'}
                </th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Estado' : 'Status'}
                </th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Progreso' : 'Progress'}
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">Docs</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Productos' : 'Products'}
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Docs OK' : 'Docs OK'}
                </th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Errores' : 'Errors'}
                </th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Fecha' : 'Date'}
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => {
                const status = mapRunStatus(run.runStatus);
                const progress = run.totalDocs > 0
                  ? Math.round((run.processedDocs / run.totalDocs) * 100)
                  : 0;
                const productPct = run.productAccuracy;
                const docPct = run.docAccuracy;
                const errorEntries = Object.entries(run.byErrorType ?? {});

                return (
                  <tr
                    key={run.testRunId}
                    onClick={() => navigate(`/stock-test/${run.testRunId}`)}
                    className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {run.runName || run.testRunId.slice(0, 8)}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {run.testRunId.slice(0, 12)}...
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded ${
                        run.mode === 'compare'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-purple-50 text-purple-600'
                      }`}>
                        {run.mode === 'compare'
                          ? (language === 'es' ? 'Comparar' : 'Compare')
                          : (language === 'es' ? 'Reprocesar' : 'Reprocess')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={status} language={language} />
                    </td>
                    <td className="px-3 py-3">
                      <ProgressBar value={progress} status={status} />
                    </td>
                    <td className="text-right px-3 py-3">
                      <span className="text-sm tabular-nums text-gray-600">{run.totalDocs}</span>
                    </td>
                    <td className="text-right px-3 py-3">
                      <AccuracyValue value={productPct} />
                    </td>
                    <td className="text-right px-3 py-3">
                      {docPct > 0 ? (
                        <span className="text-sm tabular-nums text-gray-600">
                          {Math.round(docPct * 100)}%
                          <span className="text-gray-400 text-[10px] ml-1">({run.perfectDocs}/{run.totalDocs})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {errorEntries.slice(0, 2).map(([type, count]) => (
                          <span key={type} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-500">
                            {getStockErrorLabel(type, language)}
                            <span className="text-gray-400">{count}</span>
                          </span>
                        ))}
                        {errorEntries.length > 2 && (
                          <span className="text-[10px] text-gray-300">+{errorEntries.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-gray-500">
                        {run.date
                          ? new Date(run.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })
                          : '\u2014'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {runs.length === 0 && (
            <div className="px-4 py-12 text-center">
              <FlaskConical size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {language === 'es' ? 'No se encontraron tests de stock' : 'No stock tests found'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Run Test Modal */}
      {showRunModal && (
        <RunTestModal
          language={language}
          onClose={() => setShowRunModal(false)}
          onSuccess={(testRunId) => {
            setShowRunModal(false);
            setPollingRunId(testRunId);
            refetch();
          }}
        />
      )}
    </div>
  );
}
