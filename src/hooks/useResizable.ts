import { useState, useCallback, useRef, useEffect } from 'react';

interface UseResizableOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  /** 'left' = handle on right edge, 'right' = handle on left edge */
  side: 'left' | 'right';
  /** External collapsed control — when provided, overrides internal collapsed state */
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export function useResizable({
  initialWidth,
  minWidth,
  maxWidth,
  side,
  collapsed: externalCollapsed,
  onCollapseChange,
}: UseResizableOptions) {
  const [width, setWidth] = useState(initialWidth);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const widthRef = useRef(initialWidth);
  const widthBeforeCollapse = useRef(initialWidth);

  const collapsed = externalCollapsed ?? internalCollapsed;
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;

  const setCollapsed = useCallback(
    (val: boolean) => {
      if (onCollapseChange) onCollapseChange(val);
      else setInternalCollapsed(val);
    },
    [onCollapseChange]
  );

  // Stable refs for min/max/side so the listeners never need re-registration
  const configRef = useRef({ minWidth, maxWidth, side });
  configRef.current = { minWidth, maxWidth, side };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const { minWidth: min, maxWidth: max, side: s } = configRef.current;
      const delta = s === 'left'
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      const raw = startWidth.current + delta;

      const clamped = Math.min(max, Math.max(min, raw));
      widthRef.current = clamped;
      setWidth(clamped);
      if (collapsed) setCollapsed(false);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setDragging(false);
      if (widthRef.current > 0) {
        widthBeforeCollapse.current = widthRef.current;
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // Prevent the browser's native drag (ghost image / drag-and-drop)
    const handleDragStart = (e: DragEvent) => {
      if (isDragging.current) e.preventDefault();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('dragstart', handleDragStart);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, [setCollapsed]);

  // When externally un-collapsed (e.g. toggle button), restore previous width
  useEffect(() => {
    if (!collapsed && widthRef.current === 0) {
      const restored = widthBeforeCollapse.current;
      widthRef.current = restored;
      setWidth(restored);
    }
  }, [collapsed]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setDragging(true);
    startX.current = e.clientX;
    startWidth.current = collapsedRef.current ? 0 : widthRef.current;
    if (!collapsedRef.current && widthRef.current > 0) {
      widthBeforeCollapse.current = widthRef.current;
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const effectiveWidth = collapsed ? 0 : width;

  return { width: effectiveWidth, collapsed, dragging, startResize };
}
