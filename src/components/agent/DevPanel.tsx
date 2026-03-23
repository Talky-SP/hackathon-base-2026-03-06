import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, Trash2, Circle, Wifi, WifiOff, Clock, Cpu, DollarSign, Zap, AlertTriangle, Filter, Database, Code, Search as SearchIcon, FileText, Bot, Wrench, Play, CheckCircle, XCircle, BarChart3, Hash, Table, Users } from 'lucide-react';
import type { LogEntry, TraceEntry } from '../../hooks/useDevLogs';
import { fetchChatTraces } from '../../hooks/useDevLogs';
import type { DevEvent } from '../../hooks/useAgentChat';

type Props = {
  logs: LogEntry[];
  connected: boolean;
  onClear: () => void;
  /** Active chat ID for loading traces */
  chatId?: string | null;
  /** Raw WebSocket events from agent chat */
  devEvents?: DevEvent[];
  onClearEvents?: () => void;
  /** REST API base URL for traces */
  apiBase?: string;
};

type Tab = 'events' | 'logs' | 'traces';

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

// Event type styling for the Events tab
const EVENT_STYLES: Record<string, { icon: typeof Bot; color: string; bg: string; label: string }> = {
  // Agent lifecycle
  event: { icon: Bot, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Event' },
  chat_id: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Chat ID' },
  response: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Response' },
  result: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Result' },
  final: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Final' },
  // Tasks
  task_created: { icon: Play, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Task Created' },
  task_progress: { icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Task Progress' },
  task_completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Task Done' },
  task_failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Task Failed' },
  cancelled: { icon: XCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Cancelled' },
};

// Sub-event styling (for event.event field)
const SUB_EVENT_STYLES: Record<string, { icon: typeof Bot; color: string; label: string }> = {
  thinking: { icon: Bot, color: 'text-blue-300', label: 'Thinking' },
  tool_calls: { icon: Wrench, color: 'text-orange-400', label: 'Tool Calls' },
  tool_call_detail: { icon: Wrench, color: 'text-orange-300', label: 'Tool Detail' },
  querying: { icon: Database, color: 'text-cyan-400', label: 'Querying' },
  query_result: { icon: Database, color: 'text-cyan-300', label: 'Query Result' },
  query_error: { icon: AlertTriangle, color: 'text-red-400', label: 'Query Error' },
  analyzing: { icon: Code, color: 'text-yellow-400', label: 'Analyzing' },
  analysis_result: { icon: Code, color: 'text-yellow-300', label: 'Analysis Result' },
  generating: { icon: FileText, color: 'text-purple-400', label: 'Generating' },
  code_exec_start: { icon: Play, color: 'text-green-400', label: 'Code Exec' },
  file_generated: { icon: FileText, color: 'text-green-300', label: 'File Generated' },
  agent_start: { icon: Bot, color: 'text-blue-400', label: 'Agent Start' },
  agent_done: { icon: CheckCircle, color: 'text-green-400', label: 'Agent Done' },
  intent: { icon: SearchIcon, color: 'text-pink-400', label: 'Intent' },
  step: { icon: Play, color: 'text-gray-400', label: 'Step' },
  // Subagent events
  dispatching_subagents: { icon: Users, color: 'text-violet-400', label: 'Dispatching' },
  dispatch_start: { icon: Users, color: 'text-violet-400', label: 'Dispatch' },
  subagent_start: { icon: Bot, color: 'text-violet-300', label: 'Sub Start' },
  subagent_thinking: { icon: Bot, color: 'text-violet-300', label: 'Sub Think' },
  subagent_query: { icon: Database, color: 'text-cyan-300', label: 'Sub Query' },
  subagent_code: { icon: Code, color: 'text-yellow-300', label: 'Sub Code' },
  subagent_complete: { icon: CheckCircle, color: 'text-violet-400', label: 'Sub Done' },
  subagent_result: { icon: FileText, color: 'text-violet-300', label: 'Sub Result' },
  subagents_done: { icon: Users, color: 'text-green-400', label: 'All Done' },
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

/** Renders a JSON-like value with syntax coloring */
function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span className="text-gray-500">null</span>;
  if (typeof value === 'boolean') return <span className="text-yellow-300">{String(value)}</span>;
  if (typeof value === 'number') return <span className="text-cyan-300">{value}</span>;
  if (typeof value === 'string') {
    // Truncate long strings
    const display = value.length > 200 ? value.slice(0, 200) + '...' : value;
    return <span className="text-green-300">"{display}"</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-500">[]</span>;
    if (depth > 2) return <span className="text-gray-500">[{value.length} items]</span>;
    return (
      <span>
        <span className="text-gray-500">[</span>
        {value.map((item, i) => (
          <span key={i}>
            {i > 0 && <span className="text-gray-600">, </span>}
            <JsonValue value={item} depth={depth + 1} />
          </span>
        ))}
        <span className="text-gray-500">]</span>
      </span>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-gray-500">{'{}'}</span>;
    if (depth > 2) return <span className="text-gray-500">{'{...}'}</span>;
    return (
      <span>
        <span className="text-gray-500">{'{'}</span>
        {entries.map(([k, v], i) => (
          <span key={k}>
            {i > 0 && <span className="text-gray-600">, </span>}
            <span className="text-purple-300">{k}</span>
            <span className="text-gray-500">: </span>
            <JsonValue value={v} depth={depth + 1} />
          </span>
        ))}
        <span className="text-gray-500">{'}'}</span>
      </span>
    );
  }
  return <span className="text-gray-400">{String(value)}</span>;
}

/** Get a specialized inline summary for known event types */
function getEventSummary(evt: DevEvent): { inline: string; badges?: Array<{ text: string; color: string }> } {
  const d = evt.data;
  const evtType = evt.type === 'event' ? evt.event : evt.type;

  switch (evtType) {
    case 'agent_start':
      return {
        inline: d.message as string || 'Starting agent...',
        badges: [
          ...(d.model ? [{ text: `${d.model}`, color: 'bg-blue-500/20 text-blue-300' }] : []),
          ...(d.intent ? [{ text: `${d.intent}`, color: 'bg-pink-500/20 text-pink-300' }] : []),
        ],
      };

    case 'intent':
      return {
        inline: d.message as string || '',
        badges: [
          ...(d.intent ? [{ text: `${d.intent}`, color: 'bg-pink-500/20 text-pink-300' }] : []),
          ...(d.confidence ? [{ text: `${((d.confidence as number) * 100).toFixed(0)}%`, color: 'bg-gray-500/20 text-gray-300' }] : []),
        ],
      };

    case 'thinking':
      return {
        inline: (d.message as string || 'Thinking...').slice(0, 120),
        badges: d.model ? [{ text: `${d.model}`, color: 'bg-blue-500/20 text-blue-300' }] : [],
      };

    case 'tool_calls': {
      const tools = d.tool_calls as Array<{ name: string }> | undefined;
      const names = tools?.map(t => t.name).join(', ') || d.message as string || '';
      return {
        inline: names,
        badges: tools ? [{ text: `${tools.length} tools`, color: 'bg-orange-500/20 text-orange-300' }] : [],
      };
    }

    case 'tool_call_detail': {
      const toolName = d.tool_name as string || d.name as string || '';
      const args = d.arguments as Record<string, unknown> | string | undefined;
      let argSummary = '';
      if (typeof args === 'string') {
        try { argSummary = Object.keys(JSON.parse(args)).join(', '); } catch { argSummary = args.slice(0, 60); }
      } else if (args && typeof args === 'object') {
        argSummary = Object.keys(args).join(', ');
      }
      return {
        inline: argSummary ? `${toolName}(${argSummary})` : toolName,
        badges: [{ text: toolName || 'tool', color: 'bg-orange-500/20 text-orange-300' }],
      };
    }

    case 'querying': {
      const table = d.table as string || d.index as string || '';
      const limit = d.limit as number | undefined;
      const filterStr = d.filter as string || d.query as string || '';
      const parts = [table, filterStr ? `filter: ${String(filterStr).slice(0, 60)}` : '', limit ? `limit: ${limit}` : ''].filter(Boolean);
      return {
        inline: parts.join(' · '),
        badges: [
          ...(table ? [{ text: table, color: 'bg-cyan-500/20 text-cyan-300' }] : []),
          ...(limit ? [{ text: `limit:${limit}`, color: 'bg-gray-500/20 text-gray-400' }] : []),
        ],
      };
    }

    case 'query_result': {
      const table = d.table as string || d.index as string || '';
      const count = d.count as number ?? d.row_count as number ?? d.results_count as number;
      const elapsed = d.elapsed_ms as number ?? d.latency_ms as number;
      return {
        inline: d.message as string || `${table} → ${count ?? '?'} rows`,
        badges: [
          ...(table ? [{ text: table, color: 'bg-cyan-500/20 text-cyan-300' }] : []),
          ...(count != null ? [{ text: `${count} rows`, color: 'bg-green-500/20 text-green-300' }] : []),
          ...(elapsed != null ? [{ text: `${elapsed}ms`, color: 'bg-gray-500/20 text-gray-400' }] : []),
        ],
      };
    }

    case 'query_error':
      return {
        inline: d.error as string || d.message as string || 'Query failed',
        badges: [
          ...(d.table ? [{ text: `${d.table}`, color: 'bg-red-500/20 text-red-300' }] : []),
        ],
      };

    case 'analyzing': {
      const code = d.code as string;
      const preview = code ? code.split('\n')[0]?.slice(0, 80) : (d.message as string || '');
      const queryCount = d.query_counts as Record<string, number> | undefined;
      const availQ = d.available_queries as string[] | undefined;
      return {
        inline: preview,
        badges: [
          ...(queryCount ? Object.entries(queryCount).map(([k, v]) => ({ text: `${k}:${v}`, color: 'bg-yellow-500/20 text-yellow-300' })) : []),
          ...(availQ ? [{ text: `${availQ.length} queries avail`, color: 'bg-gray-500/20 text-gray-400' }] : []),
        ],
      };
    }

    case 'analysis_result': {
      const preview = d.answer_preview as string || d.answer as string || d.message as string || '';
      const hasChart = d.has_chart as boolean;
      const srcCount = d.sources_count as number;
      return {
        inline: preview.slice(0, 100),
        badges: [
          ...(hasChart ? [{ text: 'Chart', color: 'bg-purple-500/20 text-purple-300' }] : []),
          ...(srcCount ? [{ text: `${srcCount} sources`, color: 'bg-gray-500/20 text-gray-400' }] : []),
        ],
      };
    }

    case 'generating':
      return {
        inline: d.message as string || 'Generating response...',
        badges: d.model ? [{ text: `${d.model}`, color: 'bg-purple-500/20 text-purple-300' }] : [],
      };

    case 'code_exec_start': {
      const lang = d.language as string || 'python';
      const code = d.code as string;
      const preview = code ? code.split('\n')[0]?.slice(0, 80) : (d.message as string || '');
      return {
        inline: preview,
        badges: [{ text: lang, color: 'bg-green-500/20 text-green-300' }],
      };
    }

    case 'file_generated': {
      const filename = d.filename as string || '';
      const files = d.files as Array<{ filename: string }> | undefined;
      const success = d.success as boolean | undefined;
      return {
        inline: filename || files?.map(f => f.filename).join(', ') || d.message as string || '',
        badges: [
          ...(files ? [{ text: `${files.length} files`, color: 'bg-green-500/20 text-green-300' }] : []),
          ...(success === true ? [{ text: 'OK', color: 'bg-green-500/20 text-green-300' }] : []),
          ...(success === false ? [{ text: 'FAIL', color: 'bg-red-500/20 text-red-300' }] : []),
        ],
      };
    }

    case 'agent_done': {
      const cost = d.cost_usd as number | undefined;
      const totalTokens = d.total_tokens as number | undefined;
      return {
        inline: d.message as string || 'Done',
        badges: [
          ...(cost != null ? [{ text: `$${cost.toFixed(4)}`, color: 'bg-green-500/20 text-green-300' }] : []),
          ...(totalTokens ? [{ text: `${formatTokens(totalTokens)} tok`, color: 'bg-blue-500/20 text-blue-300' }] : []),
        ],
      };
    }

    // Top-level types (not sub-events)
    case 'chat_id':
      return {
        inline: `Chat: ${d.chat_id as string || ''}`,
        badges: [],
      };

    case 'task_created': {
      const typeName = d.task_type_name as string || d.task_type as string || '';
      return {
        inline: `${typeName} — ${d.task_id as string || ''}`,
        badges: [{ text: typeName || 'task', color: 'bg-purple-500/20 text-purple-300' }],
      };
    }

    case 'task_progress': {
      const progress = d.progress as number | undefined;
      const step = d.step;
      const desc = typeof step === 'string' ? step : (step as { description?: string })?.description ?? '';
      return {
        inline: desc || d.message as string || '',
        badges: progress != null ? [{ text: `${progress}%`, color: progress >= 100 ? 'bg-green-500/20 text-green-300' : 'bg-purple-500/20 text-purple-300' }] : [],
      };
    }

    case 'task_completed': {
      const cost = d.cost_usd as number | undefined;
      const artifacts = d.artifacts as unknown[] | undefined;
      return {
        inline: d.summary as string || d.message as string || 'Completed',
        badges: [
          ...(cost != null ? [{ text: `$${cost.toFixed(4)}`, color: 'bg-green-500/20 text-green-300' }] : []),
          ...(artifacts?.length ? [{ text: `${artifacts.length} artifacts`, color: 'bg-blue-500/20 text-blue-300' }] : []),
        ],
      };
    }

    case 'task_failed':
      return {
        inline: d.error as string || d.message as string || 'Failed',
        badges: [],
      };

    case 'response': {
      const answer = d.answer as string || '';
      const hasChart = !!d.chart;
      const srcCount = (d.sources as unknown[])?.length ?? 0;
      const cost = d.cost_usd as number | undefined;
      return {
        inline: answer.slice(0, 100),
        badges: [
          ...(hasChart ? [{ text: 'Chart', color: 'bg-purple-500/20 text-purple-300' }] : []),
          ...(srcCount ? [{ text: `${srcCount} sources`, color: 'bg-gray-500/20 text-gray-400' }] : []),
          ...(cost != null ? [{ text: `$${cost.toFixed(4)}`, color: 'bg-green-500/20 text-green-300' }] : []),
        ],
      };
    }

    // Subagent events
    case 'dispatching_subagents':
    case 'dispatch_start': {
      const count = (d.subtask_count ?? d.subagent_count) as number | undefined;
      const docs = d.total_documents as number | undefined;
      return {
        inline: d.message as string || '',
        badges: [
          ...(count ? [{ text: `${count} agents`, color: 'bg-violet-500/20 text-violet-300' }] : []),
          ...(docs ? [{ text: `${docs} docs`, color: 'bg-gray-500/20 text-gray-400' }] : []),
        ],
      };
    }

    case 'subagent_start': {
      const sid = (d.subagent_id as string || '').slice(0, 12);
      const docCount = d.doc_count as number | undefined;
      return {
        inline: d.message as string || sid,
        badges: [
          { text: sid, color: 'bg-violet-500/20 text-violet-300' },
          ...(docCount ? [{ text: `${docCount} docs`, color: 'bg-gray-500/20 text-gray-400' }] : []),
        ],
      };
    }

    case 'subagent_thinking': {
      const sid = (d.subagent_id as string || '').slice(0, 12);
      const iter = d.iteration as number | undefined;
      const maxIter = d.max_iterations as number | undefined;
      return {
        inline: d.message as string || '',
        badges: [
          { text: sid, color: 'bg-violet-500/20 text-violet-300' },
          ...(iter != null ? [{ text: `iter ${iter}${maxIter ? '/' + maxIter : ''}`, color: 'bg-blue-500/20 text-blue-300' }] : []),
        ],
      };
    }

    case 'subagent_query': {
      const sid = (d.subagent_id as string || '').slice(0, 12);
      const table = d.table as string | undefined;
      return {
        inline: d.message as string || '',
        badges: [
          { text: sid, color: 'bg-violet-500/20 text-violet-300' },
          ...(table ? [{ text: table, color: 'bg-cyan-500/20 text-cyan-300' }] : []),
        ],
      };
    }

    case 'subagent_code': {
      const sid = (d.subagent_id as string || '').slice(0, 12);
      return {
        inline: d.code_preview as string || d.message as string || '',
        badges: [{ text: sid, color: 'bg-violet-500/20 text-violet-300' }],
      };
    }

    case 'subagent_complete': {
      const sid = (d.subagent_id as string || '').slice(0, 12);
      const success = d.success as boolean;
      const completed = d.completed as number | undefined;
      const totalSub = d.total as number | undefined;
      const cost = d.cost_usd as number | undefined;
      return {
        inline: d.message as string || '',
        badges: [
          { text: sid, color: 'bg-violet-500/20 text-violet-300' },
          { text: success ? 'OK' : 'FAIL', color: success ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300' },
          ...(completed != null && totalSub != null ? [{ text: `${completed}/${totalSub}`, color: 'bg-gray-500/20 text-gray-400' }] : []),
          ...(cost != null ? [{ text: `$${cost.toFixed(3)}`, color: 'bg-green-500/20 text-green-300' }] : []),
        ],
      };
    }

    case 'subagent_result': {
      const sid = (d.subagent_id as string || '').slice(0, 12);
      const docsProc = d.documents_processed as number | undefined;
      const totalAmt = d.total_amount as number | undefined;
      return {
        inline: d.message as string || `${docsProc ?? '?'} docs processed`,
        badges: [
          { text: sid, color: 'bg-violet-500/20 text-violet-300' },
          ...(docsProc ? [{ text: `${docsProc} docs`, color: 'bg-green-500/20 text-green-300' }] : []),
          ...(totalAmt ? [{ text: `${totalAmt.toLocaleString('es-ES')} EUR`, color: 'bg-gray-500/20 text-gray-400' }] : []),
        ],
      };
    }

    case 'subagents_done': {
      const cost = d.total_cost as number | undefined;
      const elapsed = d.elapsed_s as number | undefined;
      const docsProc = d.documents_processed as number | undefined;
      return {
        inline: d.message as string || 'All subagents done',
        badges: [
          ...(docsProc ? [{ text: `${docsProc} docs`, color: 'bg-green-500/20 text-green-300' }] : []),
          ...(cost != null ? [{ text: `$${cost.toFixed(3)}`, color: 'bg-green-500/20 text-green-300' }] : []),
          ...(elapsed != null ? [{ text: `${elapsed.toFixed(1)}s`, color: 'bg-gray-500/20 text-gray-400' }] : []),
        ],
      };
    }

    default:
      return {
        inline: d.message as string || '',
        badges: [],
      };
  }
}

/** Renders specialized detail for known event types */
function EventDetailSpecialized({ evt }: { evt: DevEvent }) {
  const d = evt.data;
  const evtType = evt.type === 'event' ? evt.event : evt.type;

  // Show specialized views for specific types
  switch (evtType) {
    case 'querying': {
      const table = d.table as string || d.index as string;
      const filter = d.filter || d.query;
      const params = d.params as Record<string, unknown> | undefined;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-cyan-800/50 space-y-1.5">
          {table && (
            <div className="flex items-center gap-2 text-[10px]">
              <Table size={10} className="text-cyan-400 shrink-0" />
              <span className="text-cyan-300 font-medium">{table}</span>
            </div>
          )}
          {filter && (
            <div className="text-[10px]">
              <span className="text-gray-500">Filter: </span>
              <span className="text-yellow-300 font-mono">{typeof filter === 'string' ? filter : JSON.stringify(filter)}</span>
            </div>
          )}
          {params && (
            <div className="text-[10px]">
              <span className="text-gray-500">Params: </span>
              <span className="text-gray-300"><JsonValue value={params} /></span>
            </div>
          )}
          <EventDetailGeneric data={d} skipExtra={['table', 'index', 'filter', 'query', 'params']} />
        </div>
      );
    }

    case 'query_result': {
      const table = d.table as string || d.index as string;
      const count = d.count ?? d.row_count ?? d.results_count;
      const sample = d.sample as unknown[] | undefined;
      const columns = d.columns as string[] | undefined;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-cyan-800/50 space-y-1.5">
          <div className="flex items-center gap-3 text-[10px]">
            {table && <span className="text-cyan-300 font-medium">{table}</span>}
            {count != null && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-300 font-medium">
                <Hash size={9} /> {count as number} rows
              </span>
            )}
            {columns && <span className="text-gray-500">cols: {columns.join(', ')}</span>}
          </div>
          {sample && sample.length > 0 && (
            <div className="text-[10px] bg-gray-800/50 rounded p-1.5 overflow-x-auto max-h-[80px]">
              <span className="text-gray-500">Sample: </span>
              <JsonValue value={sample} />
            </div>
          )}
          <EventDetailGeneric data={d} skipExtra={['table', 'index', 'count', 'row_count', 'results_count', 'sample', 'columns']} />
        </div>
      );
    }

    case 'tool_call_detail': {
      const toolName = d.tool_name as string || d.name as string;
      const args = d.arguments;
      let parsed: unknown = args;
      if (typeof args === 'string') { try { parsed = JSON.parse(args); } catch { /* keep as string */ } }
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-orange-800/50 space-y-1.5">
          {toolName && (
            <div className="flex items-center gap-2 text-[10px]">
              <Wrench size={10} className="text-orange-400" />
              <span className="text-orange-300 font-medium">{toolName}</span>
            </div>
          )}
          {parsed && (
            <div className="text-[10px] bg-gray-800/50 rounded p-1.5 overflow-x-auto max-h-[100px]">
              <span className="text-gray-500">Arguments: </span>
              <JsonValue value={parsed} />
            </div>
          )}
          <EventDetailGeneric data={d} skipExtra={['tool_name', 'name', 'arguments', 'tool_call_id']} />
        </div>
      );
    }

    case 'analyzing': {
      const code = d.code as string;
      const queryCountsObj = d.query_counts as Record<string, number> | undefined;
      const availQ = d.available_queries as string[] | undefined;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-yellow-800/50 space-y-1.5">
          {queryCountsObj && (
            <div className="flex items-center gap-2 flex-wrap text-[10px]">
              <span className="text-gray-500">Query data:</span>
              {Object.entries(queryCountsObj).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-300">
                  <Database size={8} /> {k}: {v}
                </span>
              ))}
            </div>
          )}
          {availQ && (
            <div className="text-[10px]">
              <span className="text-gray-500">Available queries: </span>
              <span className="text-gray-300">{availQ.join(', ')}</span>
            </div>
          )}
          {code && (
            <div className="text-[10px] bg-gray-800/50 rounded p-1.5 overflow-x-auto max-h-[120px]">
              <pre className="text-yellow-200/80 whitespace-pre-wrap font-mono text-[10px]">{code.slice(0, 600)}{code.length > 600 ? '\n...' : ''}</pre>
            </div>
          )}
          <EventDetailGeneric data={d} skipExtra={['code', 'query_counts', 'available_queries']} />
        </div>
      );
    }

    case 'code_exec_start': {
      const code = d.code as string;
      const lang = d.language as string;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-green-800/50 space-y-1.5">
          {lang && <div className="text-[10px] text-gray-500">Language: <span className="text-green-300">{lang}</span></div>}
          {code && (
            <div className="text-[10px] bg-gray-800/50 rounded p-1.5 overflow-x-auto max-h-[120px]">
              <pre className="text-green-200/80 whitespace-pre-wrap font-mono text-[10px]">{code.slice(0, 600)}{code.length > 600 ? '\n...' : ''}</pre>
            </div>
          )}
          <EventDetailGeneric data={d} skipExtra={['code', 'language']} />
        </div>
      );
    }

    case 'analysis_result': {
      const answer = d.answer_preview as string || d.answer as string;
      const hasChart = d.has_chart as boolean;
      const chartType = d.chart_type as string;
      const srcCount = d.sources_count as number;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-yellow-800/50 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            {hasChart && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300">
                <BarChart3 size={9} /> {chartType || 'chart'}
              </span>
            )}
            {srcCount != null && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-300">
                {srcCount} sources
              </span>
            )}
          </div>
          {answer && (
            <div className="text-[10px] text-gray-300 bg-gray-800/50 rounded p-1.5 max-h-[80px] overflow-y-auto">
              {answer.slice(0, 400)}{(answer.length ?? 0) > 400 ? '...' : ''}
            </div>
          )}
          <EventDetailGeneric data={d} skipExtra={['answer_preview', 'answer', 'has_chart', 'chart_type', 'sources_count']} />
        </div>
      );
    }

    case 'file_generated': {
      const files = d.files as Array<{ filename: string; type?: string; size_bytes?: number; url?: string }> | undefined;
      const filename = d.filename as string;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-green-800/50 space-y-1">
          {filename && !files && (
            <div className="flex items-center gap-2 text-[10px]">
              <FileText size={10} className="text-green-300" />
              <span className="text-green-300">{filename}</span>
              {d.size_bytes && <span className="text-gray-500">({((d.size_bytes as number) / 1024).toFixed(1)} KB)</span>}
            </div>
          )}
          {files?.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <FileText size={10} className="text-green-300" />
              <span className="text-green-300">{f.filename}</span>
              {f.type && <span className="text-gray-500 px-1 py-0.5 rounded bg-gray-800">{f.type}</span>}
              {f.size_bytes && <span className="text-gray-500">({(f.size_bytes / 1024).toFixed(1)} KB)</span>}
            </div>
          ))}
          <EventDetailGeneric data={d} skipExtra={['filename', 'files', 'size_bytes', 'url', 'success']} />
        </div>
      );
    }

    case 'task_progress': {
      const progress = d.progress as number | undefined;
      const step = d.step;
      const desc = typeof step === 'string' ? step : (step as { description?: string; step_number?: number })?.description;
      const stepNum = typeof step === 'object' ? (step as { step_number?: number })?.step_number : undefined;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-purple-800/50 space-y-1.5">
          {progress != null && (
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden max-w-[200px]">
                <div className="h-full bg-purple-400 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <span className="text-purple-300 font-medium tabular-nums">{progress}%</span>
            </div>
          )}
          {desc && (
            <div className="text-[10px]">
              {stepNum != null && <span className="text-gray-500">Step {stepNum}: </span>}
              <span className="text-gray-300">{desc}</span>
            </div>
          )}
          <EventDetailGeneric data={d} skipExtra={['progress', 'step', 'task_id']} />
        </div>
      );
    }

    case 'response': {
      const answer = d.answer as string;
      const chart = d.chart;
      const sources = d.sources as unknown[] | undefined;
      const files = d.files as unknown[] | undefined;
      const cost = d.cost_usd as number;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-green-800/50 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            {d.model_used && <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300">{d.model_used as string}</span>}
            {d.intent && <span className="px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-300">{d.intent as string}</span>}
            {chart && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300"><BarChart3 size={9} className="inline mr-1" />chart</span>}
            {sources?.length ? <span className="text-gray-400">{sources.length} sources</span> : null}
            {files?.length ? <span className="text-gray-400">{files.length} files</span> : null}
            {cost != null && <span className="text-green-300">${cost.toFixed(4)}</span>}
          </div>
          {answer && (
            <div className="text-[10px] text-gray-300 bg-gray-800/50 rounded p-1.5 max-h-[100px] overflow-y-auto whitespace-pre-wrap">
              {answer.slice(0, 500)}{answer.length > 500 ? '...' : ''}
            </div>
          )}
        </div>
      );
    }

    // Subagent events — specialized detail views
    case 'subagent_start': {
      const docs = d.documents as string[] | undefined;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-violet-800/50 space-y-1.5">
          {d.objective && (
            <div className="text-[10px] text-gray-300 bg-gray-800/50 rounded p-1.5 max-h-[60px] overflow-y-auto">
              {(d.objective as string).slice(0, 300)}
            </div>
          )}
          {docs && docs.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
              {docs.map((name, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">{name}</span>
              ))}
            </div>
          )}
          <EventDetailGeneric data={d} skipExtra={['subagent_id', 'objective', 'doc_count', 'documents']} />
        </div>
      );
    }

    case 'subagent_result': {
      const docs = d.documents as Array<{ filename: string; supplier?: string; total?: number; matched?: boolean }> | undefined;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-violet-800/50 space-y-1.5">
          {docs && docs.length > 0 && (
            <div className="space-y-0.5">
              {docs.map((doc, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className={doc.matched ? 'text-green-400' : 'text-amber-400'}>
                    {doc.matched ? '\u2713' : '\u25CB'}
                  </span>
                  <span className="text-gray-300 truncate">{doc.filename}</span>
                  {doc.supplier && <span className="text-gray-500">{doc.supplier}</span>}
                  {doc.total != null && <span className="text-gray-400 tabular-nums">{doc.total.toLocaleString('es-ES')} EUR</span>}
                </div>
              ))}
            </div>
          )}
          <EventDetailGeneric data={d} skipExtra={['subagent_id', 'documents', 'documents_processed', 'total_amount', 'success', 'cost_usd']} />
        </div>
      );
    }

    case 'subagents_done': {
      const subs = d.subagents as Array<{ subagent_id: string; success: boolean; documents_processed: number; cost_usd: number }> | undefined;
      return (
        <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-violet-800/50 space-y-1.5">
          {subs && subs.length > 0 && (
            <div className="space-y-0.5">
              {subs.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className={s.success ? 'text-green-400' : 'text-red-400'}>
                    {s.success ? '\u2713' : '\u2717'}
                  </span>
                  <span className="text-violet-300 font-mono">{s.subagent_id.slice(0, 12)}</span>
                  <span className="text-gray-400">{s.documents_processed} docs</span>
                  <span className="text-gray-500 tabular-nums">${s.cost_usd.toFixed(3)}</span>
                </div>
              ))}
            </div>
          )}
          <EventDetailGeneric data={d} skipExtra={['subagents', 'subagent_count', 'documents_processed', 'total_cost', 'elapsed_s', 'success']} />
        </div>
      );
    }

    default:
      return <EventDetailGeneric data={d} skipExtra={[]} />;
  }
}

/** Generic fallback detail — shows remaining key-value pairs */
function EventDetailGeneric({ data, skipExtra = [] }: { data: Record<string, unknown>; skipExtra?: string[] }) {
  const skipKeys = new Set(['type', 'event', 'request_id', 'message', ...skipExtra]);
  const entries = Object.entries(data).filter(([k]) => !skipKeys.has(k));
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1 mt-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 text-[10px]">
          <span className="text-purple-300 shrink-0 font-medium">{key}:</span>
          <span className="text-gray-300 break-all">
            {typeof value === 'object' && value !== null ? (
              <JsonValue value={value} />
            ) : typeof value === 'string' && value.length > 100 ? (
              <span className="text-green-300">{value.slice(0, 300)}{value.length > 300 ? '...' : ''}</span>
            ) : (
              <JsonValue value={value} />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Single event row with specialized inline summaries */
function EventRow({ evt, forceExpand }: { evt: DevEvent; forceExpand?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpand || expanded;

  const isSubEvent = evt.type === 'event' && evt.event;
  const subStyle = isSubEvent ? SUB_EVENT_STYLES[evt.event!] : null;
  const topStyle = EVENT_STYLES[evt.type];
  const Icon = subStyle?.icon ?? topStyle?.icon ?? Bot;
  const color = subStyle?.color ?? topStyle?.color ?? 'text-gray-400';
  const bg = topStyle?.bg ?? 'bg-gray-500/10';
  const label = subStyle?.label ?? topStyle?.label ?? evt.type;

  // Get specialized summary
  const { inline, badges = [] } = getEventSummary(evt);

  // Check if there's meaningful detail data beyond headers
  const skipKeys = new Set(['type', 'event', 'request_id', 'message']);
  const hasDetail = Object.keys(evt.data).some(k => !skipKeys.has(k));

  return (
    <div>
      <button
        type="button"
        onClick={() => hasDetail && setExpanded(!isExpanded)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors ${
          isExpanded ? 'bg-gray-800' : 'hover:bg-gray-800/50'
        } ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {hasDetail && (
          <ChevronRight size={10} className={`text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        )}
        {!hasDetail && <span className="w-[10px] shrink-0" />}
        <span className="text-gray-500 shrink-0 tabular-nums text-[10px]" style={{ minWidth: 72 }}>{formatTs(evt.ts)}</span>
        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${bg}`}>
          <Icon size={10} className={color} />
          <span className={color}>{label}</span>
        </div>
        {evt.requestId && (
          <span className="text-gray-600 text-[9px] shrink-0 tabular-nums">{evt.requestId.slice(0, 12)}</span>
        )}
        {badges.map((b, i) => (
          <span key={i} className={`px-1 py-0.5 rounded text-[9px] font-medium shrink-0 ${b.color}`}>{b.text}</span>
        ))}
        <span className="text-gray-300 text-[10px] truncate flex-1 min-w-0">{inline}</span>
      </button>
      {isExpanded && hasDetail && <EventDetailSpecialized evt={evt} />}
    </div>
  );
}

export default function DevPanel({ logs, connected, onClear, chatId, devEvents = [], onClearEvents, apiBase }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [expanded, setExpanded] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [filterLogger, setFilterLogger] = useState<string | null>(null);
  const [filterEventType, setFilterEventType] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [tracesLoading, setTracesLoading] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const [expandAllEvents, setExpandAllEvents] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll for logs
  useEffect(() => {
    if (autoScroll && activeTab === 'logs') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, activeTab]);

  // Auto-scroll for events
  useEffect(() => {
    if (autoScroll && activeTab === 'events') {
      eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [devEvents, autoScroll, activeTab]);

  // Load traces
  const loadTraces = useCallback(async () => {
    if (!chatId) { setTraces([]); return; }
    setTracesLoading(true);
    const data = await fetchChatTraces(chatId, apiBase);
    setTraces(data);
    setTracesLoading(false);
  }, [chatId]);

  const handleTracesTab = useCallback(() => {
    setActiveTab('traces');
    loadTraces();
  }, [loadTraces]);

  const filteredLogs = logs.filter(l => {
    if (filterLevel && l.level !== filterLevel) return false;
    if (filterLogger && l.logger !== filterLogger) return false;
    return true;
  });

  const filteredEvents = filterEventType
    ? devEvents.filter(e => {
        if (e.type === 'event' && e.event) return e.event === filterEventType;
        return e.type === filterEventType;
      })
    : devEvents;

  // Collect all unique event types for filtering
  const eventTypes = [...new Set(devEvents.map(e => e.type === 'event' && e.event ? e.event : e.type))];

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
            <span className="text-gray-500">{devEvents.length} events · {logs.length} logs</span>
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
    <div className="border-t border-gray-700 bg-gray-900 shrink-0 flex flex-col" style={{ height: 360 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'events' ? 'bg-gray-700 text-gray-200' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Events
            {devEvents.length > 0 && (
              <span className="ml-1 text-[9px] px-1 py-0.5 rounded-full bg-gray-600 text-gray-300">{devEvents.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'logs' ? 'bg-gray-700 text-gray-200' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Logs
            {logs.length > 0 && (
              <span className="ml-1 text-[9px] px-1 py-0.5 rounded-full bg-gray-600 text-gray-300">{logs.length}</span>
            )}
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
          {activeTab === 'events' && (
            <>
              {/* Event type filter */}
              {eventTypes.length > 0 && (
                <select
                  value={filterEventType ?? ''}
                  onChange={e => setFilterEventType(e.target.value || null)}
                  className="bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400 px-1.5 py-0.5 outline-none max-w-[120px]"
                >
                  <option value="">Todos</option>
                  {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}

              <button
                type="button"
                onClick={() => setExpandAllEvents(!expandAllEvents)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  expandAllEvents ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-400'
                }`}
                title={expandAllEvents ? 'Colapsar todos' : 'Expandir todos'}
              >
                {expandAllEvents ? <ChevronDown size={10} className="inline mr-0.5" /> : <ChevronRight size={10} className="inline mr-0.5" />}
                {expandAllEvents ? 'Colapsar' : 'Expandir'}
              </button>

              <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={e => setAutoScroll(e.target.checked)}
                  className="h-3 w-3 rounded bg-gray-700 border-gray-600"
                />
                Auto-scroll
              </label>

              {onClearEvents && (
                <button type="button" onClick={onClearEvents} className="text-gray-500 hover:text-gray-400 transition-colors" title="Limpiar eventos">
                  <Trash2 size={12} />
                </button>
              )}
            </>
          )}

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
        {/* Events tab */}
        {activeTab === 'events' && (
          <div className="px-2 py-1">
            {filteredEvents.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                {devEvents.length === 0 ? 'Esperando eventos del WebSocket... Envia un mensaje para ver eventos.' : 'Sin eventos con el filtro aplicado'}
              </div>
            ) : (
              filteredEvents.map(evt => <EventRow key={evt.id} evt={evt} forceExpand={expandAllEvents} />)
            )}
            <div ref={eventsEndRef} />
          </div>
        )}

        {/* Logs tab */}
        {activeTab === 'logs' && (
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
        )}

        {/* Traces tab */}
        {activeTab === 'traces' && (
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
