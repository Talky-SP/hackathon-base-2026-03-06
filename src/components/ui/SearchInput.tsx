import { Search, X } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** When set, shows as a read-only selected value with clear button. */
  selectedValue?: string;
  onClear?: () => void;
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function SearchInput({
  value,
  onChange,
  placeholder,
  selectedValue,
  onClear,
  className = '',
}: SearchInputProps) {
  if (selectedValue) {
    return (
      <div className={`relative ${className}`}>
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          readOnly
          value={selectedValue}
          className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white outline-none text-gray-800"
        />
        {onClear && (
          <button
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none placeholder:text-gray-500"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
