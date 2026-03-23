import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronRight, Ban, FileText, Receipt, Users, Calculator, ClipboardCheck, CircleDot } from 'lucide-react';
import type { TodoItem, CloseStatus } from '../../hooks/useAgentChat';

type Props = {
  todo: TodoItem[];
  closeStatus: CloseStatus;
};

const STATUS_CONFIG: Record<CloseStatus, { icon: typeof CheckCircle2; label: string; color: string; bg: string; border: string; ring: string }> = {
  CERRADO: {
    icon: CheckCircle2,
    label: 'Cierre completado',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    ring: 'ring-emerald-500/20',
  },
  BLOQUEADO: {
    icon: Ban,
    label: 'Cierre bloqueado',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    ring: 'ring-red-500/20',
  },
  PENDIENTE: {
    icon: Clock,
    label: 'Pendiente de revision',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    ring: 'ring-amber-500/20',
  },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string; dot: string }> = {
  critical: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Critico', dot: 'bg-red-500' },
  high: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'Alto', dot: 'bg-orange-500' },
  medium: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', label: 'Medio', dot: 'bg-yellow-500' },
  low: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Bajo', dot: 'bg-blue-500' },
};

const CATEGORY_CONFIG: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  conciliacion: { icon: Calculator, label: 'Conciliacion', color: 'text-cyan-600' },
  facturacion: { icon: Receipt, label: 'Facturacion', color: 'text-violet-600' },
  nominas: { icon: Users, label: 'Nominas', color: 'text-pink-600' },
  iva: { icon: FileText, label: 'IVA', color: 'text-emerald-600' },
  revision: { icon: ClipboardCheck, label: 'Revision', color: 'text-gray-600' },
};

function formatAmount(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';
}

export default function CloseStatusCard({ todo, closeStatus }: Props) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const statusCfg = STATUS_CONFIG[closeStatus] ?? STATUS_CONFIG.PENDIENTE;
  const StatusIcon = statusCfg.icon;

  const blockingTasks = todo.filter(t => t.blocking);
  const nonBlockingTasks = todo.filter(t => !t.blocking);
  const totalAmount = todo.reduce((sum, t) => sum + (t.amount ?? 0), 0);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const progress = todo.length > 0 ? Math.round((checkedItems.size / todo.length) * 100) : 0;

  return (
    <div className="max-w-2xl space-y-3">
      {/* Status header card */}
      <div className={`rounded-xl border ${statusCfg.border} ${statusCfg.bg} overflow-hidden`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${statusCfg.bg} ring-1 ${statusCfg.ring}`}>
              <StatusIcon size={18} className={statusCfg.color} />
            </div>
            <div>
              <div className={`text-sm font-semibold ${statusCfg.color}`}>{statusCfg.label}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {todo.length} tarea{todo.length !== 1 ? 's' : ''}
                {blockingTasks.length > 0 && <span className="text-red-600 font-medium"> &middot; {blockingTasks.length} bloqueante{blockingTasks.length !== 1 ? 's' : ''}</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            {totalAmount > 0 && (
              <div className="text-sm font-semibold text-gray-800 tabular-nums">{formatAmount(totalAmount)}</div>
            )}
            {checkedItems.size > 0 && (
              <div className="text-[10px] text-gray-400 mt-0.5">{checkedItems.size}/{todo.length} completadas</div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {checkedItems.size > 0 && (
          <div className="px-4 pb-3">
            <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progress}%`,
                  backgroundColor: progress === 100 ? '#059669' : '#f2764b',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Todo items */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
        {/* Blocking tasks section */}
        {blockingTasks.length > 0 && (
          <>
            <div className="px-4 py-2 bg-red-50/50 border-b border-red-100">
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-red-500" />
                <span className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">Bloqueantes</span>
              </div>
            </div>
            {blockingTasks.map(item => (
              <TodoRow
                key={item.id}
                item={item}
                expanded={expandedItems.has(item.id)}
                checked={checkedItems.has(item.id)}
                onToggleExpand={() => toggleExpand(item.id)}
                onToggleCheck={() => toggleCheck(item.id)}
              />
            ))}
          </>
        )}

        {/* Non-blocking tasks section */}
        {nonBlockingTasks.length > 0 && (
          <>
            {blockingTasks.length > 0 && (
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-gray-400" />
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Pendientes</span>
                </div>
              </div>
            )}
            {nonBlockingTasks.map(item => (
              <TodoRow
                key={item.id}
                item={item}
                expanded={expandedItems.has(item.id)}
                checked={checkedItems.has(item.id)}
                onToggleExpand={() => toggleExpand(item.id)}
                onToggleCheck={() => toggleCheck(item.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function TodoRow({ item, expanded, checked, onToggleExpand, onToggleCheck }: {
  item: TodoItem;
  expanded: boolean;
  checked: boolean;
  onToggleExpand: () => void;
  onToggleCheck: () => void;
}) {
  const priorityCfg = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.medium;
  const categoryCfg = CATEGORY_CONFIG[item.category] ?? { icon: CircleDot, label: item.category, color: 'text-gray-500' };
  const CategoryIcon = categoryCfg.icon;

  return (
    <div className={`transition-colors ${checked ? 'bg-gray-50/50' : 'hover:bg-gray-50'}`}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          type="button"
          onClick={onToggleCheck}
          className={`mt-0.5 h-[18px] w-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
            checked
              ? 'bg-emerald-500 border-emerald-500'
              : item.blocking
                ? 'border-red-300 hover:border-red-400'
                : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {checked && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onToggleExpand}
            className="w-full text-left flex items-start gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-medium leading-tight ${checked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {item.title}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* Priority badge */}
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${priorityCfg.bg}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${priorityCfg.dot}`} />
                  <span className={priorityCfg.color}>{priorityCfg.label}</span>
                </span>
                {/* Category badge */}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  <CategoryIcon size={10} className={categoryCfg.color} />
                  {categoryCfg.label}
                </span>
                {/* Amount */}
                {item.amount != null && item.amount > 0 && (
                  <span className="text-[11px] font-semibold text-gray-700 tabular-nums">
                    {formatAmount(item.amount)}
                  </span>
                )}
                {/* Items count */}
                {item.items_count != null && (
                  <span className="text-[10px] text-gray-400">
                    {item.items_count} item{item.items_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            {/* Expand chevron */}
            {item.description && (
              <span className="mt-1 shrink-0 text-gray-400">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
          </button>

          {/* Expanded description */}
          {expanded && item.description && (
            <div className={`mt-2 text-[12px] leading-relaxed rounded-lg px-3 py-2.5 ${
              checked ? 'text-gray-400 bg-gray-50' : 'text-gray-600 bg-gray-50'
            }`}>
              {item.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
