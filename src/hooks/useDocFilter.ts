import { useMemo, useCallback } from 'react';
import type { Batch } from '../components/annotation/FileExplorer';
import type { DocListItem } from '../services/docApiUrls';

export function useDocFilter(batches: Batch[]) {
  const filesTabDocIds = useMemo(() => {
    const ids = new Set<string>();
    for (const batch of batches) {
      if (!batch.named) continue;
      for (const fileId of batch.fileIds) {
        const match = fileId.match(/^import-(.+)-\d+$/);
        if (match) ids.add(match[1]);
      }
    }
    return ids;
  }, [batches]);

  const filterVisible = useCallback(
    (docs: DocListItem[]) => docs.filter((doc) => !filesTabDocIds.has(doc.id)),
    [filesTabDocIds],
  );

  const filterBulkCandidates = useCallback(
    (docs: DocListItem[], selectedDocIds?: Set<string>) =>
      docs.filter((doc) => !selectedDocIds?.has(doc.id) && !filesTabDocIds.has(doc.id)),
    [filesTabDocIds],
  );

  return { filesTabDocIds, filterVisible, filterBulkCandidates };
}
