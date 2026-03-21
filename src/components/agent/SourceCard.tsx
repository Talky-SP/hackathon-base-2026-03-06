import { useState } from 'react';
import { FileText, ChevronDown, ExternalLink } from 'lucide-react';
import type { Source } from '../../hooks/useAgentChat';

type SourcesListProps = {
  sources: Source[];
};

const formatEUR = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';

/** Collapsible sources section — shows a compact summary bar, expands to show all */
export default function SourcesList({ sources }: SourcesListProps) {
  const [expanded, setExpanded] = useState(false);

  if (sources.length === 0) return null;

  const totalAmount = sources.reduce((sum, s) => sum + (s.total ?? 0), 0);
  const paidCount = sources.filter(s => s.reconciled).length;
  const pendingCount = sources.length - paidCount;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden max-w-2xl">
      {/* Summary bar — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center justify-center h-6 w-6 rounded-md shrink-0" style={{ backgroundColor: '#fdf5f3' }}>
          <FileText size={13} style={{ color: '#f2764b' }} />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-700">
            {sources.length} documento{sources.length !== 1 ? 's' : ''} de referencia
          </span>
          <span className="text-[11px] text-gray-400 tabular-nums">{formatEUR(totalAmount)}</span>
          {paidCount > 0 && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">{paidCount} pagada{paidCount !== 1 ? 's' : ''}</span>}
          {pendingCount > 0 && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: '#ffd2d5', color: '#c44a2a' }}>{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>}
        </div>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="border-t border-gray-100">
          {sources.map((source, i) => (
            <SourceRow key={i} source={source} index={i} isLast={i === sources.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceRow({ source, index, isLast }: { source: Source; index: number; isLast: boolean }) {
  if (!source) return null;
  return (
    <div className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer group ${!isLast ? 'border-b border-gray-100' : ''}`}>
      {/* Index */}
      <span className="text-[10px] font-bold text-white h-5 w-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#f2764b' }}>
        {index + 1}
      </span>

      {/* Supplier */}
      <span className="text-xs font-medium text-gray-800 truncate min-w-0 flex-1" style={{ maxWidth: 200 }}>
        {source.supplier ?? '—'}
      </span>

      {/* Amount */}
      <span className="text-xs font-medium tabular-nums shrink-0" style={{ color: '#f2764b' }}>
        {formatEUR(source.total ?? 0)}
      </span>

      {/* Date */}
      <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">{source.invoice_date ?? ''}</span>

      {/* Status */}
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
        source.reconciled ? 'bg-green-50 text-green-700' : 'text-white'
      }`} style={!source.reconciled ? { backgroundColor: '#f2764b' } : undefined}>
        {source.reconciled ? 'Pagada' : 'Pendiente'}
      </span>

      {/* Category */}
      <span className="text-[10px] text-gray-400 truncate hidden sm:inline" style={{ maxWidth: 140 }}>
        {source.category ?? ''}{source.concept ? ` · ${source.concept}` : ''}
      </span>

      {/* Open icon on hover */}
      <ExternalLink size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}
