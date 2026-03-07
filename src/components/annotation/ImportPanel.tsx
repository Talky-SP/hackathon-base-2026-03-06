import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Loader2, ChevronRight, ChevronDown, MapPin, Plus, X, Building2,
  FileText, Image as ImageIcon,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { authenticatedFetch } from '../../services/authFetch';
import { cachedFetch } from '../../services/cachedFetch';
import { config } from '../../config/environment';
import LazyImage from './LazyImage';
import Fuse from 'fuse.js';
import {
  DOC_TYPES, getDocListUrl, getDocDetailUrl,
  parseDocListResponse, parseDocDetailResponse,
  type DocType, type DocListItem,
} from '../../services/docApiUrls';
import type { UploadedFile } from './FileUploadZone';
import { formatFileSize } from '../../utils/fileValidation';

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

function proxyS3Url(url: string): string {
  return url
    .replace('https://talky-invoice-v2-dev-6136.s3.amazonaws.com', '/s3-dev')
    .replace('https://talky-invoice-v2-prod-6136.s3.amazonaws.com', '/s3-prod');
}

type AccordionSection = 'selectedFiles' | 'experiments' | 'goldenDataset' | 'unreviewed';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ImportPanelProps {
  onImportFile: (file: UploadedFile, textractResultUrl?: string, invoiceDetail?: Record<string, unknown>, options?: { openInViewer?: boolean; addToBuffer?: boolean }) => void;
  onAddFiles?: () => void;
  onExternalFileDrop?: (files: File[]) => void;
  selectedDocIds?: Set<string>;
  onToggleSelect?: (doc: DocListItem) => void;
  bufferFiles?: UploadedFile[];
  onRemoveFromBuffer?: (fileId: string) => void;
  onOpenNamingModal?: () => void;
  onPreviewFile?: (fileId: string) => void;
  importedFiles?: UploadedFile[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ImportPanel({ onImportFile, onAddFiles, onExternalFileDrop, selectedDocIds, onToggleSelect, bufferFiles = [], onRemoveFromBuffer, onOpenNamingModal, onPreviewFile, importedFiles = [] }: ImportPanelProps) {
  const { t } = useLanguage();

  // Accordion state — only one section open at a time
  const [expandedSection, setExpandedSection] = useState<AccordionSection | null>('unreviewed');

  const toggleSection = (section: AccordionSection) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  // Location state
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Provider state
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<Provider[]>([]);
  const [providerSearch, setProviderSearch] = useState('');
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Doc state — multi-select doc types
  const [selectedDocTypes, setSelectedDocTypes] = useState<Set<DocType>>(new Set(['expenses']));
  const [docList, setDocList] = useState<DocListItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Drop zone state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  // ─── Helpers ────────────────────────────────────────────────────────────

  const looksLikeCif = (q: string) => {
    const t = q.trim();
    return /\d{2}/.test(t) && (t.match(/[A-Za-z]/g) || []).length < 4;
  };

  // ─── Derived state ──────────────────────────────────────────────────────

  const activeProviderCifs = useMemo(() => {
    if (selectedLocations.length === 0) {
      return new Set(selectedProviders.map(p => p.cif));
    }
    const locSet = new Set(selectedLocations);
    return new Set(
      selectedProviders.filter(p => locSet.has(p.locationId)).map(p => p.cif)
    );
  }, [selectedLocations, selectedProviders]);

  const effectiveLocationIds = useMemo(() => {
    const ids = new Set<string>(selectedLocations);
    for (const p of selectedProviders) {
      if (selectedLocations.length === 0 || ids.has(p.locationId)) {
        ids.add(p.locationId);
      }
    }
    return Array.from(ids);
  }, [selectedLocations, selectedProviders]);

  const hasActiveFilter = selectedLocations.length > 0 || selectedProviders.length > 0;

  // Locations filtered by search query, excluding already-selected
  const filteredLocations = useMemo(() => {
    const selectedSet = new Set(selectedLocations);
    const list = locations.filter((loc) => !selectedSet.has(loc.id));
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
  }, [locations, searchQuery, selectedLocations]);

  // Providers filtered by selected locations + search query, excluding already-selected
  const filteredProviders = useMemo(() => {
    const selectedCifs = new Set(selectedProviders.map((p) => p.cif));
    let list = allProviders.filter((p) => !selectedCifs.has(p.cif));
    if (selectedLocations.length > 0) {
      const locSet = new Set(selectedLocations);
      list = list.filter((p) => locSet.has(p.locationId));
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
  }, [allProviders, selectedLocations, selectedProviders, providerSearch]);

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

  const fetchDocList = useCallback(async () => {
    if (effectiveLocationIds.length === 0) {
      setDocList([]);
      return;
    }
    setLoadingDocs(true);
    setError('');
    setDocList([]);

    const docTypes = Array.from(selectedDocTypes);
    const jobs: { docType: DocType; locationId: string; url: string }[] = [];

    for (const locationId of effectiveLocationIds) {
      for (const docType of docTypes) {
        // supplierCif only applies to expenses
        let supplierCif: string | undefined;
        if (docType === 'expenses') {
          const matchingProvider = selectedProviders.find((p) => p.locationId === locationId);
          supplierCif = matchingProvider?.cif;
        }
        const url = getDocListUrl(docType, locationId, supplierCif);
        jobs.push({ docType, locationId, url });
      }
    }

    try {
      const results = await Promise.allSettled(
        jobs.map(async (job) => {
          const res = await authenticatedFetch(job.url);
          const data = await res.json();
          return parseDocListResponse(job.docType, data);
        })
      );

      const merged: DocListItem[] = [];
      const seen = new Set<string>();
      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (const doc of result.value) {
            if (!seen.has(doc.id)) {
              seen.add(doc.id);
              merged.push(doc);
            }
          }
        }
      }
      setDocList(merged);
    } catch (err) {
      setError(`Error: ${(err as Error).message}`);
    } finally {
      setLoadingDocs(false);
    }
  }, [effectiveLocationIds, selectedDocTypes, selectedProviders]);

  useEffect(() => { fetchDocList(); }, [fetchDocList]);

  // ─── Fetch document detail & import ───────────────────────────────────────

  const handleImportDoc = useCallback(async (doc: DocListItem, options?: { forBuffer?: boolean; preview?: boolean }) => {
    const locationId = effectiveLocationIds[0];
    if (!locationId) return;
    setLoadingDetail(doc.id);
    setError('');

    // Use first selected doc type for detail fetch
    const docType = Array.from(selectedDocTypes)[0];
    const url = getDocDetailUrl(docType, locationId, doc);

    try {
      const res = await authenticatedFetch(url);
      const data = await res.json();
      const detail = parseDocDetailResponse(docType, data);

      if (!detail) { setError('No document detail found'); return; }

      const invoiceUrl = detail.invoice_url as string | undefined;
      if (!invoiceUrl) { setError('No invoice_url in document'); return; }

      const file: UploadedFile = {
        id: `import-${doc.id}-${Date.now()}`,
        file: new File([], doc.label),
        type: 'pdf',
        validatedType: 'pdf',
        url: proxyS3Url(invoiceUrl),
      };

      const rawTextractUrl = detail.textract_result_url as string | undefined;
      if (options?.preview && !options?.forBuffer) {
        // Preview-only (Ctrl+click): import without buffer, then preview without tab switch
        onImportFile(file, rawTextractUrl ? proxyS3Url(rawTextractUrl) : undefined, detail);
        onPreviewFile?.(file.id);
      } else if (options?.forBuffer) {
        onImportFile(file, rawTextractUrl ? proxyS3Url(rawTextractUrl) : undefined, detail, { addToBuffer: true });
      } else {
        onImportFile(file, rawTextractUrl ? proxyS3Url(rawTextractUrl) : undefined, detail);
      }
    } catch (err) {
      setError(`Error: ${(err as Error).message}`);
    } finally {
      setLoadingDetail(null);
    }
  }, [selectedDocTypes, effectiveLocationIds, onImportFile]);

  // ─── Toggle doc type (multi-select, at least one must remain) ──────────

  const toggleDocType = useCallback((key: DocType) => {
    setSelectedDocTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // ─── Selection handlers ────────────────────────────────────────────────

  const addLocation = useCallback((id: string) => {
    setSelectedLocations((prev) => prev.includes(id) ? prev : [...prev, id]);
    setSearchQuery('');
  }, []);

  const removeLocation = useCallback((id: string) => {
    setSelectedLocations((prev) => prev.filter((l) => l !== id));
  }, []);

  const addProvider = useCallback((provider: Provider) => {
    setSelectedProviders((prev) => prev.some((p) => p.cif === provider.cif) ? prev : [...prev, provider]);
    setProviderSearch('');
  }, []);

  const removeProvider = useCallback((cif: string) => {
    setSelectedProviders((prev) => prev.filter((p) => p.cif !== cif));
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
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100"
      >
        {isExpanded ? (
          <ChevronDown size={14} className="shrink-0 text-gray-400" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-gray-400" />
        )}
        <span className="text-xs font-semibold text-gray-600">{t(labelKey as Parameters<typeof t>[0])}</span>
      </button>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col text-sm bg-white border-r border-gray-200">
      {/* ── Drop zone (always visible, solid background) ── */}
      <div
        className={`shrink-0 mx-3 mt-3 mb-1 rounded-lg cursor-pointer transition-colors ${
          isDragOver ? 'border-2 border-brand-400 bg-brand-50/50' : 'border-2 border-dashed border-gray-300 bg-gray-50'
        }`}
        onClick={handleDropZoneClick}
        onDragEnter={handleDropZoneDragEnter}
        onDragOver={handleDropZoneDragOver}
        onDragLeave={handleDropZoneDragLeave}
        onDrop={handleDropZoneDrop}
      >
        <div className="flex flex-col items-center justify-center gap-1.5 py-5 px-3">
          <Plus size={20} className={`${isDragOver ? 'text-brand-500' : 'text-gray-400'}`} />
          <span className={`text-xs text-center ${isDragOver ? 'text-brand-600 font-medium' : 'text-gray-500'}`}>
            {t('imports.dropFiles')}
          </span>
        </div>
      </div>

      {/* ── Accordion area (fills remaining space) ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {/* ── Selected files accordion (only when buffer has files) ── */}
        {bufferFiles.length > 0 && (
          <>
            <button
              onClick={() => toggleSection('selectedFiles')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              {expandedSection === 'selectedFiles' ? (
                <ChevronDown size={14} className="shrink-0 text-gray-400" />
              ) : (
                <ChevronRight size={14} className="shrink-0 text-gray-400" />
              )}
              <span className="text-xs font-semibold text-brand-600">
                {t('imports.selectedFiles')} ({bufferFiles.length})
              </span>
            </button>
            {expandedSection === 'selectedFiles' && (
              <div className="border-b border-gray-100">
                {bufferFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => onPreviewFile?.(file.id)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-l-2 border-transparent hover:bg-gray-50 cursor-pointer"
                  >
                    {file.type === 'pdf' ? (
                      <FileText size={14} className="shrink-0 text-red-500" />
                    ) : (
                      <ImageIcon size={14} className="shrink-0 text-blue-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{file.file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.file.size)}</p>
                    </div>
                    {onRemoveFromBuffer && (
                      <button
                        onClick={() => onRemoveFromBuffer(file.id)}
                        className="shrink-0 p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {onOpenNamingModal && (
                  <div className="px-3 pb-2 pt-1">
                    <button
                      onClick={onOpenNamingModal}
                      className="w-full py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                    >
                      {t('batches.createBatch')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Unreviewed accordion ── */}
        {renderAccordionHeader('unreviewed', 'imports.unreviewed')}
        {expandedSection === 'unreviewed' && (
          <div className="flex-1 min-h-0 flex flex-col border-b border-gray-100">

            {error && (
              <div className="mx-3 mb-2 mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                {error}
              </div>
            )}

            {/* ── Location filter section ── */}
            <div className="px-3 pt-3 pb-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Location</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('imports.searchLocation')}
                  className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Selected location tags */}
              {selectedLocations.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selectedLocations.map((locId) => {
                    const loc = locations.find((l) => l.id === locId);
                    return (
                      <span
                        key={locId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-brand-50 border border-brand-200 text-brand-600"
                      >
                        <MapPin size={10} />
                        {loc?.name || locId}
                        <button onClick={() => removeLocation(locId)} className="ml-0.5 hover:text-brand-800">
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Location dropdown — only when search has text */}
              {searchQuery.trim() && (
                <div className="mt-1 max-h-[150px] overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                  {loadingLocations ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 px-2 py-3">
                      <Loader2 size={14} className="animate-spin" /> {t('imports.loadingLocations')}
                    </div>
                  ) : filteredLocations.length === 0 ? (
                    <p className="text-xs text-gray-400 px-2 py-3 text-center">{t('imports.noResults')}</p>
                  ) : (
                    filteredLocations.map((loc) => (
                      <button
                        key={loc.id}
                        onClick={() => addLocation(loc.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-100 transition-colors"
                      >
                        <MapPin size={13} className="text-gray-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{loc.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{loc.cif ? `${loc.cif} · ` : ''}{loc.id}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* ── Provider filter section ── */}
            <div className="px-3 pt-2 pb-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Provider</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  placeholder={t('imports.searchProvider')}
                  className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none placeholder:text-gray-400"
                />
                {providerSearch && (
                  <button
                    onClick={() => setProviderSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Selected provider tags */}
              {selectedProviders.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selectedProviders.map((p) => {
                    const isActive = activeProviderCifs.has(p.cif);
                    return (
                      <span
                        key={p.cif}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                          isActive
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-gray-100 border-gray-200 text-gray-400'
                        }`}
                      >
                        <Building2 size={10} />
                        {p.name || p.company || p.cif}
                        <button onClick={() => removeProvider(p.cif)} className={`ml-0.5 ${isActive ? 'hover:text-emerald-900' : 'hover:text-gray-600'}`}>
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Provider dropdown — only when search has text */}
              {providerSearch.trim() && (
                <div ref={providerDropdownRef} className="mt-1 max-h-[150px] overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                  {loadingProviders ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 px-2 py-3">
                      <Loader2 size={14} className="animate-spin" /> {t('imports.loadingProviders')}
                    </div>
                  ) : filteredProviders.length === 0 ? (
                    <p className="text-xs text-gray-400 px-2 py-3 text-center">{t('imports.noProviders')}</p>
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
                            fallback={<Building2 size={13} className="text-gray-400 shrink-0" />}
                          />
                        ) : (
                          <Building2 size={13} className="text-gray-400 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{p.name || p.company}</p>
                          <p className="text-[10px] text-gray-400 truncate">{p.cif}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* ── Doc type toggle buttons (multi-select, always visible) ── */}
            <div className="px-3 pt-2 pb-2 flex flex-wrap gap-1">
              {DOC_TYPES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => toggleDocType(key)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    selectedDocTypes.has(key)
                      ? 'bg-brand-50 border-brand-200 text-brand-600'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
            </div>

            {/* ── Document list ── */}
            <div className="flex-1 min-h-0 overflow-y-auto px-1">
              {!hasActiveFilter ? (
                <p className="text-xs text-gray-400 px-2 py-4 text-center">
                  Select a location or provider to view documents
                </p>
              ) : loadingDocs ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 px-2 py-4">
                  <Loader2 size={14} className="animate-spin" /> {t('imports.loadingDocs')}
                </div>
              ) : docList.length === 0 ? (
                <p className="text-xs text-gray-400 px-2 py-4 text-center">{t('imports.noDocs')}</p>
              ) : (
                docList.map((doc) => {
                  const isSelected = selectedDocIds?.has(doc.id) ?? false;
                  return (
                    <button
                      key={doc.id}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          // Ctrl/Cmd+click: preview only, no selection toggle, no tab switch
                          const existing = importedFiles.find(f => f.id.includes(doc.id));
                          if (existing) {
                            onPreviewFile?.(existing.id);
                          } else {
                            handleImportDoc(doc, { preview: true });
                          }
                          return;
                        }
                        if (onToggleSelect) {
                          const alreadySelected = selectedDocIds?.has(doc.id);
                          onToggleSelect(doc);
                          if (!alreadySelected) {
                            // Only import if not already imported
                            const existing = importedFiles.find(f => f.id.includes(doc.id));
                            if (!existing) {
                              handleImportDoc(doc, { forBuffer: true });
                            }
                          }
                        } else {
                          handleImportDoc(doc);
                        }
                      }}
                      disabled={onToggleSelect ? false : loadingDetail !== null}
                      className={`w-full flex items-center gap-2 px-2 py-2.5 rounded-md text-left transition-colors ${
                        isSelected
                          ? 'bg-brand-50 border-l-2 border-brand-500'
                          : 'hover:bg-gray-100 disabled:opacity-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-800 truncate">{doc.label}</p>
                        <p className="text-[10px] text-gray-400 truncate">{doc.sublabel}</p>
                      </div>
                      {loadingDetail === doc.id ? (
                        <Loader2 size={13} className="text-gray-400 shrink-0 animate-spin" />
                      ) : (
                        <ChevronRight size={13} className="text-gray-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── Golden Dataset accordion ── */}
        {renderAccordionHeader('goldenDataset', 'imports.goldenDataset')}
        {expandedSection === 'goldenDataset' && (
          <div className="px-4 py-6 border-b border-gray-100">
            <p className="text-xs text-gray-400 text-center italic">{t('imports.comingSoon')}</p>
          </div>
        )}

        {/* ── Experiments accordion ── */}
        {renderAccordionHeader('experiments', 'imports.experiments')}
        {expandedSection === 'experiments' && (
          <div className="px-4 py-6 border-b border-gray-100">
            <p className="text-xs text-gray-400 text-center italic">{t('imports.comingSoon')}</p>
          </div>
        )}
      </div>

      {/* Hidden file input fallback (when onAddFiles is not provided) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={handleFileInputChange}
      />

    </div>
  );
}
