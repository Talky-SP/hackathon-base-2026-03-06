import { useState, useRef, useEffect, useCallback } from 'react';
import { Tag, X, Search } from 'lucide-react';
import { useFieldAnnotation } from '../../contexts/FieldAnnotationContext';

// ─── Annotation Tags (rendered below field input) ───────────────────────────

export function FieldAnnotationTags({ fieldName }: { fieldName: string }) {
  const { fieldAnnotations, removeAnnotationFromField } = useFieldAnnotation();
  const tags = fieldAnnotations[fieldName];
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border bg-amber-50 border-amber-200 text-amber-700"
        >
          {label}
          <button
            type="button"
            className="hover:text-amber-900"
            onClick={(e) => { e.stopPropagation(); removeAnnotationFromField(fieldName, label); }}
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Annotation Button + Dropdown ───────────────────────────────────────────

export function FieldAnnotationButton({ fieldName }: { fieldName: string }) {
  const { search, addAnnotationToField, openFieldName, clearOpenFieldName } = useFieldAnnotation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = search(query);

  // Open via Ctrl+E (context signals openFieldName)
  useEffect(() => {
    if (openFieldName === fieldName) {
      setOpen(true);
      clearOpenFieldName();
    }
  }, [openFieldName, fieldName, clearOpenFieldName]);

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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = useCallback((label: string) => {
    addAnnotationToField(fieldName, label);
    setOpen(false);
  }, [addAnnotationToField, fieldName]);

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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="p-0.5 text-gray-400 hover:text-amber-600 transition-colors"
        title="Add annotation"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <Tag size={12} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg z-50" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100">
            <Search size={12} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or create..."
              className="w-full text-xs outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-[180px] overflow-y-auto">
            {results.length > 0 ? (
              results.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={`w-full text-left px-2 py-1 text-xs hover:bg-amber-50 ${i === highlightIdx ? 'bg-amber-50 text-amber-700' : 'text-gray-700'}`}
                  onMouseEnter={() => setHighlightIdx(i)}
                  onClick={() => select(label)}
                >
                  {label}
                </button>
              ))
            ) : query.trim() ? (
              <button
                type="button"
                className="w-full text-left px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
                onClick={() => select(query.trim())}
              >
                Create "{query.trim()}"
              </button>
            ) : (
              <div className="px-2 py-1 text-xs text-gray-400">No annotations</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
