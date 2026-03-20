import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Plus, ChevronDown, ArrowUp, Paperclip, Camera, X, Maximize2, Search, MessageSquare, SquarePen, Trash2, PanelLeftClose, PanelLeftOpen, Download, FileSpreadsheet, Wifi, WifiOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthenticator } from '@aws-amplify/ui-react';
import SpreadsheetViewer, { type SpreadsheetData } from '../components/agent/SpreadsheetViewer';
import ChartRenderer from '../components/agent/ChartRenderer';
import SourceCard from '../components/agent/SourceCard';
import StatusIndicator from '../components/agent/StatusIndicator';
import { useAgentChat, type AgentResult, type ChartData, type Source } from '../hooks/useAgentChat';

// ── Types ──

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
  chart?: ChartData | null;
  sources?: Source[];
};

type Attachment = {
  id: string;
  name: string;
  type: 'file' | 'screenshot' | 'spreadsheet';
  previewUrl?: string;
  /** parsed workbook for spreadsheets */
  spreadsheet?: SpreadsheetData;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  model: string;
};

type AIModel = {
  id: string;
  label: string;
  provider: 'anthropic' | 'google';
};

const AI_MODELS: AIModel[] = [
  { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', provider: 'anthropic' },
  { id: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash', provider: 'google' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', provider: 'google' },
];

const TALKY_ICON_URL =
  'https://talky-product-image-v2-dev-6136.s3.eu-west-3.amazonaws.com/Talky-Chat-Icon.png';

const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.ods'];
function isSpreadsheetFile(name: string) {
  const lower = name.toLowerCase();
  return SPREADSHEET_EXTENSIONS.some(ext => lower.endsWith(ext));
}
function getFileExtLabel(name: string): string {
  const ext = name.split('.').pop()?.toUpperCase() ?? '';
  return ext;
}

// ── Mock data ──

function mockDate(daysAgo: number, hoursAgo = 0): Date {
  return new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000);
}

function createMockWorkbook(): SpreadsheetData {
  const wb = XLSX.utils.book_new();
  // Conciliacion sheet
  const concData = [
    ['CONCILIACION BANCARIA ROLUVAN 2026'],
    [''],
    ['Nro Factura', 'Proveedor', 'Importe (EUR)', 'Estado Bancario', 'Conciliado', 'Accion'],
    ['LQ0068', 'Santander (Prestamo)', '10.092,64', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['UB25231735', 'NIPPON GASES', '67,76', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['16762601P0056047', 'Aguas de Alcala', '381,78', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['ACE-12107-1/2026', 'DISCOIL MEDIOAMBIENTE', '72,00', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['A-V2026-000310483', 'MERCADONA', '448,74', 'Conciliado', 'Si', ''],
    ['FG/28700129', 'MERITEM', '168,29', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['FV/26000689', 'MAHOU SAN MIGUEL', '458,78', 'Conciliado', 'Si', ''],
    ['23244492', 'Europastry', '288,29', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['23338130', 'Europastry', '299,91', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['0I(062)(2026)000049', 'makro', '453,26', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['0I(062)0007/(2026)000168', 'makro', '694,54', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['7260124153', 'Conway', '1.737,84', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['7260148616', 'Conway', '1.947,18', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['7260156738', 'Conway', '4.032,70', 'Conciliado', 'Si', ''],
    ['FV/2600517', 'Ameta Food & Service', '286,25', 'Conciliado', 'No', 'Marcar como conciliado en sistema'],
    ['', '', '', '', '', ''],
    ['TOTAL A MARCAR COMO CONCILIADO', '', '24.218,52 EUR', '', '', ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(concData);
  ws1['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Conciliacion');

  // Resumen sheet
  const resData = [
    ['RESUMEN CONCILIACION'],
    [''],
    ['Concepto', 'Facturas', 'Importe'],
    ['Conciliadas', '77 facturas/abonos en 66 grupos', '72.527 EUR'],
    ['Pendientes de cobro', '12 facturas', '8.340 EUR'],
    ['Movimientos sin factura', '5 transacciones', '3.120 EUR'],
    [''],
    ['Total procesado', '94 registros', '83.987 EUR'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(resData);
  ws2['!cols'] = [{ wch: 28 }, { wch: 34 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

  return { fileName: 'Conciliacion bancaria roluvan 2026.xlsx', workbook: wb };
}

let _mockSpreadsheet: SpreadsheetData | null = null;
function getMockSpreadsheet(): SpreadsheetData {
  if (!_mockSpreadsheet) _mockSpreadsheet = createMockWorkbook();
  return _mockSpreadsheet;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'mock-1',
    title: 'Conciliacion facturas y transacciones bancarias',
    messages: [
      { id: 'm1-1', role: 'user', content: 'Mira tengo estas facturas y en el excel estan las transacciones de banco hazme la conciliacion incluyendo las de 1-n n-1 es decir de una factura que se paga en varias transacciones o varias facturas que se pagan de una y ademas usando abonos', timestamp: mockDate(0, 2) },
      { id: 'm1-2', role: 'assistant', content: 'Aqui tienes la conciliacion completa. El Excel tiene dos pestanas:\n\nHoja "Conciliacion" — todas las facturas cruzadas con los movimientos bancarios, con codigo de colores:\n\n- Verde: conciliado\n- Amarillo: facturas sin cobro/pago aun en el periodo\n- Gris: movimientos bancarios sin factura en el periodo\n\nHoja "Resumen" — totales globales\n\nResultados clave:\n- Conciliadas: 77 facturas/abonos en 66 grupos — 72.527 EUR\n- Pendientes de cobro: 12 facturas — 8.340 EUR\n- Movimientos sin factura: 5 transacciones — 3.120 EUR',
        timestamp: mockDate(0, 1.5),
        attachments: [{
          id: 'att-sheet-1',
          name: 'Conciliacion bancaria roluvan 2026.xlsx',
          type: 'spreadsheet' as const,
          spreadsheet: getMockSpreadsheet(),
        }],
      },
    ],
    createdAt: mockDate(0, 2),
    updatedAt: mockDate(0, 1.5),
    model: 'claude-sonnet-4.5',
  },
  {
    id: 'mock-2',
    title: 'Analisis margen bruto Q1 2026',
    messages: [
      { id: 'm2-1', role: 'user', content: 'Explica la variacion del margen bruto del primer trimestre respecto al anterior', timestamp: mockDate(1, 5) },
      { id: 'm2-2', role: 'assistant', content: 'El margen bruto del Q1 2026 fue del 42.3%, frente al 38.7% del Q4 2025, una mejora de +3.6pp. Los principales factores:\n\n1. Reduccion del coste de materias primas (-8.2%) por renegociacion con proveedores\n2. Mejora en eficiencia operativa: el coste unitario bajo un 4.1%\n3. Mix de producto favorable: mayor peso de servicios premium (+12% en ventas)\n\nEl unico impacto negativo fue el incremento en costes logisticos (+5.3%) por nuevas rutas de distribucion.',
        timestamp: mockDate(1, 4.5),
        chart: {
          type: 'bar',
          title: 'Margen bruto por trimestre',
          labels: ['Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026'],
          datasets: [{ label: 'Margen bruto (%)', data: [36.1, 37.5, 38.7, 42.3] }],
        },
        sources: [
          { categoryDate: 'COMPRAS#2026-01-15#abc', supplier: 'Bio-Rad Laboratories', supplier_cif: 'B12345678', invoice_date: '2026-01-15', due_date: '2026-02-15', total: 695.30, importe: 574.63, reconciled: true, category: 'COMPRAS', concept: 'Material Lab' },
          { categoryDate: 'COMPRAS#2026-02-20#def', supplier: 'Europastry S.A.', supplier_cif: 'A87654321', invoice_date: '2026-02-20', due_date: '2026-03-20', total: 1200.00, importe: 991.74, reconciled: false, category: 'COMPRAS', concept: 'Suministros' },
        ],
      },
    ],
    createdAt: mockDate(1, 5),
    updatedAt: mockDate(1, 4.5),
    model: 'claude-opus-4.6',
  },
  {
    id: 'mock-3',
    title: 'Prevision de tesoreria marzo',
    messages: [
      { id: 'm3-1', role: 'user', content: 'Genera una prevision de tesoreria para las proximas 4 semanas con los datos que tienes', timestamp: mockDate(2, 3) },
      { id: 'm3-2', role: 'assistant', content: 'Prevision de tesoreria (20 Mar - 17 Abr 2026):\n\nSaldo inicial: 145.230 EUR\n\nSemana 1: +32.400 cobros / -28.100 pagos = +4.300\nSemana 2: +18.700 cobros / -41.200 pagos (nominas) = -22.500\nSemana 3: +45.100 cobros / -15.800 pagos = +29.300\nSemana 4: +22.300 cobros / -35.600 pagos (proveedores) = -13.300\n\nSaldo estimado final: 143.030 EUR\n\nAlerta: la semana 2 el saldo baja a 127.030 EUR por el pago de nominas. Recomiendo adelantar el cobro de la factura #2847 (12.500 EUR) para mantener el colchon.', timestamp: mockDate(2, 2.5) },
    ],
    createdAt: mockDate(2, 3),
    updatedAt: mockDate(2, 2.5),
    model: 'gemini-3.1-pro',
  },
  {
    id: 'mock-4',
    title: 'Comparativa gastos operativos 2025 vs 2026',
    messages: [
      { id: 'm4-1', role: 'user', content: 'Comparame los gastos operativos de enero y febrero 2026 con el mismo periodo de 2025', timestamp: mockDate(5, 2) },
      { id: 'm4-2', role: 'assistant', content: 'Comparativa Ene-Feb 2025 vs 2026:\n\nPersonal: 82.400 vs 89.100 (+8.1%) — nuevo equipo de desarrollo\nAlquileres: 12.000 vs 12.000 (0%) — mismo contrato\nMarketing: 15.600 vs 22.300 (+42.9%) — campana lanzamiento producto\nTecnologia: 8.200 vs 11.400 (+39.0%) — migracion cloud\nSuministros: 3.100 vs 2.800 (-9.7%) — renegociacion electrica\n\nTotal: 121.300 vs 137.600 (+13.4%)\n\nEl incremento principal viene de marketing y tecnologia, ambas inversiones planificadas en el presupuesto anual.', timestamp: mockDate(5, 1.5) },
    ],
    createdAt: mockDate(5, 2),
    updatedAt: mockDate(5, 1.5),
    model: 'claude-sonnet-4.5',
  },
  {
    id: 'mock-5',
    title: 'Resumen estado financiero actual',
    messages: [
      { id: 'm5-1', role: 'user', content: 'Resume el estado financiero actual de la empresa', timestamp: mockDate(12, 1) },
      { id: 'm5-2', role: 'assistant', content: 'Resumen financiero a 8 de marzo 2026:\n\nIngresos YTD: 487.200 EUR (+15.2% vs 2025)\nEBITDA: 68.400 EUR (margen 14.0%)\nTesoreria: 145.230 EUR\nDeuda financiera: 52.000 EUR (ratio deuda/EBITDA: 0.76x)\n\nCuentas por cobrar: 94.700 EUR (DSO: 38 dias)\nCuentas por pagar: 61.300 EUR (DPO: 29 dias)\n\nSituacion saludable. El flujo de caja operativo es positivo y la deuda esta controlada.', timestamp: mockDate(12, 0.5) },
    ],
    createdAt: mockDate(12, 1),
    updatedAt: mockDate(12, 0.5),
    model: 'claude-opus-4-6',
  },
  {
    id: 'mock-6',
    title: 'Facturas pendientes de cobro febrero',
    messages: [
      { id: 'm6-1', role: 'user', content: 'Dame las facturas pendientes de cobro de febrero que llevan mas de 30 dias', timestamp: mockDate(18, 4) },
      { id: 'm6-2', role: 'assistant', content: 'Facturas pendientes >30 dias (emitidas en febrero):\n\n1. #2834 — Cliente ABC Corp — 4.200 EUR — 45 dias — Contactar urgente\n2. #2841 — Cliente XYZ SL — 2.800 EUR — 38 dias — Reclamacion enviada\n3. #2845 — Cliente MNO Ltd — 1.350 EUR — 33 dias — Primer aviso\n\nTotal pendiente: 8.350 EUR\n\nRecomendacion: escalar la factura #2834 a direccion comercial, el cliente tiene un patron de pago a 60+ dias en los ultimos 3 meses.', timestamp: mockDate(18, 3.5) },
    ],
    createdAt: mockDate(18, 4),
    updatedAt: mockDate(18, 3.5),
    model: 'gemini-2.5-flash',
  },
  {
    id: 'mock-7',
    title: 'KPIs financieros dashboard mensual',
    messages: [
      { id: 'm7-1', role: 'user', content: 'Preparame los KPIs financieros principales para el dashboard mensual de febrero', timestamp: mockDate(35, 2) },
      { id: 'm7-2', role: 'assistant', content: 'KPIs Dashboard Febrero 2026:\n\nIngresos: 168.400 EUR (+12.3% MoM)\nMargen bruto: 41.8%\nEBITDA: 23.100 EUR\nBurn rate: 145.300 EUR/mes\nRunway: 12.4 meses\nCAC: 1.240 EUR\nLTV: 18.600 EUR\nLTV/CAC: 15.0x\nChurn: 2.1%\nARR: 2.02M EUR\nNRR: 112%', timestamp: mockDate(35, 1.5) },
    ],
    createdAt: mockDate(35, 2),
    updatedAt: mockDate(35, 1.5),
    model: 'claude-sonnet-4.5',
  },
];

// ── Helpers ──

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos dias';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatRelativeDate(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days}d`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function groupConversationsByDate(convs: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Hoy', items: [] }, { label: 'Ayer', items: [] },
    { label: 'Ultimos 7 dias', items: [] }, { label: 'Ultimos 30 dias', items: [] },
    { label: 'Anteriores', items: [] },
  ];
  for (const c of convs) {
    const d = c.updatedAt;
    if (d >= today) groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= weekAgo) groups[2].items.push(c);
    else if (d >= monthAgo) groups[3].items.push(c);
    else groups[4].items.push(c);
  }
  return groups.filter(g => g.items.length > 0);
}

// ── Sub-components ──

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white z-10"><X size={28} /></button>
      <img src={src} alt={alt} className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
    </div>
  );
}

/** Spreadsheet file card (like Claude's file attachment card) */
function SpreadsheetCard({ att, onOpen, onDownload }: { att: Attachment; onOpen: () => void; onDownload?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm max-w-md cursor-pointer hover:border-gray-300 transition-colors" onClick={onOpen}>
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-50 shrink-0">
        <FileSpreadsheet size={20} className="text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{att.name}</div>
        <div className="text-xs text-gray-400">Hoja de calculo · {getFileExtLabel(att.name)}</div>
      </div>
      {onDownload && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDownload(); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 shrink-0 transition-colors"
        >
          Descargar
        </button>
      )}
    </div>
  );
}

// ── Main component ──

export default function AgentPage() {
  const { t } = useLanguage();
  const { user } = useAuthenticator(context => [context.user]);
  const displayName = (user?.signInDetails?.loginId?.split('@')[0] || '').replace(/^./, c => c.toUpperCase());

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Conversations
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState<string | null>('mock-1');
  const [searchQuery, setSearchQuery] = useState('');

  // Chat input
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Viewers
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [sheetViewer, setSheetViewer] = useState<SpreadsheetData | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConversation = useMemo(() => conversations.find(c => c.id === activeConvId) ?? null, [conversations, activeConvId]);
  const messages = activeConversation?.messages ?? [];
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q) || c.messages.some(m => m.content.toLowerCase().includes(q)));
  }, [conversations, searchQuery]);
  const groupedConversations = useMemo(() => groupConversationsByDate(filteredConversations), [filteredConversations]);
  const canSend = useMemo(() => input.trim().length > 0 || attachments.length > 0, [input, attachments]);

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Close menus
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) setShowModelMenu(false);
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(false);
    };
    if (showModelMenu || showAddMenu) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showModelMenu, showAddMenu]);

  // ── Agent WebSocket ──
  const pendingConvId = useRef<string | null>(null);

  const handleAgentResult = useCallback((result: AgentResult, _requestId: string) => {
    const convId = pendingConvId.current;
    if (!convId) return;
    const aMsg: ChatMessage = {
      id: `${Date.now()}-a`,
      role: 'assistant',
      content: result.answer,
      timestamp: new Date(),
      chart: result.chart,
      sources: result.sources,
    };
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, aMsg], updatedAt: new Date() } : c));
  }, []);

  const { sendMessage: sendAgentMessage, connectionState, statusMessage, isProcessing } = useAgentChat({
    locationId: 'deloitte-84',
    onResult: handleAgentResult,
  });

  const startNewChat = useCallback(() => { setActiveConvId(null); setInput(''); setAttachments([]); setTimeout(() => inputRef.current?.focus(), 10); }, []);
  const deleteConversation = useCallback((id: string) => { setConversations(prev => prev.filter(c => c.id !== id)); if (activeConvId === id) setActiveConvId(null); }, [activeConvId]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    const userMsg: ChatMessage = { id: `${Date.now()}`, role: 'user', content: text, timestamp: new Date(), attachments: attachments.length > 0 ? [...attachments] : undefined };

    let convId = activeConvId;
    if (convId) {
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, userMsg], updatedAt: new Date() } : c));
    } else {
      convId = `conv-${Date.now()}`;
      const newConv: Conversation = { id: convId, title: text.length > 50 ? text.slice(0, 50) + '...' : (text || attachments[0]?.name || 'Nueva conversacion'), messages: [userMsg], createdAt: new Date(), updatedAt: new Date(), model: selectedModel.id };
      setConversations(prev => [newConv, ...prev]);
      setActiveConvId(convId);
    }

    pendingConvId.current = convId;
    setInput(''); setAttachments([]);

    // Send to agent backend
    if (text) {
      sendAgentMessage(text, selectedModel.id, `req-${Date.now()}`);
    }
  }, [input, attachments, selectedModel, activeConvId, sendAgentMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }, [handleSubmit]);
  const applySuggestion = useCallback((text: string) => { setInput(text); setTimeout(() => inputRef.current?.focus(), 10); }, []);
  const handleFileSelect = useCallback(() => { fileInputRef.current?.click(); setShowAddMenu(false); }, []);

  const handleFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(async (file) => {
      if (isSpreadsheetFile(file.name)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellStyles: true });
        const att: Attachment = { id: `${Date.now()}-${file.name}`, name: file.name, type: 'spreadsheet', spreadsheet: { fileName: file.name, workbook: wb, rawBuffer: buf } };
        setAttachments(prev => [...prev, att]);
      } else {
        const att: Attachment = { id: `${Date.now()}-${file.name}`, name: file.name, type: 'file' };
        if (file.type.startsWith('image/')) att.previewUrl = URL.createObjectURL(file);
        setAttachments(prev => [...prev, att]);
      }
    });
    e.target.value = '';
  }, []);

  const handleScreenCapture = useCallback(async () => {
    setShowAddMenu(false);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' } as MediaTrackConstraints });
      const video = document.createElement('video'); video.srcObject = stream; await video.play();
      await new Promise(r => requestAnimationFrame(r));
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0); stream.getTracks().forEach(t => t.stop());
      setAttachments(prev => [...prev, { id: `screenshot-${Date.now()}`, name: `Captura ${new Date().toLocaleTimeString()}`, type: 'screenshot', previewUrl: canvas.toDataURL('image/png') }]);
    } catch { /* cancelled */ }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => { const r = prev.find(a => a.id === id); if (r?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(r.previewUrl); return prev.filter(a => a.id !== id); });
  }, []);

  const downloadSpreadsheet = useCallback((att: Attachment) => {
    if (!att.spreadsheet) return;
    const sd = att.spreadsheet;
    const buf = sd.rawBuffer ?? XLSX.write(sd.workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = sd.fileName; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const suggestions = [t('agent.suggestion1'), t('agent.suggestion2'), t('agent.suggestion3')];
  const greeting = getGreeting();

  // ── Render attachment preview in input card ──
  const renderAttachmentPreview = (att: Attachment, removable: boolean) => {
    if (att.type === 'spreadsheet') {
      return (
        <div key={att.id} className="relative group/att">
          <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white pl-3 pr-2 py-2 shadow-sm cursor-pointer hover:border-gray-300 transition-colors" onClick={() => att.spreadsheet && setSheetViewer(att.spreadsheet)}>
            <FileSpreadsheet size={18} className="text-green-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-800 truncate max-w-[140px]">{att.name}</div>
              <div className="text-[10px] text-gray-400">{getFileExtLabel(att.name)}</div>
            </div>
          </div>
          {removable && (
            <button type="button" onClick={() => removeAttachment(att.id)} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gray-800 text-white flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"><X size={12} /></button>
          )}
        </div>
      );
    }
    if (att.previewUrl) {
      return (
        <div key={att.id} className="relative group/att">
          <div className="relative w-28 h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer" onClick={() => setLightboxSrc(att.previewUrl!)}>
            <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover/att:bg-black/20 transition-colors flex items-center justify-center">
              <Maximize2 size={16} className="text-white opacity-0 group-hover/att:opacity-100 transition-opacity" />
            </div>
          </div>
          {removable && (
            <button type="button" onClick={() => removeAttachment(att.id)} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gray-800 text-white flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"><X size={12} /></button>
          )}
        </div>
      );
    }
    return (
      <div key={att.id} className="relative group/att">
        <div className="w-28 h-24 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center px-2">
          <span className="text-[11px] text-gray-500 text-center truncate">{att.name}</span>
        </div>
        {removable && (
          <button type="button" onClick={() => removeAttachment(att.id)} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gray-800 text-white flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"><X size={12} /></button>
        )}
      </div>
    );
  };

  // ── Render attachment in sent message ──
  const renderMessageAttachment = (att: Attachment) => {
    if (att.type === 'spreadsheet') {
      return (
        <SpreadsheetCard
          key={att.id}
          att={att}
          onOpen={() => att.spreadsheet && setSheetViewer(att.spreadsheet)}
          onDownload={() => downloadSpreadsheet(att)}
        />
      );
    }
    if (att.previewUrl) {
      return (
        <div key={att.id} className="w-24 h-20 rounded-lg overflow-hidden border border-white/20 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setLightboxSrc(att.previewUrl!)}>
          <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
        </div>
      );
    }
    return <div key={att.id} className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs">{att.name}</div>;
  };

  // ── Input card ──
  const renderInputCard = (size: 'large' | 'compact') => {
    const isLarge = size === 'large';
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <form onSubmit={handleSubmit}>
          {attachments.length > 0 && (
            <div className="px-5 pt-4 flex flex-wrap gap-3">
              {attachments.map(att => renderAttachmentPreview(att, true))}
            </div>
          )}
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={t('agent.placeholder')} rows={isLarge ? 2 : 1}
            className={`w-full resize-none px-5 text-gray-800 placeholder-gray-400 outline-none bg-transparent ${isLarge ? 'pt-5 pb-2 text-base' : 'pt-4 pb-2 text-sm'}`}
            style={{ maxHeight: isLarge ? 160 : 120 }} />
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-1">
              <div className="relative" ref={addMenuRef}>
                <button type="button" onClick={() => setShowAddMenu(!showAddMenu)} className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Adjuntar archivos, capturas y mas">
                  <Plus size={18} />
                </button>
                {showAddMenu && (
                  <div className="absolute left-0 top-full mt-2 w-60 rounded-xl border border-gray-200 bg-white shadow-xl py-1.5 z-50">
                    <button type="button" onClick={handleFileSelect} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Paperclip size={16} className="text-gray-400" />Adjuntar archivos o fotos
                    </button>
                    <button type="button" onClick={handleScreenCapture} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Camera size={16} className="text-gray-400" />Hacer una captura de pantalla
                    </button>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.csv,.xlsx,.xls,.ods,.doc,.docx,.txt,.json" className="hidden" onChange={handleFilesChange} />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative" ref={modelMenuRef}>
                <button type="button" onClick={() => setShowModelMenu(!showModelMenu)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  <span className={`font-medium ${isLarge ? 'text-sm' : 'text-xs'}`}>{selectedModel.label}</span>
                  <ChevronDown size={14} className={`transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
                </button>
                {showModelMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg py-1 z-50">
                    <div className="px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Anthropic</div>
                    {AI_MODELS.filter(m => m.provider === 'anthropic').map(model => (
                      <button key={model.id} type="button" onClick={() => { setSelectedModel(model); setShowModelMenu(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedModel.id === model.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>{model.label}</button>
                    ))}
                    <div className="mx-3 my-1 border-t border-gray-100" />
                    <div className="px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Google</div>
                    {AI_MODELS.filter(m => m.provider === 'google').map(model => (
                      <button key={model.id} type="button" onClick={() => { setSelectedModel(model); setShowModelMenu(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedModel.id === model.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>{model.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={!canSend || isProcessing} title={t('agent.send')}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${isProcessing ? 'bg-gray-200 text-gray-400 cursor-wait' : canSend ? 'text-white' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                style={canSend && !isProcessing ? { backgroundColor: '#f2764b' } : undefined}>
                {isProcessing ? (
                  <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowUp size={16} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  // ── Layout ──
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="Preview" onClose={() => setLightboxSrc(null)} />}

      {/* Sidebar */}
      <div className={`flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full transition-all duration-200 ${sidebarOpen ? 'w-72' : 'w-0 overflow-hidden border-r-0'}`}>
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Chats</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={startNewChat} title="Nuevo chat" className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><SquarePen size={16} /></button>
            <button type="button" onClick={() => setSidebarOpen(false)} title="Cerrar panel" className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><PanelLeftClose size={16} /></button>
          </div>
        </div>
        <div className="px-3 pb-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar conversaciones..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-gray-300 focus:bg-white transition-colors" />
            {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {conversations.length === 0 ? (
            <div className="px-3 py-8 text-center"><MessageSquare size={28} className="mx-auto text-gray-300 mb-2" /><p className="text-xs text-gray-400">Sin conversaciones aun</p></div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-3 py-8 text-center"><Search size={28} className="mx-auto text-gray-300 mb-2" /><p className="text-xs text-gray-400">Sin resultados para "{searchQuery}"</p></div>
          ) : (
            groupedConversations.map(group => (
              <div key={group.label} className="mb-3">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{group.label}</div>
                {group.items.map(conv => (
                  <button key={conv.id} type="button" onClick={() => setActiveConvId(conv.id)}
                    className={`group/conv w-full text-left rounded-lg px-3 py-2.5 mb-0.5 transition-colors relative ${activeConvId === conv.id ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium truncate flex-1 leading-snug">{conv.title}</span>
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{formatRelativeDate(conv.updatedAt)}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-snug">{conv.messages[conv.messages.length - 1]?.content.slice(0, 60)}</p>
                    <button type="button" onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                      className="absolute top-2 right-2 h-6 w-6 rounded-md items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 hidden group-hover/conv:inline-flex transition-colors" title="Eliminar"><Trash2 size={13} /></button>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main area + sheet viewer */}
      <div className="flex-1 flex min-w-0">
      <div className="flex-1 flex flex-col bg-[#faf9f7] min-w-0">
        {/* Top bar: sidebar toggle + connection status */}
        <div className="flex items-center justify-between px-4 h-10 shrink-0">
          {!sidebarOpen ? (
            <button type="button" onClick={() => setSidebarOpen(true)} title="Abrir panel"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
              <PanelLeftOpen size={16} />
            </button>
          ) : <div />}
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400" title={`Estado: ${connectionState}`}>
            {connectionState === 'connected' ? (
              <><Wifi size={12} className="text-green-500" /><span>Conectado</span></>
            ) : connectionState === 'connecting' ? (
              <><Wifi size={12} className="text-yellow-500 animate-pulse" /><span>Conectando...</span></>
            ) : (
              <><WifiOff size={12} className="text-gray-400" /><span>Desconectado</span></>
            )}
          </div>
        </div>

        {messages.length === 0 && !activeConvId ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <h1 className="text-4xl font-serif text-gray-800 mb-10 text-center">
              <img src={TALKY_ICON_URL} alt="" className="inline-block h-9 w-9 mr-2 -mt-1" />
              {greeting}, {displayName}
            </h1>
            <div className="w-full max-w-2xl">
              {renderInputCard('large')}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                {suggestions.map(text => (
                  <button key={text} type="button" onClick={() => applySuggestion(text)}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors shadow-sm">{text}</button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map(m => m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-gray-800" style={{ backgroundColor: '#f3ede4' }}>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {m.attachments.map(att => renderMessageAttachment(att))}
                        </div>
                      )}
                      {m.content && <div className="whitespace-pre-wrap">{m.content}</div>}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="space-y-3">
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {m.attachments.map(att => renderMessageAttachment(att))}
                      </div>
                    )}
                    {m.content && (
                      <div className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{m.content}</div>
                    )}
                    {m.chart && <ChartRenderer data={m.chart} />}
                    {m.sources && m.sources.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documentos de referencia</div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                          {m.sources.map((src, i) => (
                            <SourceCard key={i} source={src} index={i} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {/* Status indicator while agent is processing */}
                {isProcessing && statusMessage && (
                  <StatusIndicator message={statusMessage} />
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div className="px-4 pb-4">
              <div className="max-w-3xl mx-auto">
                {renderInputCard('compact')}
                <div className="flex items-center gap-2 overflow-x-auto justify-center pt-3" style={{ scrollbarWidth: 'none' }}>
                  {suggestions.map(text => (
                    <button key={text} type="button" onClick={() => applySuggestion(text)}
                      className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">{text}</button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Inline spreadsheet viewer */}
      {sheetViewer && <SpreadsheetViewer data={sheetViewer} onClose={() => setSheetViewer(null)} inline />}
      </div>
    </div>
  );
}
