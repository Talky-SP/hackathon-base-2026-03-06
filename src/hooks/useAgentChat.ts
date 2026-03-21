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

export type AgentResult = {
  type: 'direct_answer' | 'full_answer' | 'complex_task';
  answer: string;
  chart: ChartData | null;
  sources: Source[];
  intent: string;
  model_used: string;
};

export type AgentEvent = {
  type: 'event';
  event: 'step' | 'intent' | 'agent_start' | 'thinking' | 'querying' | 'query_result' | 'query_error' | 'analyzing' | 'agent_done';
  request_id?: string;
  message: string;
};

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

type UseAgentChatOptions = {
  locationId: string;
  onResult?: (result: AgentResult, requestId: string) => void;
  onEvent?: (event: AgentEvent) => void;
  onChatId?: (chatId: string, requestId: string) => void;
};

export function useAgentChat({ locationId, onResult, onEvent, onChatId }: UseAgentChatOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef(onResult);
  const onEventRef = useRef(onEvent);
  const onChatIdRef = useRef(onChatId);
  onResultRef.current = onResult;
  onEventRef.current = onEvent;
  onChatIdRef.current = onChatId;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionState('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/agent-api/ws/chat`);

    ws.onopen = () => {
      setConnectionState('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'chat_id') {
          onChatIdRef.current?.(msg.chat_id as string, msg.request_id ?? '');
        }

        if (msg.type === 'event') {
          const agentEvent = msg as AgentEvent;
          setStatusMessage(agentEvent.message || agentEvent.event);
          onEventRef.current?.(agentEvent);

          if (agentEvent.event === 'agent_done') {
            setStatusMessage(null);
          }
        }

        if (msg.type === 'result') {
          setIsProcessing(false);
          setStatusMessage(null);
          onResultRef.current?.(msg.data as AgentResult, msg.request_id ?? '');
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
  }, []);

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

  const sendMessage = useCallback((question: string, model: string, requestId?: string, chatId?: string | null) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Fallback to REST API
      sendViaRest(question, model, locationId, requestId);
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Clasificando intencion...');

    wsRef.current.send(JSON.stringify({
      question,
      location_id: locationId,
      model,
      chat_id: chatId ?? null,
      request_id: requestId ?? `req-${Date.now()}`,
    }));
  }, [locationId]);

  const sendViaRest = useCallback(async (question: string, model: string, locId: string, requestId?: string) => {
    setIsProcessing(true);
    setStatusMessage('Procesando...');

    try {
      const response = await fetch('/agent-api/api/chat', {
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
      setIsProcessing(false);
      setStatusMessage(null);
      onResultRef.current?.(data as AgentResult, requestId ?? '');
    } catch {
      setIsProcessing(false);
      setStatusMessage(null);
      // Return error as a direct_answer
      onResultRef.current?.({
        type: 'direct_answer',
        answer: 'No se pudo conectar con el servidor del agente. Asegurate de que el backend esta ejecutandose en localhost:8000.',
        chart: null,
        sources: [],
        intent: 'error',
        model_used: model,
      }, requestId ?? '');
    }
  }, []);

  return {
    sendMessage,
    connectionState,
    statusMessage,
    isProcessing,
    connect,
    disconnect,
  };
}
