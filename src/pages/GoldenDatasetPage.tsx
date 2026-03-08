import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, Search, FileText, Receipt, Wallet, Truck, MapPin,
  Plus, ChevronDown,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTestQueue } from '../context/TestQueueContext';
import { MOCK_DATASETS } from '../data/goldenMockData';
import { ERROR_CATEGORY_LABELS } from '../types/golden';
import type { GoldenDataset, ErrorCategory } from '../types/golden';
import MiniSparkline from '../components/golden/MiniSparkline';

type FilterType = 'all' | 'expenses' | 'income' | 'payrolls' | 'delivery_notes';

const FILTER_OPTIONS: { value: FilterType; labelEs: string; labelEn: string }[] = [
  { value: 'all', labelEs: 'Todos', labelEn: 'All' },
  { value: 'expenses', labelEs: 'Gastos', labelEn: 'Expenses' },
  { value: 'income', labelEs: 'Ingresos', labelEn: 'Income' },
  { value: 'payrolls', labelEs: 'Nominas', labelEn: 'Payrolls' },
  { value: 'delivery_notes', labelEs: 'Albaranes', labelEn: 'Delivery Notes' },
];

function ErrorCategoryBadge({ category, language }: { category: ErrorCategory; language: 'es' | 'en' }) {
  const label = ERROR_CATEGORY_LABELS[category][language];
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded bg-gray-100 text-gray-600 whitespace-nowrap">
      {label}
    </span>
  );
}

function DatasetCheckbox({ dataset, selected, onToggle }: {
  dataset: GoldenDataset;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
        selected
          ? 'bg-brand-500 border-brand-500'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      {selected && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export default function GoldenDatasetPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toggleItem, isInQueue } = useTestQueue();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const datasets = useMemo(() => {
    let result = MOCK_DATASETS;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
      );
    }

    if (filter !== 'all') {
      result = result.filter(d => {
        switch (filter) {
          case 'expenses': return d.expenseDocs > 0;
          case 'income': return d.incomeDocs > 0;
          case 'payrolls': return d.payrollDocs > 0;
          case 'delivery_notes': return d.deliveryNoteDocs > 0;
          default: return true;
        }
      });
    }

    return result;
  }, [search, filter]);

  const activeFilter = FILTER_OPTIONS.find(f => f.value === filter)!;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('golden.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('golden.subtitle')}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} />
          {language === 'es' ? 'Nuevo Dataset' : 'New Dataset'}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'es' ? 'Buscar datasets...' : 'Search datasets...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <span className="text-gray-600">
              {language === 'es' ? activeFilter.labelEs : activeFilter.labelEn}
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {showFilterDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
              <div className="absolute top-full mt-1 left-0 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilter(opt.value); setShowFilterDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      filter === opt.value ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {language === 'es' ? opt.labelEs : opt.labelEn}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-10 px-4 py-3" />
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Dataset' : 'Dataset'}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <FileText size={13} className="inline mr-1 -mt-0.5" />
                {language === 'es' ? 'Docs' : 'Docs'}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <Receipt size={13} className="inline mr-1 -mt-0.5" />
                {language === 'es' ? 'Gastos' : 'Expenses'}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <Wallet size={13} className="inline mr-1 -mt-0.5" />
                {language === 'es' ? 'Ingresos' : 'Income'}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Nominas' : 'Payrolls'}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <Truck size={13} className="inline mr-1 -mt-0.5" />
                {language === 'es' ? 'Albaranes' : 'D. Notes'}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <MapPin size={13} className="inline mr-1 -mt-0.5" />
                Locations
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Evolucion' : 'Evolution'}
              </th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Categorias' : 'Categories'}
              </th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((ds) => {
              const inQueue = isInQueue(ds.id);
              return (
                <tr
                  key={ds.id}
                  onClick={() => navigate(`/golden-dataset/${ds.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <DatasetCheckbox
                      dataset={ds}
                      selected={inQueue}
                      onToggle={() => toggleItem({
                        type: 'dataset',
                        id: ds.id,
                        label: ds.name,
                        sublabel: `${ds.totalDocs} docs`,
                        docCount: ds.totalDocs,
                      })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Database size={14} className="text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{ds.name}</p>
                        <p className="text-xs text-gray-400 truncate">{ds.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="text-sm font-medium text-gray-900">{ds.totalDocs.toLocaleString()}</span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="text-sm text-gray-600">{ds.expenseDocs}</span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="text-sm text-gray-600">{ds.incomeDocs}</span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="text-sm text-gray-600">{ds.payrollDocs}</span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="text-sm text-gray-600">{ds.deliveryNoteDocs}</span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      {ds.locationIds.length}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center">
                      <MiniSparkline data={ds.evolution} />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {ds.errorCategories.slice(0, 3).map(cat => (
                        <ErrorCategoryBadge key={cat} category={cat} language={language} />
                      ))}
                      {ds.errorCategories.length > 3 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded bg-gray-50 text-gray-400">
                          +{ds.errorCategories.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {datasets.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Database size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {language === 'es' ? 'No se encontraron datasets' : 'No datasets found'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
