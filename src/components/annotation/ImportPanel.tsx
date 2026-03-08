import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Loader2, ChevronRight, ChevronDown, MapPin, Plus, X, Building2,
  FileText, Image as ImageIcon,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { authenticatedFetch } from '../../services/authFetch';
import { cachedFetch } from '../../services/cachedFetch';
import { config } from '../../config/environment';
import { SearchInput, Button } from '../ui';
import Modal from '../ui/Modal';
import { useNotification } from '../../contexts/NotificationContext';
import LazyImage from './LazyImage';
import Fuse from 'fuse.js';
import {
  DOC_TYPES, getDocListUrl, getDocDetailUrl,
  parseDocListResponse, parseDocDetailResponse, getDocumentFileUrl, getDocumentImageUrls,
  getSearchDocumentsUrl, parseSearchDocumentsResponse,
  type DocType, type DocListItem,
} from '../../services/docApiUrls';
import type { UploadedFile } from './FileUploadZone';
import { useDocFilter } from '../../hooks/useDocFilter';
import type { Batch } from './FileExplorer';
import type { RefetchContext } from '../../contexts/AnnotationContext';

// TODO: re-enable manual file upload
const MANUAL_UPLOAD_ENABLED = false;

/** Max concurrent downloads during bulk import */
const BULK_CONCURRENCY = 3;

// ─── Types ──────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  cif?: string;
}

interface Provider {
  cif: string;
  name: string;
  company: string;
  logo_url?: string;
  locationId: string;
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|tiff?)(\?|$)/i;

function detectFileType(url: string): { type: 'pdf' | 'image'; validatedType: string } {
  if (IMAGE_EXTENSIONS.test(url)) {
    const ext = url.match(IMAGE_EXTENSIONS)?.[1]?.toLowerCase() ?? 'png';
    return { type: 'image', validatedType: ext };
  }
  return { type: 'pdf', validatedType: 'pdf' };
}

function proxyS3Url(url: string): string {
  return url
    .replace('https://talky-invoice-v2-dev-6136.s3.amazonaws.com', '/s3-dev')
    .replace('https://talky-invoice-v2-prod-6136.s3.amazonaws.com', '/s3-prod');
}

type AccordionSection = 'selectedFiles' | 'experiments' | 'goldenDataset' | 'unreviewed';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ImportPanelProps {
  onImportFile: (file: UploadedFile, textractResultUrl?: string, invoiceDetail?: Record<string, unknown>, options?: { openInViewer?: boolean; addToBuffer?: boolean; refetchContext?: RefetchContext }) => void;
  onAddFiles?: () => void;
  onExternalFileDrop?: (files: File[]) => void;
  selectedDocIds?: Set<string>;
  onToggleSelect?: (doc: DocListItem) => void;
  onBulkSelect?: (docs: DocListItem[]) => void;
  onBulkCreateBatch?: (name: string, mergeBatchId?: string) => void;
  bufferFiles?: UploadedFile[];
  onRemoveFromBuffer?: (fileId: string) => void;
  onOpenNamingModal?: () => void;
  onPreviewFile?: (fileId: string) => void;
  importedFiles?: UploadedFile[];
  batches?: Batch[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ImportPanel({ onImportFile, onAddFiles, onExternalFileDrop, selectedDocIds, onToggleSelect, onBulkSelect, onBulkCreateBatch, bufferFiles = [], onRemoveFromBuffer, onOpenNamingModal, onPreviewFile, importedFiles = [], batches = [] }: ImportPanelProps) {
  const { t } = useLanguage();
  const { notify } = useNotification();
  const { filterVisible, filterBulkCandidates } = useDocFilter(batches);

  // Refs for bulk auto-pagination
  const allLoadedDocsRef = useRef<DocListItem[]>([]);
  const hasMoreRef = useRef(false);

  // Accordion state — only one section open at a time
  const [expandedSection, setExpandedSection] = useState<AccordionSection | null>('unreviewed');

  const toggleSection = (section: AccordionSection) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  // Location state
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Provider state
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [providerSearch, setProviderSearch] = useState('');
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Doc state — multi-select doc types
  const [selectedDocTypes, setSelectedDocTypes] = useState<Set<DocType>>(new Set(['expenses']));
  const [docList, setDocList] = useState<DocListItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // paginationToken per "locationId:docType" job
  const paginationTokensRef = useRef<Map<string, string>>(new Map());
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Drop zone state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  // Bulk select state
  const [bulkBatchSize, setBulkBatchSize] = useState('10');
  const [loadingDetailIds, setLoadingDetailIds] = useState<Set<string>>(new Set());
  const docListRef = useRef<HTMLDivElement>(null);

  // Bulk modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkModalStep, setBulkModalStep] = useState<'input' | 'importing' | 'done' | 'confirm-merge'>('input');
  const [bulkProgress, setBulkProgress] = useState({ completed: 0, total: 0, failed: 0 });
  const [bulkTotalAvailable, setBulkTotalAvailable] = useState(0);
  const [bulkBatchName, setBulkBatchName] = useState('');

  // Invoice number search state
  const [searchMode, setSearchMode] = useState<'supplier' | 'invoiceNumber'>('supplier');
  const [invoiceNumberQuery, setInvoiceNumberQuery] = useState('');
  const [invoiceSearchResults, setInvoiceSearchResults] = useState<DocListItem[]>([]);
  const [loadingInvoiceSearch, setLoadingInvoiceSearch] = useState(false);
  const [invoiceSearchHasMore, setInvoiceSearchHasMore] = useState(false);
  const invoiceNextTokenRef = useRef<string | undefined>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ─── Helpers ────────────────────────────────────────────────────────────

  const looksLikeCif = (q: string) => {
    const t = q.trim();
    return /\d{2}/.test(t) && (t.match(/[A-Za-z]/g) || []).length < 4;
  };

  // ─── Derived state ──────────────────────────────────────────────────────

  const effectiveLocationIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedLocation) ids.add(selectedLocation);
    if (selectedProvider) ids.add(selectedProvider.locationId);
    return Array.from(ids);
  }, [selectedLocation, selectedProvider]);

  const hasActiveFilter = selectedLocation !== null || selectedProvider !== null;

  // Locations filtered by search query, excluding already-selected
  const filteredLocations = useMemo(() => {
    const list = selectedLocation ? locations.filter((loc) => loc.id !== selectedLocation) : locations;
    if (!searchQuery.trim()) return list;
    const query = searchQuery.trim().toLowerCase();
    if (looksLikeCif(searchQuery)) {
      return list.filter((loc) => loc.cif?.toLowerCase().startsWith(query));
    }
    const fuse = new Fuse(list, {
      keys: ['name', 'id', 'cif'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    return fuse.search(searchQuery).map((r) => r.item);
  }, [locations, searchQuery, selectedLocation]);

  // Providers filtered by selected location + search query, excluding already-selected
  const filteredProviders = useMemo(() => {
    let list = selectedProvider ? allProviders.filter((p) => p.cif !== selectedProvider.cif) : allProviders;
    if (selectedLocation) {
      list = list.filter((p) => p.locationId === selectedLocation);
    }
    if (!providerSearch.trim()) return list;
    if (looksLikeCif(providerSearch)) {
      const query = providerSearch.trim().toLowerCase();
      return list.filter((p) => p.cif.toLowerCase().startsWith(query));
    }
    const fuse = new Fuse(list, {
      keys: ['name', 'company', 'cif'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    return fuse.search(providerSearch).map((r) => r.item);
  }, [allProviders, selectedLocation, selectedProvider, providerSearch]);

  // ─── Fetch locations on mount ───────────────────────────────────────────

  const fetchLocations = useCallback(async () => {
    setLoadingLocations(true);
    setError('');
    try {
      const data = await cachedFetch<{ locations?: Location[] }>(
        `${config.talkyTpvBaseUrl}/get-user-locations`,
        { ttl: 10 * 60 * 1000 },
      );
      setLocations(data.locations || []);
    } catch (err) {
      setError(`Error: ${(err as Error).message}`);
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  // ─── Fetch providers for all locations after locations load ─────────────

  useEffect(() => {
    if (locations.length === 0) return;

    let cancelled = false;
    setLoadingProviders(true);

    const fetchAllProviders = async () => {
      try {
        const results = await Promise.allSettled(
          locations.map((loc) =>
            cachedFetch<{ providers?: Record<string, unknown>[] }>(
              `${config.talkyOrdersApiBaseUrl}/orders/providers/by-location/${loc.id}`,
              { ttl: 10 * 60 * 1000 },
            ).then((data) => {
                const providers = (data.providers || []) as Record<string, unknown>[];
                return providers.map((p) => ({
                  cif: (p.cif || '') as string,
                  name: (p.name || p.trade_name || '') as string,
                  company: (p.company || '') as string,
                  logo_url: (p.logo_url || p.logoUrl || undefined) as string | undefined,
                  locationId: loc.id,
                }));
              })
          )
        );

        if (cancelled) return;

        const combined: Provider[] = [];
        const seen = new Set<string>();
        for (const result of results) {
          if (result.status === 'fulfilled') {
            for (const p of result.value) {
              if (p.cif && !seen.has(p.cif)) {
                seen.add(p.cif);
                combined.push(p);
              }
            }
          }
        }
        setAllProviders(combined);
      } catch {
        // Silently handle — providers are an optional filter
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    };

    fetchAllProviders();
    return () => { cancelled = true; };
  }, [locations]);

  // ─── Fetch document list (multi-location × multi-docType) ──────────────

  const fetchDocList = useCallback(async (isLoadMore = false) => {
    if (effectiveLocationIds.length === 0) {
      setDocList([]);
      allLoadedDocsRef.current = [];
      return allLoadedDocsRef.current;
    }
    if (!isLoadMore) {
      setLoadingDocs(true);
      setDocList([]);
      allLoadedDocsRef.current = [];
      paginationTokensRef.current = new Map();
      setHasMore(false);
      hasMoreRef.current = false;
    } else {
      setLoadingMore(true);
    }
    setError('');

    // Empty selectedDocTypes = no filter = fetch all doc types
    const docTypes = selectedDocTypes.size > 0 ? Array.from(selectedDocTypes) : DOC_TYPES.map(d => d.key);
    const jobs: { jobKey: string; docType: DocType; locationId: string; url: string }[] = [];

    for (const locationId of effectiveLocationIds) {
      for (const docType of docTypes) {
        const jobKey = `${locationId}:${docType}`;
        // On load-more, skip jobs that have exhausted their pages
        if (isLoadMore && !paginationTokensRef.current.has(jobKey)) continue;

        let supplierCif: string | undefined;
        if (docType === 'expenses' && selectedProvider && selectedProvider.locationId === locationId) {
          supplierCif = selectedProvider.cif;
        }
        const token = isLoadMore ? paginationTokensRef.current.get(jobKey) : undefined;
        const url = getDocListUrl(docType, locationId, supplierCif, token);
        jobs.push({ jobKey, docType, locationId, url });
      }
    }

    if (isLoadMore && jobs.length === 0) {
      setHasMore(false);
      hasMoreRef.current = false;
      setLoadingMore(false);
      return allLoadedDocsRef.current;
    }

    try {
      const results = await Promise.allSettled(
        jobs.map(async (job) => {
          const res = await authenticatedFetch(job.url);
          const data = await res.json();
          const page = parseDocListResponse(job.docType, data);
          return { ...page, jobKey: job.jobKey };
        })
      );

      const merged: DocListItem[] = [];
      const seen = new Set<string>();
      let anyHasMore = false;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { items, paginationToken, hasMore: pageHasMore, jobKey } = result.value;
          for (const doc of items) {
            if (!seen.has(doc.id)) {
              seen.add(doc.id);
              merged.push(doc);
            }
          }
          if (pageHasMore && paginationToken) {
            paginationTokensRef.current.set(jobKey, paginationToken);
            anyHasMore = true;
          } else {
            paginationTokensRef.current.delete(jobKey);
          }
        }
      }

      setHasMore(anyHasMore);
      hasMoreRef.current = anyHasMore;

      let result: DocListItem[];
      if (!isLoadMore) {
        result = merged;
      } else {
        const existingIds = new Set(allLoadedDocsRef.current.map((d) => d.id));
        const newDocs = merged.filter((d) => !existingIds.has(d.id));
        result = newDocs.length > 0 ? [...allLoadedDocsRef.current, ...newDocs] : allLoadedDocsRef.current;
      }
      allLoadedDocsRef.current = result;
      setDocList(result);
      return result;
    } catch (err) {
      setError(`Error: ${(err as Error).message}`);
      return allLoadedDocsRef.current;
    } finally {
      setLoadingDocs(false);
      setLoadingMore(false);
    }
  }, [effectiveLocationIds, selectedDocTypes, selectedProvider]);

  useEffect(() => { fetchDocList(false); }, [fetchDocList]);

  // ─── Infinite scroll — observe sentinel at bottom of doc list ──────────

  const handleLoadMore = useCallback(() => {
    if (searchMode === 'invoiceNumber') {
      if (invoiceSearchHasMore && !loadingInvoiceSearch) {
        fetchInvoiceSearch(true);
      }
      return;
    }
    if (hasMore && !loadingDocs && !loadingMore) {
      fetchDocList(true);
    }
  }, [hasMore, loadingDocs, loadingMore, fetchDocList, searchMode, invoiceSearchHasMore, loadingInvoiceSearch]);

  // ─── Invoice number search ─────────────────────────────────────────────

  const fetchInvoiceSearch = useCallback(async (isLoadMore = false) => {
    const locationId = effectiveLocationIds[0];
    if (!locationId || !invoiceNumberQuery.trim()) return;

    if (!isLoadMore) {
      setLoadingInvoiceSearch(true);
      setInvoiceSearchResults([]);
      invoiceNextTokenRef.current = undefined;
      setInvoiceSearchHasMore(false);
    } else {
      setLoadingInvoiceSearch(true);
    }

    try {
      const token = isLoadMore ? invoiceNextTokenRef.current : undefined;
      const url = getSearchDocumentsUrl(locationId, invoiceNumberQuery.trim(), token);
      const res = await authenticatedFetch(url);
      const data = await res.json();
      const page = parseSearchDocumentsResponse(data);

      invoiceNextTokenRef.current = page.paginationToken;
      setInvoiceSearchHasMore(page.hasMore);

      if (!isLoadMore) {
        setInvoiceSearchResults(page.items);
      } else {
        setInvoiceSearchResults((prev) => {
          const existingIds = new Set(prev.map((d) => d.id));
          const newDocs = page.items.filter((d) => !existingIds.has(d.id));
          return newDocs.length > 0 ? [...prev, ...newDocs] : prev;
        });
      }
    } catch (err) {
      setError(`Error: ${(err as Error).message}`);
    } finally {
      setLoadingInvoiceSearch(false);
    }
  }, [effectiveLocationIds, invoiceNumberQuery]);

  // Debounced invoice search
  useEffect(() => {
    if (searchMode !== 'invoiceNumber') return;
    if (!invoiceNumberQuery.trim()) {
      setInvoiceSearchResults([]);
      setInvoiceSearchHasMore(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchInvoiceSearch(false);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [invoiceNumberQuery, searchMode, fetchInvoiceSearch]);

  // ─── Fetch document detail & import ───────────────────────────────────────

  const handleImportDoc = useCallback(async (doc: DocListItem, options?: { forBuffer?: boolean; preview?: boolean }) => {
    const locationId = effectiveLocationIds[0];
    if (!locationId) return;
    setLoadingDetail(doc.id);
    setError('');

    const docType = doc.docType ?? Array.from(selectedDocTypes)[0];
    const url = getDocDetailUrl(docType, locationId, doc);

    try {
      const res = await authenticatedFetch(url);
      const data = await res.json();
      const detail = parseDocDetailResponse(docType, data);

      if (!detail) { setError('No document detail found'); return; }

      const imageUrls = getDocumentImageUrls(detail);
      if (imageUrls.length === 0) { setError('No document URL found'); return; }

      const { type: fileType, validatedType } = detectFileType(imageUrls[0]);
      const proxiedUrls = imageUrls.map((url) => proxyS3Url(url));
      const file: UploadedFile = {
        id: `import-${doc.id}-${Date.now()}`,
        file: new File([], doc.label),
        type: fileType,
        validatedType,
        url: proxiedUrls[0], // First URL for backward compatibility
        urls: proxiedUrls.length > 1 ? proxiedUrls : undefined, // Multiple URLs if multi-page
        preview: fileType === 'image' ? proxiedUrls[0] : undefined,
        docType, // FIX: Set docType for cache invalidation
      };

      const rawTextractUrl = detail.textract_result_url as string | undefined;

      // Build refetch context for cache invalidation
      const refetchContext = {
        locationId,
        docType,
        documentId: doc.id,
        categoryDate: doc.categoryDate,
        invoiceId: doc.invoiceid,
        originalLabel: doc.label,
      };

      if (options?.preview && !options?.forBuffer) {
        onImportFile(file, rawTextractUrl ? proxyS3Url(rawTextractUrl) : undefined, detail, { refetchContext });
        onPreviewFile?.(file.id);
      } else if (options?.forBuffer) {
        onImportFile(file, rawTextractUrl ? proxyS3Url(rawTextractUrl) : undefined, detail, { addToBuffer: true, refetchContext });
      } else {
        onImportFile(file, rawTextractUrl ? proxyS3Url(rawTextractUrl) : undefined, detail, { refetchContext });
      }
    } catch (err) {
      setError(`Error: ${(err as Error).message}`);
    } finally {
      setLoadingDetail(null);
    }
  }, [selectedDocTypes, effectiveLocationIds, onImportFile]);

  // Determine which doc list to show based on search mode
  const displayDocList = searchMode === 'invoiceNumber' ? invoiceSearchResults : docList;
  const displayHasMore = searchMode === 'invoiceNumber' ? invoiceSearchHasMore : hasMore;
  const displayLoadingMore = searchMode === 'invoiceNumber' ? loadingInvoiceSearch && invoiceSearchResults.length > 0 : loadingMore;
  const displayLoadingDocs = searchMode === 'invoiceNumber' ? loadingInvoiceSearch && invoiceSearchResults.length === 0 : loadingDocs;

  // Filter out docs already in files tab (named batches)
  const visibleDocList = useMemo(
    () => filterVisible(displayDocList),
    [displayDocList, filterVisible],
  );

  // Available for bulk (also excludes manually selected)
  const bulkCandidates = useMemo(
    () => filterBulkCandidates(displayDocList, selectedDocIds),
    [displayDocList, selectedDocIds, filterBulkCandidates],
  );
  const bulkDisabled = bulkCandidates.length === 0 && !hasMore;

  // Auto-load more pages until ≥20 visible docs or pages exhausted
  useEffect(() => {
    if (searchMode === 'invoiceNumber') return;
    if (!hasActiveFilter) return;
    if (loadingDocs || loadingMore) return;
    if (visibleDocList.length >= 20 || !hasMore) return;
    fetchDocList(true);
  }, [visibleDocList.length, hasMore, loadingDocs, loadingMore, hasActiveFilter, searchMode, fetchDocList]);

  // ─── Bulk import doc (concurrent, uses loadingDetailIds Set) ──────────

  const handleBulkImportDoc = useCallback(async (doc: DocListItem) => {
    const locationId = effectiveLocationIds[0];
    if (!locationId) throw new Error('No location selected');

    setLoadingDetailIds((prev) => { const next = new Set(prev); next.add(doc.id); return next; });

    const docType = doc.docType ?? Array.from(selectedDocTypes)[0];
    const url = getDocDetailUrl(docType, locationId, doc);

    try {
      const res = await authenticatedFetch(url);
      const data = await res.json();
      const detail = parseDocDetailResponse(docType, data);
      if (!detail) throw new Error('No document detail found');

      const invoiceUrl = getDocumentFileUrl(detail);
      if (!invoiceUrl) throw new Error('No document URL found');

      const { type: fileType, validatedType } = detectFileType(invoiceUrl);
      const proxiedUrl = proxyS3Url(invoiceUrl);
      const file: UploadedFile = {
        id: `import-${doc.id}-${Date.now()}`,
        file: new File([], doc.label),
        type: fileType,
        validatedType,
        url: proxiedUrl,
        preview: fileType === 'image' ? proxiedUrl : undefined,
      };

      const rawTextractUrl = detail.textract_result_url as string | undefined;
      onImportFile(file, rawTextractUrl ? proxyS3Url(rawTextractUrl) : undefined, detail, { addToBuffer: true });
    } finally {
      setLoadingDetailIds((prev) => { const next = new Set(prev); next.delete(doc.id); return next; });
    }
  }, [selectedDocTypes, effectiveLocationIds, onImportFile]);

  // ─── Bulk modal: start import ──────────────────────────────────────────

  const handleBulkStart = useCallback(async () => {
    const batchSize = Number(bulkBatchSize) || 0;
    if (batchSize <= 0) return;

    setBulkModalStep('importing');
    setBulkProgress({ completed: 0, total: 0, failed: 0 });

    // Collect enough candidates, auto-paginating if needed
    let allDocs = allLoadedDocsRef.current;
    let candidates = filterBulkCandidates(allDocs, selectedDocIds);

    while (candidates.length < batchSize && hasMoreRef.current) {
      const moreDocs = await fetchDocList(true);
      if (moreDocs) allDocs = moreDocs;
      candidates = filterBulkCandidates(allDocs, selectedDocIds);
    }

    setBulkTotalAvailable(candidates.length);

    if (candidates.length === 0) {
      notify(t('imports.bulkNoMore'), { variant: 'warning' });
      setBulkModalStep('input');
      return;
    }

    const toImport = candidates.slice(0, batchSize);
    setBulkProgress({ completed: 0, total: toImport.length, failed: 0 });

    onBulkSelect?.(toImport);

    // Process downloads with bounded concurrency
    const queue = [...toImport];
    const processNext = async (): Promise<void> => {
      while (queue.length > 0) {
        const doc = queue.shift()!;
        requestAnimationFrame(() => {
          const el = docListRef.current?.querySelector(`[data-doc-id="${doc.id}"]`) as HTMLElement | null;
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        try {
          await handleBulkImportDoc(doc);
          setBulkProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
        } catch {
          setBulkProgress((prev) => ({ ...prev, completed: prev.completed + 1, failed: prev.failed + 1 }));
        }
      }
    };
    const workers = Array.from({ length: Math.min(BULK_CONCURRENCY, toImport.length) }, () => processNext());
    await Promise.all(workers);

    setBulkModalStep('done');

    // Build default name from active filters
    const parts: string[] = [];
    if (selectedLocation) {
      const loc = locations.find((l) => l.id === selectedLocation);
      if (loc) parts.push(loc.name);
    }
    if (selectedProvider) parts.push(selectedProvider.name || selectedProvider.company);
    const typeInitials = Array.from(selectedDocTypes)
      .map((k) => DOC_TYPES.find((d) => d.key === k)?.label?.[0] ?? '')
      .filter(Boolean)
      .join('');
    if (typeInitials) parts.push(typeInitials);
    setBulkBatchName(parts.length > 0 ? parts.join(' · ') : t('batches.importedDefault'));
  }, [filterBulkCandidates, selectedDocIds, bulkBatchSize, fetchDocList, onBulkSelect, handleBulkImportDoc, notify, t, selectedLocation, locations, selectedProvider, selectedDocTypes]);

  // ─── Bulk modal: finalize batch ──────────────────────────────────────

  const matchingBatch = useMemo(() => {
    const name = bulkBatchName.trim();
    if (!name) return null;
    return batches.find((b) => b.named && b.name === name) ?? null;
  }, [bulkBatchName, batches]);

  const handleBulkFinalize = useCallback(() => {
    const name = bulkBatchName.trim() || t('batches.importedDefault');
    if (matchingBatch) {
      setBulkModalStep('confirm-merge');
      return;
    }
    onBulkCreateBatch?.(name);
    setShowBulkModal(false);
    setBulkModalStep('input');
  }, [bulkBatchName, onBulkCreateBatch, t, matchingBatch]);

  const handleBulkMergeConfirm = useCallback(() => {
    if (matchingBatch) {
      onBulkCreateBatch?.(bulkBatchName.trim(), matchingBatch.id);
    }
    setShowBulkModal(false);
    setBulkModalStep('input');
  }, [matchingBatch, bulkBatchName, onBulkCreateBatch]);

  // ─── Toggle doc type (multi-select, at least one must remain) ──────────

  const toggleDocType = useCallback((key: DocType) => {
    setSelectedDocTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // ─── Selection handlers ────────────────────────────────────────────────

  const addLocation = useCallback((id: string) => {
    setSelectedLocation(id);
    setSearchQuery('');
  }, []);

  const removeLocation = useCallback(() => {
    setSelectedLocation(null);
  }, []);

  const addProvider = useCallback((provider: Provider) => {
    setSelectedProvider(provider);
    setProviderSearch('');
  }, []);

  const removeProvider = useCallback(() => {
    setSelectedProvider(null);
  }, []);

  // ─── Drop zone handlers ─────────────────────────────────────────────────

  const handleDropZoneDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  }, []);

  const handleDropZoneDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDropZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDropZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0 && onExternalFileDrop) {
      onExternalFileDrop(Array.from(e.dataTransfer.files));
    }
  }, [onExternalFileDrop]);

  const handleDropZoneClick = useCallback(() => {
    if (onAddFiles) {
      onAddFiles();
    } else {
      fileInputRef.current?.click();
    }
  }, [onAddFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onExternalFileDrop) {
      onExternalFileDrop(Array.from(files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onExternalFileDrop]);

  // ─── Accordion header renderer ──────────────────────────────────────────

  const renderAccordionHeader = (section: AccordionSection, labelKey: string) => {
    const isExpanded = expandedSection === section;
    return (
      <button
        onClick={() => toggleSection(section)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-100 transition-colors border-b border-gray-200"
      >
        {isExpanded ? (
          <ChevronDown size={14} className="shrink-0 text-gray-500" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-gray-500" />
        )}
        <span className="text-xs font-semibold text-gray-500">{t(labelKey as Parameters<typeof t>[0])}</span>
      </button>
    );
  };

  // ─── Doc list item click handlers ─────────────────────────────────────────

  const handleDocClick = useCallback((doc: DocListItem, event: React.MouseEvent) => {
    // Ctrl+click (or Cmd+click on Mac) opens/previews the document
    if (event.ctrlKey || event.metaKey) {
      const existing = importedFiles.find(f => f.id.includes(doc.id));
      if (existing) {
        onPreviewFile?.(existing.id);
      } else {
        handleImportDoc(doc, { preview: true });
      }
      return;
    }

    // Regular click: toggle selection or add to buffer
    if (onToggleSelect) {
      const alreadySelected = selectedDocIds?.has(doc.id);
      onToggleSelect(doc);
      if (!alreadySelected) {
        const existing = importedFiles.find(f => f.id.includes(doc.id));
        if (!existing) {
          handleImportDoc(doc, { forBuffer: true });
        }
      }
    } else {
      handleImportDoc(doc);
    }
  }, [onToggleSelect, selectedDocIds, importedFiles, handleImportDoc, onPreviewFile]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="h-full flex flex-col text-sm bg-white border-r border-gray-200"
      onDragEnter={MANUAL_UPLOAD_ENABLED ? handleDropZoneDragEnter : undefined}
      onDragOver={MANUAL_UPLOAD_ENABLED ? handleDropZoneDragOver : undefined}
      onDragLeave={MANUAL_UPLOAD_ENABLED ? handleDropZoneDragLeave : undefined}
      onDrop={MANUAL_UPLOAD_ENABLED ? handleDropZoneDrop : undefined}
    >
      {/* Drag overlay */}
      {/* TODO: re-enable manual file upload */}
      {MANUAL_UPLOAD_ENABLED && isDragOver && (
        <div className="absolute inset-0 z-10 bg-brand-100/80 border-2 border-brand-500 rounded-lg flex items-center justify-center pointer-events-none">
          <Plus size={24} className="text-brand-500" />
        </div>
      )}

      {/* ── Accordion area (fills remaining space) ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">

        {/* ── Golden Dataset accordion ── */}
        {renderAccordionHeader('goldenDataset', 'imports.goldenDataset')}
        {expandedSection === 'goldenDataset' && (
          <div className="px-4 py-6 border-b border-gray-200">
            <p className="text-xs text-gray-500 text-center italic">{t('imports.comingSoon')}</p>
          </div>
        )}

        {/* ── Experiments accordion ── */}
        {renderAccordionHeader('experiments', 'imports.experiments')}
        {expandedSection === 'experiments' && (
          <div className="px-4 py-6 border-b border-gray-200">
            <p className="text-xs text-gray-500 text-center italic">{t('imports.comingSoon')}</p>
          </div>
        )}

        {/* ── Unreviewed accordion ── */}
        {renderAccordionHeader('unreviewed', 'imports.unreviewed')}
        {expandedSection === 'unreviewed' && (
          <div className="flex-1 min-h-0 flex flex-col border-b border-gray-200">

            {error && (
              <div className="mx-3 mb-2 mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                {error}
              </div>
            )}

            {/* ── Location filter section ── */}
            <div className="px-3 pt-3 pb-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{t('imports.location')}</label>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('imports.searchLocation')}
                selectedValue={selectedLocation ? (locations.find((l) => l.id === selectedLocation)?.name || selectedLocation) : undefined}
                onClear={selectedLocation ? removeLocation : undefined}
              />

              {/* Location dropdown — only when search has text and no location selected */}
              {!selectedLocation && searchQuery.trim() && (
                <div className="mt-1 max-h-[150px] overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                  {loadingLocations ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 px-2 py-3">
                      <Loader2 size={14} className="animate-spin" /> {t('imports.loadingLocations')}
                    </div>
                  ) : filteredLocations.length === 0 ? (
                    <p className="text-xs text-gray-500 px-2 py-3 text-center">{t('imports.noResults')}</p>
                  ) : (
                    filteredLocations.map((loc) => (
                      <button
                        key={loc.id}
                        onClick={() => addLocation(loc.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-100 transition-colors"
                      >
                        <MapPin size={13} className="text-gray-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{loc.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{loc.cif ? `${loc.cif} · ` : ''}{loc.id}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* ── Search mode selector + Provider/Invoice search ── */}
            <div className="px-3 pt-2 pb-1">
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={() => {
                    setSearchMode('supplier');
                    setInvoiceNumberQuery('');
                    setInvoiceSearchResults([]);
                  }}
                  className={`text-[11px] uppercase tracking-wide transition-colors ${
                    searchMode === 'supplier'
                      ? 'font-semibold text-gray-500'
                      : 'text-gray-500 hover:text-gray-500'
                  }`}
                >
                  {t('imports.searchMode.supplier')}
                </button>
                <button
                  onClick={() => {
                    if (selectedLocation === null) return;
                    setSearchMode('invoiceNumber');
                    setProviderSearch('');
                  }}
                  disabled={selectedLocation === null}
                  className={`text-[11px] uppercase tracking-wide transition-colors ${
                    searchMode === 'invoiceNumber'
                      ? 'font-semibold text-gray-500'
                      : selectedLocation === null
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : 'text-gray-500 hover:text-gray-500'
                  }`}
                >
                  {t('imports.searchMode.invoiceNumber')}
                </button>
              </div>

              {searchMode === 'supplier' ? (
                <>
                  <SearchInput
                    value={providerSearch}
                    onChange={setProviderSearch}
                    placeholder={t('imports.searchProvider')}
                    selectedValue={selectedProvider ? (selectedProvider.name || selectedProvider.company || selectedProvider.cif) : undefined}
                    onClear={selectedProvider ? removeProvider : undefined}
                  />

                  {/* Provider dropdown — only when search has text and no provider selected */}
                  {!selectedProvider && providerSearch.trim() && (
                    <div ref={providerDropdownRef} className="mt-1 max-h-[150px] overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                      {loadingProviders ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500 px-2 py-3">
                          <Loader2 size={14} className="animate-spin" /> {t('imports.loadingProviders')}
                        </div>
                      ) : filteredProviders.length === 0 ? (
                        <p className="text-xs text-gray-500 px-2 py-3 text-center">{t('imports.noProviders')}</p>
                      ) : (
                        filteredProviders.map((p) => (
                          <button
                            key={p.cif}
                            onClick={() => addProvider(p)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-100 transition-colors"
                          >
                            {p.logo_url ? (
                              <LazyImage
                                src={proxyS3Url(p.logo_url)}
                                className="w-5 h-5 rounded object-cover shrink-0"
                                scrollRoot={providerDropdownRef.current}
                                rootMargin="150px"
                                fallback={<Building2 size={13} className="text-gray-500 shrink-0" />}
                              />
                            ) : (
                              <Building2 size={13} className="text-gray-500 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-800 truncate">{p.name || p.company}</p>
                              <p className="text-[10px] text-gray-500 truncate">{p.cif}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Invoice number search input */
                <SearchInput
                  value={invoiceNumberQuery}
                  onChange={(v) => {
                    setInvoiceNumberQuery(v);
                    if (!v) setInvoiceSearchResults([]);
                  }}
                  placeholder={t('imports.searchInvoice')}
                />
              )}
            </div>

            {/* ── Doc type toggle buttons (icon-only, always visible) ── */}
            <div className="px-3 pt-2 pb-2 grid grid-cols-4 gap-1">
              {DOC_TYPES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => toggleDocType(key)}
                  title={label}
                  className={`flex items-center justify-center h-7 rounded-md border transition-colors ${
                    selectedDocTypes.has(key)
                      ? 'bg-brand-100 border-brand-500 text-brand-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>

            {/* ── Bulk select button ── */}
            {onToggleSelect && (
              <div className="px-3 pb-2">
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  disabled={bulkDisabled}
                  onClick={() => { setShowBulkModal(true); setBulkModalStep('input'); }}
                  className={`text-xs ${bulkDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {t('imports.bulkSelect')}
                </Button>
              </div>
            )}

            {/* ── Document list ── */}
            <div ref={docListRef} className="flex-1 min-h-0 overflow-y-auto px-1">
              {searchMode === 'invoiceNumber' && !invoiceNumberQuery.trim() ? (
                <p className="text-xs text-gray-500 px-2 py-4 text-center">
                  {t('imports.searchInvoice')}
                </p>
              ) : !hasActiveFilter && searchMode === 'supplier' ? (
                <p className="text-xs text-gray-500 px-2 py-4 text-center">
                  {t('imports.selectFilter')}
                </p>
              ) : displayLoadingDocs ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 px-2 py-4">
                  <Loader2 size={14} className="animate-spin" /> {t('imports.loadingDocs')}
                </div>
              ) : visibleDocList.length === 0 ? (
                <p className="text-xs text-gray-500 px-2 py-4 text-center">{t('imports.noDocs')}</p>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    {visibleDocList.map((doc) => {
                      const isSelected = selectedDocIds?.has(doc.id) ?? false;
                      return (
                        <button
                          key={doc.id}
                          data-doc-id={doc.id}
                          onClick={(e) => handleDocClick(doc, e)}
                          disabled={onToggleSelect ? false : loadingDetail !== null}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                            isSelected
                              ? 'bg-brand-100 border-l-2 border-brand-500'
                              : 'hover:bg-gray-100 disabled:opacity-50'
                          }`}
                        >
                          {(() => {
                            const DocIcon = DOC_TYPES.find(d => d.key === doc.docType)?.icon || FileText;
                            return <DocIcon size={13} className="text-gray-500 shrink-0" />;
                          })()}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-800 truncate">{doc.label}</p>
                            <p className="text-[10px] text-gray-500 truncate">{doc.sublabel}</p>
                          </div>
                          {(loadingDetail === doc.id || loadingDetailIds.has(doc.id)) ? (
                            <Loader2 size={13} className="text-gray-500 shrink-0 animate-spin" />
                          ) : (
                            <ChevronRight size={13} className="text-gray-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* Load more / end indicator */}
                  {displayLoadingMore ? (
                    <div className="flex items-center justify-center gap-2 py-3">
                      <Loader2 size={14} className="text-gray-500 animate-spin" />
                      <span className="text-[11px] text-gray-500">{t('imports.loadingMore')}</span>
                    </div>
                  ) : displayHasMore ? (
                    <Button variant="ghost" size="sm" fullWidth onClick={handleLoadMore} className="text-brand-700">
                      {t('imports.loadMore')}
                    </Button>
                  ) : visibleDocList.length > 0 ? (
                    <p className="text-[11px] text-gray-500 text-center py-3">{t('imports.endOfList')}</p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Selected files accordion (only when buffer has files) ── */}
        {bufferFiles.length > 0 && (
          <>
            <button
              onClick={() => toggleSection('selectedFiles')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-100 transition-colors border-b border-gray-200"
            >
              {expandedSection === 'selectedFiles' ? (
                <ChevronDown size={14} className="shrink-0 text-gray-500" />
              ) : (
                <ChevronRight size={14} className="shrink-0 text-gray-500" />
              )}
              <span className="text-xs font-semibold text-brand-700">
                {t('imports.selectedFiles')} ({bufferFiles.length})
              </span>
            </button>
            {expandedSection === 'selectedFiles' && (
              <div className="border-b border-gray-200">
                {bufferFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => onPreviewFile?.(file.id)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-l-2 border-transparent hover:bg-gray-100 cursor-pointer"
                  >
                    {file.type === 'pdf' ? (
                      <FileText size={14} className="shrink-0 text-red-500" />
                    ) : (
                      <ImageIcon size={14} className="shrink-0 text-blue-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800 truncate">{file.file.name}</p>
                    </div>
                    {onRemoveFromBuffer && (
                      <button
                        onClick={() => onRemoveFromBuffer(file.id)}
                        className="shrink-0 p-0.5 text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {onOpenNamingModal && (
                  <div className="px-3 pb-2 pt-1">
                    <Button variant="primary" size="sm" fullWidth onClick={onOpenNamingModal}>
                      {t('batches.createBatch')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Full-width "+" add button at bottom ── */}
      {/* TODO: re-enable manual file upload */}
      {MANUAL_UPLOAD_ENABLED && (
        <div className="shrink-0 px-3 py-2 border-t border-gray-200">
          <button
            onClick={handleDropZoneClick}
            className="w-full py-2 flex items-center justify-center gap-1.5 rounded-lg bg-brand-100 border border-brand-500 text-brand-700 hover:bg-brand-100 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {/* Hidden file input fallback (when onAddFiles is not provided) */}
      {/* TODO: re-enable manual file upload */}
      {MANUAL_UPLOAD_ENABLED && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFileInputChange}
        />
      )}

      {/* ── Bulk selection modal ── */}
      <Modal
        open={showBulkModal}
        onClose={() => { if (bulkModalStep !== 'importing') setShowBulkModal(false); }}
        title={t('imports.bulkModalTitle')}
        maxWidth="max-w-sm"
        footer={
          bulkModalStep === 'input' ? (
            <>
              <Button variant="ghost" size="md" onClick={() => setShowBulkModal(false)}>
                {t('imports.bulkCancel')}
              </Button>
              <Button variant="primary" size="md" onClick={handleBulkStart} disabled={!bulkBatchSize || Number(bulkBatchSize) <= 0}>
                {t('imports.bulkStart')}
              </Button>
            </>
          ) : bulkModalStep === 'done' ? (
            <>
              <Button variant="ghost" size="md" onClick={() => setShowBulkModal(false)}>
                {t('imports.bulkClose')}
              </Button>
              <Button variant="primary" size="md" onClick={handleBulkFinalize}>
                {t('imports.bulkCreateBatch')}
              </Button>
            </>
          ) : bulkModalStep === 'confirm-merge' ? (
            <>
              <Button variant="ghost" size="md" onClick={() => setBulkModalStep('done')}>
                {t('imports.bulkCancel')}
              </Button>
              <Button variant="primary" size="md" onClick={handleBulkMergeConfirm}>
                {t('imports.bulkMergeConfirm')}
              </Button>
            </>
          ) : null
        }
      >
        <div className="px-5 py-4">
          {bulkModalStep === 'input' && (
            <div>
              <label className="text-xs font-medium text-gray-800 block mb-2">
                {t('imports.bulkCount')}
              </label>
              <input
                type="number"
                min={1}
                value={bulkBatchSize}
                onChange={(e) => setBulkBatchSize(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              />
            </div>
          )}
          {bulkModalStep === 'importing' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={24} className="animate-spin text-brand-500" />
              <p className="text-sm text-gray-800">
                {t('imports.bulkProgress')
                  .replace('{0}', String(bulkProgress.completed))
                  .replace('{1}', String(bulkProgress.total))}
              </p>
            </div>
          )}
          {bulkModalStep === 'done' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-800">
                {t('imports.bulkDone')
                  .replace('{0}', String(bulkProgress.total - bulkProgress.failed))
                  .replace('{1}', String(bulkTotalAvailable))}
              </p>
              {bulkProgress.failed > 0 && (
                <p className="text-xs text-red-500">
                  {bulkProgress.failed} failed
                </p>
              )}
              <label className="text-xs font-medium text-gray-800 block">
                {t('imports.bulkBatchName')}
              </label>
              <input
                type="text"
                value={bulkBatchName}
                onChange={(e) => setBulkBatchName(e.target.value)}
                placeholder={t('batches.nameModalPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') handleBulkFinalize(); }}
              />
            </div>
          )}
          {bulkModalStep === 'confirm-merge' && (
            <p className="text-sm text-gray-800">
              {t('imports.bulkMergeWarning').replace('{0}', bulkBatchName.trim())}
            </p>
          )}
        </div>
      </Modal>

    </div>
  );
}
