import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Plus, ChevronDown, ArrowUp, Paperclip, Camera, X, Maximize2, Search, MessageSquare, SquarePen, Trash2, PanelLeftClose, PanelLeftOpen, FileSpreadsheet, FileText, Wifi, WifiOff, Coins, Terminal, Loader2, MapPin } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthenticator } from '@aws-amplify/ui-react';
import SpreadsheetViewer, { type SpreadsheetData } from '../components/agent/SpreadsheetViewer';
import ChartRenderer from '../components/agent/ChartRenderer';
import SourcesList from '../components/agent/SourceCard';
import StatusIndicator from '../components/agent/StatusIndicator';
import MarkdownContent from '../components/agent/MarkdownContent';
import CostPanel from '../components/agent/CostPanel';
import DevPanel from '../components/agent/DevPanel';
import { useDevLogs } from '../hooks/useDevLogs';
import { TaskProgress, TaskFailed, ArtifactsCard } from '../components/agent/TaskProgressCard';
import GeneratedFilesCard from '../components/agent/GeneratedFilesCard';
import { useAgentChat, type AgentResult, type ChartData, type Source, type TaskArtifact, type GeneratedFile, type TaskCreatedEvent, type TaskProgressEvent, type TaskCompletedEvent, type TaskFailedEvent, type TaskStep, type WsAttachment } from '../hooks/useAgentChat';
import { useAgentChats, type BackendMessage } from '../hooks/useAgentChats';
import { useLocations } from '../hooks/useLocations';

// ── Types ──

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
  chart?: ChartData | null;
  sources?: Source[];
  artifacts?: TaskArtifact[];
  files?: GeneratedFile[];
  taskId?: string;
  costUsd?: number;
};

type Attachment = {
  id: string;
  name: string;
  type: 'file' | 'screenshot' | 'spreadsheet';
  previewUrl?: string;
  /** parsed workbook for spreadsheets */
  spreadsheet?: SpreadsheetData;
  /** base64 data for sending to backend (images, PDFs) */
  base64Data?: string;
  /** MIME type of the file */
  mimeType?: string;
};

type Conversation = {
  id: string;
  /** Backend chat_id (null for local-only conversations before server assigns one) */
  backendChatId: string | null;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  model: string;
};

type ActiveTask = {
  taskId: string;
  taskTypeName: string;
  progress: number;
  steps: TaskStep[];
  costUsd?: number;
  failed?: string;
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

function isPdfFile(name: string) {
  return name.toLowerCase().endsWith('.pdf');
}

function isImageFile(name: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pdfThumbnail(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
  const url = canvas.toDataURL('image/png');
  page.cleanup();
  pdf.destroy();
  return url;
}

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

/** Full PDF viewer — renders all pages scrollable */
function PdfViewerModal({ base64, filename, onClose }: { base64: string; filename: string; onClose: () => void }) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const rendered: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) break;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
        rendered.push(canvas.toDataURL('image/png'));
        page.cleanup();
      }
      pdf.destroy();
      if (!cancelled) {
        setPages(rendered);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [base64]);

  // Track current page on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const scrollTop = el.scrollTop;
      let closest = 1;
      for (let i = 0; i < pageRefs.current.length; i++) {
        const ref = pageRefs.current[i];
        if (ref && ref.offsetTop - el.offsetTop <= scrollTop + 100) {
          closest = i + 1;
        }
      }
      setCurrentPage(closest);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [pages]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/80 backdrop-blur-sm" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-white bg-red-600 rounded px-1.5 py-0.5">PDF</span>
          <span className="text-sm text-white/90 font-medium truncate max-w-[400px]">{filename}</span>
          {!loading && (
            <span className="text-xs text-white/50">{currentPage} / {pages.length}</span>
          )}
        </div>
        <button type="button" onClick={onClose} className="text-white/80 hover:text-white transition-colors"><X size={24} /></button>
      </div>
      {/* Pages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-6" onClick={e => e.stopPropagation()}>
        <div className="max-w-4xl mx-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-white/60" />
            </div>
          ) : (
            pages.map((src, i) => (
              <div
                key={i}
                ref={el => { pageRefs.current[i] = el; }}
                className="rounded-lg overflow-hidden shadow-2xl bg-white"
              >
                <img src={src} alt={`Pagina ${i + 1}`} className="w-full" />
              </div>
            ))
          )}
        </div>
      </div>
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Chat input
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Viewers
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ base64: string; filename: string } | null>(null);
  const [sheetViewer, setSheetViewer] = useState<SpreadsheetData | null>(null);
  const [costChatId, setCostChatId] = useState<{ id: string; title: string } | null>(null);

  // Active task tracking
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);

  // Drag & drop
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Dev panel
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const { logs: devLogs, connected: devLogsConnected, clearLogs: clearDevLogs } = useDevLogs({ enabled: devPanelOpen });

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

  // ── Location selector ──
  const { locations, loading: locsLoading } = useLocations();
  const [selectedLocationId, setSelectedLocationId] = useState('deloitte-84');

  // ── Backend Chat CRUD ──
  const { chats: backendChats, fetchChats, fetchMessages: fetchBackendMessages, fetchChatCosts, deleteChat: deleteBackendChat, upsertChat } = useAgentChats(selectedLocationId);

  // Convert backend message to local ChatMessage
  const backendMsgToLocal = useCallback((m: BackendMessage): ChatMessage => ({
    id: String(m.id),
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp * 1000),
    chart: (m.metadata?.chart && typeof m.metadata.chart === 'object') ? m.metadata.chart as ChartData : undefined,
    sources: m.metadata?.sources,
  }), []);

  // Clear local state when switching location
  const syncedChatIdsRef = useRef(new Set<string>());
  const prevLocationRef = useRef(selectedLocationId);
  useEffect(() => {
    if (prevLocationRef.current !== selectedLocationId) {
      prevLocationRef.current = selectedLocationId;
      setConversations([]);
      setActiveConvId(null);
      syncedChatIdsRef.current = new Set();
    }
  }, [selectedLocationId]);

  // Load chats from backend on mount and sync into local state
  const loadChatsFromBackend = useCallback(async () => {
    await fetchChats();
  }, [fetchChats]);

  useEffect(() => { loadChatsFromBackend(); }, [loadChatsFromBackend]);

  useEffect(() => {
    if (backendChats.length === 0) return;
    const newChats = backendChats.filter(bc => !syncedChatIdsRef.current.has(bc.chat_id));
    if (newChats.length === 0 && syncedChatIdsRef.current.size === backendChats.length) return;
    syncedChatIdsRef.current = new Set(backendChats.map(bc => bc.chat_id));
    setConversations(prev => {
      const localOnlyConvs = prev.filter(c => !c.backendChatId);
      const backendConvs: Conversation[] = backendChats.map(bc => {
        const existing = prev.find(c => c.backendChatId === bc.chat_id);
        if (existing) return { ...existing, title: bc.title || existing.title, updatedAt: new Date(bc.updated_at * 1000) };
        return {
          id: bc.chat_id,
          backendChatId: bc.chat_id,
          title: bc.title || 'Nueva conversacion',
          messages: [],
          createdAt: new Date(bc.created_at * 1000),
          updatedAt: new Date(bc.updated_at * 1000),
          model: bc.model,
        };
      });
      return [...localOnlyConvs, ...backendConvs];
    });
  }, [backendChats]);

  // Load messages when selecting a conversation that has a backendChatId but no messages loaded
  const selectConversation = useCallback(async (convId: string) => {
    setActiveConvId(convId);
    const conv = conversations.find(c => c.id === convId);
    if (conv?.backendChatId && conv.messages.length === 0) {
      setLoadingMessages(true);
      const msgs = await fetchBackendMessages(conv.backendChatId);
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, messages: msgs.map(backendMsgToLocal) } : c
      ));
      setLoadingMessages(false);
    }
  }, [conversations, fetchBackendMessages, backendMsgToLocal]);

  // ── Agent WebSocket ──
  // Map requestId → convId for routing parallel queries
  const pendingRequests = useRef<Map<string, string>>(new Map());

  const handleChatId = useCallback((chatId: string, requestId: string) => {
    const convId = pendingRequests.current.get(requestId);
    if (!convId) return;
    // Associate the backend chat_id with the local conversation
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, backendChatId: chatId } : c
    ));
    // Update backend chat list
    const conv = conversations.find(c => c.id === convId);
    upsertChat(chatId, conv?.title ?? '', conv?.model ?? selectedModel.id);
  }, [conversations, upsertChat, selectedModel]);

  const autoOpenExcel = useCallback(async (files?: GeneratedFile[], artifacts?: TaskArtifact[], taskId?: string) => {
    // Find first Excel file from files or artifacts
    const excelFile = files?.find(f => f.type === 'excel' || f.filename.match(/\.xlsx?$/i));
    const excelArtifact = !excelFile ? artifacts?.find(a => a.type === 'excel' || a.filename.match(/\.xlsx?$/i)) : undefined;

    const rawUrl = excelFile
      ? excelFile.url
      : excelArtifact && taskId
        ? (excelArtifact.url ?? `/api/tasks/${taskId}/artifacts/${excelArtifact.filename}`)
        : null;
    const url = rawUrl?.startsWith('/api/') ? `/agent-api${rawUrl}` : rawUrl;

    const filename = excelFile?.filename ?? excelArtifact?.filename;
    if (!url || !filename) return;

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellStyles: true });
      setSheetViewer({ fileName: filename, workbook: wb, rawBuffer: buf });
    } catch { /* silent */ }
  }, []);

  const handleAgentResult = useCallback((result: AgentResult, requestId: string) => {
    const convId = pendingRequests.current.get(requestId);
    if (!convId) return;
    pendingRequests.current.delete(requestId);
    setActiveTask(null);

    // If we have Excel files, suppress the table chart (SpreadsheetViewer is better)
    const hasExcelFiles = result.files?.some(f => f.type === 'excel' || f.filename.match(/\.xlsx?$/i))
      || result.artifacts?.some(a => a.type === 'excel' || a.filename.match(/\.xlsx?$/i));
    const chart = (hasExcelFiles && result.chart?.type === 'table') ? null : result.chart;

    const aMsg: ChatMessage = {
      id: `${Date.now()}-a`,
      role: 'assistant',
      content: result.answer,
      timestamp: new Date(),
      chart,
      sources: result.sources,
      artifacts: result.artifacts,
      files: result.files,
      taskId: activeTask?.taskId,
      costUsd: result.cost_usd,
    };
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, aMsg], updatedAt: new Date() } : c));

    // Auto-open the first Excel in SpreadsheetViewer
    if (hasExcelFiles) {
      autoOpenExcel(result.files, result.artifacts, activeTask?.taskId);
    }
  }, [activeTask?.taskId, autoOpenExcel]);

  const handleCancelled = useCallback((requestId: string) => {
    pendingRequests.current.delete(requestId);
    setActiveTask(null);
  }, []);

  const handleTaskCreated = useCallback((event: TaskCreatedEvent) => {
    setActiveTask({
      taskId: event.task_id,
      taskTypeName: event.task_type_name,
      progress: 0,
      steps: [],
    });
  }, []);

  const handleTaskProgress = useCallback((event: TaskProgressEvent) => {
    setActiveTask(prev => {
      if (!prev || prev.taskId !== event.task_id) return prev;
      const steps = [...prev.steps];
      if (event.step) {
        // Backend can send step as string or as TaskStep object
        const stepObj: TaskStep = typeof event.step === 'string'
          ? { step_number: steps.length + 1, status: 'RUNNING', description: event.step }
          : event.step;
        const idx = steps.findIndex(s => s.step_number === stepObj.step_number);
        if (idx >= 0) steps[idx] = stepObj;
        else {
          // Mark previous running steps as completed
          steps.forEach((s, i) => { if (s.status === 'RUNNING') steps[i] = { ...s, status: 'COMPLETED' }; });
          steps.push(stepObj);
        }
      }
      return { ...prev, progress: event.progress, steps };
    });
  }, []);

  const handleTaskCompleted = useCallback((event: TaskCompletedEvent) => {
    // task_completed arrives before the result message
    // Update task cost if provided
    setActiveTask(prev => {
      if (!prev || prev.taskId !== event.task_id) return prev;
      // Mark all steps as completed
      const steps = prev.steps.map(s => ({ ...s, status: 'COMPLETED' as const }));
      return { ...prev, progress: 100, steps, costUsd: event.cost_usd };
    });
  }, []);

  const handleTaskFailed = useCallback((event: TaskFailedEvent) => {
    setActiveTask(prev => {
      if (!prev || prev.taskId !== event.task_id) return prev;
      return { ...prev, failed: event.error };
    });
  }, []);

  const { sendMessage: sendAgentMessage, cancelChat, connectionState, activeRequests } = useAgentChat({
    locationId: selectedLocationId,
    onResult: handleAgentResult,
    onChatId: handleChatId,
    onTaskCreated: handleTaskCreated,
    onTaskProgress: handleTaskProgress,
    onTaskCompleted: handleTaskCompleted,
    onTaskFailed: handleTaskFailed,
    onCancelled: handleCancelled,
  });

  const cancelTask = useCallback(() => {
    if (!activeTask) return;
    cancelChat(undefined, activeTask.taskId);
  }, [activeTask, cancelChat]);

  const handleCancelCurrentChat = useCallback(() => {
    const conv = activeConversation;
    if (!conv?.backendChatId) return;
    cancelChat(conv.backendChatId);
  }, [activeConversation, cancelChat]);

  const startNewChat = useCallback(() => { setActiveConvId(null); setInput(''); setAttachments([]); setTimeout(() => inputRef.current?.focus(), 10); }, []);
  const deleteConversation = useCallback((id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv?.backendChatId) deleteBackendChat(conv.backendChatId);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) setActiveConvId(null);
  }, [activeConvId, conversations, deleteBackendChat]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    const userMsg: ChatMessage = { id: `${Date.now()}`, role: 'user', content: text, timestamp: new Date(), attachments: attachments.length > 0 ? [...attachments] : undefined };

    let convId = activeConvId;
    let backendChatId: string | null = null;

    if (convId) {
      const existing = conversations.find(c => c.id === convId);
      backendChatId = existing?.backendChatId ?? null;
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, userMsg], updatedAt: new Date() } : c));
    } else {
      convId = `conv-${Date.now()}`;
      const newConv: Conversation = {
        id: convId,
        backendChatId: null,
        title: text.length > 50 ? text.slice(0, 50) + '...' : (text || attachments[0]?.name || 'Nueva conversacion'),
        messages: [userMsg],
        createdAt: new Date(),
        updatedAt: new Date(),
        model: selectedModel.id,
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveConvId(convId);
    }

    // Build backend attachments from files with base64 data
    const wsAttachments: WsAttachment[] = attachments
      .filter(a => a.base64Data && a.mimeType)
      .map(a => ({ filename: a.name, mime_type: a.mimeType!, data: a.base64Data! }));

    setInput(''); setAttachments([]);

    // Send to agent backend with chat_id for multi-turn
    if (text || wsAttachments.length > 0) {
      const requestId = `req-${Date.now()}`;
      pendingRequests.current.set(requestId, convId);
      sendAgentMessage(text || '(adjunto)', selectedModel.id, requestId, backendChatId, wsAttachments.length > 0 ? wsAttachments : undefined);
    }
  }, [input, attachments, selectedModel, activeConvId, conversations, sendAgentMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }, [handleSubmit]);
  const applySuggestion = useCallback((text: string) => { setInput(text); setTimeout(() => inputRef.current?.focus(), 10); }, []);
  const handleFileSelect = useCallback(() => { fileInputRef.current?.click(); setShowAddMenu(false); }, []);

  const processFiles = useCallback((fileList: FileList | File[]) => {
    Array.from(fileList).forEach(async (file) => {
      if (isSpreadsheetFile(file.name)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellStyles: true });
        const att: Attachment = { id: `${Date.now()}-${file.name}`, name: file.name, type: 'spreadsheet', spreadsheet: { fileName: file.name, workbook: wb, rawBuffer: buf } };
        setAttachments(prev => [...prev, att]);
      } else {
        const b64 = await fileToBase64(file);
        const mimeType = file.type || (isPdfFile(file.name) ? 'application/pdf' : 'application/octet-stream');
        const att: Attachment = {
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          type: 'file',
          base64Data: b64,
          mimeType,
        };
        if (file.type.startsWith('image/')) {
          att.previewUrl = URL.createObjectURL(file);
        }
        setAttachments(prev => [...prev, att]);
        // Generate PDF thumbnail asynchronously
        if (isPdfFile(file.name)) {
          pdfThumbnail(b64).then(thumb => {
            setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, previewUrl: thumb } : a));
          }).catch(() => { /* silent — keep icon fallback */ });
        }
      }
    });
  }, []);

  const handleFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  }, [processFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleScreenCapture = useCallback(async () => {
    setShowAddMenu(false);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' } as MediaTrackConstraints });
      const video = document.createElement('video'); video.srcObject = stream; await video.play();
      await new Promise(r => requestAnimationFrame(r));
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0); stream.getTracks().forEach(t => t.stop());
      const dataUrl = canvas.toDataURL('image/png');
      const b64 = dataUrl.split(',')[1];
      setAttachments(prev => [...prev, { id: `screenshot-${Date.now()}`, name: `Captura ${new Date().toLocaleTimeString()}.png`, type: 'screenshot', previewUrl: dataUrl, base64Data: b64, mimeType: 'image/png' }]);
    } catch { /* cancelled */ }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => { const r = prev.find(a => a.id === id); if (r?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(r.previewUrl); return prev.filter(a => a.id !== id); });
  }, []);

  const openAttachment = useCallback((att: Attachment) => {
    if (isPdfFile(att.name) && att.base64Data) {
      setPdfViewer({ base64: att.base64Data, filename: att.name });
    } else if (att.previewUrl) {
      setLightboxSrc(att.previewUrl);
    }
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

  // Derive per-conversation processing state
  const processingConvIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [reqId] of pendingRequests.current) {
      if (activeRequests[reqId]) {
        const convId = pendingRequests.current.get(reqId);
        if (convId) ids.add(convId);
      }
    }
    return ids;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRequests]);

  const activeConvStatus = useMemo(() => {
    if (!activeConvId) return null;
    for (const [reqId, state] of Object.entries(activeRequests)) {
      if (pendingRequests.current.get(reqId) === activeConvId) {
        return state;
      }
    }
    return null;
  }, [activeConvId, activeRequests]);

  const suggestions = [t('agent.suggestion1'), t('agent.suggestion2'), t('agent.suggestion3')];
  const greeting = getGreeting();

  // ── Render attachment preview in input card ──
  const renderAttachmentPreview = (att: Attachment, removable: boolean) => {
    const removeBtn = removable && (
      <button type="button" onClick={() => removeAttachment(att.id)} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gray-800 text-white flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"><X size={12} /></button>
    );

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
          {removeBtn}
        </div>
      );
    }
    // PDF — thumbnail or icon fallback
    if (isPdfFile(att.name)) {
      return (
        <div key={att.id} className="relative group/att">
          {att.previewUrl ? (
            <div className="relative w-28 h-36 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm cursor-pointer" onClick={() => openAttachment(att)}>
              <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover object-top" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5 flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-white bg-red-600 rounded px-1 py-0.5 leading-none">PDF</span>
                <span className="text-[10px] text-white/90 truncate">{att.name}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white pl-3 pr-2 py-2 shadow-sm cursor-pointer" onClick={() => openAttachment(att)}>
              <FileText size={18} className="shrink-0" style={{ color: '#f2764b' }} />
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate max-w-[140px]">{att.name}</div>
                <div className="text-[10px] text-gray-400">PDF</div>
              </div>
            </div>
          )}
          {removeBtn}
        </div>
      );
    }
    // Image with preview
    if (att.previewUrl) {
      return (
        <div key={att.id} className="relative group/att">
          <div className="relative w-28 h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer" onClick={() => setLightboxSrc(att.previewUrl!)}>
            <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover/att:bg-black/20 transition-colors flex items-center justify-center">
              <Maximize2 size={16} className="text-white opacity-0 group-hover/att:opacity-100 transition-opacity" />
            </div>
          </div>
          {removeBtn}
        </div>
      );
    }
    // Generic file
    return (
      <div key={att.id} className="relative group/att">
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white pl-3 pr-2 py-2 shadow-sm">
          <FileText size={18} className="text-gray-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-medium text-gray-800 truncate max-w-[140px]">{att.name}</div>
            <div className="text-[10px] text-gray-400">{getFileExtLabel(att.name)}</div>
          </div>
        </div>
        {removeBtn}
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
    // PDF — thumbnail card or icon fallback
    if (isPdfFile(att.name)) {
      if (att.previewUrl) {
        return (
          <div key={att.id} className="relative rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm max-w-[200px] cursor-pointer" onClick={() => openAttachment(att)}>
            <img src={att.previewUrl} alt={att.name} className="w-full object-cover object-top" style={{ maxHeight: 220 }} />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-2.5 py-2 flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-white bg-red-600 rounded px-1 py-0.5 leading-none shrink-0">PDF</span>
              <span className="text-[10px] text-white/90 truncate">{att.name}</span>
            </div>
          </div>
        );
      }
      return (
        <div key={att.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm max-w-xs cursor-pointer" onClick={() => openAttachment(att)}>
          <div className="flex items-center justify-center h-10 w-10 rounded-lg shrink-0" style={{ backgroundColor: '#fdf5f3' }}>
            <FileText size={20} style={{ color: '#f2764b' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-800 truncate">{att.name}</div>
            <div className="text-xs text-gray-400">PDF</div>
          </div>
        </div>
      );
    }
    // Image with preview
    if (att.previewUrl) {
      return (
        <div key={att.id} className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity max-w-xs" onClick={() => setLightboxSrc(att.previewUrl!)}>
          <img src={att.previewUrl} alt={att.name} className="w-full max-h-48 object-cover" />
          {isImageFile(att.name) && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent px-3 py-1.5">
              <span className="text-[11px] text-white/90 truncate block">{att.name}</span>
            </div>
          )}
        </div>
      );
    }
    // Generic file
    return (
      <div key={att.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm max-w-xs">
        <FileText size={18} className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{att.name}</div>
          <div className="text-xs text-gray-400">{getFileExtLabel(att.name)}</div>
        </div>
      </div>
    );
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
              {activeConvStatus ? (
                <button type="button" onClick={handleCancelCurrentChat} title="Detener"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                  <span className="block h-3 w-3 rounded-sm bg-current" />
                </button>
              ) : (
                <button type="submit" disabled={!canSend} title={t('agent.send')}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${canSend ? 'text-white' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                  style={canSend ? { backgroundColor: '#f2764b' } : undefined}>
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  };

  // ── Layout ──
  return (
    <div
      className="flex h-[calc(100vh-4rem)] relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-12 py-10" style={{ borderColor: '#f2764b' }}>
            <Paperclip size={32} style={{ color: '#f2764b' }} />
            <span className="text-sm font-medium text-gray-700">Suelta archivos aqui</span>
            <span className="text-xs text-gray-400">Imagenes, PDFs, hojas de calculo...</span>
          </div>
        </div>
      )}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="Preview" onClose={() => setLightboxSrc(null)} />}
      {pdfViewer && <PdfViewerModal base64={pdfViewer.base64} filename={pdfViewer.filename} onClose={() => setPdfViewer(null)} />}
      {costChatId && <CostPanel chatId={costChatId.id} chatTitle={costChatId.title} fetchCosts={fetchChatCosts} onClose={() => setCostChatId(null)} />}

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
                  <button key={conv.id} type="button" onClick={() => selectConversation(conv.id)}
                    className={`group/conv w-full text-left rounded-lg px-3 py-2.5 mb-0.5 transition-colors relative ${activeConvId === conv.id ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {processingConvIds.has(conv.id) && (
                          <Loader2 size={12} className="animate-spin shrink-0" style={{ color: '#f2764b' }} />
                        )}
                        <span className="text-sm font-medium truncate leading-snug">{conv.title}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{formatRelativeDate(conv.updatedAt)}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-snug">
                      {processingConvIds.has(conv.id) ? 'Procesando...' : conv.messages[conv.messages.length - 1]?.content.slice(0, 60)}
                    </p>
                    <div className="absolute top-2 right-2 hidden group-hover/conv:flex items-center gap-0.5">
                      {conv.backendChatId && (
                        <button type="button" onClick={e => { e.stopPropagation(); setCostChatId({ id: conv.backendChatId!, title: conv.title }); }}
                          className="h-6 w-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Ver costes"><Coins size={12} /></button>
                      )}
                      <button type="button" onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                        className="h-6 w-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar"><Trash2 size={13} /></button>
                    </div>
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
        {/* Top bar: sidebar toggle + location selector + connection status */}
        <div className="flex items-center justify-between px-4 h-10 shrink-0">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button type="button" onClick={() => setSidebarOpen(true)} title="Abrir panel"
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
                <PanelLeftOpen size={16} />
              </button>
            )}
            {/* Location selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 shadow-sm">
              <MapPin size={12} className="text-gray-400 shrink-0" />
              {locsLoading ? (
                <span className="text-[11px] text-gray-400">Cargando...</span>
              ) : (
                <select
                  value={selectedLocationId}
                  onChange={e => setSelectedLocationId(e.target.value)}
                  className="text-[11px] font-medium text-gray-700 bg-transparent outline-none cursor-pointer pr-1 max-w-[180px]"
                >
                  <option value="deloitte-84">deloitte-84</option>
                  {locations.map(loc => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.locationName} ({loc.locationId})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeConversation?.backendChatId && (
              <button
                type="button"
                onClick={() => setCostChatId({ id: activeConversation.backendChatId!, title: activeConversation.title })}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-400 hover:text-gray-600 hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                title="Ver costes de IA"
              >
                <Coins size={12} />
                <span>Costes</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setDevPanelOpen(!devPanelOpen)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] border transition-colors ${
                devPanelOpen
                  ? 'text-gray-700 bg-gray-100 border-gray-200'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-white border-transparent hover:border-gray-200'
              }`}
              title="Panel de desarrollador"
            >
              <Terminal size={12} />
              <span>Dev</span>
            </button>
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
                      <div className="text-sm leading-relaxed text-gray-800">
                        <MarkdownContent content={m.content} />
                      </div>
                    )}
                    {m.chart && <ChartRenderer data={m.chart} />}
                    {m.artifacts && m.artifacts.length > 0 && (
                      <ArtifactsCard artifacts={m.artifacts} taskId={m.taskId ?? ''} costUsd={m.costUsd} onPreviewSpreadsheet={setSheetViewer} />
                    )}
                    {m.files && m.files.length > 0 && (
                      <GeneratedFilesCard files={m.files} onPreviewSpreadsheet={setSheetViewer} />
                    )}
                    {m.sources && m.sources.length > 0 && (
                      <SourcesList sources={m.sources} />
                    )}
                  </div>
                ))}
                {/* Active task progress */}
                {activeTask && !activeTask.failed && (
                  <TaskProgress
                    taskId={activeTask.taskId}
                    taskTypeName={activeTask.taskTypeName}
                    progress={activeTask.progress}
                    steps={activeTask.steps}
                    costUsd={activeTask.costUsd}
                    onCancel={cancelTask}
                  />
                )}
                {activeTask?.failed && (
                  <TaskFailed taskTypeName={activeTask.taskTypeName} error={activeTask.failed} />
                )}
                {/* Loading messages from backend */}
                {loadingMessages && (
                  <StatusIndicator message="Cargando mensajes..." />
                )}
                {/* Status indicator while agent is processing */}
                {activeConvStatus?.statusMessage && !activeTask && (
                  <StatusIndicator message={activeConvStatus.statusMessage} />
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

        {/* Dev Panel */}
        {devPanelOpen && (
          <DevPanel
            logs={devLogs}
            connected={devLogsConnected}
            onClear={clearDevLogs}
            chatId={activeConversation?.backendChatId}
          />
        )}
      </div>

      {/* Inline spreadsheet viewer */}
      {sheetViewer && <SpreadsheetViewer data={sheetViewer} onClose={() => setSheetViewer(null)} inline />}
      </div>
    </div>
  );
}
