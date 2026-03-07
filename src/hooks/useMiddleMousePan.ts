import { useEffect, type RefObject } from 'react';

/**
 * Enable middle-mouse-button panning on a scrollable container.
 * Hold middle click and drag to scroll.
 */
export function useMiddleMousePan(containerRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let panning = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return; // middle button only
      e.preventDefault();
      panning = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = el.scrollLeft;
      startScrollTop = el.scrollTop;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!panning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.scrollLeft = startScrollLeft - dx;
      el.scrollTop = startScrollTop - dy;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!panning) return;
      if (e.button !== 1) return;
      panning = false;
      el.style.cursor = '';
      el.style.userSelect = '';
    };

    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [containerRef]);
}
