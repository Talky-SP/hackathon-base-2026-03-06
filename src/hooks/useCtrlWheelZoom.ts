import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

interface UseCtrlWheelZoomOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  scrollingToPage: RefObject<boolean>;
  zoom: number;
  fitMode: 'none' | 'width';
  intrinsicWidth: RefObject<number>;
  onZoomChange: (zoom: number) => void;
}

/**
 * Ctrl+wheel zoom with cursor-anchored scroll correction.
 * Adjusts scroll position so the point under the cursor stays fixed.
 */
export function useCtrlWheelZoom({
  containerRef,
  scrollingToPage,
  zoom,
  fitMode,
  intrinsicWidth,
  onZoomChange,
}: UseCtrlWheelZoomOptions): void {
  // Synchronously-updated ref so rapid wheel events accumulate correctly
  const liveZoomRef = useRef(zoom);
  useEffect(() => { liveZoomRef.current = zoom; }, [zoom]);

  const fitModeRef = useRef(fitMode);
  fitModeRef.current = fitMode;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  // Pending scroll correction: stored by wheel handler, applied in useLayoutEffect
  const pendingScroll = useRef<{
    img: Element; fracX: number; fracY: number; clientX: number; clientY: number;
  } | null>(null);

  // Apply scroll correction synchronously after React commits DOM (before paint).
  useLayoutEffect(() => {
    const p = pendingScroll.current;
    if (!p) return;
    pendingScroll.current = null;
    const el = containerRef.current;
    if (!el) return;

    // Suppress page-tracking while we adjust scroll programmatically
    scrollingToPage.current = true;

    const newImgRect = p.img.getBoundingClientRect();
    const pointViewX = newImgRect.left + p.fracX * newImgRect.width;
    const pointViewY = newImgRect.top + p.fracY * newImgRect.height;
    el.scrollLeft += pointViewX - p.clientX;
    el.scrollTop += pointViewY - p.clientY;

    requestAnimationFrame(() => { scrollingToPage.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      let base: number;
      if (fitModeRef.current === 'width' && intrinsicWidth.current > 0) {
        const cw = el.clientWidth;
        base = (cw - 48) / intrinsicWidth.current;
      } else {
        base = liveZoomRef.current;
      }
      const newZoom = Math.min(4, Math.max(0.25, base + delta));
      liveZoomRef.current = newZoom;

      // Find the image closest to the cursor
      const imgs = Array.from(el.querySelectorAll('img'));
      let bestImg: Element | undefined;
      let minDist = Infinity;
      for (const img of imgs) {
        const r = img.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (d < minDist) { minDist = d; bestImg = img; }
      }

      // Record cursor position as fraction of image dimensions
      if (bestImg) {
        const imgRect = bestImg.getBoundingClientRect();
        pendingScroll.current = {
          img: bestImg,
          fracX: (e.clientX - imgRect.left) / imgRect.width,
          fracY: (e.clientY - imgRect.top) / imgRect.height,
          clientX: e.clientX,
          clientY: e.clientY,
        };
      }

      onZoomChangeRef.current(newZoom);
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [containerRef, intrinsicWidth]);
}
