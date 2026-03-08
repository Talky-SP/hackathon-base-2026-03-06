import { useState } from 'react';
import { FlaskConical, ChevronDown, ChevronUp, X, Database, FileText, Play } from 'lucide-react';
import { useTestQueue } from '../context/TestQueueContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';

export default function TestQueuePanel() {
  const { items, removeItem, clearQueue } = useTestQueue();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);

  const totalDocs = items.reduce((sum, item) => sum + (item.docCount ?? 1), 0);

  return (
    <div className="fixed bottom-6 right-6 w-80 z-50">
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
              <FlaskConical size={14} className="text-brand-500" />
            </div>
            <span className="text-sm font-medium text-gray-900">Test Queue</span>
            <span className="text-xs text-gray-400">({items.length})</span>
          </div>
          {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
        </button>

        {/* Content */}
        {isExpanded && (
          <div className="border-t border-gray-100">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <FlaskConical size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  {language === 'es' ? 'Sin tests en cola' : 'No tests in queue'}
                </p>
                <p className="text-xs text-gray-300 mt-0.5">
                  {language === 'es' ? 'Agrega datasets desde la tabla' : 'Add datasets from the table'}
                </p>
              </div>
            ) : (
              <>
                <div className="max-h-52 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group">
                      {item.type === 'dataset' ? (
                        <Database size={14} className="text-gray-400 shrink-0" />
                      ) : (
                        <FileText size={14} className="text-gray-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{item.label}</p>
                        <p className="text-xs text-gray-400 truncate">{item.sublabel}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded transition-all"
                      >
                        <X size={12} className="text-gray-400" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{totalDocs} {language === 'es' ? 'documentos' : 'documents'}</span>
                    <button onClick={clearQueue} className="hover:text-gray-600 transition-colors">
                      {language === 'es' ? 'Limpiar' : 'Clear'}
                    </button>
                  </div>
                  <button
                    onClick={() => navigate('/test')}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Play size={14} />
                    {language === 'es' ? 'Ejecutar Tests' : 'Run Tests'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
