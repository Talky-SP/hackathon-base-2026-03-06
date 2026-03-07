import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { UploadedFile } from '../components/annotation/FileUploadZone';
import type { Batch } from '../components/annotation/FileExplorer';

// ─── Constants ──────────────────────────────────────────────────────────────

const BUFFER_ID = '__buffer__';

function createEmptyBuffer(): Batch {
  return { id: BUFFER_ID, name: '', fileIds: [], named: false };
}

// ─── Context shape ──────────────────────────────────────────────────────────

interface AnnotationContextValue {
  // Files
  files: UploadedFile[];
  setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  importedFiles: UploadedFile[];
  setImportedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  importMeta: Record<string, { textractResultUrl?: string; invoiceDetail?: Record<string, unknown> }>;
  setImportMeta: React.Dispatch<React.SetStateAction<Record<string, { textractResultUrl?: string; invoiceDetail?: Record<string, unknown> }>>>;
  allFiles: UploadedFile[];

  // Batches
  batches: Batch[];
  setBatches: React.Dispatch<React.SetStateAction<Batch[]>>;
  addToBuffer: (fileIds: string[]) => void;
  removeFromBuffer: (fileId: string) => void;
  finalizeBuffer: (name: string, batchId?: string) => string;

  // Selection
  selectedDocIds: Set<string>;
  setSelectedDocIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Tabs
  openTabs: string[];
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  handleSelectFile: (id: string) => void;
  handleCloseTab: (id: string) => void;

  // Left sidebar tab
  leftTab: 'files' | 'imports';
  setLeftTab: React.Dispatch<React.SetStateAction<'files' | 'imports'>>;
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null);

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAnnotation(): AnnotationContextValue {
  const ctx = useContext(AnnotationContext);
  if (!ctx) throw new Error('useAnnotation must be used within AnnotationProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AnnotationProvider({ children }: { children: React.ReactNode }) {
  // Files
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [importedFiles, setImportedFiles] = useState<UploadedFile[]>([]);
  const [importMeta, setImportMeta] = useState<Record<string, { textractResultUrl?: string; invoiceDetail?: Record<string, unknown> }>>({});

  const allFiles = useMemo(() => [...files, ...importedFiles], [files, importedFiles]);
  const allFileIds = useMemo(() => allFiles.map((f) => f.id), [allFiles]);

  // Batches
  const [batches, setBatches] = useState<Batch[]>([createEmptyBuffer()]);

  // Selection
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Left sidebar tab
  const [leftTab, setLeftTab] = useState<'files' | 'imports'>('files');

  // ─── Tab management (inlined from useTabManager) ────────────────────────
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabId, setActiveTabIdRaw] = useState<string | null>(null);

  // Prune stale tabs when files change
  useEffect(() => {
    const idSet = new Set(allFileIds);
    setOpenTabs((prev) => prev.filter((id) => idSet.has(id)));
    setActiveTabIdRaw((prev) => (prev && idSet.has(prev) ? prev : null));
  }, [allFileIds]);

  const setActiveTabId = useCallback((id: string | null) => {
    setActiveTabIdRaw(id);
  }, []);

  const handleSelectFile = useCallback((id: string) => {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveTabIdRaw(id);
  }, []);

  const handleCloseTab = useCallback((id: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((tabId) => tabId !== id);
      setActiveTabIdRaw((currentActive) => {
        if (currentActive === id) {
          const closedIdx = prev.indexOf(id);
          return next[Math.min(closedIdx, next.length - 1)] ?? null;
        }
        return currentActive;
      });
      return next;
    });
  }, []);

  // ─── Buffer helpers ─────────────────────────────────────────────────────

  const addToBuffer = useCallback((fileIds: string[]) => {
    setBatches((prev) => prev.map((b) =>
      !b.named
        ? { ...b, fileIds: [...b.fileIds, ...fileIds.filter((id) => !b.fileIds.includes(id))] }
        : b
    ));
  }, []);

  const removeFromBuffer = useCallback((fileId: string) => {
    setBatches((prev) => prev.map((b) =>
      !b.named ? { ...b, fileIds: b.fileIds.filter((id) => id !== fileId) } : b
    ));
  }, []);

  const finalizeBuffer = useCallback((name: string, batchId?: string) => {
    const id = batchId ?? crypto.randomUUID();
    setBatches((prev) => {
      const updated = prev.map((b) =>
        !b.named ? { ...b, name, named: true, id } : b
      );
      return [...updated, createEmptyBuffer()];
    });
    return id;
  }, []);

  // ─── Context value ──────────────────────────────────────────────────────

  const value = useMemo<AnnotationContextValue>(() => ({
    files, setFiles,
    importedFiles, setImportedFiles,
    importMeta, setImportMeta,
    allFiles,
    batches, setBatches,
    addToBuffer, removeFromBuffer, finalizeBuffer,
    selectedDocIds, setSelectedDocIds,
    openTabs, activeTabId, setActiveTabId, handleSelectFile, handleCloseTab,
    leftTab, setLeftTab,
  }), [
    files, importedFiles, importMeta, allFiles,
    batches, addToBuffer, removeFromBuffer, finalizeBuffer,
    selectedDocIds,
    openTabs, activeTabId, setActiveTabId, handleSelectFile, handleCloseTab,
    leftTab,
  ]);

  return (
    <AnnotationContext.Provider value={value}>
      {children}
    </AnnotationContext.Provider>
  );
}
