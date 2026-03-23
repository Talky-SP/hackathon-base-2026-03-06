import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type AgentEnvId = 'local' | 'aws';

export type AgentEnv = {
  id: AgentEnvId;
  label: string;
  /** Base URL for REST API calls (e.g. '/agent-api/api' or 'https://...') */
  apiBase: string;
  /** Full WebSocket URL for chat, or null to build from current host */
  wsChat: string | null;
  /** Full WebSocket URL for logs, or null if unavailable */
  wsLogs: string | null;
  /** Whether location_id goes as WS query param (AWS) vs in message body (local) */
  locationInQuery: boolean;
};

const ENVS: Record<AgentEnvId, AgentEnv> = {
  local: {
    id: 'local',
    label: 'Local',
    apiBase: '/agent-api/api',
    wsChat: null, // built from current host: /agent-api/ws/chat
    wsLogs: null, // built from current host: /agent-api/ws/logs
    locationInQuery: false,
  },
  aws: {
    id: 'aws',
    label: 'AWS Dev',
    apiBase: 'https://qjgx7zjsma.execute-api.eu-west-3.amazonaws.com/api',
    wsChat: 'wss://buctm9ogkd.execute-api.eu-west-3.amazonaws.com/dev',
    wsLogs: null, // not available in AWS
    locationInQuery: true,
  },
};

type AgentEnvContextValue = {
  env: AgentEnv;
  envId: AgentEnvId;
  setEnvId: (id: AgentEnvId) => void;
  /** Resolved WS chat URL (with protocol for local) */
  getWsChatUrl: (locationId?: string) => string;
  /** Resolved WS logs URL or null if unavailable */
  getWsLogsUrl: () => string | null;
};

const AgentEnvContext = createContext<AgentEnvContextValue | null>(null);

export function AgentEnvProvider({ children }: { children: ReactNode }) {
  const [envId, setEnvId] = useState<AgentEnvId>(() => {
    const saved = localStorage.getItem('agent-env');
    return saved === 'aws' ? 'aws' : 'local';
  });

  const env = ENVS[envId];

  const handleSetEnvId = useCallback((id: AgentEnvId) => {
    setEnvId(id);
    localStorage.setItem('agent-env', id);
  }, []);

  const getWsChatUrl = useCallback((locationId?: string) => {
    if (env.wsChat) {
      // AWS — add location_id as query param
      const url = new URL(env.wsChat);
      if (locationId && env.locationInQuery) {
        url.searchParams.set('location_id', locationId);
      }
      return url.toString();
    }
    // Local — derive from current host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/agent-api/ws/chat`;
  }, [env]);

  const getWsLogsUrl = useCallback(() => {
    if (env.wsLogs) return env.wsLogs;
    if (env.id === 'local') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/agent-api/ws/logs`;
    }
    return null; // not available in AWS
  }, [env]);

  return (
    <AgentEnvContext.Provider value={{ env, envId, setEnvId: handleSetEnvId, getWsChatUrl, getWsLogsUrl }}>
      {children}
    </AgentEnvContext.Provider>
  );
}

export function useAgentEnv() {
  const ctx = useContext(AgentEnvContext);
  if (!ctx) throw new Error('useAgentEnv must be used within AgentEnvProvider');
  return ctx;
}
