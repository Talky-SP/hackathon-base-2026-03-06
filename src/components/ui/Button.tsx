import type { ReactNode, ButtonHTMLAttributes } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconOnly?: boolean;
  fullWidth?: boolean;
}

// ─── Style maps ────────────────────────────────────────────────────────────

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'text-white bg-brand-700 hover:bg-brand-500 border-transparent',
  secondary: 'text-brand-700 bg-brand-100 hover:bg-brand-500 hover:text-white border-transparent',
  ghost: 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 border-transparent',
  success: 'text-white bg-green-700 hover:bg-green-500 border-transparent',
  danger: 'text-red-700 hover:bg-red-100 border-transparent',
  outline: 'text-gray-500 bg-white border-gray-200 hover:bg-gray-100',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-3 py-2 text-sm gap-2',
};

const iconOnlySizes: Record<ButtonSize, string> = {
  xs: 'p-1',
  sm: 'p-1.5',
  md: 'p-2',
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconOnly = false,
  fullWidth = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
  const sizing = iconOnly ? iconOnlySizes[size] : sizeStyles[size];
  const width = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${base} ${variantStyles[variant]} ${sizing} ${width} ${className}`}
      {...rest}
    >
      {icon}
      {!iconOnly && children}
    </button>
  );
}
