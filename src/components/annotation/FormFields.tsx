import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { FieldErrorTagButton, FieldErrorTagList } from './FieldErrorTagButton';
import { useFieldErrorTag } from '../../contexts/FieldErrorTagContext';
import { useFormState } from '../../contexts/FormStateContext';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ValidationIssue } from '../../validation/validateInvoice';

// ─── Style constants ────────────────────────────────────────────────────────

export const inputCls = 'w-full px-2.5 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500';
export const inputClsEmpty = 'border-brand-500 bg-brand-100/30';
export const inputClsFilled = 'border-gray-200';
export const smallInputCls = 'w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500';

// ─── Shared field props ─────────────────────────────────────────────────────

interface FieldSelectProps {
  fieldName?: string;
  onSelect?: (fieldName: string) => void;
  issues?: ValidationIssue[];
}

// ─── Validation warning ────────────────────────────────────────────────────

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

export function ValidationWarning({ issues, visible = false }: { issues: ValidationIssue[]; visible?: boolean }) {
  const iconRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; centerX: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!iconRef.current) return;
    const iconRect = iconRef.current.getBoundingClientRect();
    const panel = findScrollParent(iconRef.current);
    const centerX = panel
      ? panel.getBoundingClientRect().left + panel.getBoundingClientRect().width / 2
      : iconRect.left + iconRect.width / 2;
    setPos({ top: iconRect.top, centerX });
  }, []);

  useEffect(() => {
    if (!visible || !iconRef.current) { setPos(null); return; }
    updatePos();
    const panel = findScrollParent(iconRef.current);
    if (panel) {
      panel.addEventListener('scroll', updatePos, { passive: true });
      return () => panel.removeEventListener('scroll', updatePos);
    }
  }, [visible, updatePos]);

  if (issues.length === 0) return null;
  const hasError = issues.some((i) => i.severity === 'error');

  return (
    <div ref={iconRef} className="inline-flex shrink-0">
      <AlertTriangle size={14} className={hasError ? 'text-red-500' : 'text-yellow-500'} />
      {visible && pos && createPortal(
        <div
          className="fixed p-2 bg-white border border-gray-200 rounded-md shadow-lg text-gray-800 text-[10px] pointer-events-none z-[9999]"
          style={{ top: pos.top, left: pos.centerX, transform: 'translate(-50%, -100%) translateY(-6px)', maxWidth: 280 }}
        >
          {issues.map((issue, i) => (
            <div key={i} className="py-0.5">
              <span className={`font-semibold ${issue.severity === 'error' ? 'text-red-700' : 'text-yellow-700'}`}>
                {issue.severity}:
              </span>{' '}
              {issue.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function useFieldClick(fieldName?: string, onSelect?: (fieldName: string) => void) {
  const { setActiveFieldName } = useFieldErrorTag();
  const handler = useCallback(() => {
    if (!fieldName) return;
    setActiveFieldName(fieldName);
    onSelect?.(fieldName);
  }, [fieldName, onSelect, setActiveFieldName]);
  if (!fieldName) return undefined;
  return handler;
}

// ─── Components ─────────────────────────────────────────────────────────────

export function ConfidenceBadge({ value }: { value: number }) {
  const pct = value > 1 ? value : value * 100;
  const normalized = value > 1 ? value / 100 : value;
  const color =
    normalized >= 0.9
      ? 'bg-green-100 text-green-700'
      : normalized >= 0.7
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

export function FieldLabel({ label, confidence }: { label: string; confidence: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {confidence !== null && <ConfidenceBadge value={confidence} />}
    </div>
  );
}

export function TextField({ label, value, confidence, fieldName, onSelect, issues }: { label: string; value: string; confidence: number | null } & FieldSelectProps) {
  const { formData, setValue } = useFormState();
  const [hovered, setHovered] = useState(false);
  const handleClick = useFieldClick(fieldName, onSelect);

  const fieldValue = fieldName ? String(formData[fieldName] ?? '') : value;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (fieldName) {
      setValue(fieldName, e.target.value);
    }
  };

  return (
    <div className={`space-y-1 transition-all duration-300 ${handleClick ? 'cursor-pointer' : ''}`} onClick={handleClick} data-field-name={fieldName}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-center justify-between">
        <FieldLabel label={label} confidence={confidence} />
        <div className="flex items-center gap-1">
          {issues && issues.length > 0 && <ValidationWarning issues={issues} visible={hovered} />}
          {fieldName && <FieldErrorTagButton fieldName={fieldName} />}
        </div>
      </div>
      <input type="text" value={fieldValue} onChange={handleChange}
        className={`${inputCls} ${fieldValue ? inputClsFilled : inputClsEmpty}`} />
      {fieldName && <FieldErrorTagList fieldName={fieldName} />}
    </div>
  );
}

export function FloatField({ label, value, confidence, fieldName, onSelect, issues }: { label: string; value: string; confidence: number | null } & FieldSelectProps) {
  const { formData, setValue } = useFormState();
  const [hovered, setHovered] = useState(false);
  const handleClick = useFieldClick(fieldName, onSelect);

  const fieldValue = fieldName ? String(formData[fieldName] ?? '') : value;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || v === '-' || /^-?\d*\.?\d{0,2}$/.test(v)) {
      if (fieldName) {
        setValue(fieldName, v);
      }
    }
  };

  return (
    <div className={`space-y-1 transition-all duration-300 ${handleClick ? 'cursor-pointer' : ''}`} onClick={handleClick} data-field-name={fieldName}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-center justify-between">
        <FieldLabel label={label} confidence={confidence} />
        <div className="flex items-center gap-1">
          {issues && issues.length > 0 && <ValidationWarning issues={issues} visible={hovered} />}
          {fieldName && <FieldErrorTagButton fieldName={fieldName} />}
        </div>
      </div>
      <input type="text" inputMode="decimal" value={fieldValue} onChange={handleChange}
        className={`${inputCls} ${fieldValue ? inputClsFilled : inputClsEmpty}`} />
      {fieldName && <FieldErrorTagList fieldName={fieldName} />}
    </div>
  );
}

export function BoolField({ label, value, confidence, fieldName, onSelect, issues }: { label: string; value: string; confidence: number | null } & FieldSelectProps) {
  const { formData, setValue } = useFormState();
  const [hovered, setHovered] = useState(false);
  const handleClick = useFieldClick(fieldName, onSelect);

  const fieldValue = fieldName ? formData[fieldName] : value;
  const checked = fieldValue === true || fieldValue === 'true' || fieldValue === '1';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (fieldName) {
      setValue(fieldName, e.target.checked);
    }
  };

  return (
    <div data-field-name={fieldName} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <label className={`flex items-center justify-between px-2.5 py-1.5 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-100 transition-all duration-300`} onClick={handleClick}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">{label}</span>
          {confidence !== null && <ConfidenceBadge value={confidence} />}
        </div>
        <div className="flex items-center gap-2">
          {issues && issues.length > 0 && <ValidationWarning issues={issues} visible={hovered} />}
          {fieldName && <FieldErrorTagButton fieldName={fieldName} />}
          <input type="checkbox" checked={checked} onChange={handleChange}
            className="rounded border-gray-200 text-brand-500 focus:ring-brand-500" />
        </div>
      </label>
      {fieldName && <FieldErrorTagList fieldName={fieldName} />}
    </div>
  );
}

export function SelectField({ label, value, confidence, options, fieldName, onSelect, issues }: { label: string; value: string; confidence: number | null; options: readonly string[] } & FieldSelectProps) {
  const { t } = useLanguage();
  const { formData, setValue } = useFormState();
  const [hovered, setHovered] = useState(false);
  const handleClick = useFieldClick(fieldName, onSelect);

  const fieldValue = fieldName ? String(formData[fieldName] ?? '') : value;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (fieldName) {
      setValue(fieldName, e.target.value);
    }
  };

  return (
    <div className={`space-y-1 transition-all duration-300 ${handleClick ? 'cursor-pointer' : ''}`} onClick={handleClick} data-field-name={fieldName}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-center justify-between">
        <FieldLabel label={label} confidence={confidence} />
        <div className="flex items-center gap-1">
          {issues && issues.length > 0 && <ValidationWarning issues={issues} visible={hovered} />}
          {fieldName && <FieldErrorTagButton fieldName={fieldName} />}
        </div>
      </div>
      <select value={fieldValue} onChange={handleChange}
        className={`w-full px-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 ${fieldValue ? inputClsFilled : inputClsEmpty}`}>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt || t('annotation.form.none')}</option>
        ))}
        {fieldValue && !options.includes(fieldValue) && (
          <option value={fieldValue}>{fieldValue}</option>
        )}
      </select>
      {fieldName && <FieldErrorTagList fieldName={fieldName} />}
    </div>
  );
}

export function MultiSelectField({ label, value, confidence, options, fieldName, onSelect, issues }: { label: string; value: string[]; confidence: number | null; options: readonly string[] } & FieldSelectProps) {
  const { formData, setValue } = useFormState();
  const [hovered, setHovered] = useState(false);
  const handleClick = useFieldClick(fieldName, onSelect);

  const fieldValue = fieldName ? formData[fieldName] : value;
  const selected = new Set(Array.isArray(fieldValue) ? fieldValue : []);

  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt); else next.add(opt);
    if (fieldName) {
      setValue(fieldName, Array.from(next));
    }
  };

  const reasons = options.filter((o) => o !== '');
  const valueArray = Array.isArray(fieldValue) ? fieldValue : value;

  return (
    <div className={`space-y-1 transition-all duration-300 ${handleClick ? 'cursor-pointer' : ''}`} onClick={handleClick} data-field-name={fieldName}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-center justify-between">
        <FieldLabel label={label} confidence={confidence} />
        <div className="flex items-center gap-1">
          {issues && issues.length > 0 && <ValidationWarning issues={issues} visible={hovered} />}
          {fieldName && <FieldErrorTagButton fieldName={fieldName} />}
        </div>
      </div>
      <div className="border border-gray-200 rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
        {reasons.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded">
            <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)}
              className="rounded border-gray-200 text-brand-500 focus:ring-brand-500" />
            {opt}
          </label>
        ))}
        {valueArray.filter((v) => v && !reasons.includes(v)).map((v) => (
          <label key={v} className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded">
            <input type="checkbox" checked={selected.has(v)} onChange={() => toggle(v)}
              className="rounded border-gray-200 text-brand-500 focus:ring-brand-500" />
            {v}
          </label>
        ))}
      </div>
      {fieldName && <FieldErrorTagList fieldName={fieldName} />}
    </div>
  );
}

export function SmallFloatInput({ label, value, fieldName }: { label: string; value: string; fieldName?: string }) {
  const { formData, setValue } = useFormState();

  const fieldValue = fieldName ? String(formData[fieldName] ?? '') : value;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || v === '-' || /^-?\d*\.?\d{0,2}$/.test(v)) {
      if (fieldName) {
        setValue(fieldName, v);
      }
    }
  };

  return (
    <div className="space-y-0.5">
      <label className="text-[10px] text-gray-500">{label}</label>
      <input type="text" inputMode="decimal" value={fieldValue} onChange={handleChange} className={smallInputCls} data-field-name={fieldName} />
    </div>
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export function downloadJson(data: unknown, filename: string) {
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
