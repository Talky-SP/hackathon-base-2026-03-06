import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { UploadedFile } from '../components/annotation/FileUploadZone';
import type { Batch } from '../components/annotation/FileExplorer';
import { saveAnnotationState, loadAnnotationState, hydrateFiles } from '../services/statePersistence';

// ─── Constants ──────────────────────────────────────────────────────────────

const BUFFER_ID = '__buffer__';

function createEmptyBuffer(): Batch {
  return { id: BUFFER_ID, name: '', fileIds: [], named: false };
}

// ─── Context shape ──────────────────────────────────────────────────────────

export interface RefetchContext {
  locationId: string;
  docType: 'expenses' | 'delivery-notes' | 'income-invoices' | 'payrolls';
  documentId: string;
  categoryDate?: string;
  invoiceId?: string;
  originalLabel: string;
}

export interface ImportMetadata {
  textractResultUrl?: string;
  textractResult?: unknown;
  invoiceDetail?: Record<string, unknown>;
  refetchContext?: RefetchContext;
  urlFetchedAt?: number;
  textractUrlFetchedAt?: number;
}

interface AnnotationContextValue {
  // Files
  files: UploadedFile[];
  setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  importedFiles: UploadedFile[];
  setImportedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  importMeta: Record<string, ImportMetadata>;
  setImportMeta: React.Dispatch<React.SetStateAction<Record<string, ImportMetadata>>>;
  allFiles: UploadedFile[];

  // Refetch functions
  refetchDocumentUrl: (fileId: string) => Promise<void>;
  refetchTextractUrl: (fileId: string) => Promise<void>;

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
  // ─── Hydrate persisted state ────────────────────────────────────────────
  const persisted = useRef(loadAnnotationState());
  const p = persisted.current;

  // Files
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [importedFiles, setImportedFiles] = useState<UploadedFile[]>([]);
  const [importMeta, setImportMeta] = useState<Record<string, ImportMetadata>>(p?.importMeta ?? {});

  // Hydrate file objects asynchronously (IndexedDB for blobs)
  const [hydrated, setHydrated] = useState(!p);
  useEffect(() => {
    if (!p) return;
    hydrateFiles(p).then(({ files: localFiles, importedFiles: imported }) => {
      setFiles(localFiles);
      setImportedFiles(imported);
      setHydrated(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allFiles = useMemo(() => [...files, ...importedFiles], [files, importedFiles]);
  const allFileIds = useMemo(() => allFiles.map((f) => f.id), [allFiles]);

  // Batches
  const [batches, setBatches] = useState<Batch[]>(p?.batches ?? [createEmptyBuffer()]);

  // Selection (don't restore from sessionStorage - start fresh on mount)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Left sidebar tab
  const [leftTab, setLeftTab] = useState<'files' | 'imports'>(p?.leftTab ?? 'files');

  // ─── Tab management (inlined from useTabManager) ────────────────────────
  // Don't restore from sessionStorage - start fresh on mount
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabId, setActiveTabIdRaw] = useState<string | null>(null);

  // ─── Persist state on changes (debounced) ───────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      saveAnnotationState(files, importedFiles, importMeta, batches, new Set(), openTabs, activeTabId, leftTab);
    }, 500);
    return () => clearTimeout(timer);
  }, [hydrated, files, importedFiles, importMeta, batches, openTabs, activeTabId, leftTab]);

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

  // ─── Refetch functions ──────────────────────────────────────────────

  const refetchDocumentUrl = useCallback(async (fileId: string) => {
    const meta = importMeta[fileId];
    if (!meta?.refetchContext) {
      console.warn('[Refetch] No refetch context for file', fileId);
      return;
    }

    try {
      const { locationId, docType, documentId, categoryDate, invoiceId } = meta.refetchContext;

      // Import the required functions dynamically to avoid circular dependencies
      const { getDocDetailUrl, parseDocDetailResponse, getDocumentImageUrls } = await import('../services/docApiUrls');
      const { authenticatedFetch } = await import('../services/authFetch');

      // Build doc object for URL generation
      const doc = {
        id: documentId,
        categoryDate,
        invoiceid: invoiceId,
        label: meta.refetchContext.originalLabel,
        sublabel: '',
      };

      // Fetch fresh document detail
      const url = getDocDetailUrl(docType, locationId, doc);
      const res = await authenticatedFetch(url);
      const data = await res.json();
      const detail = parseDocDetailResponse(docType, data);

      if (!detail) throw new Error('No document detail found');

      // Extract new URLs (supports multi-page)
      const rawImageUrls = getDocumentImageUrls(detail);
      const rawTextractUrl = detail.textract_result_url as string | undefined;

      // Proxy URLs
      const proxyS3Url = (rawUrl: string) => rawUrl
        .replace('https://talky-invoice-v2-dev-6136.s3.amazonaws.com', '/s3-dev')
        .replace('https://talky-invoice-v2-prod-6136.s3.amazonaws.com', '/s3-prod');

      const proxiedUrls = rawImageUrls.map((url) => proxyS3Url(url));
      const proxiedTextractUrl = rawTextractUrl ? proxyS3Url(rawTextractUrl) : undefined;

      // Update file URL(s)
      setImportedFiles((prev) => prev.map((f) =>
        f.id === fileId && proxiedUrls.length > 0
          ? {
              ...f,
              url: proxiedUrls[0],
              urls: proxiedUrls.length > 1 ? proxiedUrls : undefined,
              preview: f.type === 'image' ? proxiedUrls[0] : f.preview
            }
          : f
      ));

      // Update metadata
      setImportMeta((prev) => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          textractResultUrl: proxiedTextractUrl,
          invoiceDetail: detail,
          urlFetchedAt: Date.now(),
          textractUrlFetchedAt: proxiedTextractUrl ? Date.now() : prev[fileId]?.textractUrlFetchedAt,
        },
      }));

      console.log('[Refetch] Successfully refetched document URL for', fileId);
    } catch (err) {
      console.error('[Refetch] Failed to refetch document URL:', err);
      throw err;
    }
  }, [importMeta, setImportedFiles, setImportMeta]);

  const refetchTextractUrl = useCallback(async (fileId: string) => {
    // Refetching textract URL requires refetching the whole document detail
    await refetchDocumentUrl(fileId);
  }, [refetchDocumentUrl]);

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
    refetchDocumentUrl, refetchTextractUrl,
  }), [
    files, importedFiles, importMeta, allFiles,
    batches, addToBuffer, removeFromBuffer, finalizeBuffer,
    selectedDocIds,
    openTabs, activeTabId, setActiveTabId, handleSelectFile, handleCloseTab,
    leftTab,
    refetchDocumentUrl, refetchTextractUrl,
  ]);

  return (
    <AnnotationContext.Provider value={value}>
      {children}
    </AnnotationContext.Provider>
  );
}
