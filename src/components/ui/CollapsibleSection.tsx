import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

type CollapsibleSize = 'sm' | 'md';

interface CollapsibleSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  /** Summary text shown when collapsed. */
  summary?: string;
  /** Render function for a badge after the title. Receives hover state of the header. */
  badge?: (hovered: boolean) => React.ReactNode;
  size?: CollapsibleSize;
  children: React.ReactNode;
  className?: string;
}

// ─── Size maps ─────────────────────────────────────────────────────────────

const titleStyles: Record<CollapsibleSize, string> = {
  sm: 'text-[10px] font-semibold text-gray-500 uppercase',
  md: 'text-xs font-semibold text-gray-800',
};

const buttonStyles: Record<CollapsibleSize, string> = {
  sm: 'w-full flex items-center gap-1 py-0.5',
  md: 'w-full flex items-center gap-1.5 py-1',
};

const chevronSizes: Record<CollapsibleSize, number> = {
  sm: 10,
  md: 12,
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function CollapsibleSection({
  title,
  expanded,
  onToggle,
  summary,
  badge,
  size = 'md',
  children,
  className = '',
}: CollapsibleSectionProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <section className={className}>
      <button
        type="button"
        onClick={onToggle}
        className={buttonStyles[size]}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <ChevronRight
          size={chevronSizes[size]}
          className={`text-gray-500 transition-transform duration-200 shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
        <span className={titleStyles[size]}>{title}</span>
        {badge?.(hovered)}
      </button>
      {expanded ? (
        children
      ) : summary ? (
        <p className="ml-4 text-[10px] text-gray-500">{summary}</p>
      ) : null}
    </section>
  );
}
