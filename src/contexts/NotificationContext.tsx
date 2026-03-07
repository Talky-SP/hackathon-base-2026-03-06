import { createContext, useContext, useState, useCallback, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotificationVariant = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  message: string;
  variant: NotificationVariant;
  timeout: number;
}

interface NotifyOptions {
  variant?: NotificationVariant;
  timeout?: number;
}

interface NotificationContextValue {
  notifications: Notification[];
  notify: (message: string, options?: NotifyOptions) => void;
  dismiss: (id: string) => void;
}

const MAX_VISIBLE = 3;
const DEFAULT_TIMEOUT = 1750;

// ─── Context ────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback((message: string, options?: NotifyOptions) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const variant = options?.variant ?? 'info';
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    const notification: Notification = { id, message, variant, timeout };

    setNotifications((prev) => {
      const next = [...prev, notification];
      // Evict oldest if over max
      while (next.length > MAX_VISIBLE) {
        const evicted = next.shift()!;
        const timer = timersRef.current.get(evicted.id);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(evicted.id);
        }
      }
      return next;
    });

    // Auto-dismiss after timeout
    const timer = setTimeout(() => {
      timersRef.current.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, timeout);
    timersRef.current.set(id, timer);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
    </NotificationContext.Provider>
  );
}
