import { useState } from 'react';
import { FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { DOC_TYPES, type DocType } from '../../services/docApiUrls';
import { formatFileSize } from '../../utils/fileValidation';
import Modal from '../ui/Modal';

// ─── Types ─────────────────────────────────────────────────────────────────

interface FileTypeModalProps {
  files: File[];
  onConfirm: (files: { file: File; docType: DocType }[]) => void;
  onCancel: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function FileTypeModal({ files, onConfirm, onCancel }: FileTypeModalProps) {
  const { t } = useLanguage();

  const [globalType, setGlobalType] = useState<DocType>('expenses');
  const [overrides, setOverrides] = useState<Record<string, DocType>>({});
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));

  const getDocType = (fileName: string): DocType => overrides[fileName] ?? globalType;

  const handleGlobalChange = (type: DocType) => {
    setGlobalType(type);
    setOverrides((prev) => {
      const next: Record<string, DocType> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v !== type) next[k] = v;
      }
      return next;
    });
  };

  const handleOverride = (fileName: string, type: DocType) => {
    if (type === globalType) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[fileName];
        return next;
      });
    } else {
      setOverrides((prev) => ({ ...prev, [fileName]: type }));
    }
  };

  const handleConfirm = () => {
    onConfirm(sortedFiles.map((file) => ({ file, docType: getDocType(file.name) })));
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={t('fileType.modalTitle')}
      footer={
        <>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t('fileType.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
          >
            {t('fileType.confirm')}
          </button>
        </>
      }
    >
      {/* Global doc-type buttons */}
      <div className="px-5 pt-4 pb-2 flex flex-wrap gap-1.5">
        {DOC_TYPES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleGlobalChange(key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              globalType === key
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* File list */}
      <div className="px-5 py-2">
        {sortedFiles.map((file) => {
          const isExpanded = expandedFile === file.name;
          const currentType = getDocType(file.name);
          const hasOverride = file.name in overrides;

          return (
            <div key={file.name} className="border-b border-gray-100 last:border-0">
              <div
                className="flex items-center gap-2 py-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
                onClick={() => setExpandedFile(isExpanded ? null : file.name)}
              >
                {isExpanded ? (
                  <ChevronDown size={14} className="shrink-0 text-gray-400" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-gray-400" />
                )}
                <FileText size={14} className="shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                {hasOverride && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 font-medium">
                    {DOC_TYPES.find((d) => d.key === currentType)?.label}
                  </span>
                )}
              </div>

              {isExpanded && (
                <div className="pl-8 pb-2 flex flex-wrap gap-1">
                  {DOC_TYPES.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => handleOverride(file.name, key)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        currentType === key
                          ? 'bg-brand-50 border-brand-300 text-brand-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={11} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
