import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Columns,
  Scan,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

// ─── Types ─────────────────────────────────────────────────────────────────

export type BBoxMode = 0 | 1 | 2; // 0 = precise, 1 = metadata, 2 = off

export interface ViewerState {
  zoom: number;
  rotation: number;
  fitMode: 'none' | 'width';
  currentPage: number;
  totalPages: number;
  bboxMode: BBoxMode;
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
  const cycleBBox = () => onViewerStateChange({ bboxMode: ((viewerState.bboxMode + 1) % 3) as BBoxMode });
  const bboxLabels = [t('viewer.bbox.precise'), t('viewer.bbox.metadata'), t('viewer.bbox.off')] as const;

  const prevPage = () => {
    if (currentPage > 1) onViewerStateChange({ currentPage: currentPage - 1 });
  };
  const nextPage = () => {
    if (currentPage < totalPages) onViewerStateChange({ currentPage: currentPage + 1 });
  };

  const btnClass =
    'p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-1">
      {/* Zoom controls */}
      <button onClick={zoomOut} className={btnClass} title={t('viewer.zoomOut')}>
        <ZoomOut size={16} />
      </button>
      <span className="text-xs font-medium text-gray-500 w-12 text-center select-none">
        {Math.round(displayZoom * 100)}%
      </span>
      <button onClick={zoomIn} className={btnClass} title={t('viewer.zoomIn')}>
        <ZoomIn size={16} />
      </button>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      {/* Fit controls */}
      <button
        onClick={fitWidth}
        className={`${btnClass} ${viewerState.fitMode === 'width' ? 'bg-gray-200 text-gray-800' : ''}`}
        title={t('viewer.fitWidth')}
      >
        <Columns size={16} />
      </button>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      {/* Rotate */}
      <button onClick={rotate} className={btnClass} title={t('viewer.rotate')}>
        <RotateCw size={16} />
      </button>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      {/* BBox mode */}
      <button
        onClick={cycleBBox}
        className={`${btnClass} ${viewerState.bboxMode < 2 ? 'text-blue-500 hover:text-blue-700' : ''}`}
        title={`OCR boxes: ${bboxLabels[viewerState.bboxMode]}`}
      >
        <Scan size={16} />
      </button>
      <span className="text-[10px] font-medium text-gray-500 w-14 text-center select-none">
        {bboxLabels[viewerState.bboxMode]}
      </span>

      {/* Page navigation (PDF only) */}
      {isPdf && totalPages > 0 && (
        <>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className={btnClass}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-medium text-gray-500 select-none">
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
