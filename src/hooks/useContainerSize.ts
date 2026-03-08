import { useState, useEffect, type RefObject } from 'react';

/**
 * Observe a container element's width via ResizeObserver.
 * Returns the current content width (updates on resize).
 */
export function useContainerSize(containerRef: RefObject<HTMLDivElement | null>): number {
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });

    observer.observe(el);
    setContainerWidth(el.clientWidth);

    return () => observer.disconnect();
  }, [containerRef]);

  return containerWidth;
}
