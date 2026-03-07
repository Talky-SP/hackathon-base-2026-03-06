import { useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useResizable } from '../../hooks/useResizable';
import { useToolbarAutoHide } from '../../hooks/useToolbarAutoHide';
import { useAnnotation } from '../../contexts/AnnotationContext';
import type { UploadedFile } from './FileUploadZone';
import FileExplorer from './FileExplorer';
import ImportPanel from './ImportPanel';
import DocumentViewer from './DocumentViewer';
import ViewerToolbar, { type ViewerState } from './ViewerToolbar';
import AnnotationPanel, { type TextractResult } from './AnnotationPanel';
import TabBar from './TabBar';
import FileTypeModal from './FileTypeModal';
import Modal from '../ui/Modal';
import type { DocType, DocListItem } from '../../services/docApiUrls';
import { validateFileByExtension } from '../../utils/fileValidation';

// ─── Constants ──────────────────────────────────────────────────────────────

const defaultViewerState: ViewerState = {
  zoom: 1,
  rotation: 0,
  fitMode: 'width',
  currentPage: 1,
  totalPages: 0,
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function DocumentWorkspace() {
  const { t } = useLanguage();

  // ─── Context state ────────────────────────────────────────────────────
  const {
    importedFiles, setImportedFiles,
    importMeta, setImportMeta,
    allFiles,
    batches, setBatches,
    addToBuffer, removeFromBuffer, finalizeBuffer,
    selectedDocIds, setSelectedDocIds,
    openTabs, activeTabId, setActiveTabId, handleSelectFile, handleCloseTab,
    leftTab, setLeftTab,
  } = useAnnotation();

  // ─── Local-only state ─────────────────────────────────────────────────
  const [viewerState, setViewerState] = useState<ViewerState>(defaultViewerState);
  const [displayZoom, setDisplayZoom] = useState(1);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [textractResult, setTextractResult] = useState<TextractResult | null>(null);
  const [activeFieldName, setActiveFieldName] = useState<string | null>(null);

  // File type modal state
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);

  // Batch naming modal state
  const [showNamingModal, setShowNamingModal] = useState(false);
  const [batchNameInput, setBatchNameInput] = useState('');
  const namingInputRef = useRef<HTMLInputElement>(null);

  const leftResize = useResizable({
    initialWidth: 224, minWidth: 160, maxWidth: 400, side: 'left',
    collapsed: leftCollapsed, onCollapseChange: setLeftCollapsed,
  });
  const rightResize = useResizable({
    initialWidth: 320, minWidth: 240, maxWidth: 500, side: 'right',
    collapsed: rightCollapsed, onCollapseChange: setRightCollapsed,
  });

  const selectedFile = allFiles.find((f) => f.id === activeTabId) ?? null;

  // Reset viewer state when active tab changes
  useEffect(() => {
    setViewerState(defaultViewerState);
    setDisplayZoom(1);
    setTextractResult(null);
  }, [activeTabId]);

  const updateViewerState = useCallback((partial: Partial<ViewerState>) => {
    setViewerState((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleZoomChange = useCallback(
    (zoom: number) => updateViewerState({ zoom, fitMode: 'none' }),
    [updateViewerState]
  );

  const handleDisplayZoomChange = useCallback(
    (zoom: number) => setDisplayZoom(zoom),
    []
  );

  const handleTotalPagesChange = useCallback(
    (totalPages: number) => updateViewerState({ totalPages }),
    [updateViewerState]
  );

  const handleCurrentPageChange = useCallback(
    (currentPage: number) => updateViewerState({ currentPage }),
    [updateViewerState]
  );

  // ─── Floating toolbar auto-hide ──────────────────────────────────────
  const viewerAreaRef = useRef<HTMLDivElement>(null);
  const toolbarVisible = useToolbarAutoHide(viewerAreaRef, displayZoom);

  // ─── Naming modal helpers ───────────────────────────────────────────────

  useEffect(() => {
    if (showNamingModal && namingInputRef.current) {
      namingInputRef.current.focus();
      namingInputRef.current.select();
    }
  }, [showNamingModal]);

  const openNamingModal = useCallback(() => {
    setBatchNameInput('Imported');
    setShowNamingModal(true);
  }, []);

  const handleCreateBatchFromBuffer = useCallback(() => {
    const name = batchNameInput.trim() || 'Imported';
    finalizeBuffer(name);
    setShowNamingModal(false);
  }, [batchNameInput, finalizeBuffer]);

  // ─── Upload interception with type modal ──────────────────────────────

  const handleExternalFileDrop = useCallback((droppedFiles: File[]) => {
    setPendingUploadFiles(droppedFiles);
    setShowTypeModal(true);
  }, []);

  const handleTypeModalConfirm = useCallback((typedFiles: { file: File; docType: DocType }[]) => {
    setShowTypeModal(false);
    setPendingUploadFiles([]);

    const newFiles: UploadedFile[] = typedFiles.map(({ file, docType }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const validation = validateFileByExtension(file);
      const validatedType = validation.detectedType ?? 'pdf';
      const type: 'pdf' | 'image' = validatedType === 'pdf' ? 'pdf' : 'image';
      const preview = type === 'image' ? URL.createObjectURL(file) : undefined;
      return { id, file, preview, type, validatedType, docType };
    });

    setImportedFiles((prev) => [...prev, ...newFiles]);
    addToBuffer(newFiles.map((f) => f.id));
    setLeftTab('files');
  }, [addToBuffer, setImportedFiles]);

  const handleTypeModalCancel = useCallback(() => {
    setShowTypeModal(false);
    setPendingUploadFiles([]);
  }, []);

  // ─── Import handler ────────────────────────────────────────────────────
  const handleImportFile = useCallback(
    (file: UploadedFile, fileTextractUrl?: string, fileInvoiceDetail?: Record<string, unknown>,
     options?: { openInViewer?: boolean; addToBuffer?: boolean }) => {
      setImportedFiles((prev) => [...prev, file]);
      if (fileTextractUrl || fileInvoiceDetail) {
        setImportMeta((prev) => ({
          ...prev,
          [file.id]: { textractResultUrl: fileTextractUrl, invoiceDetail: fileInvoiceDetail },
        }));
      }
      if (options?.addToBuffer) addToBuffer([file.id]);
      if (options?.openInViewer !== false) {
        handleSelectFile(file.id);
        setLeftTab('files');
      }
    },
    [handleSelectFile, setImportedFiles, setImportMeta, addToBuffer]
  );

  // ─── Import toggle select/deselect ──────────────────────────────────────

  const handleToggleSelect = useCallback((doc: DocListItem) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(doc.id)) {
        next.delete(doc.id);
        const importedFile = importedFiles.find((f) => f.id.includes(doc.id));
        if (importedFile) {
          removeFromBuffer(importedFile.id);
        }
      } else {
        next.add(doc.id);
      }
      return next;
    });
  }, [importedFiles, removeFromBuffer, setSelectedDocIds]);

  // ─── File add handler (click path — same type-modal flow as drag-drop) ──
  const handleAddFiles = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp';
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        setPendingUploadFiles(Array.from(input.files));
        setShowTypeModal(true);
      }
    };
    input.click();
  }, []);

  // Resolve textract/invoice for the active file
  const activeTextractUrl = selectedFile
    ? importMeta[selectedFile.id]?.textractResultUrl
    : undefined;
  const activeInvoiceDetail = selectedFile
    ? importMeta[selectedFile.id]?.invoiceDetail
    : undefined;

  // Build tab data for TabBar
  const tabData = openTabs
    .map((id) => {
      const file = allFiles.find((f) => f.id === id);
      if (!file) return null;
      return { id: file.id, name: file.file.name, type: file.type };
    })
    .filter((tab): tab is NonNullable<typeof tab> => tab !== null);

  // Buffer files for ImportPanel
  const bufferBatch = batches.find((b) => !b.named);
  const bufferFiles = bufferBatch
    ? bufferBatch.fileIds
        .map((id) => allFiles.find((f) => f.id === id))
        .filter((f): f is UploadedFile => f !== undefined)
        .sort((a, b) => a.file.name.localeCompare(b.file.name))
    : [];

  const isAnyResizing = leftResize.dragging || rightResize.dragging;

  return (
    <div className="-mx-6 -my-8 flex flex-col h-[calc(100vh-3.5rem)]">
      {isAnyResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}

      {/* ── 3-column body ── */}
      <div className="flex-1 flex min-h-0">
        {/* Left: File explorer / Imports or collapsed strip */}
        {leftCollapsed ? (
          <div
            onClick={() => setLeftCollapsed(false)}
            className="relative shrink-0 w-1.5 border-r border-gray-200 cursor-pointer group transition-all hover:w-2 hover:border-brand-400 hover:bg-brand-50/50"
          >
            <div className="absolute inset-y-0 -right-2 w-5" />
          </div>
        ) : (
          <div className="relative shrink-0 flex flex-col" style={{ width: leftResize.width }}>
            {/* Tab switcher */}
            <div className="shrink-0 flex border-b border-gray-200 bg-white h-9">
              {(['files', 'imports'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`flex-1 px-3 text-xs font-medium transition-colors ${
                    leftTab === tab
                      ? 'text-brand-600 border-b-2 border-brand-500'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t(tab === 'files' ? 'sidebar.files' : 'sidebar.imports')}
                </button>
              ))}
            </div>

            {/* Tab content — CSS hidden to preserve state */}
            <div className="flex-1 min-h-0">
              <div className={leftTab === 'files' ? 'h-full' : 'hidden'}>
                <FileExplorer
                  files={allFiles}
                  selectedFileId={activeTabId}
                  onSelectFile={handleSelectFile}
                  batches={batches}
                  onBatchesChange={setBatches}
                  onExternalFileDrop={handleExternalFileDrop}
                />
              </div>
              <div className={leftTab === 'imports' ? 'h-full' : 'hidden'}>
                <ImportPanel
                  onImportFile={handleImportFile}
                  onAddFiles={handleAddFiles}
                  onExternalFileDrop={handleExternalFileDrop}
                  selectedDocIds={selectedDocIds}
                  onToggleSelect={handleToggleSelect}
                  bufferFiles={bufferFiles}
                  onRemoveFromBuffer={removeFromBuffer}
                  onOpenNamingModal={openNamingModal}
                />
              </div>
            </div>

            <div
              onMouseDown={leftResize.startResize}
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-brand-400 active:bg-brand-500 transition-colors z-10"
            />
          </div>
        )}

        {/* Center: Tabs + Document viewer */}
        <div className="flex-1 min-w-0 flex flex-col">
          <TabBar
            tabs={tabData}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={handleCloseTab}
          />
          <div ref={viewerAreaRef} className="flex-1 min-h-0 relative">
            {selectedFile ? (
              <DocumentViewer
                file={selectedFile}
                zoom={viewerState.zoom}
                rotation={viewerState.rotation}
                fitMode={viewerState.fitMode}
                currentPage={viewerState.currentPage}
                onTotalPagesChange={handleTotalPagesChange}
                onZoomChange={handleZoomChange}
                onDisplayZoomChange={handleDisplayZoomChange}
                onCurrentPageChange={handleCurrentPageChange}
                invoiceDetail={activeInvoiceDetail}
                textractResult={textractResult}
                activeFieldName={activeFieldName}
                onActiveFieldClear={() => setActiveFieldName(null)}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
                {t('workspace.noFileSelected')}
              </div>
            )}

            {/* Floating toolbar island */}
            {selectedFile && (
              <div
                className={`absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-20 transition-all duration-300 ${
                  toolbarVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-2 pointer-events-none'
                }`}
              >
                <div className="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 px-3 py-1.5">
                  <ViewerToolbar
                    viewerState={viewerState}
                    displayZoom={displayZoom}
                    onViewerStateChange={updateViewerState}
                    isPdf={selectedFile.type === 'pdf'}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Annotation panel or collapsed strip */}
        {rightCollapsed ? (
          <div
            onClick={() => setRightCollapsed(false)}
            className="relative shrink-0 w-1.5 border-l border-gray-200 cursor-pointer group transition-all hover:w-2 hover:border-brand-400 hover:bg-brand-50/50"
          >
            <div className="absolute inset-y-0 -left-2 w-5" />
          </div>
        ) : (
          selectedFile && (
            <div className="relative shrink-0" style={{ width: rightResize.width }}>
              <div
                onMouseDown={rightResize.startResize}
                className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-brand-400 active:bg-brand-500 transition-colors z-10"
              />
              <AnnotationPanel
                file={selectedFile}
                textractResult={textractResult}
                onTextractResult={setTextractResult}
                textractResultUrl={activeTextractUrl}
                invoiceDetail={activeInvoiceDetail}
                onFieldSelect={setActiveFieldName}
              />
            </div>
          )
        )}
      </div>

      {/* ── File type modal ── */}
      {showTypeModal && pendingUploadFiles.length > 0 && (
        <FileTypeModal
          files={pendingUploadFiles}
          onConfirm={handleTypeModalConfirm}
          onCancel={handleTypeModalCancel}
        />
      )}

      {/* ── Batch naming modal ── */}
      <Modal
        open={showNamingModal}
        onClose={() => setShowNamingModal(false)}
        title={t('batches.nameModalTitle')}
        maxWidth="max-w-sm"
        footer={
          <>
            <button
              onClick={() => setShowNamingModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('batches.cancel')}
            </button>
            <button
              onClick={handleCreateBatchFromBuffer}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
            >
              {t('batches.confirm')}
            </button>
          </>
        }
      >
        <div className="px-5 py-4">
          <input
            ref={namingInputRef}
            type="text"
            value={batchNameInput}
            onChange={(e) => setBatchNameInput(e.target.value)}
            placeholder={t('batches.nameModalPlaceholder')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateBatchFromBuffer();
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
