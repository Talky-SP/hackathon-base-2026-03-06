import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  GripVertical,
  X,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatFileSize } from '../../utils/fileValidation';
import { ContextMenu } from '../ui';
import type { UploadedFile } from './FileUploadZone';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Batch {
  id: string;
  name: string;
  fileIds: string[];
  named: boolean; // false = selection buffer, true = finalized batch
}

interface FileExplorerProps {
  files: UploadedFile[];
  selectedFileId: string | null;
  onSelectFile: (id: string) => void;
  batches: Batch[];
  onBatchesChange: (batches: Batch[]) => void;
  onExternalFileDrop?: (files: File[]) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetBatchId?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function FileExplorer({
  files,
  selectedFileId,
  onSelectFile,
  batches,
  onBatchesChange,
  onExternalFileDrop,
}: FileExplorerProps) {
  const { t } = useLanguage();
  const [collapsedBatches, setCollapsedBatches] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [dragOverBatchId, setDragOverBatchId] = useState<string | null>(null);
  const dragCounterRef = useRef<Map<string, number>>(new Map());
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input when editing starts
  useEffect(() => {
    if (editingBatchId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingBatchId]);

  // ─── Batch helpers ──────────────────────────────────────────────────────

  const namedBatches = batches.filter((b) => b.named);

  const toggleCollapse = (batchId: string) => {
    setCollapsedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const createBatch = () => {
    const id = crypto.randomUUID();
    const newBatch: Batch = { id, name: t('batches.defaultName'), fileIds: [], named: true };
    onBatchesChange([...batches, newBatch]);
    setEditingBatchId(id);
    setContextMenu(null);
  };

  const renameBatch = (batchId: string, name: string) => {
    onBatchesChange(
      batches.map((b) => (b.id === batchId ? { ...b, name: name || b.name } : b))
    );
    setEditingBatchId(null);
  };

  const deleteBatch = (batchId: string) => {
    onBatchesChange(batches.filter((b) => b.id !== batchId));
    setContextMenu(null);
  };

  const removeFileFromBatch = (fileId: string, batchId: string) => {
    onBatchesChange(
      batches.map((b) =>
        b.id === batchId ? { ...b, fileIds: b.fileIds.filter((id) => id !== fileId) } : b
      )
    );
  };

  const moveFileToBatch = (fileId: string, targetBatchId: string | null) => {
    onBatchesChange(
      batches.map((b) => {
        const filtered = b.fileIds.filter((id) => id !== fileId);
        if (b.id === targetBatchId) {
          return { ...b, fileIds: [...filtered, fileId] };
        }
        return { ...b, fileIds: filtered };
      })
    );
  };

  // ─── Context menu ──────────────────────────────────────────────────────

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, batchId?: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetBatchId: batchId });
    },
    []
  );

  // ─── Drag and drop ─────────────────────────────────────────────────────

  const INTERNAL_DRAG_TYPE = 'application/x-file-explorer-id';

  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    e.dataTransfer.setData(INTERNAL_DRAG_TYPE, fileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, zoneId: string) => {
    e.preventDefault();
    const count = (dragCounterRef.current.get(zoneId) ?? 0) + 1;
    dragCounterRef.current.set(zoneId, count);
    if (count === 1) setDragOverBatchId(zoneId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e: React.DragEvent, zoneId: string) => {
    e.preventDefault();
    const count = (dragCounterRef.current.get(zoneId) ?? 0) - 1;
    dragCounterRef.current.set(zoneId, count);
    if (count <= 0) {
      dragCounterRef.current.set(zoneId, 0);
      if (dragOverBatchId === zoneId) setDragOverBatchId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetBatchId: string | null) => {
    e.preventDefault();
    const internalId = e.dataTransfer.getData(INTERNAL_DRAG_TYPE);
    if (internalId) {
      moveFileToBatch(internalId, targetBatchId);
    } else if (e.dataTransfer.files.length > 0 && onExternalFileDrop) {
      onExternalFileDrop(Array.from(e.dataTransfer.files));
    }
    dragCounterRef.current.clear();
    setDragOverBatchId(null);
  };

  // ─── File row renderer (named batch — click to open, X to remove) ─────

  const renderFileRow = (file: UploadedFile, batchId: string) => {
    const isSelected = file.id === selectedFileId;
    return (
      <div
        key={file.id}
        draggable
        onDragStart={(e) => handleDragStart(e, file.id)}
        onClick={() => onSelectFile(file.id)}
        className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer border-l-2 group ${
          isSelected
            ? 'bg-brand-100 border-brand-500'
            : 'border-transparent hover:bg-gray-100'
        }`}
      >
        <GripVertical size={12} className="shrink-0 text-gray-200 cursor-grab" />
        {file.type === 'pdf' ? (
          <FileText size={14} className="shrink-0 text-red-500" />
        ) : (
          <ImageIcon size={14} className="shrink-0 text-blue-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-800 truncate">{file.file.name}</p>
          <p className="text-xs text-gray-500">{formatFileSize(file.file.size)}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeFileFromBatch(file.id, batchId);
          }}
          className="shrink-0 p-0.5 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={12} />
        </button>
      </div>
    );
  };

  // ─── Batch section renderer ────────────────────────────────────────────

  const renderBatchSection = (batch: Batch) => {
    const isCollapsed = collapsedBatches.has(batch.id);
    const isDropTarget = dragOverBatchId === batch.id;
    const batchFiles = batch.fileIds
      .map((id) => files.find((f) => f.id === id))
      .filter((f): f is UploadedFile => f !== undefined);

    return (
      <div
        key={batch.id}
        onDragEnter={(e) => handleDragEnter(e, batch.id)}
        onDragOver={handleDragOver}
        onDragLeave={(e) => handleDragLeave(e, batch.id)}
        onDrop={(e) => handleDrop(e, batch.id)}
        className={`transition-colors ${
          isDropTarget ? 'bg-brand-100 border border-brand-500 rounded-md mx-1' : ''
        }`}
      >
        {/* Batch header */}
        <div
          className="flex items-center gap-1 px-3 py-2 cursor-pointer hover:bg-gray-100 select-none"
          onClick={() => toggleCollapse(batch.id)}
          onContextMenu={(e) => handleContextMenu(e, batch.id)}
        >
          {isCollapsed ? (
            <ChevronRight size={14} className="shrink-0 text-gray-500" />
          ) : (
            <ChevronDown size={14} className="shrink-0 text-gray-500" />
          )}
          {editingBatchId === batch.id ? (
            <input
              ref={renameInputRef}
              defaultValue={batch.name}
              className="text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded px-1 py-0.5 flex-1 min-w-0"
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => renameBatch(batch.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameBatch(batch.id, (e.target as HTMLInputElement).value);
                if (e.key === 'Escape') setEditingBatchId(null);
              }}
            />
          ) : (
            <span className="text-xs font-semibold text-gray-500 truncate flex-1">
              {batch.name}
            </span>
          )}
          <span className="text-xs text-gray-500">{batchFiles.length}</span>
        </div>

        {/* Batch files */}
        {!isCollapsed && batchFiles.map((f) => renderFileRow(f, batch.id))}
      </div>
    );
  };

  return (
    <div
      className="h-full flex flex-col bg-white border-r border-gray-200"
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('[data-batch-header]')) return;
        handleContextMenu(e);
      }}
    >
      <div className="shrink-0 px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {t('workspace.files')}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Named batches only */}
        {namedBatches.map(renderBatchSection)}
      </div>

      {/* ── Context menu ── */}
      {contextMenu && (
        <ContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            { label: t('batches.new'), onClick: createBatch },
            ...(contextMenu.targetBatchId ? [
              { label: t('batches.rename'), onClick: () => { setEditingBatchId(contextMenu.targetBatchId!); setContextMenu(null); } },
              { label: t('batches.delete'), onClick: () => deleteBatch(contextMenu.targetBatchId!), danger: true },
            ] : []),
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
