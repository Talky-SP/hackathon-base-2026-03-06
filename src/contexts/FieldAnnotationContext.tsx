import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';

// ─── Context shape ──────────────────────────────────────────────────────────

interface FieldAnnotationContextValue {
  globalAnnotations: string[];
  fieldAnnotations: Record<string, string[]>;
  addAnnotationToField: (fieldName: string, label: string) => void;
  removeAnnotationFromField: (fieldName: string, label: string) => void;
  search: (query: string) => string[];
  activeFieldName: string | null;
  setActiveFieldName: (name: string | null) => void;
  openFieldName: string | null;
  clearOpenFieldName: () => void;
}

const FieldAnnotationContext = createContext<FieldAnnotationContextValue | null>(null);

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useFieldAnnotation(): FieldAnnotationContextValue {
  const ctx = useContext(FieldAnnotationContext);
  if (!ctx) throw new Error('useFieldAnnotation must be used within FieldAnnotationProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

const DEFAULT_ANNOTATIONS = ['Rounding', 'Missing Field', 'Math Error'];

export function FieldAnnotationProvider({ children }: { children: React.ReactNode }) {
  const [globalAnnotations, setGlobalAnnotations] = useState<string[]>(DEFAULT_ANNOTATIONS);
  const [fieldAnnotations, setFieldAnnotations] = useState<Record<string, string[]>>({});
  const [activeFieldName, setActiveFieldName] = useState<string | null>(null);
  const [openFieldName, setOpenFieldName] = useState<string | null>(null);
  const activeFieldRef = useRef(activeFieldName);
  activeFieldRef.current = activeFieldName;

  const clearOpenFieldName = useCallback(() => setOpenFieldName(null), []);

  // Ctrl+E opens annotation dropdown for the active (last selected) field
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
    () => new Fuse(globalAnnotations, { threshold: 0.4, ignoreLocation: true }),
    [globalAnnotations],
  );

  const search = useCallback(
    (query: string): string[] => {
      if (!query.trim()) return globalAnnotations;
      return fuse.search(query).map((r) => r.item);
    },
    [fuse, globalAnnotations],
  );

  const addAnnotationToField = useCallback((fieldName: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;

    setGlobalAnnotations((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed],
    );

    setFieldAnnotations((prev) => {
      const existing = prev[fieldName] ?? [];
      if (existing.includes(trimmed)) return prev;
      return { ...prev, [fieldName]: [...existing, trimmed] };
    });
  }, []);

  const removeAnnotationFromField = useCallback((fieldName: string, label: string) => {
    setFieldAnnotations((prev) => {
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

  const value = useMemo<FieldAnnotationContextValue>(() => ({
    globalAnnotations,
    fieldAnnotations,
    addAnnotationToField,
    removeAnnotationFromField,
    search,
    activeFieldName,
    setActiveFieldName,
    openFieldName,
    clearOpenFieldName,
  }), [globalAnnotations, fieldAnnotations, addAnnotationToField, removeAnnotationFromField, search, activeFieldName, openFieldName, clearOpenFieldName]);

  return (
    <FieldAnnotationContext.Provider value={value}>
      {children}
    </FieldAnnotationContext.Provider>
  );
}
