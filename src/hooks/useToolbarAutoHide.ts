import { useState, useEffect, useRef, type RefObject } from 'react';

/**
 * Auto-hide toolbar based on mouse position and zoom changes.
 * Shows toolbar when cursor is in the bottom 25% of the viewer area.
 * Briefly flashes toolbar on zoom changes (Ctrl+wheel).
 */
export function useToolbarAutoHide(
  viewerAreaRef: RefObject<HTMLDivElement | null>,
  displayZoom: number,
): boolean {
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Show toolbar when cursor is in the bottom 25% of the viewer area.
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
  }, [viewerAreaRef]);

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

  return toolbarVisible;
}
