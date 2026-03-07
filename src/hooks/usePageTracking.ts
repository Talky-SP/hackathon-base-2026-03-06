import { useCallback, useEffect, useRef, type RefObject } from 'react';

interface UsePageTrackingOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  pageRefs: RefObject<Map<number, HTMLDivElement>>;
  scrollingToPage: RefObject<boolean>;
  numPages: number;
  currentPage: number;
  onCurrentPageChange: (page: number) => void;
}

/**
 * Track the current page from scroll position and scroll to a page
 * when `currentPage` changes from the toolbar (not from user scrolling).
 */
export function usePageTracking({
  containerRef,
  pageRefs,
  scrollingToPage,
  numPages,
  currentPage,
  onCurrentPageChange,
}: UsePageTrackingOptions): void {
  // Flag: true when the page change came from user scrolling (not toolbar)
  const pageChangeFromScroll = useRef(false);

  const handleScroll = useCallback(() => {
    if (scrollingToPage.current || numPages === 0) return;
    const container = containerRef.current;
    if (!container) return;

    const containerTop = container.scrollTop + container.clientHeight / 3;
    let closestPage = 1;
    let closestDist = Infinity;

    pageRefs.current.forEach((el, pageNum) => {
      const dist = Math.abs(el.offsetTop - containerTop);
      if (dist < closestDist) {
        closestDist = dist;
        closestPage = pageNum;
      }
    });

    if (closestPage !== currentPage) {
      pageChangeFromScroll.current = true;
      onCurrentPageChange(closestPage);
    }
  }, [containerRef, pageRefs, scrollingToPage, numPages, currentPage, onCurrentPageChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [containerRef, handleScroll]);

  // ─── Scroll to page when currentPage changes from toolbar ───────────────

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (!el) return;
    scrollingToPage.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      scrollingToPage.current = false;
    }, 600);
  }, [pageRefs, scrollingToPage]);

  const prevPageRef = useRef(currentPage);
  useEffect(() => {
    if (currentPage !== prevPageRef.current && numPages > 0) {
      // Only scroll to page if the change came from the toolbar, not from
      // the user scrolling (scrollbar drag, trackpad, wheel, etc.)
      if (pageChangeFromScroll.current) {
        pageChangeFromScroll.current = false;
      } else {
        scrollToPage(currentPage);
      }
    }
    prevPageRef.current = currentPage;
  }, [currentPage, numPages, scrollToPage]);
}
