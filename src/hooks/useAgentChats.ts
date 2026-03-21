import { useState, useCallback, useRef } from 'react';
import type { ChartData, Source } from './useAgentChat';

// ── Types matching backend Chat API ──

export type BackendChat = {
  chat_id: string;
  location_id: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
  message_count: number;
};

export type BackendMessage = {
  id: number;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata: {
    type?: string;
    chart?: ChartData | boolean | null;
    sources?: Source[];
    sources_count?: number;
    model?: string;
  };
};

export type ChatCostSummary = {
  total_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
};

export type ChatCostByModel = {
  model: string;
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
};

export type ChatCostByStep = {
  step: string;
  calls: number;
  total_tokens: number;
  cost_usd: number;
};

export type ChatCosts = {
  chat_id: string;
  summary: ChatCostSummary;
  by_model: ChatCostByModel[];
  by_step: ChatCostByStep[];
};

const API_BASE = '/agent-api/api';

export function useAgentChats(locationId: string) {
  const [chats, setChats] = useState<BackendChat[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchChats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chats?location_id=${encodeURIComponent(locationId)}&limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChats(data.chats ?? []);
      fetchedRef.current = true;
    } catch (e) {
      console.warn('Failed to fetch chats:', e);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const fetchMessages = useCallback(async (chatId: string): Promise<BackendMessage[]> => {
    try {
      const res = await fetch(`${API_BASE}/chats/${chatId}/messages?limit=200`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.messages ?? [];
    } catch (e) {
      console.warn('Failed to fetch messages:', e);
      return [];
    }
  }, []);

  const deleteChat = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`${API_BASE}/chats/${chatId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setChats(prev => prev.filter(c => c.chat_id !== chatId));
      return true;
    } catch (e) {
      console.warn('Failed to delete chat:', e);
      return false;
    }
  }, []);

  const fetchChatCosts = useCallback(async (chatId: string): Promise<ChatCosts | null> => {
    try {
      const res = await fetch(`${API_BASE}/chats/${chatId}/costs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('Failed to fetch chat costs:', e);
      return null;
    }
  }, []);

  /** Update local chat list after a new message (optimistic) */
  const upsertChat = useCallback((chatId: string, title: string, model: string) => {
    setChats(prev => {
      const existing = prev.find(c => c.chat_id === chatId);
      if (existing) {
        return prev.map(c => c.chat_id === chatId
          ? { ...c, title: title || c.title, updated_at: Date.now() / 1000, message_count: c.message_count + 1 }
          : c
        );
      }
      return [{
        chat_id: chatId,
        location_id: locationId,
        title,
        model,
        created_at: Date.now() / 1000,
        updated_at: Date.now() / 1000,
        message_count: 1,
      }, ...prev];
    });
  }, [locationId]);

  return {
    chats,
    loading,
    fetchChats,
    fetchMessages,
    fetchChatCosts,
    deleteChat,
    upsertChat,
    hasFetched: fetchedRef.current,
  };
}
