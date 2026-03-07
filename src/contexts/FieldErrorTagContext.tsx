import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';

// ─── Context shape ──────────────────────────────────────────────────────────

interface FieldErrorTagContextValue {
  globalErrorTags: string[];
  fieldErrorTags: Record<string, string[]>;
  addErrorTagToField: (fieldName: string, label: string) => void;
  removeErrorTagFromField: (fieldName: string, label: string) => void;
  search: (query: string) => string[];
  activeFieldName: string | null;
  setActiveFieldName: (name: string | null) => void;
  openFieldName: string | null;
  clearOpenFieldName: () => void;
}

const FieldErrorTagContext = createContext<FieldErrorTagContextValue | null>(null);

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useFieldErrorTag(): FieldErrorTagContextValue {
  const ctx = useContext(FieldErrorTagContext);
  if (!ctx) throw new Error('useFieldErrorTag must be used within FieldErrorTagProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

const DEFAULT_ERROR_TAGS = ['Rounding', 'Missing Field', 'Math Error'];

export function FieldErrorTagProvider({ children }: { children: React.ReactNode }) {
  const [globalErrorTags, setGlobalErrorTags] = useState<string[]>(DEFAULT_ERROR_TAGS);
  const [fieldErrorTags, setFieldErrorTags] = useState<Record<string, string[]>>({});
  const [activeFieldName, setActiveFieldName] = useState<string | null>(null);
  const [openFieldName, setOpenFieldName] = useState<string | null>(null);
  const activeFieldRef = useRef(activeFieldName);
  activeFieldRef.current = activeFieldName;

  const clearOpenFieldName = useCallback(() => setOpenFieldName(null), []);

  // Ctrl+E opens error tag dropdown for the active (last selected) field
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        if (activeFieldRef.current) {
          setOpenFieldName(activeFieldRef.current);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const fuse = useMemo(
    () => new Fuse(globalErrorTags, { threshold: 0.4, ignoreLocation: true }),
    [globalErrorTags],
  );

  const search = useCallback(
    (query: string): string[] => {
      if (!query.trim()) return globalErrorTags;
      return fuse.search(query).map((r) => r.item);
    },
    [fuse, globalErrorTags],
  );

  const addErrorTagToField = useCallback((fieldName: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;

    setGlobalErrorTags((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed],
    );

    setFieldErrorTags((prev) => {
      const existing = prev[fieldName] ?? [];
      if (existing.includes(trimmed)) return prev;
      return { ...prev, [fieldName]: [...existing, trimmed] };
    });
  }, []);

  const removeErrorTagFromField = useCallback((fieldName: string, label: string) => {
    setFieldErrorTags((prev) => {
      const existing = prev[fieldName];
      if (!existing) return prev;
      const next = existing.filter((a) => a !== label);
      if (next.length === 0) {
        const { [fieldName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [fieldName]: next };
    });
  }, []);

  const value = useMemo<FieldErrorTagContextValue>(() => ({
    globalErrorTags,
    fieldErrorTags,
    addErrorTagToField,
    removeErrorTagFromField,
    search,
    activeFieldName,
    setActiveFieldName,
    openFieldName,
    clearOpenFieldName,
  }), [globalErrorTags, fieldErrorTags, addErrorTagToField, removeErrorTagFromField, search, activeFieldName, openFieldName, clearOpenFieldName]);

  return (
    <FieldErrorTagContext.Provider value={value}>
      {children}
    </FieldErrorTagContext.Provider>
  );
}
