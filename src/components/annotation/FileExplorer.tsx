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
import { ContextMenu } from '../ui';
import type { UploadedFile } from './FileUploadZone';

// TODO: re-enable manual file upload
const MANUAL_UPLOAD_ENABLED = false;

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
  focusBatchId?: string | null;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetBatchId?: string;
  targetFileId?: string;
}

interface LassoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function FileExplorer({
  files,
  selectedFileId,
  onSelectFile,
  batches,
  onBatchesChange,
  onExternalFileDrop,
  focusBatchId,
}: FileExplorerProps) {
  const { t } = useLanguage();
  const [collapsedBatches, setCollapsedBatches] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [dragOverBatchId, setDragOverBatchId] = useState<string | null>(null);
  const dragCounterRef = useRef<Map<string, number>>(new Map());
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ─── Multi-selection (lasso + click) ────────────────────────────────────
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [lassoRect, setLassoRect] = useState<LassoRect | null>(null);
  const lassoOrigin = useRef<{ x: number; y: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isLassoing = useRef(false);

  // Focus rename input when editing starts
  useEffect(() => {
    if (editingBatchId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingBatchId]);

  // Focus a specific batch: expand it, collapse all others
  useEffect(() => {
    if (!focusBatchId) return;
    setCollapsedBatches(
      new Set(batches.filter((b) => b.named && b.id !== focusBatchId).map((b) => b.id))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBatchId]);

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

  // ─── Batch operations on multi-selected files ────────────────────────────

  const moveFilesToBatch = useCallback((fileIds: Set<string>, targetBatchId: string) => {
    onBatchesChange(
      batches.map((b) => {
        const filtered = b.fileIds.filter((id) => !fileIds.has(id));
        if (b.id === targetBatchId) {
          const toAdd = Array.from(fileIds).filter((id) => !b.fileIds.includes(id));
          return { ...b, fileIds: [...filtered, ...toAdd] };
        }
        return { ...b, fileIds: filtered };
      })
    );
    setMultiSelected(new Set());
    setContextMenu(null);
  }, [batches, onBatchesChange]);

  const removeFilesFromBatches = useCallback((fileIds: Set<string>) => {
    onBatchesChange(
      batches.map((b) => ({
        ...b,
        fileIds: b.fileIds.filter((id) => !fileIds.has(id)),
      }))
    );
    setMultiSelected(new Set());
    setContextMenu(null);
  }, [batches, onBatchesChange]);

  // ─── Context menu ──────────────────────────────────────────────────────

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, batchId?: string, fileId?: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetBatchId: batchId, targetFileId: fileId });
    },
    []
  );

  // ─── Lasso selection ────────────────────────────────────────────────────

  const getFileIdsInRect = useCallback((rect: LassoRect): Set<string> => {
    const container = scrollContainerRef.current;
    if (!container) return new Set();
    const ids = new Set<string>();
    const rows = container.querySelectorAll<HTMLElement>('[data-file-id]');
    // Lasso rect is relative to viewport
    const rLeft = Math.min(rect.x, rect.x + rect.w);
    const rRight = Math.max(rect.x, rect.x + rect.w);
    const rTop = Math.min(rect.y, rect.y + rect.h);
    const rBottom = Math.max(rect.y, rect.y + rect.h);

    for (const row of rows) {
      const r = row.getBoundingClientRect();
      const centerY = (r.top + r.bottom) / 2;
      if (centerY >= rTop && centerY <= rBottom && r.right >= rLeft && r.left <= rRight) {
        ids.add(row.dataset.fileId!);
      }
    }
    return ids;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start lasso on left click, not on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [data-no-lasso], [draggable="true"]')) return;

    lassoOrigin.current = { x: e.clientX, y: e.clientY };
    isLassoing.current = false;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!lassoOrigin.current) return;
      const dx = e.clientX - lassoOrigin.current.x;
      const dy = e.clientY - lassoOrigin.current.y;

      // Start lasso only after 5px movement to avoid accidental triggers
      if (!isLassoing.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      isLassoing.current = true;

      const rect: LassoRect = {
        x: lassoOrigin.current.x,
        y: lassoOrigin.current.y,
        w: dx,
        h: dy,
      };
      setLassoRect(rect);
      setMultiSelected(getFileIdsInRect(rect));
    };

    const handleMouseUp = () => {
      if (lassoOrigin.current && !isLassoing.current) {
        // Was a click, not a drag — clear selection
        setMultiSelected(new Set());
      }
      lassoOrigin.current = null;
      isLassoing.current = false;
      setLassoRect(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [getFileIdsInRect]);

  // ─── File click with Ctrl/Shift multi-select ────────────────────────────

  const handleFileClick = useCallback((e: React.MouseEvent, fileId: string) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      setMultiSelected((prev) => {
        const next = new Set(prev);
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
        return next;
      });
      return;
    }
    if (multiSelected.size > 0 && !e.ctrlKey) {
      setMultiSelected(new Set());
    }
    onSelectFile(fileId);
  }, [multiSelected.size, onSelectFile]);

  // ─── Drag and drop ─────────────────────────────────────────────────────

  const INTERNAL_DRAG_TYPE = 'application/x-file-explorer-id';
  const MULTI_DRAG_TYPE = 'application/x-file-explorer-multi';

  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    if (multiSelected.size > 1 && multiSelected.has(fileId)) {
      e.dataTransfer.setData(MULTI_DRAG_TYPE, JSON.stringify(Array.from(multiSelected)));
      e.dataTransfer.effectAllowed = 'move';
    } else {
      e.dataTransfer.setData(INTERNAL_DRAG_TYPE, fileId);
      e.dataTransfer.effectAllowed = 'move';
    }
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
    const multiData = e.dataTransfer.getData(MULTI_DRAG_TYPE);
    if (multiData && targetBatchId) {
      const ids = new Set<string>(JSON.parse(multiData) as string[]);
      moveFilesToBatch(ids, targetBatchId);
    } else {
      const internalId = e.dataTransfer.getData(INTERNAL_DRAG_TYPE);
      if (internalId) {
        moveFileToBatch(internalId, targetBatchId);
      } else if (MANUAL_UPLOAD_ENABLED && e.dataTransfer.files.length > 0 && onExternalFileDrop) {
        onExternalFileDrop(Array.from(e.dataTransfer.files));
      }
    }
    dragCounterRef.current.clear();
    setDragOverBatchId(null);
  };

  // ─── File row renderer (named batch — click to open, X to remove) ─────

  const renderFileRow = (file: UploadedFile, batchId: string) => {
    const isActive = file.id === selectedFileId;
    const isMultiSel = multiSelected.has(file.id);
    return (
      <div
        key={file.id}
        data-file-id={file.id}
        draggable
        onDragStart={(e) => handleDragStart(e, file.id)}
        onClick={(e) => handleFileClick(e, file.id)}
        onContextMenu={(e) => {
          if (multiSelected.size > 0 && multiSelected.has(file.id)) {
            handleContextMenu(e, undefined, file.id);
          } else {
            handleContextMenu(e, batchId, file.id);
          }
        }}
        className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer border-l-2 group ${
          isMultiSel
            ? 'bg-blue-100 border-blue-500'
            : isActive
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
          data-no-lasso
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

  // ─── Build context menu items ──────────────────────────────────────────

  const buildContextMenuItems = () => {
    const items: { label: string; onClick: () => void; danger?: boolean }[] = [];
    items.push({ label: t('batches.new'), onClick: createBatch });

    if (contextMenu?.targetBatchId && !contextMenu.targetFileId) {
      // Right-clicked on a batch header
      items.push({ label: t('batches.rename'), onClick: () => { setEditingBatchId(contextMenu.targetBatchId!); setContextMenu(null); } });
      items.push({ label: t('batches.delete'), onClick: () => deleteBatch(contextMenu.targetBatchId!), danger: true });
    }

    // Multi-selected files context menu
    if (multiSelected.size > 0 && contextMenu?.targetFileId && multiSelected.has(contextMenu.targetFileId)) {
      const count = multiSelected.size;
      // Move to each other batch
      for (const batch of namedBatches) {
        // Only show batches that don't already contain ALL selected files
        const allInBatch = Array.from(multiSelected).every((id) => batch.fileIds.includes(id));
        if (allInBatch) continue;
        items.push({
          label: t('batches.moveToOther').replace('{0}', batch.name),
          onClick: () => moveFilesToBatch(multiSelected, batch.id),
        });
      }
      items.push({
        label: t('batches.removeSelected').replace('{0}', String(count)),
        onClick: () => removeFilesFromBatches(multiSelected),
        danger: true,
      });
    }

    return items;
  };

  // ─── Lasso overlay rect (viewport-relative → container-relative) ──────

  const renderLasso = () => {
    if (!lassoRect) return null;
    const left = Math.min(lassoRect.x, lassoRect.x + lassoRect.w);
    const top = Math.min(lassoRect.y, lassoRect.y + lassoRect.h);
    const width = Math.abs(lassoRect.w);
    const height = Math.abs(lassoRect.h);
    return (
      <div
        className="fixed border border-blue-500 bg-blue-500/10 pointer-events-none z-50"
        style={{ left, top, width, height }}
      />
    );
  };

  return (
    <div
      className="h-full flex flex-col bg-white border-r border-gray-200 select-none"
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('[data-batch-header]')) return;
        if (!(e.target as HTMLElement).closest('[data-file-id]')) {
          handleContextMenu(e);
        }
      }}
    >
      <div className="shrink-0 px-4 py-3 border-b border-gray-200" data-no-lasso>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {t('workspace.files')}
        </h3>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {/* Named batches only */}
        {namedBatches.map(renderBatchSection)}
      </div>

      {/* ── Lasso overlay ── */}
      {renderLasso()}

      {/* ── Context menu ── */}
      {contextMenu && (
        <ContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
