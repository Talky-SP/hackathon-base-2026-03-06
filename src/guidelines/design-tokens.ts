/**
 * Design Tokens - Evals Platform
 *
 * Single source of truth for all design decisions.
 * Import from here when building components.
 */

export const colors = {
  brand: {
    primary: '#F97316',       // orange-500 — buttons, accents, active states
    primaryHover: '#EA580C',  // orange-600 — hover on primary buttons
    primaryLight: '#FFF7ED',  // orange-50  — subtle backgrounds, badges
    primaryMuted: '#FFEDD5',  // orange-100 — borders on highlighted elements
  },
  text: {
    primary: '#111827',       // gray-900 — headings, primary text
    secondary: '#6B7280',     // gray-500 — descriptions, placeholders
    tertiary: '#9CA3AF',      // gray-400 — disabled, hints
    inverse: '#FFFFFF',       // white    — text on brand buttons
  },
  surface: {
    page: '#F9FAFB',          // gray-50  — page background
    card: '#FFFFFF',          // white    — cards, modals, inputs
    border: '#E5E7EB',        // gray-200 — default borders
    borderLight: '#F3F4F6',   // gray-100 — subtle dividers
  },
  feedback: {
    error: '#DC2626',         // red-600
    errorBg: '#FEF2F2',      // red-50
    errorBorder: '#FECACA',   // red-200
    success: '#16A34A',       // green-600
    successBg: '#F0FDF4',     // green-50
    info: '#2563EB',          // blue-600
    infoBg: '#EFF6FF',        // blue-50
    infoBorder: '#BFDBFE',    // blue-200
  },
} as const;

export const typography = {
  heading: 'font-semibold text-gray-900',
  body: 'text-gray-600',
  caption: 'text-sm text-gray-500',
  link: 'text-brand-500 hover:text-brand-600 font-medium transition-colors',
} as const;

export const spacing = {
  inputPadding: 'px-4 py-3',
  cardPadding: 'p-8',
  sectionGap: 'space-y-6',
} as const;

export const radii = {
  input: 'rounded-xl',
  button: 'rounded-xl',
  card: 'rounded-2xl',
  badge: 'rounded-md',
  avatar: 'rounded-full',
} as const;

export const shadows = {
  card: 'shadow-none',
  dropdown: 'shadow-lg',
} as const;

export const logo = {
  url: 'https://talky-product-image-v2-dev-6136.s3.eu-west-3.amazonaws.com/web/Full+Talky+Logo+(2).png',
  altText: 'Talky Logo',
} as const;
