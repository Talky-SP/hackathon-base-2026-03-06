import { useState, useRef, useCallback, useEffect } from 'react';

export type LogEntry = {
  ts: number;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  logger: string;
  message: string;
  event?: string;
  data?: Record<string, unknown>;
};

export type TraceEntry = {
  trace_id: string;
  chat_id?: string;
  task_id?: string;
  step: string;
  model: string;
  provider?: string;
  input?: {
    message_count?: number;
    tool_count?: number;
    last_user_message?: string;
    system_prompt_len?: number;
  };
  output?: {
    text?: string;
    finish_reason?: string;
  };
  tool_calls?: Array<{ id: string; name: string; arguments: string }>;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  status: 'ok' | 'error';
  error?: string;
  started_at: number;
  completed_at: number;
};

type UseDevLogsOptions = {
  enabled: boolean;
  maxEntries?: number;
  /** WS logs URL, or null if not available (AWS) */
  wsLogsUrl?: string | null;
  /** REST API base for traces/logs endpoints */
  apiBase?: string;
};

export function useDevLogs({ enabled, maxEntries = 500, wsLogsUrl, apiBase = '/agent-api/api' }: UseDevLogsOptions) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Resolve WS URL: explicit param, or derive from current host
    const url = wsLogsUrl ?? (() => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/agent-api/ws/logs`;
    })();
    if (!url) return; // not available (e.g. AWS)

    const ws = new WebSocket(url);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data) as LogEntry;
        setLogs(prev => {
          const next = [...prev, log];
          return next.length > maxEntries ? next.slice(-maxEntries) : next;
        });
      } catch { /* ignore */ }
    };

    ws.onerror = () => setConnected(false);

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (enabled) {
        reconnectTimer.current = setTimeout(() => connectRef.current(), 5000);
      }
    };

    wsRef.current = ws;
  }, [enabled, maxEntries, wsLogsUrl]);

  useEffect(() => { connectRef.current = connect; });

  const disconnectWs = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnectWs();
    }
    return () => {
      disconnectWs();
    };
  }, [enabled, connect, disconnectWs]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, connected, clearLogs };
}

export async function fetchChatTraces(chatId: string, apiBase = '/agent-api/api'): Promise<TraceEntry[]> {
  try {
    const res = await fetch(`${apiBase}/chats/${chatId}/traces`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.traces ?? [];
  } catch { return []; }
}

export async function fetchRecentLogs(limit = 100, apiBase = '/agent-api/api'): Promise<LogEntry[]> {
  try {
    const res = await fetch(`${apiBase}/logs?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.logs ?? [];
  } catch { return []; }
}
