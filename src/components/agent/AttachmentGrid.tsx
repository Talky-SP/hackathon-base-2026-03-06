import { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  /** Total attachment nodes (already rendered) */
  children: React.ReactNode[];
  /** Max visible items in the row (default 5) */
  maxVisible?: number;
};

/**
 * Single-row attachment grid.
 * Shows up to `maxVisible` items, then a "+N" pill.
 * Clicking "+N" opens a full carousel modal.
 */
export default function AttachmentGrid({ children, maxVisible = 5 }: Props) {
  const total = children.length;
  if (total === 0) return null;

  const visible = children.slice(0, maxVisible);
  const overflow = total - maxVisible;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  const openModal = (startIdx = maxVisible) => {
    setModalIndex(Math.min(startIdx, total - 1));
    setModalOpen(true);
  };

  return (
    <>
      <div className="flex gap-2 overflow-hidden items-end">
        {visible.map((child, i) => (
          <div key={i} className="shrink-0 max-w-[140px]">
            {child}
          </div>
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => openModal(maxVisible)}
            className="shrink-0 h-[140px] w-[90px] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1 hover:border-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <span className="text-lg font-bold text-gray-500">+{overflow}</span>
            <span className="text-[10px] text-gray-400">mas</span>
          </button>
        )}
      </div>

      {/* Carousel modal */}
      {modalOpen && (
        <CarouselModal
          items={children}
          startIndex={modalIndex}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function CarouselModal({ items, startIndex, onClose }: {
  items: React.ReactNode[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(items.length - 1, i + 1));

  // Keyboard nav
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 h-8 w-8 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Counter */}
        <div className="mb-3 px-3 py-1 rounded-full bg-white/90 shadow-sm text-[12px] font-medium text-gray-600 tabular-nums">
          {idx + 1} / {items.length}
        </div>

        {/* Content area */}
        <div ref={containerRef} className="bg-white rounded-2xl shadow-2xl overflow-hidden p-4 max-h-[70vh] overflow-y-auto">
          <div className="flex gap-3 flex-wrap justify-center">
            {/* Show a grid of ~6 items around the current index for context */}
            {items.map((item, i) => (
              <div
                key={i}
                className={`shrink-0 max-w-[160px] rounded-lg transition-all cursor-pointer ${
                  i === idx ? 'ring-2 ring-offset-2 scale-105' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ ringColor: '#f2764b' }}
                onClick={() => setIdx(i)}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              disabled={idx === 0}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={idx === items.length - 1}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
