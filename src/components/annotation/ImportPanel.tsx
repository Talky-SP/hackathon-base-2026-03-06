import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, FileText, Truck, ArrowDownCircle, Users,
  Loader2, ChevronRight, ChevronDown, MapPin, Plus,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { authenticatedFetch } from '../../services/authFetch';
import { config } from '../../config/environment';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import type { UploadedFile } from './FileUploadZone';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  cif?: string;
}

type DocType = 'expenses' | 'delivery-notes' | 'income-invoices' | 'payrolls';

interface DocListItem {
  id: string;
  label: string;
  sublabel: string;
  categoryDate?: string;
  invoiceid?: string;
}

const DOC_TYPES: { key: DocType; label: string; icon: typeof FileText }[] = [
  { key: 'expenses', label: 'Expenses', icon: FileText },
  { key: 'delivery-notes', label: 'DN', icon: Truck },
  { key: 'income-invoices', label: 'Income', icon: ArrowDownCircle },
  { key: 'payrolls', label: 'Payrolls', icon: Users },
];

function proxyS3Url(url: string): string {
  return url
    .replace('https://talky-invoice-v2-dev-6136.s3.amazonaws.com', '/s3-dev')
    .replace('https://talky-invoice-v2-prod-6136.s3.amazonaws.com', '/s3-prod');
}

type AccordionSection = 'experiments' | 'goldenDataset' | 'unreviewed';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ImportPanelProps {
  onImportFile: (file: UploadedFile, textractResultUrl?: string, invoiceDetail?: Record<string, unknown>) => void;
  onAddFiles?: () => void;
  onExternalFileDrop?: (files: File[]) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ImportPanel({ onImportFile, onAddFiles, onExternalFileDrop }: ImportPanelProps) {
  const { t } = useLanguage();

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

  // Doc state
  const [selectedDocType, setSelectedDocType] = useState<DocType>('expenses');
  const [docList, setDocList] = useState<DocListItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Drop zone state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch locations on mount ───────────────────────────────────────────

  const fetchLocations = useCallback(async () => {
    setLoadingLocations(true);
    setError('');
    try {
      const res = await authenticatedFetch(`${config.talkyTpvBaseUrl}/get-user-locations`);
      const data = await res.json();
      setLocations(data.locations || []);
    } catch (err) {
      setError(`Error: ${(err as Error).message}`);
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  // ─── Fuzzy-filtered locations ─────────────────────────────────────────────

  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return locations;
    return locations
      .map((loc) => {
        const target = `${loc.name} ${loc.id} ${loc.cif || ''}`;
        const result = fuzzyMatch(searchQuery, target);
        return { loc, ...result };
      })
      .filter((r) => r.matches)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.loc);
  }, [locations, searchQuery]);

  // ─── Fetch document list ──────────────────────────────────────────────────

  const fetchDocList = useCallback(async () => {
    if (!selectedLocation) return;
    setLoadingDocs(true);
    setError('');
    setDocList([]);

    let url = '';
    switch (selectedDocType) {
      case 'expenses':
        url = `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${selectedLocation}?limit=20`;
        break;
      case 'delivery-notes':
        url = `${config.talkyDeliveryNotesBaseUrl}/delivery-notes-get/${selectedLocation}?limit=20`;
        break;
      case 'income-invoices':
        url = `${config.talkyCombinedMetricsBaseUrl}/users/${selectedLocation}/invoice-incomes?limit=20`;
        break;
      case 'payrolls':
        url = `${config.talkyPayrollsSearchBaseUrl}/locations/${selectedLocation}/payrolls?limit=20`;
        break;
    }

    try {
      const res = await authenticatedFetch(url);
      const data = await res.json();
      let items: DocListItem[] = [];

      if (selectedDocType === 'expenses' || selectedDocType === 'income-invoices') {
        const expenses = data.expenses || [];
        items = expenses.map((e: Record<string, unknown>) => ({
          id: (e.invoiceid || e.id || e.categoryDate) as string,
          label: (e.invoice_number || e.supplier || 'Sin numero') as string,
          sublabel: `${e.supplier || ''} · ${e.invoice_date || ''} · ${e.total || ''}€`,
          categoryDate: e.categoryDate as string,
          invoiceid: (e.invoiceid || e.id) as string,
        }));
      } else if (selectedDocType === 'delivery-notes') {
        const notes = data.deliveryNotes || data.delivery_notes || [];
        items = notes.map((d: Record<string, unknown>) => ({
          id: (d.docId || d.id || d.categoryDate) as string,
          label: (d.delivery_note_number || d.supplier || 'Sin numero') as string,
          sublabel: `${d.supplier || ''} · ${d.delivery_note_date || ''} · ${d.total || ''}€`,
          categoryDate: d.categoryDate as string,
        }));
      } else if (selectedDocType === 'payrolls') {
        const payrolls = data.payrolls || [];
        items = payrolls.map((p: Record<string, unknown>) => ({
          id: (p.categoryDate || p.id) as string,
          label: (p.employee_name || 'Sin nombre') as string,
          sublabel: `${p.employee_nif || ''} · ${p.payroll_date || ''}`,
          categoryDate: p.categoryDate as string,
        }));
      }

      setDocList(items);
    } catch (err) {
      setError(`Error: ${(err as Error).message}`);
    } finally {
      setLoadingDocs(false);
    }
  }, [selectedLocation, selectedDocType]);

  useEffect(() => { fetchDocList(); }, [fetchDocList]);

  // ─── Fetch document detail & import ───────────────────────────────────────

  const handleImportDoc = useCallback(async (doc: DocListItem) => {
    if (!selectedLocation) return;
    setLoadingDetail(doc.id);
    setError('');

    let url = '';
    switch (selectedDocType) {
      case 'expenses':
        url = `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${selectedLocation}?invoiceId=${encodeURIComponent(doc.invoiceid || doc.id)}`;
        break;
      case 'delivery-notes':
        url = `${config.talkyDeliveryNotesBaseUrl}/delivery-notes-get/${selectedLocation}?docId=${encodeURIComponent(doc.id)}`;
        break;
      case 'income-invoices':
        url = `${config.talkyCombinedMetricsBaseUrl}/users/${selectedLocation}/invoice-incomes?invoiceId=${encodeURIComponent(doc.invoiceid || doc.id)}`;
        break;
      case 'payrolls':
        url = `${config.talkyPayrollsSearchBaseUrl}/locations/${selectedLocation}/payrolls?categoryDate=${encodeURIComponent(doc.categoryDate || doc.id)}`;
        break;
    }

    try {
      const res = await authenticatedFetch(url);
      const data = await res.json();

      let detail: Record<string, unknown> | null = null;
      if (selectedDocType === 'expenses' || selectedDocType === 'income-invoices') {
        detail = (data.expenses || [])[0] || data;
      } else if (selectedDocType === 'delivery-notes') {
        detail = (data.deliveryNotes || data.delivery_notes || [])[0] || data;
      } else if (selectedDocType === 'payrolls') {
        detail = (data.payrolls || [])[0] || data;
      }

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
      onImportFile(file, rawTextractUrl ? proxyS3Url(rawTextractUrl) : undefined, detail);
    } catch (err) {
      setError(`Error: ${(err as Error).message}`);
    } finally {
      setLoadingDetail(null);
    }
  }, [selectedDocType, selectedLocation, onImportFile]);

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
        {/* ── Unreviewed accordion ── */}
        {renderAccordionHeader('unreviewed', 'imports.unreviewed')}
        {expandedSection === 'unreviewed' && (
          <div className="flex-1 min-h-0 flex flex-col border-b border-gray-100">
            {/* Search input */}
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('imports.searchLocation')}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none placeholder:text-gray-400"
                />
              </div>
            </div>

            {error && (
              <div className="mx-3 mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                {error}
              </div>
            )}

            {/* Locations list */}
            {loadingLocations ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 px-3 py-4">
                <Loader2 size={14} className="animate-spin" /> {t('imports.loadingLocations')}
              </div>
            ) : !selectedLocation ? (
              <div className="flex-1 min-h-0 overflow-y-auto px-1">
                {filteredLocations.length === 0 ? (
                  <p className="text-xs text-gray-400 px-2 py-4 text-center">{t('imports.noResults')}</p>
                ) : (
                  filteredLocations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedLocation(loc.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-gray-100 transition-colors"
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
            ) : (
              <>
                {/* Selected location header */}
                <div className="px-3 pb-2">
                  <button
                    onClick={() => { setSelectedLocation(null); setDocList([]); }}
                    className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
                  >
                    <ChevronRight size={12} className="rotate-180" />
                    {locations.find((l) => l.id === selectedLocation)?.name || selectedLocation}
                  </button>
                </div>

                {/* Doc type chips */}
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {DOC_TYPES.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedDocType(key)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        selectedDocType === key
                          ? 'bg-brand-50 border-brand-200 text-brand-600'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={11} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Document list */}
                <div className="flex-1 min-h-0 overflow-y-auto px-1">
                  {loadingDocs ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 px-2 py-4">
                      <Loader2 size={14} className="animate-spin" /> {t('imports.loadingDocs')}
                    </div>
                  ) : docList.length === 0 ? (
                    <p className="text-xs text-gray-400 px-2 py-4 text-center">{t('imports.noDocs')}</p>
                  ) : (
                    docList.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => handleImportDoc(doc)}
                        disabled={loadingDetail !== null}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-gray-100 transition-colors disabled:opacity-50"
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
                    ))
                  )}
                </div>
              </>
            )}
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
