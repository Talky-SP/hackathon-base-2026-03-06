import { useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ContextMenu({ visible, x, y, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    if (!visible) return;
    const dismiss = () => onClose();
    window.addEventListener('click', dismiss);
    return () => window.removeEventListener('click', dismiss);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{ top: y, left: x }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
            item.danger
              ? 'text-red-700 hover:bg-red-100'
              : 'text-gray-800 hover:bg-gray-100'
          }`}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
