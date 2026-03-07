import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Columns,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ViewerState {
  zoom: number;
  rotation: number;
  fitMode: 'none' | 'width';
  currentPage: number;
  totalPages: number;
}

interface ViewerToolbarProps {
  viewerState: ViewerState;
  /** The actual display zoom (may differ from viewerState.zoom in fitMode) */
  displayZoom: number;
  onViewerStateChange: (state: Partial<ViewerState>) => void;
  isPdf: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ViewerToolbar({
  viewerState,
  displayZoom,
  onViewerStateChange,
  isPdf,
}: ViewerToolbarProps) {
  const { t } = useLanguage();
  const { currentPage, totalPages } = viewerState;

  const zoomIn = () => onViewerStateChange({ zoom: Math.min(displayZoom + 0.25, 4), fitMode: 'none' });
  const zoomOut = () => onViewerStateChange({ zoom: Math.max(displayZoom - 0.25, 0.25), fitMode: 'none' });
  const fitWidth = () => onViewerStateChange({ fitMode: 'width' });
  const rotate = () => onViewerStateChange({ rotation: (viewerState.rotation + 90) % 360 });

  const prevPage = () => {
    if (currentPage > 1) onViewerStateChange({ currentPage: currentPage - 1 });
  };
  const nextPage = () => {
    if (currentPage < totalPages) onViewerStateChange({ currentPage: currentPage + 1 });
  };

  const btnClass =
    'p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-1">
      {/* Zoom controls */}
      <button onClick={zoomOut} className={btnClass} title={t('viewer.zoomOut')}>
        <ZoomOut size={16} />
      </button>
      <span className="text-xs font-medium text-gray-600 w-12 text-center select-none">
        {Math.round(displayZoom * 100)}%
      </span>
      <button onClick={zoomIn} className={btnClass} title={t('viewer.zoomIn')}>
        <ZoomIn size={16} />
      </button>

      <div className="w-px h-4 bg-gray-300 mx-1" />

      {/* Fit controls */}
      <button
        onClick={fitWidth}
        className={`${btnClass} ${viewerState.fitMode === 'width' ? 'bg-gray-200 text-gray-900' : ''}`}
        title={t('viewer.fitWidth')}
      >
        <Columns size={16} />
      </button>

      <div className="w-px h-4 bg-gray-300 mx-1" />

      {/* Rotate */}
      <button onClick={rotate} className={btnClass} title={t('viewer.rotate')}>
        <RotateCw size={16} />
      </button>

      {/* Page navigation (PDF only) */}
      {isPdf && totalPages > 0 && (
        <>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className={btnClass}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-medium text-gray-600 select-none">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className={btnClass}
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}
