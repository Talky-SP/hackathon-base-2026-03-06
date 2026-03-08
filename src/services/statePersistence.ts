import type { UploadedFile } from '../components/annotation/FileUploadZone';
import type { Batch } from '../components/annotation/FileExplorer';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SerializedFile {
  id: string;
  type: 'pdf' | 'image';
  validatedType: string;
  fileName: string;
  fileType: string;
  url?: string;
  urls?: string[];
  docType?: 'expenses' | 'delivery-notes' | 'income-invoices' | 'payrolls';
}

export interface PersistedAnnotationState {
  importedFiles: SerializedFile[];
  localFiles: SerializedFile[];
  importMeta: Record<string, { textractResultUrl?: string; invoiceDetail?: Record<string, unknown> }>;
  batches: Batch[];
  selectedDocIds: string[];
  openTabs: string[];
  activeTabId: string | null;
  leftTab: 'files' | 'imports';
}

export interface PersistedErrorTagState {
  globalErrorTags: string[];
  fieldErrorTags: Record<string, string[]>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ANNOTATION_KEY = 'annotation-state';
const ERROR_TAG_KEY = 'error-tag-state';
const IDB_NAME = 'annotation-files';
const IDB_STORE = 'blobs';
const IDB_VERSION = 1;

// ─── IndexedDB helpers ──────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFileBlobs(files: UploadedFile[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(IDB_STORE, 'readwrite');
  const store = tx.objectStore(IDB_STORE);
  store.clear();
  for (const f of files) {
    store.put(f.file, f.id);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadFileBlobs(): Promise<Map<string, File>> {
  const db = await openDB();
  const tx = db.transaction(IDB_STORE, 'readonly');
  const store = tx.objectStore(IDB_STORE);
  const keys = store.getAllKeys();
  const values = store.getAll();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      const map = new Map<string, File>();
      for (let i = 0; i < keys.result.length; i++) {
        map.set(keys.result[i] as string, values.result[i] as File);
      }
      resolve(map);
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ─── Serialization helpers ──────────────────────────────────────────────────

function serializeFile(f: UploadedFile): SerializedFile {
  return {
    id: f.id,
    type: f.type,
    validatedType: f.validatedType,
    fileName: f.file.name,
    fileType: f.file.type,
    url: f.url,
    urls: f.urls,
    docType: f.docType,
  };
}

function deserializeFile(s: SerializedFile, blob?: File): UploadedFile {
  const file = blob ?? new File([], s.fileName, { type: s.fileType });
  return {
    id: s.id,
    file,
    type: s.type,
    validatedType: s.validatedType,
    url: s.url,
    urls: s.urls,
    docType: s.docType,
  };
}

// ─── Annotation state ───────────────────────────────────────────────────────

export function saveAnnotationState(
  files: UploadedFile[],
  importedFiles: UploadedFile[],
  importMeta: Record<string, { textractResultUrl?: string; invoiceDetail?: Record<string, unknown> }>,
  batches: Batch[],
  selectedDocIds: Set<string>,
  openTabs: string[],
  activeTabId: string | null,
  leftTab: 'files' | 'imports',
): void {
  const state: PersistedAnnotationState = {
    localFiles: files.map(serializeFile),
    importedFiles: importedFiles.map(serializeFile),
    importMeta,
    batches,
    selectedDocIds: [...selectedDocIds],
    openTabs,
    activeTabId,
    leftTab,
  };
  try {
    sessionStorage.setItem(ANNOTATION_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage full — silently fail
  }
  // Save local file blobs to IndexedDB (fire-and-forget)
  saveFileBlobs(files).catch(() => {});
}

export function loadAnnotationState(): PersistedAnnotationState | null {
  try {
    const raw = sessionStorage.getItem(ANNOTATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAnnotationState;
  } catch {
    return null;
  }
}

export async function hydrateFiles(
  state: PersistedAnnotationState,
): Promise<{ files: UploadedFile[]; importedFiles: UploadedFile[] }> {
  const blobMap = await loadFileBlobs().catch(() => new Map<string, File>());
  return {
    files: state.localFiles.map((s) => deserializeFile(s, blobMap.get(s.id))),
    importedFiles: state.importedFiles.map((s) => deserializeFile(s)),
  };
}

// ─── Error tag state ────────────────────────────────────────────────────────

export function saveErrorTagState(state: PersistedErrorTagState): void {
  try {
    sessionStorage.setItem(ERROR_TAG_KEY, JSON.stringify(state));
  } catch {}
}

export function loadErrorTagState(): PersistedErrorTagState | null {
  try {
    const raw = sessionStorage.getItem(ERROR_TAG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedErrorTagState;
  } catch {
    return null;
  }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

export async function clearPersistedState(): Promise<void> {
  sessionStorage.removeItem(ANNOTATION_KEY);
  sessionStorage.removeItem(ERROR_TAG_KEY);
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    await new Promise<void>((resolve) => { tx.oncomplete = () => { db.close(); resolve(); }; });
  } catch {}
}
