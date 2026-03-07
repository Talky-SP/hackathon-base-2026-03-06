import { X, FileText, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TabBarProps {
  tabs: { id: string; name: string; type: 'pdf' | 'image' }[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
}: TabBarProps) {
  const { t } = useLanguage();

  if (tabs.length === 0) {
    return (
      <div className="h-9 flex items-center px-3 bg-gray-100 border-b border-gray-200 text-xs text-gray-500">
        {t('tabs.noOpenTabs')}
      </div>
    );
  }

  return (
    <div className="h-9 flex items-center overflow-x-auto bg-gray-100 border-b border-gray-200">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`group h-full flex items-center gap-1.5 px-3 text-xs whitespace-nowrap border-r border-gray-200 transition-colors ${
              isActive
                ? 'bg-white border-b-2 border-b-brand-500 text-gray-800'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.type === 'pdf' ? (
              <FileText size={13} className="shrink-0 text-red-500" />
            ) : (
              <ImageIcon size={13} className="shrink-0 text-blue-500" />
            )}
            <span className="max-w-[120px] truncate">{tab.name}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }
              }}
              className="ml-1 p-0.5 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
              title={t('tabs.close')}
            >
              <X size={12} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
