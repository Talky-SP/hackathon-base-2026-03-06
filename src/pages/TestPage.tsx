import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, Search, Play, Clock, CheckCircle2, XCircle,
  Loader2, ChevronDown, X,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTestQueue } from '../context/TestQueueContext';
import { ERROR_CATEGORY_LABELS } from '../types/golden';
import { INVOICE_OCR_TARGETS, type InvoiceOcrTargetOption } from '../config/lambdaTargets';
import type { TestRunStatus } from '../types/testRun';
import type { ErrorCategory } from '../types/golden';
import { useTestRuns, useStartTestRun, useDatasets, useTestRunPolling } from '../hooks/useOcrTestingData';

type StatusFilter = 'all' | TestRunStatus;
type TestExecutionSelection = 'compare' | InvoiceOcrTargetOption['value'];

const STATUS_CONFIG: Record<TestRunStatus, {
  icon: typeof CheckCircle2;
  colorClass: string;
  labelEs: string;
  labelEn: string;
}> = {
  completed: { icon: CheckCircle2, colorClass: 'text-green-500', labelEs: 'Completado', labelEn: 'Completed' },
  in_progress: { icon: Loader2, colorClass: 'text-blue-500', labelEs: 'En progreso', labelEn: 'In progress' },
  failed: { icon: XCircle, colorClass: 'text-red-500', labelEs: 'Fallido', labelEn: 'Failed' },
  queued: { icon: Clock, colorClass: 'text-gray-400', labelEs: 'En cola', labelEn: 'Queued' },
};

function StatusBadge({ status, language }: { status: TestRunStatus; language: 'es' | 'en' }) {
  const cfg = STATUS_CONFIG[status];
  const dotColor: Record<TestRunStatus, string> = {
    completed: 'bg-green-500',
    in_progress: 'bg-blue-500 animate-pulse',
    failed: 'bg-red-500',
    queued: 'bg-gray-300',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor[status]}`} />
      {language === 'es' ? cfg.labelEs : cfg.labelEn}
    </span>
  );
}

function ProgressBar({ value, status }: { value: number; status: TestRunStatus }) {
  const colorMap: Record<TestRunStatus, string> = {
    completed: 'bg-gray-900',
    in_progress: 'bg-blue-500',
    failed: 'bg-red-500',
    queued: 'bg-gray-200',
  };
  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <div className="flex-1 h-1 bg-gray-100 overflow-hidden">
        <div
          className={`h-full transition-all ${colorMap[status]}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[11px] text-gray-400 tabular-nums w-7 text-right">{value}%</span>
    </div>
  );
}

function AccuracyValue({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-gray-300">&mdash;</span>;
  const color = value >= 90 ? 'text-green-600' : value >= 75 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`text-sm tabular-nums font-medium ${color}`}>{value}%</span>;
}

// ─── Run Test Modal ───────────────────────────────────────────────────────

function RunTestModal({ onClose, onSuccess, language }: {
  onClose: () => void;
  onSuccess: (testRunId: string) => void;
  language: 'es' | 'en';
}) {
  const { datasets } = useDatasets();
  const { start, loading, error } = useStartTestRun();
  const { items: queueItems } = useTestQueue();

  const [datasetId, setDatasetId] = useState(queueItems.length > 0 ? queueItems[0].id : '');
  const [testName, setTestName] = useState('');
  const [executionSelection, setExecutionSelection] = useState<TestExecutionSelection>('legacy');

  const handleStart = async () => {
    if (!datasetId) return;
    const isCompare = executionSelection === 'compare';
    try {
      const res = await start({
        datasetId,
        name: testName || undefined,
        mode: isCompare ? 'compare' : 'reprocess',
        ocrTarget: isCompare ? undefined : executionSelection,
      });
      onSuccess(res.testRunId);
    } catch {
      // error handled by hook
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <Play size={16} className="text-brand-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {language === 'es' ? 'Lanzar Test' : 'Run Test'}
                </h2>
                <p className="text-xs text-gray-400">
                  {language === 'es' ? 'Ejecuta un test sobre un dataset' : 'Run a test against a dataset'}
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
                  <option key={ds.id} value={ds.id}>{ds.name} ({ds.totalDocs} docs)</option>
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

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {language === 'es' ? 'Procesamiento a ejecutar' : 'Processing to run'}
              </label>
              <select
                value={executionSelection}
                onChange={e => setExecutionSelection(e.target.value as TestExecutionSelection)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
              >
                <option value="compare">
                  {language === 'es'
                    ? 'Comparar existente - no relanza OCR'
                    : 'Compare existing - does not rerun OCR'}
                </option>
                {INVOICE_OCR_TARGETS.map(target => (
                  <option key={target.value} value={target.value}>
                    {target.label} - {target.description}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                {executionSelection === 'compare'
                  ? (language === 'es'
                    ? 'Se envia mode=compare sin ocrTarget.'
                    : 'Sends mode=compare without ocrTarget.')
                  : (language === 'es'
                    ? 'Se envia mode=reprocess con el ocrTarget seleccionado.'
                    : 'Sends mode=reprocess with the selected ocrTarget.')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {language === 'es' ? 'Modo' : 'Mode'}
              </label>
              <div className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                {executionSelection === 'compare'
                  ? (language === 'es' ? 'Comparar existente' : 'Compare existing')
                  : (language === 'es' ? 'Reprocesar OCR' : 'Reprocess OCR')}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {language === 'es'
                  ? 'Los targets OCR relanzan OCR. Comparar solo compara resultados ya existentes.'
                  : 'OCR targets rerun OCR. Compare only compares existing results.'}
              </p>
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
                onClick={handleStart}
                disabled={!datasetId || loading}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                <Play size={14} />
                {language === 'es' ? 'Lanzar Test' : 'Run Test'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function TestPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { items: queueItems } = useTestQueue();
  const { testRuns: allRuns, loading, refetch } = useTestRuns();
  const { datasets: goldenDatasets } = useDatasets();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);

  const datasetNameById = useMemo(() => {
    const map = new Map<string, string>();
    goldenDatasets.forEach(ds => map.set(ds.id, ds.name));
    return map;
  }, [goldenDatasets]);

  const getDatasetLabel = useCallback(
    (datasetId: string, datasetName: string) =>
      datasetNameById.get(datasetId) || datasetName || datasetId || (language === 'es' ? 'Sin dataset' : 'No dataset'),
    [datasetNameById, language],
  );

  // Poll status for newly created test run
  const pollingStatus = useTestRunPolling(pollingRunId);
  const prevPollingRef = useRef(pollingStatus?.runStatus);
  useEffect(() => {
    if (
      pollingStatus &&
      (pollingStatus.runStatus === 'COMPLETED' || pollingStatus.runStatus === 'FAILED') &&
      prevPollingRef.current !== pollingStatus.runStatus
    ) {
      window.setTimeout(() => setPollingRunId(null), 0);
      refetch();
    }
    prevPollingRef.current = pollingStatus?.runStatus;
  }, [pollingStatus, refetch]);

  const runs = useMemo(() => {
    let result = [...allRuns];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        getDatasetLabel(r.datasetId, r.datasetName).toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [allRuns, search, statusFilter, getDatasetLabel]);

  const statusFilterLabel = statusFilter === 'all'
    ? (language === 'es' ? 'Todos' : 'All')
    : (language === 'es' ? STATUS_CONFIG[statusFilter].labelEs : STATUS_CONFIG[statusFilter].labelEn);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('test.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('test.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowRunModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Play size={16} />
          {language === 'es' ? 'Nuevo Test' : 'New Test'}
          {queueItems.length > 0 && (
            <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
              {queueItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { label: language === 'es' ? 'Total' : 'Total', value: allRuns.length, color: 'text-gray-900' },
          { label: language === 'es' ? 'En progreso' : 'In progress', value: allRuns.filter(r => r.status === 'in_progress').length, color: 'text-blue-600' },
          { label: language === 'es' ? 'Completados' : 'Completed', value: allRuns.filter(r => r.status === 'completed').length, color: 'text-green-600' },
          { label: language === 'es' ? 'Fallidos' : 'Failed', value: allRuns.filter(r => r.status === 'failed').length, color: 'text-red-600' },
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
                : (language === 'es' ? 'Test en ejecucion...' : 'Test running...')
              }
            </p>
            {pollingStatus.runStatus === 'FAILED' && pollingStatus.errorMessage ? (
              <p className="text-xs text-red-500 truncate">{pollingStatus.errorMessage}</p>
            ) : (
              <p className="text-xs text-blue-500">
                {pollingStatus.runStatus} &middot; {pollingStatus.processedDocs}/{pollingStatus.totalDocs} docs &middot; {Math.round(pollingStatus.progress)}%
                {pollingStatus.fieldAccuracy > 0 && (
                  <> &middot; {language === 'es' ? 'Precision' : 'Accuracy'}: {(pollingStatus.fieldAccuracy * 100).toFixed(1)}%</>
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
                {(Object.keys(STATUS_CONFIG) as TestRunStatus[]).map(s => (
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
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Test' : 'Test'}
                </th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Estado' : 'Status'}
                </th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Progreso' : 'Progress'}
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  Docs
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'OK' : 'Pass'}
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Error' : 'Fail'}
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Precision' : 'Accuracy'}
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
              {runs.map(run => (
                <tr
                  key={run.id}
                  onClick={() => navigate(`/test/${run.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{run.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        <span className="text-gray-300">{language === 'es' ? 'Golden dataset' : 'Golden dataset'}</span>
                        <span className="mx-1 text-gray-300">&middot;</span>
                        {getDatasetLabel(run.datasetId, run.datasetName)}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={run.status} language={language} />
                  </td>
                  <td className="px-3 py-3">
                    <ProgressBar value={run.progress} status={run.status} />
                  </td>
                  <td className="text-right px-3 py-3">
                    <span className="text-sm tabular-nums text-gray-600">{run.totalDocs}</span>
                  </td>
                  <td className="text-right px-3 py-3">
                    <span className="text-sm tabular-nums text-green-600">{run.passedDocs}</span>
                  </td>
                  <td className="text-right px-3 py-3">
                    <span className="text-sm tabular-nums text-red-500">{run.failedDocs > 0 ? run.failedDocs : '\u2014'}</span>
                  </td>
                  <td className="text-right px-3 py-3">
                    <AccuracyValue value={run.accuracy} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {Object.entries(run.errorSummary).slice(0, 2).map(([cat, count]) => (
                        <span key={cat} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-500">
                          {ERROR_CATEGORY_LABELS[cat as ErrorCategory][language]}
                          <span className="text-gray-400">{count}</span>
                        </span>
                      ))}
                      {Object.keys(run.errorSummary).length > 2 && (
                        <span className="text-[10px] text-gray-300">+{Object.keys(run.errorSummary).length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs text-gray-500">
                      {new Date(run.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                      {run.duration && (
                        <span className="block text-gray-400">{run.duration}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {runs.length === 0 && (
            <div className="px-4 py-12 text-center">
              <FlaskConical size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {language === 'es' ? 'No se encontraron tests' : 'No tests found'}
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
