import { FileText } from 'lucide-react';
import type { Source } from '../../hooks/useAgentChat';

type Props = {
  source: Source;
  index: number;
};

export default function SourceCard({ source, index }: Props) {
  const formatEUR = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3.5 py-3 hover:border-gray-300 transition-colors cursor-pointer group">
      <div className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 text-xs font-bold text-white" style={{ backgroundColor: '#f2764b' }}>
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 truncate">{source.supplier}</span>
          {source.supplier_cif && (
            <span className="text-[10px] text-gray-400 shrink-0">{source.supplier_cif}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span className="font-medium tabular-nums" style={{ color: '#f2764b' }}>{formatEUR(source.total)}</span>
          <span>{source.invoice_date}</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
            source.reconciled ? 'bg-green-50 text-green-700' : 'text-white'
          }`} style={!source.reconciled ? { backgroundColor: '#f2764b' } : undefined}>
            {source.reconciled ? 'Pagada' : 'Pendiente'}
          </span>
        </div>
        {source.category && (
          <div className="flex items-center gap-1 mt-1">
            <FileText size={10} className="text-gray-400" />
            <span className="text-[10px] text-gray-400 truncate">{source.category}{source.concept ? ` · ${source.concept}` : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
