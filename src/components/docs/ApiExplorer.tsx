import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '../../services/authFetch';
import { config } from '../../config/environment';
import {
  Play, Loader2, ChevronDown, ChevronRight, MapPin, Building2,
  FileText, Truck, ArrowDownCircle, Users, Image, Copy, Check,
  Maximize2, Minimize2, X, Send, Terminal,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────────────

function CopyButton({ text, light }: { text: string; light?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
        light
          ? 'text-gray-400 hover:text-white hover:bg-gray-700'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
      }`}
      title="Copy JSON"
    >
      {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

// ─── Syntax-highlighted JSON with collapsible nodes ────────────────────────

function JsonViewer({ data, maxHeight = '400px', title }: { data: unknown; maxHeight?: string; title?: string }) {
  const [fullscreen, setFullscreen] = useState(false);
  const json = JSON.stringify(data, null, 2);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  const viewer = (
    <div className={fullscreen ? 'h-full flex flex-col' : ''}>
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-950 ${fullscreen ? '' : 'rounded-t-lg'}`}>
        <span className="text-xs text-gray-500 font-mono">{title || 'JSON Response'}</span>
        <div className="flex items-center gap-1">
          <CopyButton text={json} light />
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="text-gray-400 hover:text-white hover:bg-gray-700 p-1 rounded-md transition-colors"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {fullscreen && (
            <button
              onClick={() => setFullscreen(false)}
              className="text-gray-400 hover:text-white hover:bg-gray-700 p-1 rounded-md transition-colors ml-1"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className={`overflow-auto bg-gray-900 p-4 ${fullscreen ? 'flex-1' : 'rounded-b-lg'}`}
        style={fullscreen ? undefined : { maxHeight }}
      >
        <JsonNode value={data} depth={0} defaultOpen />
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-900/95 backdrop-blur-sm flex flex-col">
        {viewer}
      </div>
    );
  }

  return <div className="rounded-lg border border-gray-800 overflow-hidden">{viewer}</div>;
}

function JsonNode({ value, depth, defaultOpen = false, keyName }: {
  value: unknown; depth: number; defaultOpen?: boolean; keyName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen || depth < 1);
  const indent = depth * 16;

  // Render primitives
  if (value === null) {
    return (
      <span>
        {keyName !== undefined && <><span className="text-purple-300">"{keyName}"</span><span className="text-gray-500">: </span></>}
        <span className="text-gray-500 italic">null</span>
      </span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span>
        {keyName !== undefined && <><span className="text-purple-300">"{keyName}"</span><span className="text-gray-500">: </span></>}
        <span className="text-orange-400">{String(value)}</span>
      </span>
    );
  }

  if (typeof value === 'number') {
    return (
      <span>
        {keyName !== undefined && <><span className="text-purple-300">"{keyName}"</span><span className="text-gray-500">: </span></>}
        <span className="text-cyan-400">{value}</span>
      </span>
    );
  }

  if (typeof value === 'string') {
    const isUrl = value.startsWith('http://') || value.startsWith('https://');
    const truncated = value.length > 120 ? value.slice(0, 120) + '...' : value;
    return (
      <span>
        {keyName !== undefined && <><span className="text-purple-300">"{keyName}"</span><span className="text-gray-500">: </span></>}
        <span className={isUrl ? 'text-blue-400' : 'text-green-400'}>"{truncated}"</span>
      </span>
    );
  }

  // Array
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span>
          {keyName !== undefined && <><span className="text-purple-300">"{keyName}"</span><span className="text-gray-500">: </span></>}
          <span className="text-gray-500">[]</span>
        </span>
      );
    }

    return (
      <div>
        <span
          className="cursor-pointer select-none inline-flex items-center gap-1 hover:bg-gray-800 rounded px-0.5 -ml-0.5"
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
          {keyName !== undefined && <><span className="text-purple-300">"{keyName}"</span><span className="text-gray-500">: </span></>}
          <span className="text-gray-500">[</span>
          {!open && <span className="text-gray-600 text-[10px] ml-1">{value.length} items</span>}
          {!open && <span className="text-gray-500">]</span>}
        </span>
        {open && (
          <>
            <div style={{ paddingLeft: indent + 16 }} className="space-y-0.5">
              {value.map((item, i) => (
                <div key={i} className="leading-5 text-xs font-mono">
                  <JsonNode value={item} depth={depth + 1} />
                  {i < value.length - 1 && <span className="text-gray-600">,</span>}
                </div>
              ))}
            </div>
            <span className="text-gray-500" style={{ paddingLeft: indent }}>]</span>
          </>
        )}
      </div>
    );
  }

  // Object
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <span>
          {keyName !== undefined && <><span className="text-purple-300">"{keyName}"</span><span className="text-gray-500">: </span></>}
          <span className="text-gray-500">{'{}'}</span>
        </span>
      );
    }

    return (
      <div>
        <span
          className="cursor-pointer select-none inline-flex items-center gap-1 hover:bg-gray-800 rounded px-0.5 -ml-0.5"
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
          {keyName !== undefined && <><span className="text-purple-300">"{keyName}"</span><span className="text-gray-500">: </span></>}
          <span className="text-gray-500">{'{'}</span>
          {!open && <span className="text-gray-600 text-[10px] ml-1">{entries.length} keys</span>}
          {!open && <span className="text-gray-500">{'}'}</span>}
        </span>
        {open && (
          <>
            <div style={{ paddingLeft: indent + 16 }} className="space-y-0.5">
              {entries.map(([k, v], i) => (
                <div key={k} className="leading-5 text-xs font-mono">
                  <JsonNode value={v} depth={depth + 1} keyName={k} />
                  {i < entries.length - 1 && <span className="text-gray-600">,</span>}
                </div>
              ))}
            </div>
            <span className="text-gray-500" style={{ paddingLeft: indent }}>{'}'}</span>
          </>
        )}
      </div>
    );
  }

  return <span className="text-gray-400">{String(value)}</span>;
}

// ─── Other helpers ─────────────────────────────────────────────────────────

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold shrink-0">
      {n}
    </span>
  );
}

function RequestBox({ method, url }: { method: string; url: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm overflow-x-auto">
      <span className="text-green-600 font-bold font-mono text-xs shrink-0">{method}</span>
      <code className="text-gray-700 font-mono text-xs break-all">{url}</code>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function ApiExplorer() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedDocType, setSelectedDocType] = useState<DocType>('expenses');
  const [docList, setDocList] = useState<DocListItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocListItem | null>(null);
  const [docDetail, setDocDetail] = useState<Record<string, unknown> | null>(null);
  const [docImages, setDocImages] = useState<string[]>([]);

  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [providers, setProviders] = useState<Record<string, unknown> | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providersUrl, setProvidersUrl] = useState('');

  const [locationsUrl, setLocationsUrl] = useState('');
  const [listUrl, setListUrl] = useState('');
  const [detailUrl, setDetailUrl] = useState('');

  const [error, setError] = useState('');

  // Manual endpoint tester state
  const [manualUrl, setManualUrl] = useState('');
  const [manualMethod, setManualMethod] = useState<'GET' | 'POST'>('GET');
  const [manualBody, setManualBody] = useState('');
  const [manualResponse, setManualResponse] = useState<unknown>(null);
  const [manualStatus, setManualStatus] = useState<number | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');
  const [useAuth, setUseAuth] = useState(true);

  const executeManualRequest = useCallback(async () => {
    if (!manualUrl.trim()) return;
    setManualLoading(true);
    setManualError('');
    setManualResponse(null);
    setManualStatus(null);

    try {
      const fetchFn = useAuth ? authenticatedFetch : fetch;
      const init: RequestInit = { method: manualMethod };
      if (manualMethod === 'POST' && manualBody.trim()) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = manualBody;
      }
      const res = await fetchFn(manualUrl.trim(), init);
      setManualStatus(res.status);
      const text = await res.text();
      try {
        setManualResponse(JSON.parse(text));
      } catch {
        setManualResponse(text);
      }
    } catch (err) {
      setManualError((err as Error).message);
    } finally {
      setManualLoading(false);
    }
  }, [manualUrl, manualMethod, manualBody, useAuth]);

  // ─── Step 1: Fetch locations ─────────────────────────────────────────────

  const fetchLocations = useCallback(async () => {
    setLoadingLocations(true);
    setError('');
    setDocList([]);
    setSelectedDoc(null);
    setDocDetail(null);
    setDocImages([]);
    const url = `${config.talkyTpvBaseUrl}/get-user-locations`;
    setLocationsUrl(url);
    try {
      const res = await authenticatedFetch(url);
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

  // ─── Step 2: Fetch providers ────────────────────────────────────────────

  const fetchProviders = useCallback(async () => {
    if (!selectedLocation) return;
    setLoadingProviders(true);
    setError('');
    setProviders(null);
    const url = `${config.talkyOrdersApiBaseUrl}/orders/providers/by-location/${selectedLocation}`;
    setProvidersUrl(url);
    try {
      const res = await authenticatedFetch(url);
      const data = await res.json();
      setProviders(data);
    } catch (err) {
      setError(`Error fetching providers: ${(err as Error).message}`);
    } finally {
      setLoadingProviders(false);
    }
  }, [selectedLocation]);

  // ─── Step 3: Fetch document list ─────────────────────────────────────────

  const fetchDocList = useCallback(async () => {
    if (!selectedLocation) return;
    setLoadingList(true);
    setError('');
    setSelectedDoc(null);
    setDocDetail(null);
    setDocImages([]);

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
    setListUrl(url);

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

  // ─── Step 3: Fetch document detail ───────────────────────────────────────

  const fetchDocDetail = useCallback(async (doc: DocListItem) => {
    setSelectedDoc(doc);
    setLoadingDetail(true);
    setError('');
    setDocDetail(null);
    setDocImages([]);

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
    setDetailUrl(url);

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

      setDocDetail(detail);

      const images: string[] = [];
      if (detail) {
        const genImages = (detail.generated_images || detail.frontend_images) as Array<Record<string, string>> | undefined;
        if (Array.isArray(genImages)) {
          genImages.forEach(img => {
            const u = img.image_url || img.url || img.signedUrl;
            if (u) images.push(u);
          });
        }
      }
      setDocImages(images);
    } catch (err) {
      setError(`Error fetching detail: ${(err as Error).message}`);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedDocType, selectedLocation]);

  useEffect(() => {
    setDocList([]);
    setSelectedDoc(null);
    setDocDetail(null);
    setDocImages([]);
  }, [selectedDocType]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-brand-700 mb-1">Interactive API Explorer</h3>
        <p className="text-sm text-brand-600">
          Make real API calls with your session. Select a location, browse documents, and inspect the full response with images.
          Click the <Maximize2 size={12} className="inline" /> icon on any JSON viewer to go fullscreen.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {/* ── Manual Endpoint Tester ── */}
      <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Manual Endpoint Tester</h3>
        </div>

        <p className="text-xs text-gray-500">
          Enter any API URL to test it directly. Use the base URL placeholders or paste a full URL.
        </p>

        {/* Quick base URL chips */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'tpv-api', value: config.talkyTpvBaseUrl },
            { label: 'user-expenses', value: config.talkyUserExpensesBaseUrl },
            { label: 'analytics-v2', value: config.talkyCombinedMetricsBaseUrl },
            { label: 'delivery-notes', value: config.talkyDeliveryNotesBaseUrl },
            { label: 'analytics-v3', value: config.talkyPayrollsSearchBaseUrl },
            { label: 'invoice-learning', value: config.talkyInvoiceLearningBaseUrl },
            { label: 'orders-api', value: config.talkyOrdersApiBaseUrl },
          ].map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setManualUrl(value + '/')}
              className="px-2 py-1 rounded-md text-[11px] font-mono bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        {/* URL input row */}
        <div className="flex gap-2">
          <select
            value={manualMethod}
            onChange={(e) => setManualMethod(e.target.value as 'GET' | 'POST')}
            className="shrink-0 border border-gray-300 rounded-lg px-2 py-2 text-sm font-mono font-bold text-green-600 bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !manualLoading) executeManualRequest(); }}
            placeholder="/api-dev/tpv-api/providers?locationId=..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none placeholder:text-gray-400"
          />
          <button
            onClick={executeManualRequest}
            disabled={manualLoading || !manualUrl.trim()}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {manualLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send
          </button>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={useAuth}
              onChange={(e) => setUseAuth(e.target.checked)}
              className="rounded border-gray-300 text-brand-500 focus:ring-brand-500/20"
            />
            Send with Bearer token (authenticatedFetch)
          </label>
        </div>

        {/* POST body */}
        {manualMethod === 'POST' && (
          <textarea
            value={manualBody}
            onChange={(e) => setManualBody(e.target.value)}
            placeholder='{"key": "value"}'
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none placeholder:text-gray-400 resize-y"
          />
        )}

        {/* Manual error */}
        {manualError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{manualError}</div>
        )}

        {/* Manual response */}
        {manualResponse !== null && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                manualStatus && manualStatus < 300
                  ? 'bg-green-100 text-green-700'
                  : manualStatus && manualStatus < 500
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
              }`}>
                {manualStatus}
              </span>
              <span className="text-xs text-gray-500">Response</span>
            </div>
            {typeof manualResponse === 'string' ? (
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">{manualResponse}</pre>
            ) : (
              <JsonViewer data={manualResponse} maxHeight="400px" title="Manual request response" />
            )}
          </div>
        )}
      </div>

      {/* ── Step 1: Locations ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <StepBadge n={1} />
          <h3 className="text-sm font-semibold text-gray-900">Get your locations</h3>
        </div>

        <button
          onClick={fetchLocations}
          disabled={loadingLocations}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {loadingLocations ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          GET /get-user-locations
        </button>

        {locationsUrl && <RequestBox method="GET" url={locationsUrl} />}

        {locations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-gray-400" />
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.cif ? `(${loc.cif})` : ''} — {loc.id}
                  </option>
                ))}
              </select>
            </div>
            <JsonViewer data={locations} maxHeight="200px" title="locations[]" />
          </div>
        )}
      </div>

      {/* ── Step 2: Providers ── */}
      {locations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <StepBadge n={2} />
            <h3 className="text-sm font-semibold text-gray-900">Get providers for location</h3>
          </div>

          <button
            onClick={fetchProviders}
            disabled={loadingProviders || !selectedLocation}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {loadingProviders ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            GET /orders/providers/by-location/{'{locationId}'}
          </button>

          {providersUrl && <RequestBox method="GET" url={providersUrl} />}

          {providers && (
            <div className="space-y-3">
              {/* Summary */}
              {providers.summary && typeof providers.summary === 'object' && (
                <div className="flex flex-wrap gap-3 text-sm">
                  {Object.entries(providers.summary as Record<string, string | number>).map(([k, v]) => (
                    <div key={k} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-500 font-mono">{k}</span>
                      <p className="text-sm font-medium text-gray-900">{String(v)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Providers list preview */}
              {Array.isArray(providers.providers) && (providers.providers as Record<string, unknown>[]).length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {(providers.providers as Record<string, unknown>[]).map((p, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <Building2 size={14} className="text-gray-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{(p.name || p.company || p.trade_name || 'Unknown') as string}</p>
                        <p className="text-xs text-gray-500 truncate">CIF: {(p.cif || '—') as string} · {(p.emailStatus || '') as string}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <JsonViewer data={providers} maxHeight="300px" title="providers response" />
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Document List ── */}
      {locations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <StepBadge n={3} />
            <h3 className="text-sm font-semibold text-gray-900">List documents</h3>
          </div>

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

          <button
            onClick={fetchDocList}
            disabled={loadingList}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {loadingList ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Fetch {selectedDocType}
          </button>

          {listUrl && <RequestBox method="GET" url={listUrl} />}

          {docList.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {docList.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => fetchDocDetail(doc)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                    selectedDoc?.id === doc.id ? 'bg-brand-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.label}</p>
                    <p className="text-xs text-gray-500 truncate">{doc.sublabel}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
          {docList.length === 0 && listUrl && !loadingList && (
            <p className="text-sm text-gray-500 italic">No documents found for this location.</p>
          )}
        </div>
      )}

      {/* ── Step 4: Document Detail ── */}
      {selectedDoc && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <StepBadge n={4} />
            <h3 className="text-sm font-semibold text-gray-900">Document detail: {selectedDoc.label}</h3>
          </div>

          {detailUrl && <RequestBox method="GET" url={detailUrl} />}

          {loadingDetail && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 size={16} className="animate-spin" /> Loading document...
            </div>
          )}

          {docDetail && !loadingDetail && (
            <div className="space-y-6">
              {/* Images */}
              {docImages.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Image size={16} />
                    Document images ({docImages.length} page{docImages.length > 1 ? 's' : ''})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {docImages.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Page ${i + 1}`}
                        className="w-full rounded-lg border border-gray-200 bg-white"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Key fields summary */}
              <KeyFieldsSummary data={docDetail} docType={selectedDocType} />

              {/* JSON Response — full width */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Full API response</p>
                <JsonViewer data={docDetail} maxHeight="500px" title={`${selectedDocType} detail`} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Key Fields Summary ────────────────────────────────────────────────────

function KeyFieldsSummary({ data, docType }: { data: Record<string, unknown>; docType: DocType }) {
  const fields: { label: string; value: unknown; tier: string }[] = [];

  if (docType === 'expenses' || docType === 'income-invoices') {
    fields.push(
      { label: 'invoice_number', value: data.invoice_number, tier: 'T1' },
      { label: 'supplier', value: data.supplier, tier: 'T1' },
      { label: 'supplier_cif', value: data.supplier_cif, tier: 'T1' },
      { label: 'invoice_date', value: data.invoice_date, tier: 'T1' },
      { label: 'importe', value: data.importe, tier: 'T1' },
      { label: 'total', value: data.total, tier: 'T1' },
      { label: 'retencion', value: data.retencion, tier: 'T2' },
      { label: 'category', value: data.category, tier: 'T2' },
      { label: 'needsReview', value: data.needsReview, tier: 'flag' },
      { label: 'processing_status', value: data.processing_status, tier: 'flag' },
      { label: 'documentKind', value: data.documentKind, tier: 'flag' },
    );
    if (docType === 'income-invoices') {
      fields.push({ label: 'incomeDocumentKind', value: data.incomeDocumentKind, tier: 'T2' });
    }
  } else if (docType === 'delivery-notes') {
    fields.push(
      { label: 'delivery_note_number', value: data.delivery_note_number, tier: 'T1' },
      { label: 'supplier', value: data.supplier, tier: 'T1' },
      { label: 'supplier_cif', value: data.supplier_cif, tier: 'T1' },
      { label: 'delivery_note_date', value: data.delivery_note_date, tier: 'T1' },
      { label: 'importe', value: data.importe, tier: 'T2' },
      { label: 'total', value: data.total, tier: 'T2' },
      { label: 'processing_status', value: data.processing_status, tier: 'flag' },
    );
  } else if (docType === 'payrolls') {
    const info = (data.payroll_info || {}) as Record<string, unknown>;
    fields.push(
      { label: 'employee_name', value: data.employee_name, tier: 'T1' },
      { label: 'employee_nif', value: data.employee_nif, tier: 'T1' },
      { label: 'payroll_date', value: data.payroll_date, tier: 'T1' },
      { label: 'gross_amount', value: info.gross_amount, tier: 'T1' },
      { label: 'net_amount', value: info.net_amount, tier: 'T1' },
      { label: 'irpf_amount', value: info.irpf_amount, tier: 'T1' },
      { label: 'company_ss_contribution', value: info.company_ss_contribution, tier: 'T2' },
      { label: 'status', value: data.status, tier: 'flag' },
    );
  }

  const tierColor = (t: string) => {
    if (t === 'T1') return 'bg-red-50 text-red-600 border-red-200';
    if (t === 'T2') return 'bg-orange-50 text-orange-600 border-orange-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Key extracted fields</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {fields.map(({ label, value, tier }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${tierColor(tier)}`}>{tier}</span>
              <span className="text-xs font-mono text-gray-500">{label}</span>
            </div>
            <p className="text-sm font-medium text-gray-900 truncate">
              {value === null || value === undefined ? <span className="text-gray-300 italic">null</span> : String(value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
