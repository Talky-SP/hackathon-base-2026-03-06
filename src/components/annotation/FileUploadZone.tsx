import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { validateFileByExtension, formatFileSize } from '../../utils/fileValidation';
import { useDropZone } from '../../hooks/useDropZone';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  type: 'pdf' | 'image';
  validatedType: string;
  url?: string; // Remote URL for API-fetched documents
  docType?: 'expenses' | 'delivery-notes' | 'income-invoices' | 'payrolls';
}

interface FileUploadZoneProps {
  onFilesUploaded?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  initialFiles?: UploadedFile[];
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function FileUploadZone({
  onFilesUploaded,
  maxFiles,
  initialFiles,
}: FileUploadZoneProps) {
  const { t } = useLanguage();

  // ─── State ─────────────────────────────────────────────────────────────

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(initialFiles ?? []);
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── File Processing with Extension Validation ─────────────────────────

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setError('');
    setIsValidating(true);

    const fileArray = Array.from(files);

    // Check max files limit
    if (maxFiles && uploadedFiles.length + fileArray.length > maxFiles) {
      setError(`${t('annotation.upload.maxFiles')}: ${maxFiles}`);
      setIsValidating(false);
      return;
    }

    try {
      // Validate each file by extension
      const validationResults = fileArray.map((file) => {
        const validation = validateFileByExtension(file);
        return { file, validation };
      });

      // Filter out invalid files
      const invalidFiles = validationResults.filter((r) => !r.validation.valid);
      if (invalidFiles.length > 0) {
        setError(
          `${invalidFiles.map((r) => r.file.name).join(', ')} — ${t('annotation.upload.invalidFiles')}`
        );
        setIsValidating(false);
        return;
      }

      // Process valid files
      const newFiles: UploadedFile[] = await Promise.all(
        validationResults.map(async ({ file, validation }) => {
          const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const validatedType = validation.detectedType!;
          const type: 'pdf' | 'image' = validatedType === 'pdf' ? 'pdf' : 'image';

          let preview: string | undefined;
          if (type === 'image') {
            preview = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            });
          }

          return { id, file, preview, type, validatedType };
        })
      );

      const updatedFiles = [...uploadedFiles, ...newFiles];
      setUploadedFiles(updatedFiles);

      if (onFilesUploaded) {
        onFilesUploaded(updatedFiles);
      }
    } catch (err) {
      setError(`${t('annotation.upload.errorProcessing')}: ${(err as Error).message}`);
    } finally {
      setIsValidating(false);
    }
  }, [maxFiles, uploadedFiles, t, onFilesUploaded]);

  // ─── Drop zone ────────────────────────────────────────────────────────

  const handleDropFiles = useCallback((files: File[]) => {
    processFiles(files);
  }, [processFiles]);

  const { isDragOver, dropZoneProps } = useDropZone(handleDropFiles);

  // ─── Click to Upload ───────────────────────────────────────────────────

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // ─── Remove File ───────────────────────────────────────────────────────

  const removeFile = (id: string) => {
    const updatedFiles = uploadedFiles.filter((f) => f.id !== id);
    setUploadedFiles(updatedFiles);

    if (onFilesUploaded) {
      onFilesUploaded(updatedFiles);
    }
  };

  // ─── Clear All ─────────────────────────────────────────────────────────

  const clearAll = () => {
    setUploadedFiles([]);
    setError('');

    if (onFilesUploaded) {
      onFilesUploaded([]);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  const isDragging = isDragOver;

  return (
    <div className="h-full flex flex-col">
      {/* Header with file count */}
      {uploadedFiles.length > 0 && (
        <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
          <span className="text-sm text-gray-600">
            {uploadedFiles.length} {t('annotation.upload.filesUploaded')}
          </span>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            {t('annotation.upload.clearAll')}
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {uploadedFiles.length === 0 ? (
          /* Empty State - Full Screen Drop Zone */
          <div
            {...dropZoneProps}
            onClick={openFilePicker}
            className={`h-full flex items-center justify-center transition-all cursor-pointer rounded-xl border-2 ${
              isDragging
                ? 'bg-brand-100 border-brand-500'
                : 'bg-gray-50 border-gray-200 hover:bg-brand-50 hover:border-brand-300'
            }`}
          >
            <div className="text-center px-6 py-12 max-w-md">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 mx-auto transition-all ${
                  isDragging ? 'bg-brand-200 scale-110' : 'bg-white border border-gray-200'
                }`}
              >
                {isValidating ? (
                  <Loader2 size={36} className="text-brand-600 animate-spin" />
                ) : (
                  <Upload
                    size={36}
                    className={`transition-colors ${
                      isDragging ? 'text-brand-600' : 'text-gray-400'
                    }`}
                  />
                )}
              </div>

              <h2 className={`text-2xl font-semibold mb-2 transition-colors ${isDragging ? 'text-brand-800' : 'text-gray-900'}`}>
                {isValidating
                  ? t('annotation.upload.processing')
                  : isDragging
                  ? t('annotation.upload.dropHere')
                  : t('annotation.upload.dragDrop')}
              </h2>

              <p className={`text-sm mb-6 transition-colors ${isDragging ? 'text-brand-600' : 'text-gray-500'}`}>
                {isValidating
                  ? t('annotation.upload.validating')
                  : t('annotation.upload.browseFiles')}
              </p>

              <div className={`inline-flex items-center gap-4 px-6 py-3 rounded-lg transition-all ${
                isDragging
                  ? 'bg-brand-200/50 border border-brand-300'
                  : 'bg-white border border-gray-200'
              }`}>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText size={16} className="text-red-500" />
                  <span className="font-medium">PDF</span>
                </div>
                <div className={`w-px h-4 ${isDragging ? 'bg-brand-300' : 'bg-gray-300'}`} />
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ImageIcon size={16} className="text-blue-500" />
                  <span className="font-medium">PNG, JPG, WEBP</span>
                </div>
              </div>

              {error && (
                <div className="mt-6 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                  <span className="text-sm text-red-700 text-left">{error}</span>
                </div>
              )}

              <p className={`text-xs mt-6 transition-colors ${isDragging ? 'text-brand-500' : 'text-gray-400'}`}>
                {t('annotation.upload.acceptedFormats')}
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        ) : (
          /* Files Grid */
          <div className="h-full overflow-auto p-6 bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {uploadedFiles.map((uploadedFile) => (
                <div
                  key={uploadedFile.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  {/* Preview */}
                  <div className="relative aspect-[3/4] bg-gray-100">
                    {uploadedFile.type === 'image' && uploadedFile.preview ? (
                      <img
                        src={uploadedFile.preview}
                        alt={uploadedFile.file.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText size={48} className="text-red-400" />
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={() => removeFile(uploadedFile.id)}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      title="Remove file"
                    >
                      <X size={16} />
                    </button>

                    {/* File type badge */}
                    <div className="absolute top-2 left-2">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                          uploadedFile.type === 'pdf'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {uploadedFile.validatedType}
                      </span>
                    </div>

                    {/* Success indicator */}
                    <div className="absolute bottom-2 right-2">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                        <CheckCircle size={14} className="text-white" />
                      </div>
                    </div>
                  </div>

                  {/* File info */}
                  <div className="p-3 border-t border-gray-100">
                    <p
                      className="text-sm font-medium text-gray-900 truncate"
                      title={uploadedFile.file.name}
                    >
                      {uploadedFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatFileSize(uploadedFile.file.size)}
                    </p>
                  </div>
                </div>
              ))}

              {/* Add more card */}
              {(!maxFiles || uploadedFiles.length < maxFiles) && (
                <div
                  onClick={openFilePicker}
                  className="aspect-[3/4] border-2 border-gray-200 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-all cursor-pointer flex items-center justify-center group"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-brand-50 flex items-center justify-center mx-auto mb-3 transition-colors">
                      <Upload
                        size={20}
                        className="text-gray-400 group-hover:text-brand-500 transition-colors"
                      />
                    </div>
                    <p className="text-sm font-medium text-gray-600 group-hover:text-brand-600 transition-colors">
                      {t('annotation.upload.addMore')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden file input for add more */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
}
