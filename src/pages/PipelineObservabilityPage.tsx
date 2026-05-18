import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  RefreshCw,
  Server,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTestRuns } from '../hooks/useOcrTestingData';
import {
  getTestRun,
  type ApiTestRun,
  type ApiTestRunDoc,
} from '../services/ocrTestingApi';
import {
  getPipelineCosts,
  getPipelineDag,
  getPipelineDocumentDetail,
  getPipelineDocuments,
  getPipelineErrors,
  getPipelineLive,
  type PipelineCostsResponse,
  type PipelineDagNode,
  type PipelineDagResponse,
  type PipelineDocumentDetailResponse,
  type PipelineEvent,
  type PipelineLiveResponse,
} from '../services/engineeringPipelineApi';

interface LocationObservability {
  locationId: string;
  documents: unknown[];
  live: PipelineLiveResponse | null;
  costs: PipelineCostsResponse | null;
  dag: PipelineDagResponse | null;
  errors: unknown[];
  fetchErrors: string[];
}

interface DocumentTarget {
  source: string;
  locationId: string;
  docId: string;
  doc: ApiTestRunDoc;
}

interface StageSummary {
  id: string;
  label: string;
  events: PipelineEvent[];
  calls: PipelineEvent[];
  costUsd: number;
  errors: number;
  status: string;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function formatDate(value: string | undefined, language: 'es' | 'en'): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === 'es' ? 'es-ES' : 'en-US');
}

function formatUsd(value: number): string {
  if (!value) return '$0.0000';
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

function formatMs(ms: number): string {
  if (!ms) return '--';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function getRawRun(run: { _raw?: ApiTestRun } | null): ApiTestRun | null {
  return run?._raw ?? null;
}

function getTempLocationEntries(run: ApiTestRun | null): Array<{ source: string; locationId: string }> {
  const byLocation = new Map<string, { source: string; locationId: string }>();
  Object.entries(run?.tempLocations ?? {})
    .filter(([, locationId]) => Boolean(locationId))
    .forEach(([source, locationId]) => byLocation.set(locationId, { source, locationId }));

  asArray<ApiTestRunDoc>(run?.documents).forEach(doc => {
    const locationId = doc.tempLocationId ?? doc.traceParams?.testRun?.userId;
    if (locationId && !byLocation.has(locationId)) {
      byLocation.set(locationId, { source: doc.locationId ?? doc.SK ?? 'doc', locationId });
    }
  });

  return Array.from(byLocation.values());
}

function getDocumentTargets(run: ApiTestRun | null): DocumentTarget[] {
  return asArray<ApiTestRunDoc>(run?.documents)
    .map(doc => {
      const locationId = doc.tempLocationId ?? doc.traceParams?.testRun?.userId;
      const docId = doc.ocrDocId ?? doc.traceParams?.testRun?.docId;
      if (!locationId || !docId) return null;
      return {
        source: doc.SK ?? doc.categoryDate ?? doc.locationId ?? docId,
        locationId,
        docId,
        doc,
      };
    })
    .filter((item): item is DocumentTarget => Boolean(item));
}

function getRunRange(run: ApiTestRun | null): { from: string; to: string; limit: number } {
  const startRaw = run?.createdAt ?? run?.date;
  const endRaw = run?.completedAt ?? run?.lastUpdated ?? run?.date ?? run?.createdAt;
  const startMs = startRaw ? new Date(startRaw).getTime() : Date.now() - 24 * 60 * 60 * 1000;
  const endMs = endRaw ? new Date(endRaw).getTime() : Date.now();
  const safeStart = Number.isFinite(startMs) ? startMs : Date.now() - 24 * 60 * 60 * 1000;
  const safeEnd = Number.isFinite(endMs) ? endMs : Date.now();
  return {
    from: new Date(safeStart - 10 * 60 * 1000).toISOString(),
    to: new Date(safeEnd + 10 * 60 * 1000).toISOString(),
    limit: 5000,
  };
}

function eventId(event: PipelineEvent): string {
  return String(event.eventId ?? event.eventKey ?? event.requestId ?? `${event.locationId ?? ''}-${event.eventAt ?? ''}-${event.eventType ?? ''}-${event.stage ?? ''}`);
}

function eventStage(event: PipelineEvent): string {
  return String(event.stage ?? event.stageScope ?? 'unknown');
}

function eventCost(event: PipelineEvent): number {
  return asNumber(event.costUsd ?? event.totalCostUsd ?? event.cost_usd ?? event.cost);
}

function eventLatency(event: PipelineEvent): number {
  return asNumber(event.latencyMs ?? event.durationMs ?? event.latency_ms ?? event.duration_ms);
}

function eventTokens(event: PipelineEvent): number {
  return asNumber(event.totalTokens ?? event.total_tokens) ||
    asNumber(event.promptTokens ?? event.prompt_tokens) + asNumber(event.completionTokens ?? event.completion_tokens);
}

function isCallEvent(event: PipelineEvent): boolean {
  const type = String(event.eventType ?? event.type ?? '');
  return ['ai_call', 'textract_call', 'lambda_invocation'].includes(type) ||
    Boolean(event.model || event.provider || event.operation || event.costType);
}

function getDetailEvents(detail: PipelineDocumentDetailResponse | null): PipelineEvent[] {
  if (!detail) return [];
  const events = [
    ...asArray<PipelineEvent>(detail.timeline),
    ...asArray<PipelineEvent>(detail.events),
    ...asArray<PipelineEvent>(detail.aiCalls),
    ...asArray<PipelineEvent>(detail.ai_calls),
    ...asArray<PipelineEvent>(detail.textractCalls),
    ...asArray<PipelineEvent>(detail.textract_calls),
    ...asArray<PipelineEvent>(detail.lambdaInvocations),
    ...asArray<PipelineEvent>(detail.lambda_invocations),
    ...asArray<PipelineEvent>(detail.errors),
  ];
  const byId = new Map<string, PipelineEvent>();
  events.forEach(event => byId.set(eventId(event), event));
  return Array.from(byId.values()).sort((a, b) => String(a.eventAt ?? '').localeCompare(String(b.eventAt ?? '')));
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
        <Icon size={13} />
        <span>{label}</span>
      </div>
      <p className="text-xl font-semibold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

async function loadLocationObservability(
  locationId: string,
  range: { from: string; to: string; limit: number },
): Promise<LocationObservability> {
  const [documentsResult, liveResult, costsResult, dagResult, errorsResult] = await Promise.allSettled([
    getPipelineDocuments(locationId, { limit: 100 }),
    getPipelineLive(locationId, range),
    getPipelineCosts(locationId, range),
    getPipelineDag(locationId, range),
    getPipelineErrors(locationId, range),
  ]);
  const results = [
    ['documents', documentsResult],
    ['live', liveResult],
    ['costs', costsResult],
    ['dag', dagResult],
    ['errors', errorsResult],
  ] as const;

  return {
    locationId,
    documents: documentsResult.status === 'fulfilled'
      ? asArray(documentsResult.value.documents ?? documentsResult.value.items)
      : [],
    live: liveResult.status === 'fulfilled' ? liveResult.value : null,
    costs: costsResult.status === 'fulfilled' ? costsResult.value : null,
    dag: dagResult.status === 'fulfilled' ? dagResult.value : null,
    errors: errorsResult.status === 'fulfilled'
      ? asArray(errorsResult.value.errors ?? errorsResult.value.items)
      : [],
    fetchErrors: results
      .filter(([, result]) => result.status === 'rejected')
      .map(([name, result]) => `${locationId}/${name}: ${result.status === 'rejected' && result.reason instanceof Error ? result.reason.message : 'failed'}`),
  };
}

export default function PipelineObservabilityPage() {
  const { language } = useLanguage();
  const { testRuns, loading: runsLoading, error: runsError, refetch } = useTestRuns();
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedRunDetail, setSelectedRunDetail] = useState<ApiTestRun | null>(null);
  const [locationsData, setLocationsData] = useState<LocationObservability[]>([]);
  const [documentDetail, setDocumentDetail] = useState<PipelineDocumentDetailResponse | null>(null);
  const [selectedDocKey, setSelectedDocKey] = useState('');
  const [loadingObservability, setLoadingObservability] = useState(false);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [observabilityError, setObservabilityError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const completedRuns = useMemo(() => (
    testRuns
      .filter(run => run.status === 'completed')
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  ), [testRuns]);

  useEffect(() => {
    if (!selectedRunId && completedRuns.length > 0) {
      setSelectedRunId(completedRuns[0].id);
    }
  }, [completedRuns, selectedRunId]);

  const selectedRun = completedRuns.find(run => run.id === selectedRunId) ?? null;
  const rawRun = selectedRunDetail ?? getRawRun(selectedRun);
  const tempLocations = useMemo(() => getTempLocationEntries(rawRun), [rawRun]);
  const documentTargets = useMemo(() => getDocumentTargets(rawRun), [rawRun]);
  const runRange = useMemo(() => getRunRange(rawRun), [rawRun]);

  const loadObservability = useCallback(async () => {
    if (!selectedRun) {
      setSelectedRunDetail(null);
      setLocationsData([]);
      setDocumentDetail(null);
      setSelectedDocKey('');
      setObservabilityError(null);
      return;
    }

    setLoadingObservability(true);
    setObservabilityError(null);
    try {
      const detail = await getTestRun(selectedRun.id, { includeDocs: true });
      setSelectedRunDetail(detail);
      const entries = getTempLocationEntries(detail);
      const range = getRunRange(detail);
      if (entries.length === 0) {
        setLocationsData([]);
        setDocumentDetail(null);
        setSelectedDocKey('');
        return;
      }
      const data = await Promise.all(entries.map(item => loadLocationObservability(item.locationId, range)));
      setLocationsData(data);
      const targets = getDocumentTargets(detail);
      setSelectedDocKey(targets[0] ? `${targets[0].locationId}::${targets[0].docId}` : '');
    } catch (err) {
      setLocationsData([]);
      setDocumentDetail(null);
      setSelectedDocKey('');
      setObservabilityError(err instanceof Error ? err.message : 'Failed to load pipeline observability');
    } finally {
      setLoadingObservability(false);
    }
  }, [selectedRun]);

  useEffect(() => { loadObservability(); }, [loadObservability]);

  useEffect(() => {
    const target = documentTargets.find(item => `${item.locationId}::${item.docId}` === selectedDocKey);
    if (!target) {
      setDocumentDetail(null);
      return;
    }

    let cancelled = false;
    setLoadingDocument(true);
    getPipelineDocumentDetail(target.locationId, target.docId)
      .then(detail => {
        if (!cancelled) setDocumentDetail(detail);
      })
      .catch(err => {
        if (!cancelled) {
          setDocumentDetail(null);
          setObservabilityError(err instanceof Error ? err.message : 'Failed to load document detail');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDocument(false);
      });

    return () => { cancelled = true; };
  }, [documentTargets, selectedDocKey]);

  const allDocuments = useMemo(() => locationsData.flatMap(item => item.documents), [locationsData]);
  const allErrors = useMemo(() => locationsData.flatMap(item => item.errors), [locationsData]);
  const allEvents = useMemo(() => {
    const byId = new Map<string, PipelineEvent>();
    locationsData.forEach(location => {
      [
        ...asArray<PipelineEvent>(location.live?.recentEvents ?? location.live?.events),
        ...asArray<PipelineEvent>(location.dag?.events),
        ...asArray<PipelineEvent>(location.costs?.events),
      ].forEach(event => {
        const withLocation = { ...event, locationId: String(event.locationId ?? location.locationId) };
        byId.set(eventId(withLocation), withLocation);
      });
    });
    return Array.from(byId.values()).sort((a, b) => String(b.eventAt ?? '').localeCompare(String(a.eventAt ?? '')));
  }, [locationsData]);

  const allCalls = useMemo(() => allEvents.filter(isCallEvent), [allEvents]);
  const totalCost = useMemo(() => {
    const fromCostEndpoints = locationsData.reduce((sum, item) => (
      sum + asNumber(item.costs?.totalUsd ?? item.costs?.total_usd)
    ), 0);
    return fromCostEndpoints || allCalls.reduce((sum, event) => sum + eventCost(event), 0);
  }, [allCalls, locationsData]);
  const totalLatency = useMemo(() => allCalls.reduce((sum, event) => sum + eventLatency(event), 0), [allCalls]);

  const stages = useMemo<StageSummary[]>(() => {
    const nodes = locationsData.flatMap(item => asArray<PipelineDagNode>(item.dag?.nodes));
    const grouped = new Map<string, PipelineEvent[]>();
    allEvents.forEach(event => {
      const stage = eventStage(event);
      grouped.set(stage, [...(grouped.get(stage) ?? []), event]);
    });

    const nodesById = new Map<string, PipelineDagNode>();
    nodes.forEach(node => {
      const id = String(node.id ?? node.stage ?? node.name ?? 'unknown');
      const existing = nodesById.get(id);
      nodesById.set(id, {
        ...existing,
        ...node,
        costUsd: asNumber(existing?.costUsd ?? existing?.totalCostUsd) + asNumber(node.costUsd ?? node.totalCostUsd),
        errors: asNumber(existing?.errors) + asNumber(node.errors),
        eventCount: asNumber(existing?.eventCount) + asNumber(node.eventCount),
      });
    });

    const fromNodes = Array.from(nodesById.values()).map(node => {
      const id = String(node.id ?? node.stage ?? node.name ?? 'unknown');
      const events = grouped.get(id) ?? grouped.get(String(node.stage ?? '')) ?? [];
      const calls = events.filter(isCallEvent);
      return {
        id,
        label: String(node.label ?? node.name ?? node.stage ?? id).replace(/_/g, ' '),
        events,
        calls,
        costUsd: asNumber(node.costUsd ?? node.totalCostUsd) || calls.reduce((sum, event) => sum + eventCost(event), 0),
        errors: asNumber(node.errors) || events.filter(event => String(event.eventType).includes('error')).length,
        status: String(node.status ?? 'completed'),
      };
    });

    const nodeIds = new Set(fromNodes.map(stage => stage.id));
    const fromEvents = Array.from(grouped.entries())
      .filter(([id]) => !nodeIds.has(id))
      .map(([id, events]) => {
        const calls = events.filter(isCallEvent);
        return {
          id,
          label: id.replace(/_/g, ' '),
          events,
          calls,
          costUsd: calls.reduce((sum, event) => sum + eventCost(event), 0),
          errors: events.filter(event => String(event.eventType).includes('error')).length,
          status: events.some(event => String(event.eventType).includes('error')) ? 'error' : 'completed',
        };
      });

    return [...fromNodes, ...fromEvents].filter(stage => stage.events.length > 0 || stage.calls.length > 0 || nodes.length > 0);
  }, [allEvents, locationsData]);

  useEffect(() => {
    if (!selectedStageId && stages.length > 0) setSelectedStageId(stages[0].id);
    if (selectedStageId && stages.length > 0 && !stages.some(stage => stage.id === selectedStageId)) {
      setSelectedStageId(stages[0].id);
    }
  }, [selectedStageId, stages]);

  const selectedStage = stages.find(stage => stage.id === selectedStageId) ?? stages[0] ?? null;
  const errorMessage = runsError ?? observabilityError;
  const partialFetchErrors = locationsData.flatMap(item => item.fetchErrors);
  const detailEvents = useMemo(() => getDetailEvents(documentDetail), [documentDetail]);
  const detailCalls = useMemo(() => detailEvents.filter(isCallEvent), [detailEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-brand-500" />
            <h1 className="text-2xl font-semibold text-gray-900">
              {language === 'es' ? 'Observabilidad OCR' : 'OCR Observability'}
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {selectedRun
              ? `${selectedRun.name} - ${tempLocations.map(item => item.locationId).join(', ') || 'sin tempLocations'}`
              : (language === 'es' ? 'Selecciona un test completado' : 'Select a completed test')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedRunId}
            onChange={event => {
              setSelectedRunId(event.target.value);
              setSelectedRunDetail(null);
              setLocationsData([]);
              setDocumentDetail(null);
              setSelectedDocKey('');
            }}
            disabled={runsLoading}
            className="min-w-[420px] px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
          >
            <option value="">
              {runsLoading
                ? (language === 'es' ? 'Cargando test runs...' : 'Loading test runs...')
                : (language === 'es' ? 'Selecciona un test run...' : 'Select a test run...')}
            </option>
            {completedRuns.map(run => {
              const raw = getRawRun(run);
              const count = getTempLocationEntries(raw).length;
              return (
                <option key={run.id} value={run.id}>
                  {run.name || run.id} - {run.totalDocs} docs - {count} temp locations - {formatDate(run.createdAt, language)}
                </option>
              );
            })}
          </select>

          <button
            onClick={() => { refetch(); }}
            disabled={runsLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {runsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={15} />}
            Refresh
          </button>

          <button
            onClick={loadObservability}
            disabled={!selectedRun || tempLocations.length === 0 || loadingObservability}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingObservability ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={15} />}
            {language === 'es' ? 'Recargar obs.' : 'Reload obs.'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      )}

      {partialFetchErrors.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle size={16} />
            {language === 'es'
              ? 'Algunos endpoints de observabilidad han fallado'
              : 'Some observability endpoints failed'}
          </div>
          <p className="text-xs text-amber-700 mt-1">
            {partialFetchErrors.slice(0, 3).join(' | ')}
            {partialFetchErrors.length > 3 ? ` | +${partialFetchErrors.length - 3}` : ''}
          </p>
        </div>
      )}

      {selectedRun && tempLocations.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-amber-800">
          <AlertCircle size={16} />
          {language === 'es'
            ? 'Este test run no incluye tempLocations en la respuesta.'
            : 'This test run does not include tempLocations in the response.'}
        </div>
      )}

      <div className="grid grid-cols-6 gap-3">
        <StatCard icon={CheckCircle2} label={language === 'es' ? 'Estado' : 'Status'} value={selectedRun ? 'Loaded' : '--'} sub={rawRun?.runStatus ?? selectedRun?.status} />
        <StatCard icon={Server} label="tempLocations" value={String(tempLocations.length)} sub={tempLocations.map(item => item.source).join(', ') || '--'} />
        <StatCard icon={FileText} label={language === 'es' ? 'Documentos obs.' : 'Obs. docs'} value={String(allDocuments.length)} sub={`${selectedRun?.totalDocs ?? 0} test docs`} />
        <StatCard icon={Sparkles} label={language === 'es' ? 'Llamadas' : 'Calls'} value={String(allCalls.length)} sub={`${allEvents.length} events`} />
        <StatCard icon={DollarSign} label={language === 'es' ? 'Coste total' : 'Total cost'} value={formatUsd(totalCost)} sub="USD" />
        <StatCard icon={Clock} label={language === 'es' ? 'Tiempo llamadas' : 'Call time'} value={formatMs(totalLatency)} sub={`${runRange.from.slice(0, 10)} - ${runRange.to.slice(0, 10)}`} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">tempLocations</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {tempLocations.map(item => (
              <div key={item.locationId} className="px-5 py-3">
                <p className="text-xs font-medium text-gray-900 truncate">{item.source}</p>
                <p className="text-[11px] font-mono text-gray-500 truncate mt-1">{item.locationId}</p>
              </div>
            ))}
            {tempLocations.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-gray-400">No tempLocations</div>
            )}
          </div>
        </div>

        <div className="col-span-9 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {language === 'es' ? 'Pasos del pipeline' : 'Pipeline steps'}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {language === 'es'
                  ? 'Agregado desde los endpoints de observabilidad por tempLocationId'
                  : 'Aggregated from observability endpoints by tempLocationId'}
              </p>
            </div>
            {loadingObservability && <Loader2 size={16} className="animate-spin text-gray-400" />}
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 p-4">
            {stages.map((stage, index) => (
              <button
                key={stage.id}
                onClick={() => setSelectedStageId(stage.id)}
                className={`text-left border rounded-lg p-3 min-h-[92px] ${
                  selectedStage?.id === stage.id ? 'border-brand-400 ring-2 ring-brand-500/10' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{stage.label}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{stage.calls.length} calls - {stage.events.length} events</p>
                    <p className="text-xs text-gray-700 font-medium mt-1">{formatUsd(stage.costUsd)}</p>
                  </div>
                </div>
              </button>
            ))}
            {stages.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-gray-400">
                {loadingObservability
                  ? (language === 'es' ? 'Cargando observabilidad...' : 'Loading observability...')
                  : (language === 'es' ? 'Sin eventos de pipeline disponibles' : 'No pipeline events available')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              {language === 'es' ? 'Documentos del test run' : 'Test run documents'}
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {language === 'es'
                ? 'Cargados con includeDocs=true'
                : 'Loaded with includeDocs=true'}
            </p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
            {documentTargets.map(target => {
              const key = `${target.locationId}::${target.docId}`;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDocKey(key)}
                  className={`w-full text-left px-5 py-3 hover:bg-gray-50 ${
                    selectedDocKey === key ? 'bg-brand-50/60' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-gray-900 truncate">{target.source}</p>
                    <span className="text-[11px] text-gray-500">{target.doc.verdict ?? '--'}</span>
                  </div>
                  <p className="text-[11px] font-mono text-gray-500 truncate mt-1">{target.docId}</p>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{target.locationId}</p>
                </button>
              );
            })}
            {documentTargets.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                {language === 'es'
                  ? 'El detalle del test run no incluye documentos con tempLocationId/ocrDocId'
                  : 'The test run detail has no documents with tempLocationId/ocrDocId'}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-8 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {language === 'es' ? 'Detalle del documento' : 'Document detail'}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {language === 'es'
                  ? 'Timeline, llamadas y errores desde /documents/{ocrDocId}'
                  : 'Timeline, calls and errors from /documents/{ocrDocId}'}
              </p>
            </div>
            {loadingDocument && <Loader2 size={16} className="animate-spin text-gray-400" />}
          </div>
          <div className="grid grid-cols-3 gap-3 p-4 border-b border-gray-100">
            <StatCard icon={BarChart3} label="Timeline" value={String(detailEvents.length)} />
            <StatCard icon={Sparkles} label={language === 'es' ? 'Llamadas' : 'Calls'} value={String(detailCalls.length)} />
            <StatCard icon={DollarSign} label={language === 'es' ? 'Coste doc.' : 'Doc cost'} value={formatUsd(detailCalls.reduce((sum, event) => sum + eventCost(event), 0))} />
          </div>
          <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
            {detailEvents.slice(0, 30).map(event => (
              <div key={eventId(event)} className="px-5 py-3 grid grid-cols-[150px_130px_1fr_80px] gap-3 items-center">
                <span className="text-[11px] text-gray-400 truncate">{String(event.eventAt ?? '--')}</span>
                <span className="text-xs font-medium text-gray-700 truncate">{String(event.eventType ?? 'event')}</span>
                <span className="text-xs text-gray-500 truncate">{eventStage(event)}</span>
                <span className="text-xs text-gray-700 text-right tabular-nums">{formatUsd(eventCost(event))}</span>
              </div>
            ))}
            {detailEvents.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                {loadingDocument
                  ? (language === 'es' ? 'Cargando detalle...' : 'Loading detail...')
                  : (language === 'es' ? 'Selecciona un documento con observabilidad' : 'Select a document with observability')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              {language === 'es' ? 'Llamadas del paso seleccionado' : 'Calls for selected step'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400">ID</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">Type</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400">Model/Operation</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">Tokens</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-medium text-gray-400">Cost</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-medium text-gray-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {(selectedStage?.calls ?? []).slice(0, 20).map(call => (
                  <tr key={eventId(call)} className="border-b border-gray-50">
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-600 max-w-[160px] truncate">{eventId(call)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{String(call.eventType ?? call.type ?? 'call')}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[260px] truncate">
                      {String(call.model ?? call.operation ?? call.lambdaName ?? call.provider ?? '--')}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 text-right tabular-nums">{eventTokens(call) || '--'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-900 text-right tabular-nums font-medium">{formatUsd(eventCost(call))}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 text-right tabular-nums">{formatMs(eventLatency(call))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!selectedStage || selectedStage.calls.length === 0) && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              {language === 'es' ? 'Sin llamadas para este paso' : 'No calls for this step'}
            </div>
          )}
        </div>

        <div className="col-span-4 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              {language === 'es' ? 'Errores recientes' : 'Recent errors'}
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {allErrors.slice(0, 8).map((item, index) => {
              const row = item as Record<string, unknown>;
              return (
                <div key={index} className="px-5 py-3">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {String(row.stage ?? row.errorClass ?? row.eventType ?? 'Pipeline error')}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate mt-1">
                    {String(row.errorMessage ?? row.message ?? row.hash ?? '--')}
                  </p>
                </div>
              );
            })}
            {allErrors.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                {language === 'es' ? 'Sin errores recientes' : 'No recent errors'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
