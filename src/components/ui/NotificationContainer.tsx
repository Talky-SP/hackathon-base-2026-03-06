import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { useNotification, type NotificationVariant } from '../../contexts/NotificationContext';

// ─── Variant config ─────────────────────────────────────────────────────────

const variantStyles: Record<NotificationVariant, { bg: string; icon: typeof CheckCircle }> = {
  success: { bg: 'bg-green-100 border-green-500 text-green-700', icon: CheckCircle },
  error:   { bg: 'bg-red-100 border-red-500 text-red-700',       icon: XCircle },
  info:    { bg: 'bg-blue-100 border-blue-500 text-blue-700',     icon: Info },
  warning: { bg: 'bg-yellow-100 border-yellow-500 text-yellow-700', icon: AlertTriangle },
};

// ─── Single toast ───────────────────────────────────────────────────────────

function Toast({ id, message, variant }: { id: string; message: string; variant: NotificationVariant }) {
  const { dismiss } = useNotification();
  const [visible, setVisible] = useState(false);
  const style = variantStyles[variant];
  const Icon = style.icon;

  // Enter animation
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      onClick={() => dismiss(id)}
      className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border shadow-sm cursor-pointer transition-all duration-200 ${style.bg} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <Icon size={16} className="shrink-0 mt-0.5" />
      <p className="flex-1 text-sm leading-snug">{message}</p>
    </div>
  );
}

// ─── Container ──────────────────────────────────────────────────────────────

export default function NotificationContainer() {
  const { notifications } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 flex flex-col gap-2">
      {notifications.map((n) => (
        <Toast key={n.id} id={n.id} message={n.message} variant={n.variant} />
      ))}
    </div>
  );
}
