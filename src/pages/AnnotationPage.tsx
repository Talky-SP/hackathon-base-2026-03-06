import { useState, useRef } from 'react';
import { PenLine } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import FileUploadZone, { UploadedFile } from '../components/annotation/FileUploadZone';
import DocumentWorkspace from '../components/annotation/DocumentWorkspace';

// ─── Main Component ────────────────────────────────────────────────────────

export default function AnnotationPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'upload' | 'workspace'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Handle Uploaded Files ─────────────────────────────────────────────

  const handleFilesUploaded = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    if (files.length > 0 && mode === 'upload') {
      setMode('workspace');
    }
  };

  const handleAddFiles = () => {
    fileInputRef.current?.click();
  };

  const processRawFiles = (rawFiles: File[]) => {
    const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
    const newFiles: UploadedFile[] = rawFiles
      .filter((file) => {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        return allowed.includes(ext);
      })
      .map((file) => {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const type: 'pdf' | 'image' = ext === 'pdf' ? 'pdf' : 'image';
        return {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: type === 'image' ? URL.createObjectURL(file) : undefined,
          type,
          validatedType: ext === 'pdf' ? 'pdf' : ext,
        };
      });
    if (newFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleAddFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processRawFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExternalFileDrop = (files: File[]) => {
    processRawFiles(files);
  };

  // ─── Workspace Mode ──────────────────────────────────────────────────

  if (mode === 'workspace') {
    return (
      <>
        <DocumentWorkspace
          files={uploadedFiles}
          onAddFiles={handleAddFiles}
          onExternalFileDrop={handleExternalFileDrop}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={handleAddFileInput}
          className="hidden"
        />
      </>
    );
  }

  // ─── Upload Mode ─────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* ── Page Header ── */}
      <div className="shrink-0 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <PenLine size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('annotation.title')}</h1>
          </div>
        </div>
        <p className="text-sm text-gray-500 ml-[52px]">
          {t('annotation.upload.goldenDesc')}
        </p>
      </div>

      {/* ── Upload Zone (takes remaining space) ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <FileUploadZone
          onFilesUploaded={handleFilesUploaded}
          initialFiles={uploadedFiles}
        />
      </div>
    </div>
  );
}
