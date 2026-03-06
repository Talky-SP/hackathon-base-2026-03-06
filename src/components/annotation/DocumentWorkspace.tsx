import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { UploadedFile } from './FileUploadZone';
import FileExplorer from './FileExplorer';
import DocumentViewer from './DocumentViewer';
import ViewerToolbar, { type ViewerState } from './ViewerToolbar';
import AnnotationPanel from './AnnotationPanel';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DocumentWorkspaceProps {
  files: UploadedFile[];
  onBack: () => void;
  onAddFiles: () => void;
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
  onBack,
  onAddFiles,
}: DocumentWorkspaceProps) {
  const { t } = useLanguage();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    files.length > 0 ? files[0].id : null
  );
  const [viewerState, setViewerState] = useState<ViewerState>(defaultViewerState);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const selectedFile = files.find((f) => f.id === selectedFileId) ?? null;

  // Reset viewer state when selected file changes
  useEffect(() => {
    setViewerState(defaultViewerState);
  }, [selectedFileId]);

  const updateViewerState = useCallback((partial: Partial<ViewerState>) => {
    setViewerState((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleZoomChange = useCallback(
    (zoom: number) => updateViewerState({ zoom, fitMode: 'none' }),
    [updateViewerState]
  );

  const handleTotalPagesChange = useCallback(
    (totalPages: number) => updateViewerState({ totalPages }),
    [updateViewerState]
  );

  const handleCurrentPageChange = useCallback(
    (currentPage: number) => updateViewerState({ currentPage }),
    [updateViewerState]
  );

  return (
    <div className="-mx-6 -my-8 flex flex-col h-[calc(100vh-3.5rem)]">
      {/* ── Top bar ── */}
      <div className="shrink-0 h-11 flex items-center gap-2 px-3 bg-white border-b border-gray-200">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ArrowLeft size={16} />
          <span>{t('workspace.back')}</span>
        </button>

        <div className="w-px h-5 bg-gray-200" />

        {/* Left panel toggle */}
        <button
          onClick={() => setLeftPanelOpen((o) => !o)}
          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        >
          {leftPanelOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>

        {/* Filename */}
        <span className="text-sm font-medium text-gray-700 truncate max-w-xs">
          {selectedFile?.file.name ?? ''}
        </span>

        {/* Toolbar (centered) */}
        <div className="flex-1 flex justify-center">
          {selectedFile && (
            <ViewerToolbar
              viewerState={viewerState}
              onViewerStateChange={updateViewerState}
              isPdf={selectedFile.type === 'pdf'}
            />
          )}
        </div>

        {/* Add files */}
        <button
          onClick={onAddFiles}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{t('workspace.addFiles')}</span>
        </button>

        {/* Right panel toggle */}
        <button
          onClick={() => setRightPanelOpen((o) => !o)}
          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        >
          {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>

      {/* ── 3-column body ── */}
      <div className="flex-1 flex min-h-0">
        {/* Left: File explorer */}
        {leftPanelOpen && (
          <div className="w-56 shrink-0">
            <FileExplorer
              files={files}
              selectedFileId={selectedFileId}
              onSelectFile={setSelectedFileId}
            />
          </div>
        )}

        {/* Center: Document viewer */}
        <div className="flex-1 min-w-0">
          {selectedFile ? (
            <DocumentViewer
              file={selectedFile}
              zoom={viewerState.zoom}
              rotation={viewerState.rotation}
              fitMode={viewerState.fitMode}
              currentPage={viewerState.currentPage}
              onTotalPagesChange={handleTotalPagesChange}
              onZoomChange={handleZoomChange}
              onCurrentPageChange={handleCurrentPageChange}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
              {t('workspace.noFileSelected')}
            </div>
          )}
        </div>

        {/* Right: Annotation panel */}
        {rightPanelOpen && selectedFile && (
          <div className="w-80 shrink-0">
            <AnnotationPanel file={selectedFile} />
          </div>
        )}
      </div>
    </div>
  );
}
