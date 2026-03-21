import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Trash2, Circle, Wifi, WifiOff, Clock, Cpu, DollarSign, Zap, AlertTriangle, Filter } from 'lucide-react';
import type { LogEntry, TraceEntry } from '../../hooks/useDevLogs';
import { fetchChatTraces } from '../../hooks/useDevLogs';

type Props = {
  logs: LogEntry[];
  connected: boolean;
  onClear: () => void;
  /** Active chat ID for loading traces */
  chatId?: string | null;
};

type Tab = 'logs' | 'traces';

const LEVEL_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  DEBUG: { bg: 'bg-gray-50', text: 'text-gray-400', dot: 'text-gray-300' },
  INFO: { bg: '', text: 'text-blue-400', dot: 'text-blue-400' },
  WARNING: { bg: 'bg-yellow-50/50', text: 'text-yellow-500', dot: 'text-yellow-400' },
  ERROR: { bg: 'bg-red-50/50', text: 'text-red-500', dot: 'text-red-400' },
};

const LOGGER_COLORS: Record<string, string> = {
  pipeline: 'text-purple-400',
  hackathon_backend: 'text-cyan-400',
  litellm: 'text-green-400',
  uvicorn: 'text-gray-400',
};

function formatTs(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 1 } as Intl.DateTimeFormatOptions);
}

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number) {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}K`;
}

export default function DevPanel({ logs, connected, onClear, chatId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('logs');
  const [expanded, setExpanded] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [filterLogger, setFilterLogger] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [tracesLoading, setTracesLoading] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && activeTab === 'logs') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, activeTab]);

  // Load traces
  const loadTraces = useCallback(async () => {
    if (!chatId) { setTraces([]); return; }
    setTracesLoading(true);
    const data = await fetchChatTraces(chatId);
    setTraces(data);
    setTracesLoading(false);
  }, [chatId]);

  // Load traces when switching to traces tab — triggered by user action
  const handleTracesTab = useCallback(() => {
    setActiveTab('traces');
    loadTraces();
  }, [loadTraces]);

  const filteredLogs = logs.filter(l => {
    if (filterLevel && l.level !== filterLevel) return false;
    if (filterLogger && l.logger !== filterLogger) return false;
    return true;
  });

  const loggers = [...new Set(logs.map(l => l.logger))];

  if (!expanded) {
    return (
      <div className="border-t border-gray-200 bg-gray-900 shrink-0">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between px-4 py-1.5 text-[11px] text-gray-400 hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ChevronUp size={12} />
            <span className="font-medium">Dev Panel</span>
            <span className="text-gray-500">{logs.length} logs</span>
          </div>
          <div className="flex items-center gap-1.5">
            {connected ? (
              <><Wifi size={10} className="text-green-400" /><span className="text-green-400">Live</span></>
            ) : (
              <><WifiOff size={10} className="text-gray-500" /><span className="text-gray-500">Off</span></>
            )}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-700 bg-gray-900 shrink-0 flex flex-col" style={{ height: 320 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'logs' ? 'bg-gray-700 text-gray-200' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Logs
          </button>
          <button
            type="button"
            onClick={handleTracesTab}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'traces' ? 'bg-gray-700 text-gray-200' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Traces
            {traces.length > 0 && (
              <span className="ml-1 text-[9px] px-1 py-0.5 rounded-full bg-gray-600 text-gray-300">{traces.length}</span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'logs' && (
            <>
              {/* Level filter */}
              <div className="flex items-center gap-0.5">
                <Filter size={10} className="text-gray-500" />
                {['INFO', 'WARNING', 'ERROR', 'DEBUG'].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFilterLevel(filterLevel === level ? null : level)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                      filterLevel === level
                        ? `${LEVEL_STYLES[level].text} bg-gray-700`
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              {/* Logger filter */}
              {loggers.length > 0 && (
                <select
                  value={filterLogger ?? ''}
                  onChange={e => setFilterLogger(e.target.value || null)}
                  className="bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400 px-1.5 py-0.5 outline-none"
                >
                  <option value="">Todos</option>
                  {loggers.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              )}

              <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={e => setAutoScroll(e.target.checked)}
                  className="h-3 w-3 rounded bg-gray-700 border-gray-600"
                />
                Auto-scroll
              </label>

              <button type="button" onClick={onClear} className="text-gray-500 hover:text-gray-400 transition-colors" title="Limpiar logs">
                <Trash2 size={12} />
              </button>
            </>
          )}

          {activeTab === 'traces' && (
            <button type="button" onClick={loadTraces} disabled={tracesLoading}
              className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              {tracesLoading ? 'Cargando...' : 'Refrescar'}
            </button>
          )}

          <div className="flex items-center gap-1 text-[10px]">
            {connected ? (
              <><Wifi size={10} className="text-green-400" /><span className="text-green-400">Live</span></>
            ) : (
              <><WifiOff size={10} className="text-gray-500" /><span className="text-gray-500">Off</span></>
            )}
          </div>

          <button type="button" onClick={() => setExpanded(false)} className="text-gray-500 hover:text-gray-400 transition-colors">
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-[1.6]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}>
        {activeTab === 'logs' ? (
          <div className="px-2 py-1">
            {filteredLogs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                {logs.length === 0 ? 'Esperando logs del servidor...' : 'Sin logs con los filtros aplicados'}
              </div>
            ) : (
              filteredLogs.map((log, i) => {
                const style = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.INFO;
                const loggerColor = LOGGER_COLORS[log.logger] ?? 'text-gray-400';
                return (
                  <div key={i} className={`flex items-start gap-2 px-1 py-0.5 rounded hover:bg-gray-800/50 ${style.bg}`}>
                    <Circle size={6} className={`${style.dot} shrink-0 mt-1.5 fill-current`} />
                    <span className="text-gray-500 shrink-0 tabular-nums" style={{ minWidth: 72 }}>{formatTs(log.ts)}</span>
                    <span className={`${style.text} shrink-0 font-semibold uppercase`} style={{ minWidth: 52 }}>{log.level}</span>
                    <span className={`${loggerColor} shrink-0`} style={{ minWidth: 120 }}>{log.logger}</span>
                    <span className="text-gray-300 break-all">{log.message}</span>
                  </div>
                );
              })
            )}
            <div ref={logEndRef} />
          </div>
        ) : (
          <div className="px-2 py-1">
            {!chatId ? (
              <div className="text-gray-500 text-center py-8">Selecciona un chat para ver sus trazas</div>
            ) : tracesLoading ? (
              <div className="text-gray-500 text-center py-8">Cargando trazas...</div>
            ) : traces.length === 0 ? (
              <div className="text-gray-500 text-center py-8">Sin trazas para este chat</div>
            ) : (
              <div className="space-y-0.5">
                {/* Summary bar */}
                <div className="flex items-center gap-4 px-2 py-2 mb-2 rounded bg-gray-800/50 text-[10px]">
                  <div className="flex items-center gap-1 text-gray-400">
                    <Zap size={10} className="text-yellow-400" />
                    <span>{traces.length} llamadas LLM</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Cpu size={10} className="text-blue-400" />
                    <span>{formatTokens(traces.reduce((s, t) => s + t.total_tokens, 0))} tokens</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <DollarSign size={10} className="text-green-400" />
                    <span>${traces.reduce((s, t) => s + t.cost_usd, 0).toFixed(4)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Clock size={10} className="text-purple-400" />
                    <span>{formatLatency(traces.reduce((s, t) => s + t.latency_ms, 0))}</span>
                  </div>
                </div>

                {/* Trace rows */}
                {traces.map(trace => (
                  <div key={trace.trace_id}>
                    <button
                      type="button"
                      onClick={() => setExpandedTrace(expandedTrace === trace.trace_id ? null : trace.trace_id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800/50 transition-colors text-left"
                    >
                      {trace.status === 'ok' ? (
                        <Circle size={6} className="text-green-400 fill-current shrink-0" />
                      ) : (
                        <AlertTriangle size={10} className="text-red-400 shrink-0" />
                      )}
                      <span className="text-purple-300 shrink-0 font-medium" style={{ minWidth: 140 }}>{trace.step}</span>
                      <span className="text-cyan-400 shrink-0" style={{ minWidth: 140 }}>{trace.model}</span>
                      <span className="text-gray-400 shrink-0 tabular-nums" style={{ minWidth: 60 }}>{formatTokens(trace.total_tokens)} tok</span>
                      <span className="text-green-400 shrink-0 tabular-nums" style={{ minWidth: 60 }}>${trace.cost_usd.toFixed(4)}</span>
                      <span className="text-yellow-400 shrink-0 tabular-nums" style={{ minWidth: 60 }}>{formatLatency(trace.latency_ms)}</span>
                      <span className="text-gray-500 shrink-0 tabular-nums">{formatTs(trace.started_at)}</span>
                    </button>

                    {/* Expanded detail */}
                    {expandedTrace === trace.trace_id && (
                      <div className="ml-4 mb-2 pl-3 border-l-2 border-gray-700 space-y-1.5 py-1.5">
                        <div className="flex gap-4 text-[10px]">
                          <span className="text-gray-500">Prompt tokens:</span>
                          <span className="text-gray-300 tabular-nums">{trace.prompt_tokens.toLocaleString()}</span>
                          <span className="text-gray-500">Completion tokens:</span>
                          <span className="text-gray-300 tabular-nums">{trace.completion_tokens.toLocaleString()}</span>
                        </div>
                        {trace.provider && (
                          <div className="text-[10px]"><span className="text-gray-500">Provider:</span> <span className="text-gray-300">{trace.provider}</span></div>
                        )}
                        {trace.input?.last_user_message && (
                          <div className="text-[10px]">
                            <span className="text-gray-500">Input:</span>{' '}
                            <span className="text-gray-300 break-all">{trace.input.last_user_message.slice(0, 200)}{trace.input.last_user_message.length > 200 ? '...' : ''}</span>
                          </div>
                        )}
                        {trace.output?.text && (
                          <div className="text-[10px]">
                            <span className="text-gray-500">Output:</span>{' '}
                            <span className="text-gray-300 break-all">{trace.output.text.slice(0, 300)}{trace.output.text.length > 300 ? '...' : ''}</span>
                          </div>
                        )}
                        {trace.tool_calls && trace.tool_calls.length > 0 && (
                          <div className="text-[10px]">
                            <span className="text-gray-500">Tools:</span>{' '}
                            {trace.tool_calls.map((tc, i) => (
                              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-800 text-orange-300 mr-1">{tc.name}</span>
                            ))}
                          </div>
                        )}
                        {trace.error && (
                          <div className="text-[10px] text-red-400">Error: {trace.error}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
