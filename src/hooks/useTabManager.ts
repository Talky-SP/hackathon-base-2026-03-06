import { useState, useCallback, useEffect } from 'react';

interface UseTabManagerOptions {
  /** All available file IDs — tabs for deleted files are pruned */
  fileIds: string[];
  /** Initial tab IDs to open */
  initialTabIds?: string[];
  /** Initial active tab */
  initialActiveId?: string | null;
}

interface UseTabManagerResult {
  openTabs: string[];
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  handleSelectFile: (id: string) => void;
  handleCloseTab: (id: string) => void;
}

/**
 * Manage open tabs with select/close/prune-stale behavior.
 */
export function useTabManager({
  fileIds,
  initialTabIds,
  initialActiveId,
}: UseTabManagerOptions): UseTabManagerResult {
  const [openTabs, setOpenTabs] = useState<string[]>(initialTabIds ?? []);
  const [activeTabId, setActiveTabId] = useState<string | null>(initialActiveId ?? null);

  // Prune stale tabs when files change (file deleted externally)
  useEffect(() => {
    const idSet = new Set(fileIds);
    setOpenTabs((prev) => prev.filter((id) => idSet.has(id)));
    setActiveTabId((prev) => (prev && idSet.has(prev) ? prev : null));
  }, [fileIds]);

  const handleSelectFile = useCallback((id: string) => {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveTabId(id);
  }, []);

  const handleCloseTab = useCallback(
    (id: string) => {
      setOpenTabs((prev) => {
        const next = prev.filter((tabId) => tabId !== id);
        setActiveTabId((currentActive) => {
          if (currentActive === id) {
            const closedIdx = prev.indexOf(id);
            return next[Math.min(closedIdx, next.length - 1)] ?? null;
          }
          return currentActive;
        });
        return next;
      });
    },
    []
  );

  return { openTabs, activeTabId, setActiveTabId, handleSelectFile, handleCloseTab };
}
