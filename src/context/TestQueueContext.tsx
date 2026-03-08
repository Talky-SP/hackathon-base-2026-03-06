import { createContext, useContext, useState, useCallback } from 'react';
import type { TestQueueItem } from '../types/golden';

interface TestQueueContextValue {
  items: TestQueueItem[];
  addItem: (item: TestQueueItem) => void;
  removeItem: (id: string) => void;
  clearQueue: () => void;
  isInQueue: (id: string) => boolean;
  toggleItem: (item: TestQueueItem) => void;
}

const TestQueueContext = createContext<TestQueueContextValue | null>(null);

export function TestQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<TestQueueItem[]>([]);

  const addItem = useCallback((item: TestQueueItem) => {
    setItems(prev => {
      if (prev.some(i => i.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const clearQueue = useCallback(() => setItems([]), []);

  const isInQueue = useCallback((id: string) => items.some(i => i.id === id), [items]);

  const toggleItem = useCallback((item: TestQueueItem) => {
    setItems(prev => {
      if (prev.some(i => i.id === item.id)) {
        return prev.filter(i => i.id !== item.id);
      }
      return [...prev, item];
    });
  }, []);

  return (
    <TestQueueContext.Provider value={{ items, addItem, removeItem, clearQueue, isInQueue, toggleItem }}>
      {children}
    </TestQueueContext.Provider>
  );
}

export function useTestQueue() {
  const ctx = useContext(TestQueueContext);
  if (!ctx) throw new Error('useTestQueue must be used within TestQueueProvider');
  return ctx;
}
