import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Bot, Database, Code, FileText } from 'lucide-react';

export type SubagentState = {
  subagentId: string;
  status: 'running' | 'completed' | 'failed';
  objective?: string;
  docCount?: number;
  documents?: string[];
  iteration?: number;
  maxIterations?: number;
  costUsd?: number;
  lastEvent?: string;
  /** Result data */
  documentsProcessed?: number;
  totalAmount?: number;
  resultDocuments?: Array<{
    filename: string;
    supplier?: string;
    total?: number;
    date?: string;
    matched?: boolean;
    issues?: string[];
  }>;
};

export type SubagentDispatchState = {
  active: boolean;
  message?: string;
  subtaskCount: number;
  totalDocuments: number;
  maxParallel?: number;
  budgetPerSubagent?: number;
  subagents: Map<string, SubagentState>;
  completedCount: number;
  failedCount: number;
  totalCost: number;
  elapsedS?: number;
  done: boolean;
};

type Props = {
  state: SubagentDispatchState;
};

function formatCost(n: number): string {
  return '$' + n.toFixed(3);
}

function formatAmount(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SubagentProgress({ state }: Props) {
  const [expanded, setExpanded] = useState(false);

  const agents = Array.from(state.subagents.values());
  const running = agents.filter(a => a.status === 'running').length;
  const completed = agents.filter(a => a.status === 'completed').length;
  const failed = agents.filter(a => a.status === 'failed').length;
  const total = state.subtaskCount || agents.length;
  const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Header — always visible */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          {/* Animated icon */}
          <div className="relative h-9 w-9 shrink-0">
            <div className={`absolute inset-0 rounded-lg flex items-center justify-center ${
              state.done
                ? failed > 0 ? 'bg-red-50' : 'bg-emerald-50'
                : 'bg-brand-50'
            }`}>
              {state.done ? (
                failed > 0 ? <XCircle size={18} className="text-red-500" /> : <CheckCircle2 size={18} className="text-emerald-500" />
              ) : (
                <Loader2 size={18} className="animate-spin" style={{ color: '#f2764b' }} />
              )}
            </div>
            {/* Agent count badge */}
            <div className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 rounded-full bg-gray-800 text-white text-[9px] font-bold flex items-center justify-center">
              {total}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-gray-800">
                {state.done
                  ? `${completed} agente${completed !== 1 ? 's' : ''} completado${completed !== 1 ? 's' : ''}`
                  : `${running} agente${running !== 1 ? 's' : ''} trabajando`
                }
              </span>
              {state.totalCost > 0 && (
                <span className="text-[10px] text-gray-400 tabular-nums">{formatCost(state.totalCost)}</span>
              )}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {state.totalDocuments > 0 && `${state.totalDocuments} documentos`}
              {state.done && state.elapsedS != null && ` · ${state.elapsedS.toFixed(1)}s`}
              {!state.done && running > 0 && ` · ${completed}/${total} completados`}
            </div>
          </div>

          {/* Progress ring or chevron */}
          <div className="flex items-center gap-2 shrink-0">
            {!state.done && (
              <div className="relative h-8 w-8">
                <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#f2764b" strokeWidth="3"
                    strokeDasharray={`${progress * 0.942} 100`}
                    strokeLinecap="round" className="transition-all duration-500" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-600 tabular-nums">
                  {progress}%
                </span>
              </div>
            )}
            {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          </div>
        </button>

        {/* Progress bar */}
        {!state.done && (
          <div className="px-4 pb-3">
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%`, backgroundColor: '#f2764b' }}
              />
            </div>
          </div>
        )}

        {/* Expanded — individual agent rows */}
        {expanded && (
          <div className="border-t border-gray-100 divide-y divide-gray-50">
            {agents.map(agent => (
              <AgentRow key={agent.subagentId} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentRow({ agent }: { agent: SubagentState }) {
  const [showDocs, setShowDocs] = useState(false);

  const statusIcon = agent.status === 'completed'
    ? <CheckCircle2 size={14} className="text-emerald-500" />
    : agent.status === 'failed'
      ? <XCircle size={14} className="text-red-500" />
      : <Loader2 size={14} className="animate-spin text-gray-400" />;

  const eventIcon = agent.lastEvent === 'subagent_query'
    ? <Database size={10} className="text-cyan-400" />
    : agent.lastEvent === 'subagent_code'
      ? <Code size={10} className="text-yellow-400" />
      : agent.lastEvent === 'subagent_thinking'
        ? <Bot size={10} className="text-blue-400" />
        : null;

  const hasDocs = (agent.resultDocuments && agent.resultDocuments.length > 0) || (agent.documents && agent.documents.length > 0);

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        {statusIcon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-gray-700 font-mono">{agent.subagentId.slice(0, 12)}</span>
            {agent.status === 'running' && agent.iteration != null && (
              <span className="text-[10px] text-gray-400 tabular-nums">
                iter {agent.iteration}{agent.maxIterations ? `/${agent.maxIterations}` : ''}
              </span>
            )}
            {eventIcon && <span className="flex items-center gap-0.5 text-[10px] text-gray-400">{eventIcon}</span>}
            {agent.docCount != null && (
              <span className="text-[10px] text-gray-400">{agent.docCount} docs</span>
            )}
          </div>
          {agent.status === 'completed' && (
            <div className="flex items-center gap-2 mt-0.5">
              {agent.documentsProcessed != null && (
                <span className="text-[10px] text-emerald-600 font-medium">{agent.documentsProcessed} procesados</span>
              )}
              {agent.totalAmount != null && agent.totalAmount > 0 && (
                <span className="text-[10px] text-gray-500 tabular-nums">{formatAmount(agent.totalAmount)} EUR</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {agent.costUsd != null && agent.costUsd > 0 && (
            <span className="text-[10px] text-gray-400 tabular-nums">{formatCost(agent.costUsd)}</span>
          )}
          {hasDocs && (
            <button
              type="button"
              onClick={() => setShowDocs(!showDocs)}
              className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showDocs ? 'Ocultar' : 'Ver docs'}
            </button>
          )}
        </div>
      </div>

      {/* Document detail */}
      {showDocs && agent.resultDocuments && agent.resultDocuments.length > 0 && (
        <div className="mt-2 ml-6 space-y-1">
          {agent.resultDocuments.map((doc, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <FileText size={10} className={doc.matched ? 'text-emerald-400' : 'text-amber-400'} />
              <span className="text-gray-600 truncate flex-1 min-w-0">{doc.filename}</span>
              {doc.supplier && <span className="text-gray-400 shrink-0">{doc.supplier}</span>}
              {doc.total != null && <span className="text-gray-500 tabular-nums shrink-0">{formatAmount(doc.total)} EUR</span>}
              {doc.matched != null && (
                <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${doc.matched ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {doc.matched ? 'Registrada' : 'Nueva'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {showDocs && !agent.resultDocuments && agent.documents && agent.documents.length > 0 && (
        <div className="mt-2 ml-6 space-y-0.5">
          {agent.documents.map((name, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500">
              <FileText size={10} className="text-gray-300" />
              <span className="truncate">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
