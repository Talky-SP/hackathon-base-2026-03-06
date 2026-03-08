import { X } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'xs' | 'sm';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  removable?: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
  className?: string;
}

// ─── Style maps ────────────────────────────────────────────────────────────

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-800',
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-[10px] px-1.5 py-0.5',
  sm: 'text-xs px-2 py-0.5',
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function Badge({
  variant = 'neutral',
  size = 'xs',
  removable = false,
  onRemove,
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold rounded ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
      {removable && onRemove && (
        <button
          type="button"
          className="hover:opacity-70"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <X size={size === 'xs' ? 10 : 12} />
        </button>
      )}
    </span>
  );
}
