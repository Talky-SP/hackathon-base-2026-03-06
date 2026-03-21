import { useState } from 'react';
import { FileSpreadsheet, FileText, Download, Eye, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { TaskArtifact, TaskStep } from '../../hooks/useAgentChat';
import type { SpreadsheetData } from './SpreadsheetViewer';

// ── Active task progress (shown while task is running) ──

type TaskProgressProps = {
  taskId: string;
  taskTypeName: string;
  progress: number;
  steps: TaskStep[];
  costUsd?: number;
  onCancel?: () => void;
};

export function TaskProgress({ taskTypeName, progress, steps, costUsd, onCancel }: TaskProgressProps) {
  const completedSteps = steps.filter(s => s.status === 'COMPLETED').length;
  const runningStep = steps.find(s => s.status === 'RUNNING');

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm max-w-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#fdf5f3' }}>
            <Loader2 size={14} className="animate-spin" style={{ color: '#f2764b' }} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-800">{taskTypeName}</div>
            {runningStep && (
              <div className="text-[10px] text-gray-400 truncate mt-0.5">{runningStep.description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {costUsd !== undefined && (
            <span className="text-[10px] text-gray-400 tabular-nums">${costUsd.toFixed(4)}</span>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-6 w-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Cancelar tarea"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gray-400">
            {completedSteps}/{steps.length} pasos
          </span>
          <span className="text-[10px] font-medium tabular-nums" style={{ color: '#f2764b' }}>
            {progress}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, backgroundColor: '#f2764b' }}
          />
        </div>
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {steps.map(step => (
            <div key={step.step_number} className="flex items-center gap-2">
              {step.status === 'COMPLETED' ? (
                <CheckCircle2 size={11} className="text-green-500 shrink-0" />
              ) : step.status === 'RUNNING' ? (
                <Loader2 size={11} className="animate-spin shrink-0" style={{ color: '#f2764b' }} />
              ) : step.status === 'FAILED' ? (
                <AlertCircle size={11} className="text-red-500 shrink-0" />
              ) : (
                <div className="h-[11px] w-[11px] rounded-full border border-gray-300 shrink-0" />
              )}
              <span className={`text-[11px] ${
                step.status === 'RUNNING' ? 'text-gray-700 font-medium' :
                step.status === 'COMPLETED' ? 'text-gray-400' :
                'text-gray-400'
              }`}>
                {step.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task failed card ──

type TaskFailedProps = {
  taskTypeName: string;
  error: string;
};

export function TaskFailed({ taskTypeName, error }: TaskFailedProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 shadow-sm max-w-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <AlertCircle size={16} className="text-red-500 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-red-700">{taskTypeName} — Error</div>
          <div className="text-[11px] text-red-600 mt-0.5">{error}</div>
        </div>
      </div>
    </div>
  );
}

// ── Artifacts card (shown after task completes, in assistant message) ──

type ArtifactsCardProps = {
  artifacts: TaskArtifact[];
  taskId: string;
  costUsd?: number;
  onPreviewSpreadsheet?: (data: SpreadsheetData) => void;
};

function getArtifactIcon(type?: string) {
  if (type === 'excel') return <FileSpreadsheet size={16} className="text-green-600" />;
  return <FileText size={16} style={{ color: '#f2764b' }} />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtLabel(filename: string) {
  const ext = filename.split('.').pop()?.toUpperCase() ?? '';
  return ext;
}

export function ArtifactsCard({ artifacts, taskId, costUsd, onPreviewSpreadsheet }: ArtifactsCardProps) {
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  if (artifacts.length === 0) return null;

  const getArtifactUrl = (artifact: TaskArtifact) => {
    const url = artifact.url ?? `/api/tasks/${taskId}/artifacts/${artifact.filename}`;
    return url.startsWith('/api/') ? `/agent-api${url}` : url;
  };

  const isExcel = (a: TaskArtifact) => a.type === 'excel' || a.filename.match(/\.xlsx?$/i);

  const handleDownload = async (artifact: TaskArtifact) => {
    const url = getArtifactUrl(artifact);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = artifact.filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.warn('Failed to download artifact:', e);
    }
  };

  const handlePreviewExcel = async (artifact: TaskArtifact) => {
    if (!onPreviewSpreadsheet) return;
    setLoadingPreview(artifact.filename);
    try {
      const url = getArtifactUrl(artifact);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellStyles: true });
      onPreviewSpreadsheet({ fileName: artifact.filename, workbook: wb, rawBuffer: buf });
    } catch (e) {
      console.warn('Failed to preview artifact:', e);
    } finally {
      setLoadingPreview(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm max-w-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ backgroundColor: '#fdf5f3' }}>
            <CheckCircle2 size={11} style={{ color: '#f2764b' }} />
          </div>
          <span className="text-xs font-semibold text-gray-700">
            {artifacts.length} archivo{artifacts.length !== 1 ? 's' : ''} generado{artifacts.length !== 1 ? 's' : ''}
          </span>
        </div>
        {costUsd !== undefined && costUsd > 0 && (
          <span className="text-[10px] text-gray-400 tabular-nums">${costUsd.toFixed(4)}</span>
        )}
      </div>

      {/* Artifact rows */}
      {artifacts.map((artifact, i) => (
        <div
          key={artifact.filename}
          className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
            i < artifacts.length - 1 ? 'border-b border-gray-100' : ''
          }`}
        >
          {/* Icon */}
          <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-gray-50 shrink-0">
            {getArtifactIcon(artifact.type)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-800 truncate">{artifact.filename}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {getExtLabel(artifact.filename)}{artifact.size_bytes ? ` · ${formatSize(artifact.size_bytes)}` : ''}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isExcel(artifact) && onPreviewSpreadsheet && (
              <button
                type="button"
                onClick={() => handlePreviewExcel(artifact)}
                disabled={loadingPreview === artifact.filename}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                {loadingPreview === artifact.filename ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Eye size={12} />
                )}
                Ver
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDownload(artifact)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors"
            >
              <Download size={12} />
              Descargar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
