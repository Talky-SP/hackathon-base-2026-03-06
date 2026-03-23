import { useState, useEffect } from 'react';
import { X, Zap, Cpu, Layers } from 'lucide-react';
import type { ChatCosts } from '../../hooks/useAgentChats';

type Props = {
  chatId: string;
  chatTitle: string;
  fetchCosts: (chatId: string) => Promise<ChatCosts | null>;
  onClose: () => void;
};

const formatUSD = (n: number) => {
  if (n < 0.01) return '<$0.01';
  return '$' + n.toFixed(4);
};

const formatTokens = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const STEP_LABELS: Record<string, string> = {
  classifier: 'Clasificador',
  orchestrator: 'Orquestador',
};
function stepLabel(step: string) {
  if (STEP_LABELS[step]) return STEP_LABELS[step];
  const match = step.match(/query_agent_iter_(\d+)/);
  if (match) return `Agente consulta #${match[1]}`;
  return step;
}

export default function CostPanel({ chatId, chatTitle, fetchCosts, onClose }: Props) {
  const [costs, setCosts] = useState<ChatCosts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCosts(chatId).then(data => {
      if (!cancelled) {
        setCosts(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [chatId, fetchCosts]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800">Costes de IA</h3>
            <p className="text-xs text-gray-400 truncate mt-0.5">{chatTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#f2764b', borderTopColor: 'transparent' }} />
            </div>
          ) : !costs ? (
            <p className="text-sm text-gray-400 text-center py-8">No hay datos de costes disponibles para este chat.</p>
          ) : (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <SummaryCard icon={<Zap size={14} />} label="Coste total" value={formatUSD(costs.summary.total_cost_usd)} accent />
                <SummaryCard icon={<Layers size={14} />} label="Tokens totales" value={formatTokens(costs.summary.total_tokens)} />
                <SummaryCard icon={<Cpu size={14} />} label="Llamadas LLM" value={String(costs.summary.total_calls)} />
              </div>

              {/* Token breakdown */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600">Tokens</span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="text-center flex-1">
                    <div className="text-lg font-semibold text-gray-800 tabular-nums">{formatTokens(costs.summary.prompt_tokens)}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Entrada</div>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div className="text-center flex-1">
                    <div className="text-lg font-semibold text-gray-800 tabular-nums">{formatTokens(costs.summary.completion_tokens)}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Salida</div>
                  </div>
                </div>
              </div>

              {/* By model */}
              {costs.by_model && costs.by_model.length > 0 && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-600">Coste por modelo</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {costs.by_model.map(m => {
                      const pct = costs.summary.total_cost_usd > 0
                        ? (m.cost_usd / costs.summary.total_cost_usd) * 100
                        : 0;
                      return (
                        <div key={m.model} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-gray-700">{m.model}</span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: '#f2764b' }}>{formatUSD(m.cost_usd)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: '#f2764b' }} />
                            </div>
                            <span className="text-[10px] text-gray-400 tabular-nums shrink-0 w-8 text-right">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5">
                            <span className="text-[10px] text-gray-400">{m.calls} llamada{m.calls !== 1 ? 's' : ''}</span>
                            <span className="text-[10px] text-gray-400">{formatTokens(m.prompt_tokens)} in</span>
                            <span className="text-[10px] text-gray-400">{formatTokens(m.completion_tokens)} out</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* By step */}
              {costs.by_step && costs.by_step.length > 0 && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-600">Coste por paso</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {costs.by_step.map(s => (
                      <div key={s.step} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: '#f2764b', opacity: Math.max(0.3, s.cost_usd / (costs.summary.total_cost_usd || 1)) }} />
                          <span className="text-xs text-gray-700 truncate">{stepLabel(s.step)}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] text-gray-400 tabular-nums">{formatTokens(s.total_tokens)} tok</span>
                          <span className="text-xs font-medium tabular-nums" style={{ color: '#f2764b' }}>{formatUSD(s.cost_usd)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 px-3 py-3 text-center">
      <div className="flex items-center justify-center mb-1.5" style={accent ? { color: '#f2764b' } : { color: '#9ca3af' }}>
        {icon}
      </div>
      <div className={`text-base font-semibold tabular-nums ${accent ? '' : 'text-gray-800'}`} style={accent ? { color: '#f2764b' } : undefined}>
        {value}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
