import { FileText, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatFileSize } from '../../utils/fileValidation';
import type { UploadedFile } from './FileUploadZone';

// ─── Types ─────────────────────────────────────────────────────────────────

interface FileExplorerProps {
  files: UploadedFile[];
  selectedFileId: string | null;
  onSelectFile: (id: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function FileExplorer({
  files,
  selectedFileId,
  onSelectFile,
}: FileExplorerProps) {
  const { t } = useLanguage();

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      <div className="shrink-0 px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {t('workspace.files')}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {files.map((file) => {
          const isSelected = file.id === selectedFileId;
          return (
            <button
              key={file.id}
              onClick={() => onSelectFile(file.id)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors border-l-2 ${
                isSelected
                  ? 'bg-brand-50 border-brand-500'
                  : 'border-transparent hover:bg-gray-50'
              }`}
            >
              {file.type === 'pdf' ? (
                <FileText size={16} className="shrink-0 text-red-500" />
              ) : (
                <ImageIcon size={16} className="shrink-0 text-blue-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 truncate">{file.file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.file.size)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
