import React, { useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import { useTaskPanel, type TaskItem } from '../../../context/TaskPanelContext';

export type FloatingAIChatProps = {
  placeholder?: string;
  initialMinimized?: boolean;
  onSendMessage?: (message: string) => void;
  onAddRequest?: (context?: string) => void;
  onDockChange?: (docked: boolean) => void;
  onCreateModeChange?: (creating: boolean) => void;
};

export type FloatingAIChatHandle = {
  openCreateModeDocked: () => void;
  minimize: () => void;
  float: () => void;
};

const TALKY_ICON_URL =
  'https://talky-product-image-v2-dev-6136.s3.eu-west-3.amazonaws.com/Talky-Chat-Icon.png';
const ADD_ICON_URL =
  'https://talky-product-image-v2-dev-6136.s3.eu-west-3.amazonaws.com/Add-Talky-Chat-Icon.png';
const PENCIL_ICON_URL =
  'https://talky-product-image-v2-dev-6136.s3.eu-west-3.amazonaws.com/Talky-Pencil-Icon.png';

const suggestionPills = [
  '¿Cómo cerraron las ventas hoy?',
  'Explica variación del margen bruto',
  'Añade gráfico: Ingresos vs Gastos',
];

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };
type ChatPickItem = { id: string; title: string; type?: string };

const FloatingAIChat = forwardRef<FloatingAIChatHandle, FloatingAIChatProps>(({
  placeholder = 'Pregunta o busca insights... ',
  initialMinimized = false,
  onSendMessage,
  onDockChange,
  onCreateModeChange,
}, ref) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(initialMinimized);
  const [message, setMessage] = useState<string>('');
  const [isDocked, setIsDocked] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isCreateMode, setIsCreateMode] = useState<boolean>(false);
  const [activeDockTab, setActiveDockTab] = useState<'chat' | 'tasks'>('chat');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [attachedItems, setAttachedItems] = useState<ChatPickItem[]>([]);
  const [availableItems, setAvailableItems] = useState<ChatPickItem[]>([]);
  const [showAddDropdown, setShowAddDropdown] = useState<boolean>(false);
  const [mentionQuery, setMentionQuery] = useState<string>('');
  const [showMentionList, setShowMentionList] = useState<boolean>(false);

  const canSend = useMemo(() => message.trim().length > 0, [message]);

  const { scopes, openTask } = useTaskPanel();
  const tasksAll = useMemo(() => {
    const out: TaskItem[] = [];
    for (const s of Object.values(scopes)) out.push(...(s.tasks || []));
    return out;
  }, [scopes]);
  const pendingTasksCount = tasksAll.length;

  const splitTaskMeta = useCallback((meta?: string | null) => {
    const raw = String(meta || '').trim();
    if (!raw) return { date: null as string | null, amount: null as string | null, rest: null as string | null };
    const parts = raw.split('·').map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const date = parts[0] || null;
      const amount = parts[parts.length - 1] || null;
      const rest = parts.slice(1, -1).join(' · ') || null;
      return { date, amount, rest };
    }
    return { date: raw, amount: null, rest: null };
  }, []);

  useImperativeHandle(ref, () => ({
    openCreateModeDocked: () => {
      setIsDocked(true);
      setIsMinimized(false);
      setIsCreateMode(true);
      onDockChange?.(true);
      onCreateModeChange?.(true);
      setTimeout(() => inputRef.current?.focus(), 10);
    },
    minimize: () => {
      setIsDocked(false);
      setIsMinimized(true);
      onDockChange?.(false);
    },
    float: () => {
      setIsDocked(false);
      setIsMinimized(false);
      onDockChange?.(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    },
  }), [onDockChange, onCreateModeChange]);

  const openTasksDocked = useCallback(() => {
    setIsDocked(true);
    setIsMinimized(false);
    setActiveDockTab('tasks');
    onDockChange?.(true);
  }, [onDockChange]);

  // Escuchar eventos globales para registrar y añadir elementos desde los charts
  useEffect(() => {
    const handleRegister = (e: Event) => {
      const ce = e as CustomEvent;
      const item = ce.detail as ChatPickItem | undefined;
      if (!item || !item.id) return;
      setAvailableItems((prev) => {
        if (prev.some((p) => p.id === item.id)) return prev;
        return [...prev, item];
      });
    };
    const handleAdd = (e: Event) => {
      const ce = e as CustomEvent;
      const item = ce.detail as ChatPickItem | undefined;
      if (!item || !item.id) return;
      setAttachedItems((prev) => (prev.some((p) => p.id === item.id) ? prev : [...prev, item]));
      setIsDocked(true);
      setIsMinimized(false);
      onDockChange?.(true);
      // Traer foco al input
      setTimeout(() => inputRef.current?.focus(), 10);
    };
    window.addEventListener('talky:register', handleRegister as EventListener);
    window.addEventListener('talky:add', handleAdd as EventListener);
    return () => {
      window.removeEventListener('talky:register', handleRegister as EventListener);
      window.removeEventListener('talky:add', handleAdd as EventListener);
    };
  }, [onDockChange]);

  const removeAttached = useCallback((id: string) => {
    setAttachedItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const filteredAvailable = useMemo(() => {
    if (!mentionQuery) return availableItems;
    const q = mentionQuery.toLowerCase();
    return availableItems.filter((i) => i.title.toLowerCase().includes(q));
  }, [availableItems, mentionQuery]);

  const handleToggle = useCallback(() => {
    setIsMinimized((prev) => !prev);
    // Enfocar input al expandir
    setTimeout(() => inputRef.current?.focus(), 10);
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = message.trim();
      if (!text) return;
      onSendMessage?.(text);
      // Añadir mensaje a la conversación y acoplar como sidebar
      const newMsg: ChatMessage = { id: `${Date.now()}`,'role':'user','content': text };
      setMessages((prev) => [...prev, newMsg]);
      setMessage('');
      setIsDocked(true);
      setIsMinimized(false);
      setActiveDockTab('chat');
      onDockChange?.(true);
    },
    [message, onSendMessage, onDockChange]
  );

  const handleAdd = useCallback(() => {
    // Abrir/cerrar dropdown de selección
    setShowAddDropdown((prev) => !prev);
  }, []);

  // Inserción de mención al escribir @
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessage(val);
    const atIndex = val.lastIndexOf('@');
    if (atIndex >= 0) {
      const after = val.slice(atIndex + 1);
      // Parar si hay espacio o salto después de @
      if (/^[^\s@]*$/.test(after)) {
        setMentionQuery(after);
        setShowMentionList(true);
        return;
      }
    }
    setShowMentionList(false);
    setMentionQuery('');
  }, []);

  const insertMention = useCallback((item: ChatPickItem) => {
    // Reemplazar el último patrón @texto por @Título
    const atIndex = message.lastIndexOf('@');
    if (atIndex >= 0) {
      const before = message.slice(0, atIndex);
      const newVal = `${before}@${item.title} `;
      setMessage(newVal);
    }
    setShowMentionList(false);
    setMentionQuery('');
  }, [message]);

  const attachFromList = useCallback((item: ChatPickItem) => {
    setAttachedItems((prev) => (prev.some((p) => p.id === item.id) ? prev : [...prev, item]));
    setShowAddDropdown(false);
  }, []);

  if (isMinimized && !isDocked) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          type="button"
          title="Abrir asistente"
          onClick={handleToggle}
          className="relative inline-flex items-center justify-center h-16 w-16 rounded-full bg-neutral-900/40 border border-neutral-700/40 backdrop-blur hover:bg-neutral-900/60 hover:border-neutral-700/60 shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400/60"
        >
          <img
            src={TALKY_ICON_URL}
            alt="Talky Chat"
            className="h-10 w-10 select-none"
            draggable={false}
          />
          {pendingTasksCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-orange-500 text-white text-xs font-semibold border border-white">
              {pendingTasksCount > 99 ? '99+' : pendingTasksCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  // Vista acoplada (sidebar derecha)
  if (isDocked) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-[560px] max-w-[100vw]">
        <div className="h-full flex flex-col border-l border-neutral-200 bg-white shadow-2xl pb-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-neutral-200 bg-white/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <img src={TALKY_ICON_URL} alt="Talky" className="h-6 w-6" />
              <span className="text-sm font-medium text-neutral-800">Talky AI</span>
              {isCreateMode && (
                <span className="ml-1 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                  Modo crear
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDocked(false);
                  setIsMinimized(false);
                  onDockChange?.(false);
                  setTimeout(() => inputRef.current?.focus(), 10);
                }}
                className="rounded-full px-3 py-1.5 text-xs border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                title="Volver a flotante"
              >
                Flotante
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreateMode((prev) => {
                    const next = !prev;
                    onCreateModeChange?.(next);
                    return next;
                  });
                }}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${
                  isCreateMode ? 'border-orange-400 bg-orange-50' : 'border-neutral-300 hover:bg-neutral-50'
                }`}
                title="Crear gráficas personalizadas"
              >
                <img src={PENCIL_ICON_URL} alt="Crear" className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={() => setActiveDockTab((t) => (t === 'tasks' ? 'chat' : 'tasks'))}
                className={`relative inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${
                  activeDockTab === 'tasks'
                    ? 'border-orange-300 bg-orange-50 text-orange-700'
                    : 'border-neutral-300 hover:bg-neutral-50 text-neutral-700'
                }`}
                title="Abrir tareas"
              >
                <ClipboardList className="h-4 w-4" />
                <span>Tareas</span>
                {pendingTasksCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[11px] font-bold">
                    {pendingTasksCount > 99 ? '99+' : pendingTasksCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDocked(false);
                  setIsMinimized(true);
                  onDockChange?.(false);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 hover:bg-neutral-50"
                title="Minimizar"
              >
                <img src={TALKY_ICON_URL} alt="Minimizar" className="h-5 w-5" />
              </button>
            </div>
          </div>
          {/* Body */}
          <div className="flex-1 overflow-auto px-4 py-4 bg-neutral-50">
            {activeDockTab === 'chat' ? (
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-neutral-500 text-sm mt-6">Comienza tu conversación…</div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                      <div
                        className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          m.role === 'user'
                            ? 'bg-orange-500 text-white'
                            : 'bg-white border border-neutral-200 text-neutral-800'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-neutral-900">Tareas pendientes</div>
                  <div className="text-xs text-neutral-500">{pendingTasksCount}</div>
                </div>
                {pendingTasksCount === 0 ? (
                  <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-6 text-center">
                    <div className="text-sm font-medium text-neutral-800">Todo al día</div>
                    <div className="mt-1 text-xs text-neutral-500">Cuando haya revisiones pendientes aparecerán aquí.</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(scopes)
                      .filter(([, s]) => (s.tasks || []).length > 0)
                      // Ordenar por proveedor/sección (como en BankReconciliation), no por updatedAt
                      .sort((a, b) => {
                        const at = String(a[1].scopeTitle || a[0]).trim();
                        const bt = String(b[1].scopeTitle || b[0]).trim();
                        return at.localeCompare(bt, 'es', { sensitivity: 'base' });
                      })
                      .map(([scopeKey, scopeState]) => (
                        <div key={scopeKey} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-neutral-100 bg-white">
                            <div className="text-xs font-semibold text-neutral-800">
                              {scopeState.scopeTitle || 'Tareas'}
                            </div>
                          </div>
                          <div className="divide-y divide-neutral-100">
                            {(scopeState.tasks || []).map((t) => {
                              const m = splitTaskMeta(t.meta);
                              const diffPct = t.extra?.differencePercent;
                              const hasRecWarningTask = t.action?.type === 'bank_reconciliation:reconciliation_warning';

                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => openTask(t)}
                                  className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors"
                                  title="Abrir"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        {hasRecWarningTask && (
                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                        )}
                                        <div className="text-sm font-medium text-neutral-900 truncate">{t.title}</div>
                                      </div>
                                      {t.description && hasRecWarningTask && (
                                        <div className="text-xs text-amber-600 mt-0.5">{t.description}</div>
                                      )}
                                      {m.date && (
                                        <div className="text-xs text-neutral-500">{m.date}</div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {diffPct != null && (
                                        <span className="text-xs text-neutral-500">{diffPct.toFixed(1)}%</span>
                                      )}
                                      {m.amount && (
                                        <span className="text-sm font-semibold text-neutral-900">{m.amount}</span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Adjuntos seleccionados */}
          {attachedItems.length > 0 && (
            <div className="px-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                {attachedItems.map((it) => (
                  <div key={it.id} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs bg-white shadow-sm" style={{ borderColor: '#f59e0b' }}>
                    <span className="text-gray-800">{it.title}</span>
                    <button type="button" className="rounded-full w-5 h-5 inline-flex items-center justify-center hover:bg-orange-50" title="Quitar" onClick={() => removeAttached(it.id)}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-gray-600">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Input */}
          {activeDockTab === 'chat' ? (
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2 px-3 py-3 border-t border-neutral-200 bg-white">
            <input
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              placeholder={placeholder}
              className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
            />
            {/* Menú menciones */}
            {showMentionList && filteredAvailable.length > 0 && (
              <div className="absolute left-3 right-24 bottom-[56px] z-10 rounded-lg border bg-white shadow-lg max-h-56 overflow-auto" style={{ borderColor: '#fde68a' }}>
                {filteredAvailable.map((it) => (
                  <button key={`m-${it.id}`} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50" onClick={() => insertMention(it)}>
                    {it.title}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleAdd}
              title="Añadir a tu panel"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white hover:bg-neutral-50"
            >
              <img src={ADD_ICON_URL} alt="Añadir" className="h-7 w-7" />
            </button>
            {/* Dropdown de añadir */}
            {showAddDropdown && (
              <div className="absolute right-14 bottom-[56px] z-20 w-64 max-h-72 overflow-auto rounded-lg border bg-white shadow-xl" style={{ borderColor: '#fde68a' }}>
                <div className="px-3 py-2 text-xs text-gray-500">Añadir al mensaje</div>
                {availableItems.length === 0 && <div className="px-3 py-2 text-sm text-gray-600">No hay elementos disponibles</div>}
                {availableItems.map((it) => (
                  <button key={it.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50" onClick={() => attachFromList(it)}>
                    {it.title}
                  </button>
                ))}
              </div>
            )}
            <button
              type="submit"
              disabled={!canSend}
              title="Enviar"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
                canSend ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-500/50 cursor-not-allowed'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className="h-5 w-5 text-white"
              >
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
          ) : (
            <div className="px-3 py-3 border-t border-neutral-200 bg-white">
              <button
                type="button"
                onClick={() => setActiveDockTab('chat')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                title="Volver al chat"
              >
                Volver al chat
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista flotante centrada inferior
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4">
      {/* Contenedor del chat */}
      <div className="rounded-2xl border border-neutral-800/70 bg-neutral-900/95 text-white shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-neutral-900/80">
        {/* Píldoras de sugerencias */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2" style={{ scrollbarWidth: 'none' }}>
            {suggestionPills.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => setMessage(text)}
                className="shrink-0 rounded-full border border-neutral-700 bg-neutral-800/80 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 hover:border-neutral-600"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
        {/* Barra de entrada */}
        <form onSubmit={handleSubmit} className="relative flex items-center gap-3 px-3 pb-3">
          {/* Botón minimizar con logo */}
          <button
            type="button"
            onClick={handleToggle}
            title="Minimizar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 hover:bg-neutral-700"
          >
            <img src={TALKY_ICON_URL} alt="Talky" className="h-6 w-6" />
          </button>

          {/* Botón modo crear (lápiz) */}
          <button
            type="button"
            onClick={() => {
              setIsCreateMode((prev) => {
                const next = !prev;
                onCreateModeChange?.(next);
                return next;
              });
            }}
            title="Crear gráficas personalizadas"
            className={`inline-flex h-12 w-12 items-center justify-center rounded-full border ${
              isCreateMode ? 'border-orange-400 bg-neutral-800/80' : 'border-neutral-700 bg-neutral-800 hover:bg-neutral-700'
            }`}
          >
            <img src={PENCIL_ICON_URL} alt="Crear" className="h-8 w-8" />
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            placeholder={placeholder}
            aria-label="Escribe tu mensaje para la IA"
            className="flex-1 bg-transparent text-base placeholder-neutral-400 outline-none"
          />
          {/* Menciones en flotante */}
          {showMentionList && filteredAvailable.length > 0 && (
            <div className="absolute left-12 right-28 bottom-[56px] z-20 rounded-lg border bg-white text-neutral-900 shadow-xl max-h-56 overflow-auto" style={{ borderColor: '#fde68a' }}>
              {filteredAvailable.map((it) => (
                <button key={`mf-${it.id}`} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50" onClick={() => insertMention(it)}>
                  {it.title}
                </button>
              ))}
            </div>
          )}

          {/* Botón añadir */}
          <button
            type="button"
            onClick={handleAdd}
            title="Añadir a tu panel"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <img src={ADD_ICON_URL} alt="Añadir" className="h-8 w-8" />
          </button>
          {/* Dropdown añadir (flotante) */}
          {showAddDropdown && (
            <div className="absolute right-16 bottom-[56px] z-20 w-64 max-h-72 overflow-auto rounded-lg border bg-white text-neutral-900 shadow-xl" style={{ borderColor: '#fde68a' }}>
              <div className="px-3 py-2 text-xs text-gray-500">Añadir al mensaje</div>
              {availableItems.length === 0 && <div className="px-3 py-2 text-sm text-gray-700">No hay elementos disponibles</div>}
              {availableItems.map((it) => (
                <button key={`af-${it.id}`} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50" onClick={() => attachFromList(it)}>
                  {it.title}
                </button>
              ))}
            </div>
          )}

          {/* Botón enviar naranja */}
          <button
            type="submit"
            title="Enviar"
            disabled={!canSend}
            className={`inline-flex h-12 w-12 items-center justify-center rounded-full focus:outline-none focus:ring-2 ${
              canSend
                ? 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-300'
                : 'bg-orange-500/50 cursor-not-allowed'
            }`}
          >
            {/* Icono flecha hacia arriba */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="h-6 w-6 text-white"
            >
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
        {/* Indicador de tareas (debajo, estilo minimal como el chat) */}
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={openTasksDocked}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800/70 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-700 hover:border-neutral-600 flex items-center justify-between"
            title="Ver tareas pendientes"
          >
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-neutral-200" />
              <span>Tareas pendientes</span>
            </span>
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-orange-500 text-white text-[11px] font-bold">
              {pendingTasksCount > 99 ? '99+' : pendingTasksCount}
            </span>
          </button>
        </div>
      </div>
      {/* Adjuntos chips en flotante */}
      {attachedItems.length > 0 && (
        <div className="mt-2 px-2">
          <div className="flex flex-wrap items-center gap-2 justify-center">
            {attachedItems.map((it) => (
              <div key={`f-${it.id}`} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs bg-white/95 text-neutral-900 shadow-sm" style={{ borderColor: '#f59e0b' }}>
                <span>{it.title}</span>
                <button type="button" className="rounded-full w-5 h-5 inline-flex items-center justify-center hover:bg-orange-50" title="Quitar" onClick={() => removeAttached(it.id)}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-gray-700">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default FloatingAIChat;


