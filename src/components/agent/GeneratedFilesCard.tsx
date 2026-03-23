import { useState } from 'react';
import { FileSpreadsheet, FileText, Image, Download, Eye, Loader2, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { GeneratedFile } from '../../hooks/useAgentChat';
import type { SpreadsheetData } from './SpreadsheetViewer';

type Props = {
  files: GeneratedFile[];
  taskId?: string;
  onPreviewSpreadsheet: (data: SpreadsheetData) => void;
};

function getFileIcon(type: string, filename: string) {
  if (type === 'excel' || type === 'csv' || filename.match(/\.(xlsx?|csv)$/i)) return <FileSpreadsheet size={16} className="text-green-600" />;
  if (type === 'image' || filename.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) return <Image size={16} style={{ color: '#f2764b' }} />;
  return <FileText size={16} style={{ color: '#f2764b' }} />;
}

function getExtLabel(filename: string) {
  return filename.split('.').pop()?.toUpperCase() ?? '';
}

function isSpreadsheetFile(file: GeneratedFile) {
  return file.type === 'excel' || file.type === 'csv' || file.filename.match(/\.(xlsx?|csv)$/i);
}

function isImageFile(file: GeneratedFile) {
  return file.type === 'image' || file.filename.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
}

function resolveUrl(url: string) {
  if (url.startsWith('/api/')) return `/agent-api${url}`;
  return url;
}

/** Whether a URL points to an external origin (presigned S3, etc.) — fetch() would be CORS-blocked */
function isExternalUrl(url: string) {
  return /^https?:\/\//.test(url);
}

/** Direct browser download — bypasses CORS for external presigned URLs */
function directDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
}


export default function GeneratedFilesCard({ files, taskId, onPreviewSpreadsheet }: Props) {
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  if (files.length === 0) return null;

  const excelFiles = files.filter(f => isSpreadsheetFile(f));
  const imageFiles = files.filter(f => isImageFile(f));
  const otherFiles = files.filter(f => !isSpreadsheetFile(f) && !isImageFile(f));

  const handleDownload = async (file: GeneratedFile) => {
    const url = resolveUrl(file.url);
    // External (presigned S3) → direct navigation to avoid CORS
    if (isExternalUrl(url)) {
      directDownload(url, file.filename);
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      directDownload(blobUrl, file.filename);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.warn('Failed to download file:', e);
    }
  };

  const handlePreviewSpreadsheet = async (file: GeneratedFile) => {
    setLoadingPreview(file.filename);
    // For preview, prefer same-origin API proxy to avoid CORS with S3 presigned URLs
    const rawUrl = resolveUrl(file.url);
    const url = (isExternalUrl(rawUrl) && taskId)
      ? `/agent-api/api/tasks/${taskId}/artifacts/${encodeURIComponent(file.filename)}`
      : rawUrl;
    try {
      const isCsv = file.type === 'csv' || file.filename.match(/\.csv$/i);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (isCsv) {
        const text = await res.text();
        const wb = XLSX.read(text, { type: 'string' });
        onPreviewSpreadsheet({ fileName: file.filename, workbook: wb });
      } else {
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellStyles: true });
        onPreviewSpreadsheet({ fileName: file.filename, workbook: wb, rawBuffer: buf });
      }
    } catch (e) {
      console.warn('Failed to preview spreadsheet:', e);
    } finally {
      setLoadingPreview(null);
    }
  };

  const loadImage = async (file: GeneratedFile) => {
    if (imageUrls[file.filename] || imageErrors.has(file.filename)) return;
    const rawUrl = resolveUrl(file.url);
    // For images with taskId, prefer API proxy; otherwise use URL directly (img src doesn't have CORS issues for display)
    const url = (isExternalUrl(rawUrl) && taskId)
      ? `/agent-api/api/tasks/${taskId}/artifacts/${encodeURIComponent(file.filename)}`
      : rawUrl;
    if (isExternalUrl(url)) {
      setImageUrls(prev => ({ ...prev, [file.filename]: url }));
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setImageUrls(prev => ({ ...prev, [file.filename]: blobUrl }));
    } catch {
      setImageErrors(prev => new Set(prev).add(file.filename));
    }
  };

  // Load images on first render
  imageFiles.forEach(f => {
    if (!imageUrls[f.filename] && !imageErrors.has(f.filename)) {
      loadImage(f);
    }
  });

  return (
    <div className="space-y-3">
      {/* Excel / PDF / CSV files card */}
      {(excelFiles.length > 0 || otherFiles.length > 0) && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm max-w-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ backgroundColor: '#fdf5f3' }}>
                <CheckCircle2 size={11} style={{ color: '#f2764b' }} />
              </div>
              <span className="text-xs font-semibold text-gray-700">
                {excelFiles.length + otherFiles.length} archivo{(excelFiles.length + otherFiles.length) !== 1 ? 's' : ''} generado{(excelFiles.length + otherFiles.length) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* File rows */}
          {[...excelFiles, ...otherFiles].map((file, i, arr) => (
            <div
              key={file.filename}
              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                i < arr.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              {/* Icon */}
              <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-gray-50 shrink-0">
                {getFileIcon(file.type, file.filename)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate">{file.filename}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{getExtLabel(file.filename)}</div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isSpreadsheetFile(file) && (
                  <button
                    type="button"
                    onClick={() => handlePreviewSpreadsheet(file)}
                    disabled={loadingPreview === file.filename}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors disabled:opacity-50"
                  >
                    {loadingPreview === file.filename ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Eye size={12} />
                    )}
                    Ver
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDownload(file)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                >
                  <Download size={12} />
                  Descargar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline images (charts generated by AI) */}
      {imageFiles.map(file => {
        const src = imageUrls[file.filename];
        return (
          <div key={file.filename} className="max-w-2xl">
            {src ? (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <img
                  src={src}
                  alt={file.filename}
                  className="w-full max-h-[480px] object-contain bg-white"
                />
                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
                  <span className="text-[11px] text-gray-400 truncate">{file.filename}</span>
                  <button
                    type="button"
                    onClick={() => handleDownload(file)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <Download size={11} />
                    Descargar
                  </button>
                </div>
              </div>
            ) : !imageErrors.has(file.filename) ? (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 flex items-center justify-center">
                <Loader2 size={16} className="animate-spin text-gray-300" />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
