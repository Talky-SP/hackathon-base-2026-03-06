import { useState, useEffect } from 'react';

// ─── Style constants ────────────────────────────────────────────────────────

export const inputCls = 'w-full px-2.5 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500';
export const inputClsEmpty = 'border-orange-200 bg-orange-50/30';
export const inputClsFilled = 'border-gray-200';
export const smallInputCls = 'w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500';

// ─── Shared field props ─────────────────────────────────────────────────────

interface FieldSelectProps {
  fieldName?: string;
  onSelect?: (fieldName: string) => void;
}

function useFieldClick(fieldName?: string, onSelect?: (fieldName: string) => void) {
  if (!fieldName || !onSelect) return undefined;
  return () => onSelect(fieldName);
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
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {confidence !== null && <ConfidenceBadge value={confidence} />}
    </div>
  );
}

export function TextField({ label, value, confidence, fieldName, onSelect }: { label: string; value: string; confidence: number | null } & FieldSelectProps) {
  const [edited, setEdited] = useState(value);
  useEffect(() => { setEdited(value); }, [value]);
  const handleClick = useFieldClick(fieldName, onSelect);
  return (
    <div className={`space-y-1 transition-all duration-300 ${handleClick ? 'cursor-pointer' : ''}`} onClick={handleClick} data-field-name={fieldName}>
      <FieldLabel label={label} confidence={confidence} />
      <input type="text" value={edited} onChange={(e) => setEdited(e.target.value)}
        className={`${inputCls} ${value ? inputClsFilled : inputClsEmpty}`} />
    </div>
  );
}

export function FloatField({ label, value, confidence, fieldName, onSelect }: { label: string; value: string; confidence: number | null } & FieldSelectProps) {
  const [edited, setEdited] = useState(value);
  useEffect(() => { setEdited(value); }, [value]);
  const handleClick = useFieldClick(fieldName, onSelect);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || v === '-' || /^-?\d*\.?\d{0,2}$/.test(v)) {
      setEdited(v);
    }
  };

  return (
    <div className={`space-y-1 transition-all duration-300 ${handleClick ? 'cursor-pointer' : ''}`} onClick={handleClick} data-field-name={fieldName}>
      <FieldLabel label={label} confidence={confidence} />
      <input type="text" inputMode="decimal" value={edited} onChange={handleChange}
        className={`${inputCls} ${value ? inputClsFilled : inputClsEmpty}`} />
    </div>
  );
}

export function BoolField({ label, value, confidence, fieldName, onSelect }: { label: string; value: string; confidence: number | null } & FieldSelectProps) {
  const parsed = value === 'true' || value === '1';
  const [checked, setChecked] = useState(parsed);
  useEffect(() => { setChecked(value === 'true' || value === '1'); }, [value]);
  const handleClick = useFieldClick(fieldName, onSelect);

  return (
    <label className={`flex items-center justify-between px-2.5 py-1.5 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 transition-all duration-300`} onClick={handleClick} data-field-name={fieldName}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {confidence !== null && <ConfidenceBadge value={confidence} />}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)}
        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
    </label>
  );
}

export function SelectField({ label, value, confidence, options, fieldName, onSelect }: { label: string; value: string; confidence: number | null; options: readonly string[] } & FieldSelectProps) {
  const [selected, setSelected] = useState(value);
  useEffect(() => { setSelected(value); }, [value]);
  const handleClick = useFieldClick(fieldName, onSelect);

  return (
    <div className={`space-y-1 transition-all duration-300 ${handleClick ? 'cursor-pointer' : ''}`} onClick={handleClick} data-field-name={fieldName}>
      <FieldLabel label={label} confidence={confidence} />
      <select value={selected} onChange={(e) => setSelected(e.target.value)}
        className={`w-full px-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 ${value ? inputClsFilled : inputClsEmpty}`}>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt || '(none)'}</option>
        ))}
        {value && !options.includes(value) && (
          <option value={value}>{value}</option>
        )}
      </select>
    </div>
  );
}

export function MultiSelectField({ label, value, confidence, options, fieldName, onSelect }: { label: string; value: string[]; confidence: number | null; options: readonly string[] } & FieldSelectProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(value));
  useEffect(() => { setSelected(new Set(value)); }, [value]);
  const handleClick = useFieldClick(fieldName, onSelect);

  const toggle = (opt: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(opt)) next.delete(opt); else next.add(opt);
      return next;
    });
  };

  const reasons = options.filter((o) => o !== '');

  return (
    <div className={`space-y-1 transition-all duration-300 ${handleClick ? 'cursor-pointer' : ''}`} onClick={handleClick} data-field-name={fieldName}>
      <FieldLabel label={label} confidence={confidence} />
      <div className="border border-gray-200 rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
        {reasons.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
            <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
            {opt}
          </label>
        ))}
        {value.filter((v) => v && !reasons.includes(v)).map((v) => (
          <label key={v} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
            <input type="checkbox" checked={selected.has(v)} onChange={() => toggle(v)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
            {v}
          </label>
        ))}
      </div>
    </div>
  );
}

export function SmallFloatInput({ label, value }: { label: string; value: string }) {
  const [edited, setEdited] = useState(value);
  useEffect(() => { setEdited(value); }, [value]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || v === '-' || /^-?\d*\.?\d{0,2}$/.test(v)) setEdited(v);
  };
  return (
    <div className="space-y-0.5">
      <label className="text-[10px] text-gray-500">{label}</label>
      <input type="text" inputMode="decimal" value={edited} onChange={handleChange} className={smallInputCls} />
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
