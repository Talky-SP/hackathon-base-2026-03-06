import { useState, useEffect, useCallback } from 'react';
import {
  PenLine, MapPin, FileText, Truck, ArrowDownCircle, Users,
  Loader2, ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { authenticatedFetch } from '../services/authFetch';
import { config } from '../config/environment';
import DocumentWorkspace from '../components/annotation/DocumentWorkspace';
import type { UploadedFile } from '../components/annotation/FileUploadZone';

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
  { key: 'expenses', label: 'Expense Invoices', icon: FileText },
  { key: 'delivery-notes', label: 'Delivery Notes', icon: Truck },
  { key: 'income-invoices', label: 'Income Invoices', icon: ArrowDownCircle },
  { key: 'payrolls', label: 'Payrolls', icon: Users },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function proxyS3Url(url: string): string {
  return url
    .replace('https://talky-invoice-v2-dev-6136.s3.amazonaws.com', '/s3-dev')
    .replace('https://talky-invoice-v2-prod-6136.s3.amazonaws.com', '/s3-prod');
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AnnotationPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'selector' | 'workspace'>('selector');

  // API state
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedDocType, setSelectedDocType] = useState<DocType>('expenses');
  const [docList, setDocList] = useState<DocListItem[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  // Workspace state
  const [workspaceFile, setWorkspaceFile] = useState<UploadedFile | null>(null);
  const [textractResultUrl, setTextractResultUrl] = useState<string | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<Record<string, unknown> | null>(null);

  // ─── Fetch locations on mount ───────────────────────────────────────────

  const fetchLocations = useCallback(async () => {
    setLoadingLocations(true);
    setError('');
    try {
      const res = await authenticatedFetch(`${config.talkyTpvBaseUrl}/get-user-locations`);
      const data = await res.json();
      const locs: Location[] = data.locations || [];
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].id);
    } catch (err) {
      setError(`Error fetching locations: ${(err as Error).message}`);
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  // ─── Fetch document list ────────────────────────────────────────────────

  const fetchDocList = useCallback(async () => {
    if (!selectedLocation) return;
    setLoadingList(true);
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
      setError(`Error fetching documents: ${(err as Error).message}`);
    } finally {
      setLoadingList(false);
    }
  }, [selectedLocation, selectedDocType]);

  useEffect(() => { fetchDocList(); }, [fetchDocList]);

  // ─── Fetch document detail & enter workspace ────────────────────────────

  const fetchDocDetail = useCallback(async (doc: DocListItem) => {
    setLoadingDetail(true);
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
        const expenses = data.expenses || [];
        detail = expenses[0] || data;
      } else if (selectedDocType === 'delivery-notes') {
        const notes = data.deliveryNotes || data.delivery_notes || [];
        detail = notes[0] || data;
      } else if (selectedDocType === 'payrolls') {
        const payrolls = data.payrolls || [];
        detail = payrolls[0] || data;
      }

      if (!detail) {
        setError('No document detail found');
        return;
      }

      const invoiceUrl = detail.invoice_url as string | undefined;
      if (!invoiceUrl) {
        setError('No invoice_url found in document detail');
        return;
      }

      const file: UploadedFile = {
        id: doc.id,
        file: new File([], doc.label),
        type: 'pdf',
        validatedType: 'pdf',
        url: proxyS3Url(invoiceUrl),
      };

      setWorkspaceFile(file);
      setInvoiceDetail(detail);
      const rawTextractUrl = detail.textract_result_url as string | undefined;
      setTextractResultUrl(rawTextractUrl ? proxyS3Url(rawTextractUrl) : null);
      setMode('workspace');
    } catch (err) {
      setError(`Error fetching detail: ${(err as Error).message}`);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedDocType, selectedLocation]);

  // ─── Workspace Mode ─────────────────────────────────────────────────────

  if (mode === 'workspace' && workspaceFile) {
    return (
      <DocumentWorkspace
        files={[workspaceFile]}
        onAddFiles={() => {}}
        textractResultUrl={textractResultUrl}
        invoiceDetail={invoiceDetail}
      />
    );
  }

  // ─── Selector Mode ──────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <PenLine size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('annotation.title')}</h1>
          </div>
        </div>
        <p className="text-sm text-gray-500 ml-[52px]">
          {t('annotation.subtitle')}
        </p>
      </div>

      {error && (
        <div className="shrink-0 mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto space-y-5">
        {/* Location selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Location</h3>
          </div>

          {loadingLocations ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Loading locations...
            </div>
          ) : (
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} {loc.cif ? `(${loc.cif})` : ''} — {loc.id}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Document type selector */}
        {selectedLocation && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {DOC_TYPES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedDocType(key)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedDocType === key
                      ? 'bg-brand-50 border-brand-200 text-brand-600'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            {/* Document list */}
            {loadingList ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
                <Loader2 size={16} className="animate-spin" /> Loading documents...
              </div>
            ) : docList.length > 0 ? (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                {docList.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => fetchDocDetail(doc)}
                    disabled={loadingDetail}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.label}</p>
                      <p className="text-xs text-gray-500 truncate">{doc.sublabel}</p>
                    </div>
                    {loadingDetail ? (
                      <Loader2 size={16} className="text-gray-400 shrink-0 ml-2 animate-spin" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400 shrink-0 ml-2" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic text-center py-6">
                No documents found for this location.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
