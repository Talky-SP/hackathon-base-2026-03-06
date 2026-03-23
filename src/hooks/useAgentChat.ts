import { useState, useRef, useCallback, useEffect } from 'react';

// ── Types matching backend API ──

export type ChartData = {
  type: 'bar' | 'line' | 'pie' | 'table';
  title: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[] | unknown[][];
  }>;
};

export type Source = {
  categoryDate: string;
  supplier: string;
  supplier_cif: string;
  invoice_date: string;
  due_date: string;
  total: number;
  importe: number;
  reconciled: boolean;
  category: string;
  concept: string;
  total_bounding_box?: {
    Height: number;
    Left: number;
    Top: number;
    Width: number;
  };
};

export type TaskArtifact = {
  filename: string;
  type?: 'excel' | 'pdf' | string;
  size_bytes?: number;
  url?: string;
};

export type GeneratedFile = {
  filename: string;
  url: string;
  type: 'excel' | 'csv' | 'image' | 'pdf' | string;
};

export type TaskStep = {
  step_number: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  description: string;
};

export type TodoItem = {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'conciliacion' | 'facturacion' | 'nominas' | 'iva' | 'revision' | string;
  title: string;
  description: string;
  amount?: number | null;
  items_count?: number;
  blocking: boolean;
};

export type CloseStatus = 'CERRADO' | 'BLOQUEADO' | 'PENDIENTE';

export type AgentResult = {
  type: 'direct_answer' | 'full_answer' | 'complex_task';
  answer: string;
  chart: ChartData | null;
  sources: Source[];
  intent: string;
  model_used: string;
  artifacts?: TaskArtifact[];
  files?: GeneratedFile[];
  cost_usd?: number;
  todo?: TodoItem[];
  close_status?: CloseStatus;
};

export type AgentEvent = {
  type: 'event';
  event: 'step' | 'intent' | 'agent_start' | 'thinking' | 'tool_calls' | 'querying' | 'query_result' | 'query_error' | 'analyzing' | 'generating' | 'code_exec_start' | 'file_generated' | 'agent_done' | 'task_created' | 'task_progress' | 'task_completed' | 'task_failed' | 'task_cancelled' | 'cancelled' | 'dispatching_subagents' | 'dispatch_start' | 'subagent_start' | 'subagent_thinking' | 'subagent_query' | 'subagent_code' | 'subagent_complete' | 'subagent_result' | 'subagents_done' | (string & {});
  request_id?: string;
  message: string;
  [key: string]: unknown;
};

export type TaskCreatedEvent = {
  type: 'task_created';
  task_id: string;
  task_type: string;
  task_type_name: string;
  request_id?: string;
};

export type TaskProgressEvent = {
  type: 'task_progress';
  task_id: string;
  progress: number;
  step?: TaskStep | string;
  request_id?: string;
};

export type TaskCompletedEvent = {
  type: 'task_completed';
  task_id: string;
  request_id?: string;
  summary?: string;
  artifacts?: TaskArtifact[];
  cost_usd?: number;
};

export type TaskFailedEvent = {
  type: 'task_failed';
  task_id: string;
  error: string;
  request_id?: string;
};

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type RequestState = {
  statusMessage: string | null;
  currentEvent: AgentEvent['event'] | null;
};

/** Raw WebSocket message captured for developer debugging */
export type DevEvent = {
  id: number;
  ts: number;
  type: string;
  event?: string;
  requestId?: string;
  data: Record<string, unknown>;
};

type UseAgentChatOptions = {
  locationId: string;
  /** WebSocket URL for chat (from AgentEnvContext) */
  wsChatUrl: string;
  /** REST API base URL (from AgentEnvContext) */
  apiBase: string;
  /** Whether location_id is already in WS query params (AWS mode) */
  locationInWsQuery?: boolean;
  onResult?: (result: AgentResult, requestId: string) => void;
  onEvent?: (event: AgentEvent, requestId: string) => void;
  onChatId?: (chatId: string, requestId: string) => void;
  onTaskCreated?: (event: TaskCreatedEvent) => void;
  onTaskProgress?: (event: TaskProgressEvent) => void;
  onTaskCompleted?: (event: TaskCompletedEvent) => void;
  onTaskFailed?: (event: TaskFailedEvent) => void;
  onCancelled?: (requestId: string) => void;
};

export type WsAttachment = {
  filename: string;
  mime_type: string;
  data: string; // base64
};

export function useAgentChat({ locationId, wsChatUrl, apiBase, locationInWsQuery, onResult, onEvent, onChatId, onTaskCreated, onTaskProgress, onTaskCompleted, onTaskFailed, onCancelled }: UseAgentChatOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  // Per-request state tracking for parallel queries
  const [activeRequests, setActiveRequests] = useState<Record<string, RequestState>>({});
  // Dev event capture — every raw WS message for debugging
  const [devEvents, setDevEvents] = useState<DevEvent[]>([]);
  const devEventIdRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef(onResult);
  const onEventRef = useRef(onEvent);
  const onChatIdRef = useRef(onChatId);
  const onTaskCreatedRef = useRef(onTaskCreated);
  const onTaskProgressRef = useRef(onTaskProgress);
  const onTaskCompletedRef = useRef(onTaskCompleted);
  const onTaskFailedRef = useRef(onTaskFailed);
  const onCancelledRef = useRef(onCancelled);
  onResultRef.current = onResult;
  onEventRef.current = onEvent;
  onChatIdRef.current = onChatId;
  onTaskCreatedRef.current = onTaskCreated;
  onTaskProgressRef.current = onTaskProgress;
  onTaskCompletedRef.current = onTaskCompleted;
  onTaskFailedRef.current = onTaskFailed;
  onCancelledRef.current = onCancelled;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionState('connecting');
    const ws = new WebSocket(wsChatUrl);

    ws.onopen = () => {
      setConnectionState('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const reqId: string = msg.request_id ?? '';

        // Capture raw message for dev panel
        const devEvt: DevEvent = {
          id: ++devEventIdRef.current,
          ts: Date.now() / 1000,
          type: msg.type ?? 'unknown',
          event: msg.event,
          requestId: reqId || undefined,
          data: msg,
        };
        setDevEvents(prev => {
          const next = [...prev, devEvt];
          return next.length > 500 ? next.slice(-500) : next;
        });

        const updateReq = (statusMessage: string | null, currentEvent: AgentEvent['event'] | null) => {
          setActiveRequests(prev => {
            if (statusMessage === null && currentEvent === null) {
              // Remove request from active map
              const { [reqId]: _, ...rest } = prev;
              return rest;
            }
            return { ...prev, [reqId]: { statusMessage, currentEvent } };
          });
        };

        if (msg.type === 'chat_id') {
          onChatIdRef.current?.(msg.chat_id as string, reqId);
        }

        if (msg.type === 'event') {
          const agentEvent = msg as AgentEvent;
          if (agentEvent.event === 'agent_done') {
            updateReq(null, null);
          } else {
            updateReq(agentEvent.message || agentEvent.event, agentEvent.event);
          }
          onEventRef.current?.(agentEvent, reqId);
        }

        if (msg.type === 'task_created') {
          updateReq(msg.task_type_name ?? 'Ejecutando tarea...', 'task_created');
          onTaskCreatedRef.current?.(msg as TaskCreatedEvent);
        }

        if (msg.type === 'task_progress') {
          const step = (msg as TaskProgressEvent).step;
          const desc = typeof step === 'string' ? step : step?.description ?? `Progreso: ${msg.progress}%`;
          updateReq(desc, 'task_progress');
          onTaskProgressRef.current?.(msg as TaskProgressEvent);
        }

        if (msg.type === 'task_completed') {
          updateReq(null, null);
          onTaskCompletedRef.current?.(msg as TaskCompletedEvent);
        }

        if (msg.type === 'task_failed') {
          updateReq(null, null);
          onTaskFailedRef.current?.(msg as TaskFailedEvent);
        }

        if (msg.type === 'task_cancelled' || msg.type === 'cancelled') {
          updateReq(null, null);
          onCancelledRef.current?.(reqId);
        }

        if (msg.type === 'response') {
          // Inline query response — fields are directly on the message
          updateReq(null, null);
          const data: AgentResult = {
            type: 'full_answer',
            answer: msg.answer ?? '',
            chart: msg.chart ?? null,
            sources: msg.sources ?? [],
            intent: msg.intent ?? '',
            model_used: msg.model_used ?? '',
            artifacts: msg.artifacts,
            files: msg.files,
            cost_usd: msg.cost_usd,
            todo: msg.todo,
            close_status: msg.close_status,
          };
          onResultRef.current?.(data, reqId);
        }

        if (msg.type === 'result' || msg.type === 'final') {
          // Background task result — data nested in msg.data
          updateReq(null, null);
          const data = msg.data as AgentResult;
          // Merge top-level files into data.files (code execution responses)
          if (msg.data?.files && !data.files) {
            data.files = msg.data.files;
          }
          onResultRef.current?.(data, reqId);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      setConnectionState('error');
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      wsRef.current = null;
      // Reconnect after 3 seconds
      reconnectTimer.current = setTimeout(() => connect(), 3000);
    };

    wsRef.current = ws;
  }, [wsChatUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionState('disconnected');
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const sendMessage = useCallback((question: string, model: string, requestId?: string, chatId?: string | null, attachments?: WsAttachment[]) => {
    const rid = requestId ?? `req-${Date.now()}`;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Fallback to REST API
      sendViaRest(question, model, locationId, rid);
      return;
    }

    setActiveRequests(prev => ({
      ...prev,
      [rid]: { statusMessage: 'Clasificando intencion...', currentEvent: 'step' },
    }));

    const payload: Record<string, unknown> = {
      question,
      model,
      chat_id: chatId ?? null,
      request_id: rid,
    };
    // In local mode, location_id goes in every message; in AWS it's in the WS query param
    if (!locationInWsQuery) {
      payload.location_id = locationId;
    }
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments;
    }
    wsRef.current.send(JSON.stringify(payload));
  }, [locationId, locationInWsQuery]);

  const cancelChat = useCallback((chatId?: string, taskId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'cancel',
      chat_id: chatId ?? null,
      task_id: taskId ?? null,
    }));
  }, []);

  const sendViaRest = useCallback(async (question: string, model: string, locId: string, requestId: string) => {
    setActiveRequests(prev => ({
      ...prev,
      [requestId]: { statusMessage: 'Procesando...', currentEvent: 'step' },
    }));

    try {
      const response = await fetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          location_id: locId,
          model,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setActiveRequests(prev => { const { [requestId]: _, ...rest } = prev; return rest; });
      onResultRef.current?.(data as AgentResult, requestId);
    } catch {
      setActiveRequests(prev => { const { [requestId]: _, ...rest } = prev; return rest; });
      onResultRef.current?.({
        type: 'direct_answer',
        answer: 'No se pudo conectar con el servidor del agente. Asegurate de que el backend esta ejecutandose en localhost:8000.',
        chart: null,
        sources: [],
        intent: 'error',
        model_used: model,
      }, requestId);
    }
  }, [apiBase]);

  const clearDevEvents = useCallback(() => setDevEvents([]), []);

  // Derived convenience values (any request active = processing)
  const isProcessing = Object.keys(activeRequests).length > 0;

  return {
    sendMessage,
    cancelChat,
    connectionState,
    activeRequests,
    isProcessing,
    devEvents,
    clearDevEvents,
    connect,
    disconnect,
  };
}
