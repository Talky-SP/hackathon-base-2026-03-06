import { useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useResizable } from '../../hooks/useResizable';
import type { UploadedFile } from './FileUploadZone';
import FileExplorer, { type Batch } from './FileExplorer';
import DocumentViewer from './DocumentViewer';
import ViewerToolbar, { type ViewerState } from './ViewerToolbar';
import AnnotationPanel from './AnnotationPanel';
import TabBar from './TabBar';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DocumentWorkspaceProps {
  files: UploadedFile[];
  onAddFiles: () => void;
  onExternalFileDrop?: (files: File[]) => void;
}

// ─── Default state ─────────────────────────────────────────────────────────

const defaultViewerState: ViewerState = {
  zoom: 1,
  rotation: 0,
  fitMode: 'width',
  currentPage: 1,
  totalPages: 0,
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function DocumentWorkspace({
  files,
  onAddFiles,
  onExternalFileDrop,
}: DocumentWorkspaceProps) {
  const { t } = useLanguage();

  // Tab state
  const [openTabs, setOpenTabs] = useState<string[]>(
    files.length > 0 ? [files[0].id] : []
  );
  const [activeTabId, setActiveTabId] = useState<string | null>(
    files.length > 0 ? files[0].id : null
  );

  const [viewerState, setViewerState] = useState<ViewerState>(defaultViewerState);
  const [displayZoom, setDisplayZoom] = useState(1);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const leftResize = useResizable({
    initialWidth: 224, minWidth: 160, maxWidth: 400, side: 'left',
    collapsed: leftCollapsed, onCollapseChange: setLeftCollapsed,
  });
  const rightResize = useResizable({
    initialWidth: 320, minWidth: 240, maxWidth: 500, side: 'right',
    collapsed: rightCollapsed, onCollapseChange: setRightCollapsed,
  });

  // Batch state
  const [batches, setBatches] = useState<Batch[]>([]);

  const selectedFile = files.find((f) => f.id === activeTabId) ?? null;

  // Prune stale tabs when files change (file deleted externally)
  useEffect(() => {
    const fileIds = new Set(files.map((f) => f.id));
    setOpenTabs((prev) => prev.filter((id) => fileIds.has(id)));
    setActiveTabId((prev) => (prev && fileIds.has(prev) ? prev : null));
  }, [files]);

  // Reset viewer state when active tab changes
  useEffect(() => {
    setViewerState(defaultViewerState);
    setDisplayZoom(1);
  }, [activeTabId]);

  const handleSelectFile = useCallback((id: string) => {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveTabId(id);
  }, []);

  const handleCloseTab = useCallback(
    (id: string) => {
      setOpenTabs((prev) => {
        const next = prev.filter((tabId) => tabId !== id);
        if (activeTabId === id) {
          const closedIdx = prev.indexOf(id);
          const neighbor = next[Math.min(closedIdx, next.length - 1)] ?? null;
          setActiveTabId(neighbor);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const updateViewerState = useCallback((partial: Partial<ViewerState>) => {
    setViewerState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Called by DocumentViewer on Ctrl+wheel — always exits fitMode
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
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Show toolbar when cursor is in the bottom 25% of the viewer area.
  // Listen on document because the child DocumentViewer div covers the
  // entire area and captures mousemove — events wouldn't reach a parent listener.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = viewerAreaRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const inBottomZone = e.clientY > rect.bottom - rect.height * 0.25
        && e.clientX >= rect.left && e.clientX <= rect.right
        && e.clientY <= rect.bottom && e.clientY >= rect.top;

      if (inBottomZone) {
        clearTimeout(hideTimerRef.current);
        setToolbarVisible(true);
      } else {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 600);
      }
    };

    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousemove', onMove);
      clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Flash toolbar briefly whenever zoom changes (Ctrl+wheel)
  const prevZoomRef = useRef(displayZoom);
  useEffect(() => {
    if (displayZoom !== prevZoomRef.current) {
      prevZoomRef.current = displayZoom;
      setToolbarVisible(true);
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 1500);
    }
  }, [displayZoom]);

  // Build tab data for TabBar
  const tabData = openTabs
    .map((id) => {
      const file = files.find((f) => f.id === id);
      if (!file) return null;
      return { id: file.id, name: file.file.name, type: file.type };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const isAnyResizing = leftResize.dragging || rightResize.dragging;

  return (
    <div className="-mx-6 -my-8 flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Transparent overlay to prevent child elements stealing mouse events during resize */}
      {isAnyResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}

      {/* ── 3-column body ── */}
      <div className="flex-1 flex min-h-0">
        {/* Left: File explorer or collapsed strip */}
        {leftCollapsed ? (
          <div
            onClick={() => setLeftCollapsed(false)}
            className="relative shrink-0 w-1.5 border-r border-gray-200 cursor-pointer group transition-all hover:w-2 hover:border-brand-400 hover:bg-brand-50/50"
          >
            {/* Wider invisible hit target */}
            <div className="absolute inset-y-0 -right-2 w-5" />
          </div>
        ) : (
          <div className="relative shrink-0" style={{ width: leftResize.width }}>
            <FileExplorer
              files={files}
              selectedFileId={activeTabId}
              onSelectFile={handleSelectFile}
              batches={batches}
              onBatchesChange={setBatches}
              onExternalFileDrop={onExternalFileDrop}
              onAddFiles={onAddFiles}
            />
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
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
                {t('workspace.noFileSelected')}
              </div>
            )}

            {/* Floating toolbar island — auto-hides when cursor is far */}
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
            {/* Wider invisible hit target */}
            <div className="absolute inset-y-0 -left-2 w-5" />
          </div>
        ) : (
          selectedFile && (
            <div className="relative shrink-0" style={{ width: rightResize.width }}>
              <div
                onMouseDown={rightResize.startResize}
                className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-brand-400 active:bg-brand-500 transition-colors z-10"
              />
              <AnnotationPanel file={selectedFile} />
            </div>
          )
        )}
      </div>
    </div>
  );
}
