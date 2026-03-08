import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Tag, X, Search } from 'lucide-react';
import { useFieldErrorTag } from '../../contexts/FieldErrorTagContext';
import { useLanguage } from '../../i18n/LanguageContext';

// ─── Error Tag List (rendered below field input) ─────────────────────────────

export function FieldErrorTagList({ fieldName }: { fieldName: string }) {
  const { fieldErrorTags, removeErrorTagFromField } = useFieldErrorTag();
  const tags = fieldErrorTags[fieldName];
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border bg-brand-100 border-brand-500 text-brand-700"
        >
          {label}
          <button
            type="button"
            className="hover:text-brand-700"
            onClick={(e) => { e.stopPropagation(); removeErrorTagFromField(fieldName, label); }}
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Error Tag Button + Dropdown ─────────────────────────────────────────────

export function FieldErrorTagButton({ fieldName, iconSize = 12, externalOpen }: { fieldName: string; iconSize?: number; externalOpen?: boolean }) {
  const { search, addErrorTagToField, openFieldName, clearOpenFieldName } = useFieldErrorTag();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  // Allow parent to open the dropdown
  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const results = search(query);

  // Open via Ctrl+E (context signals openFieldName)
  useEffect(() => {
    if (openFieldName === fieldName) {
      setOpen(true);
      clearOpenFieldName();
    }
  }, [openFieldName, fieldName, clearOpenFieldName]);

  // Position dropdown relative to button when opening
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.right - 208 }); // 208 = w-52 (13rem)
    }
  }, [open]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setQuery('');
      setHighlightIdx(0);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = useCallback((label: string) => {
    addErrorTagToField(fieldName, label);
    setOpen(false);
  }, [addErrorTagToField, fieldName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) {
        select(results[highlightIdx] ?? results[0]);
      } else if (query.trim()) {
        select(query.trim());
      }
    }
  };

  // Reset highlight when results change
  useEffect(() => {
    setHighlightIdx(0);
  }, [results.length]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="p-0.5 text-gray-500 hover:text-brand-500 transition-colors"
        title={t('annotation.tag.add')}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <Tag size={iconSize} />
      </button>

      {open && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-52 bg-white border border-gray-200 rounded-md shadow-lg z-[9999]"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100">
            <Search size={12} className="text-gray-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('annotation.tag.searchOrCreate')}
              className="w-full text-xs outline-none placeholder:text-gray-500"
            />
          </div>
          <div className="max-h-[180px] overflow-y-auto">
            {results.length > 0 ? (
              results.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={`w-full text-left px-2 py-1 text-xs hover:bg-brand-100 ${i === highlightIdx ? 'bg-brand-100 text-brand-700' : 'text-gray-800'}`}
                  onMouseEnter={() => setHighlightIdx(i)}
                  onClick={() => select(label)}
                >
                  {label}
                </button>
              ))
            ) : query.trim() ? (
              <button
                type="button"
                className="w-full text-left px-2 py-1 text-xs text-brand-700 hover:bg-brand-100"
                onClick={() => select(query.trim())}
              >
                {t('annotation.tag.create')} "{query.trim()}"
              </button>
            ) : (
              <div className="px-2 py-1 text-xs text-gray-500">{t('annotation.tag.noErrorTags')}</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
