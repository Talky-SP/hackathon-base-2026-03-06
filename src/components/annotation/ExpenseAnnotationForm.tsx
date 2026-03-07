import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { CollapsibleSection } from '../ui';
import {
  ConfidenceBadge, FieldLabel, TextField, FloatField, BoolField,
  SelectField, MultiSelectField, smallInputCls,
} from './FormFields';

// ─── Review reason options (from DocsPage documentation) ────────────────────

const REVIEW_REASONS = [
  '',
  'DOCUMENT_NOT_INVOICE',
  'CURRENCY_NOT_EUR',
  'SUPPLIER_NOT_DETECTED',
  'POSSIBLE_AMOUNTS_DISCREPANCY',
  'AMOUNTS_MISMATCH',
  'INCOME_DEVOLUCION_RAPPEL',
  'ACCOUNTING_ENTRIES_MISMATCH',
  'ASSETS_DETECTED',
  'MULTI_INVOICE_DETECTED',
] as const;

// ─── Field extraction ───────────────────────────────────────────────────────

interface ExtractedField {
  value: string;
  confidence: number | null;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    if (val.length === 0) return '';
    return val.map(formatValue).join(', ');
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if ('code' in obj && 'symbol' in obj) {
      return `${obj.symbol} ${obj.code}`;
    }
    if ('iban_normalized' in obj) {
      return String(obj.iban_normalized);
    }
    return JSON.stringify(obj);
  }
  return String(val);
}

function extractField(
  detail: Record<string, unknown> | null | undefined,
  fieldName: string,
): ExtractedField {
  const empty: ExtractedField = { value: '', confidence: null };
  if (!detail) return empty;

  const meta = detail.textract_metadata as Record<string, unknown> | undefined;
  if (meta) {
    for (const section of ['invoice_details', 'invoice_amounts']) {
      const sec = meta[section] as Record<string, unknown> | undefined;
      if (sec && sec[fieldName]) {
        const entry = sec[fieldName] as Record<string, unknown>;
        const val = entry.value;
        if (val !== undefined && val !== null) {
          return {
            value: formatValue(val),
            confidence: typeof entry.confidence === 'number' ? entry.confidence : null,
          };
        }
      }
    }
    if (meta[fieldName]) {
      const entry = meta[fieldName] as Record<string, unknown>;
      const val = entry.value;
      if (val !== undefined && val !== null) {
        return {
          value: formatValue(val),
          confidence: typeof entry.confidence === 'number' ? entry.confidence : null,
        };
      }
    }
  }

  const direct = detail[fieldName];
  if (direct !== undefined && direct !== null && direct !== '') {
    return { value: formatValue(direct), confidence: null };
  }

  return empty;
}

function extractCurrency(detail: Record<string, unknown> | null | undefined): { code: string; symbol: string } {
  if (!detail) return { code: '', symbol: '' };

  const meta = detail.textract_metadata as Record<string, unknown> | undefined;
  if (meta) {
    const invoiceDetails = meta.invoice_details as Record<string, unknown> | undefined;
    const entry = invoiceDetails?.currency as Record<string, unknown> | undefined;
    if (entry?.value && typeof entry.value === 'object') {
      const obj = entry.value as Record<string, unknown>;
      return { code: String(obj.code ?? ''), symbol: String(obj.symbol ?? '') };
    }
  }

  const direct = detail.currency;
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    const obj = direct as Record<string, unknown>;
    return { code: String(obj.code ?? ''), symbol: String(obj.symbol ?? '') };
  }

  if (typeof direct === 'string') return { code: direct, symbol: '' };
  return { code: '', symbol: '' };
}

interface IbanSubField {
  value: string;
  confidence: number | null;
  fieldPath: string;
}

interface IbanItem {
  iban: IbanSubField;
  owner: IbanSubField;
  role: IbanSubField;
}

function extractIbans(detail: Record<string, unknown> | null | undefined): IbanItem[] {
  if (!detail) return [];
  const ibans = detail.ibans as Record<string, unknown>[] | undefined;
  if (!ibans || !Array.isArray(ibans)) return [];
  return ibans.map((item, i) => {
    const conf = typeof item.confidence === 'number' ? item.confidence : null;
    return {
      iban: { value: String(item.iban_normalized ?? item.value ?? ''), confidence: conf, fieldPath: `ibans[${i}].iban_normalized` },
      owner: { value: String(item.owner ?? ''), confidence: null, fieldPath: `ibans[${i}].owner` },
      role: { value: String(item.role ?? ''), confidence: null, fieldPath: `ibans[${i}].role` },
    };
  });
}

interface IvaSubField {
  value: string;
  confidence: number | null;
  fieldPath: string;
}

interface IvaItem {
  base: IvaSubField;
  rate: IvaSubField;
  amount: IvaSubField;
}

function extractIvaSubField(entry: unknown, fieldPath: string): IvaSubField {
  if (!entry || typeof entry !== 'object') return { value: '', confidence: null, fieldPath };
  const e = entry as Record<string, unknown>;
  return {
    value: e.value !== undefined && e.value !== null ? String(e.value) : '',
    confidence: typeof e.confidence === 'number' ? e.confidence : null,
    fieldPath,
  };
}

function extractIvas(detail: Record<string, unknown> | null | undefined): IvaItem[] {
  if (!detail) return [];

  const meta = detail.textract_metadata as Record<string, unknown> | undefined;
  const amounts = meta?.invoice_amounts as Record<string, unknown> | undefined;
  const metaIvas = amounts?.ivas as Record<string, unknown>[] | undefined;
  if (metaIvas && Array.isArray(metaIvas)) {
    return metaIvas.map((iva, i) => ({
      base: extractIvaSubField(iva.base_imponible, `invoice_amounts.ivas[${i}].base_imponible`),
      rate: extractIvaSubField(iva.type, `invoice_amounts.ivas[${i}].type`),
      amount: extractIvaSubField(iva.amount, `invoice_amounts.ivas[${i}].amount`),
    }));
  }

  const directIvas = detail.ivas as { base_imponible?: number; type?: number; amount?: number }[] | undefined;
  if (directIvas && Array.isArray(directIvas)) {
    return directIvas.map((iva, i) => ({
      base: { value: iva.base_imponible !== undefined ? String(iva.base_imponible) : '', confidence: null, fieldPath: `invoice_amounts.ivas[${i}].base_imponible` },
      rate: { value: iva.type !== undefined ? String(iva.type) : '', confidence: null, fieldPath: `invoice_amounts.ivas[${i}].type` },
      amount: { value: iva.amount !== undefined ? String(iva.amount) : '', confidence: null, fieldPath: `invoice_amounts.ivas[${i}].amount` },
    }));
  }

  return [];
}

interface ProductSubField {
  value: string;
  confidence: number | null;
  fieldPath: string;
}

function prodField(value: unknown, fieldPath: string, confidence?: number | null): ProductSubField {
  return {
    value: value !== undefined && value !== null ? String(value) : '',
    confidence: typeof confidence === 'number' ? confidence : null,
    fieldPath,
  };
}

interface ProductItem {
  product_name: ProductSubField;
  quantity: ProductSubField;
  unit_price: ProductSubField;
  final_price: ProductSubField;
  discount: ProductSubField;
  category: ProductSubField;
  product_id: ProductSubField;
  pack_ai: {
    product_type: string;
    usable: boolean;
    confidence: number;
    line_total: string;
    unit_quantity: string;
    unit_uom: string;
    unit_price: string;
    packs: string;
    pack_unit: string;
    units_per_pack: string;
  } | null;
}

interface DescuentoSubField {
  value: string;
  confidence: number | null;
  fieldPath: string;
}

interface DescuentoItem {
  name: DescuentoSubField;
  amount: DescuentoSubField;
}

function extractDescuentos(detail: Record<string, unknown> | null | undefined): DescuentoItem[] {
  if (!detail) return [];

  const meta = detail.textract_metadata as Record<string, unknown> | undefined;
  const amounts = meta?.invoice_amounts as Record<string, unknown> | undefined;
  const metaDesc = amounts?.descuentos_generales as Record<string, unknown>[] | undefined;
  if (metaDesc && Array.isArray(metaDesc)) {
    return metaDesc.map((d, i) => ({
      name: extractIvaSubField(d.discount_name, `invoice_amounts.descuentos_generales[${i}].discount_name`),
      amount: extractIvaSubField(d.discount_amount, `invoice_amounts.descuentos_generales[${i}].discount_amount`),
    }));
  }

  const directDesc = detail.descuentos_generales as Record<string, unknown>[] | undefined;
  if (directDesc && Array.isArray(directDesc)) {
    return directDesc.map((d, i) => ({
      name: { value: d.discount_name !== undefined ? String(d.discount_name) : '', confidence: null, fieldPath: `invoice_amounts.descuentos_generales[${i}].discount_name` },
      amount: { value: d.discount_amount !== undefined ? String(d.discount_amount) : '', confidence: null, fieldPath: `invoice_amounts.descuentos_generales[${i}].discount_amount` },
    }));
  }

  return [];
}

function extractProducts(detail: Record<string, unknown> | null | undefined): ProductItem[] {
  if (!detail) return [];

  const products = detail.all_products as Record<string, unknown>[] | undefined;
  if (!products || !Array.isArray(products)) return [];

  return products.map((p, i) => {
    const prefix = `all_products[${i}]`;
    const packAi = p.pack_ai as Record<string, unknown> | undefined;
    const unitView = packAi?.unit_view as Record<string, unknown> | undefined;
    const packView = packAi?.pack_view as Record<string, unknown> | undefined;

    return {
      product_name: prodField(p.product_name, `${prefix}.product_name`),
      quantity: prodField(p.quantity, `${prefix}.quantity`),
      unit_price: prodField(p.unit_price, `${prefix}.unit_price`),
      final_price: prodField(p.final_price, `${prefix}.final_price`),
      discount: prodField(p.discount, `${prefix}.discount`),
      category: prodField(p.category, `${prefix}.category`),
      product_id: prodField(p.product_id, `${prefix}.product_id`),
      pack_ai: packAi ? {
        product_type: String(packAi.product_type ?? ''),
        usable: packAi.usable === true,
        confidence: typeof packAi.confidence === 'number' ? packAi.confidence : 0,
        line_total: packAi.line_total !== undefined ? String(packAi.line_total) : '',
        unit_quantity: unitView?.quantity !== undefined ? String(unitView.quantity) : '',
        unit_uom: String(unitView?.uom ?? ''),
        unit_price: unitView?.unit_price !== undefined ? String(unitView.unit_price) : '',
        packs: packView?.packs !== undefined ? String(packView.packs) : '',
        pack_unit: String(packView?.pack_unit ?? ''),
        units_per_pack: packView?.units_per_pack !== undefined ? String(packView.units_per_pack) : '',
      } : null,
    };
  });
}

function parseReviewReasons(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* not JSON */ }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

// ─── Group helpers ──────────────────────────────────────────────────────────

type GroupId = 'vat' | 'discounts' | 'products' | 'classification' | 'review';

function fieldToGroupAndItem(fieldName: string): { group: GroupId; item: string | null } | null {
  let m;
  if ((m = fieldName.match(/^invoice_amounts\.ivas\[(\d+)\]/))) return { group: 'vat', item: `iva-${m[1]}` };
  if ((m = fieldName.match(/^invoice_amounts\.descuentos_generales\[(\d+)\]/))) return { group: 'discounts', item: `discount-${m[1]}` };
  if ((m = fieldName.match(/^all_products\[(\d+)\]/))) return { group: 'products', item: `product-${m[1]}` };
  if (['documentKind', 'documentKindConfidence', 'multiInvoiceDetected'].includes(fieldName)) return { group: 'classification', item: null };
  if (['needsReview', 'talkyVerified', 'needsReviewReason', 'needsReviewReasons'].includes(fieldName)) return { group: 'review', item: null };
  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface ExpenseAnnotationFormProps {
  invoiceDetail: Record<string, unknown> | null;
  onFieldSelect?: (fieldName: string) => void;
  highlightedFormFields?: string[];
}

export default function ExpenseAnnotationForm({ invoiceDetail, onFieldSelect, highlightedFormFields }: ExpenseAnnotationFormProps) {
  const { t } = useLanguage();

  const fields = useMemo(() => {
    const d = invoiceDetail;
    return {
      invoice_number: extractField(d, 'invoice_number'),
      supplier: extractField(d, 'supplier'),
      supplier_cif: extractField(d, 'supplier_cif'),
      supplier_province: extractField(d, 'supplier_province'),
      supplier_address: extractField(d, 'supplier_address'),
      invoice_date: extractField(d, 'invoice_date'),
      due_date: extractField(d, 'due_date'),
      period: extractField(d, 'period'),
      concept: extractField(d, 'concept'),
      category: extractField(d, 'category'),
      importe: extractField(d, 'importe'),
      total: extractField(d, 'total'),
      retencion: extractField(d, 'retencion'),
      retencion_type: extractField(d, 'retencion_type'),
      documentKind: extractField(d, 'documentKind'),
      documentKindConfidence: extractField(d, 'documentKindConfidence'),
      multiInvoiceDetected: extractField(d, 'multiInvoiceDetected'),
      needsReview: extractField(d, 'needsReview'),
      talkyVerified: extractField(d, 'talkyVerified'),
      needsReviewReason: extractField(d, 'needsReviewReason'),
      needsReviewReasons: extractField(d, 'needsReviewReasons'),
    };
  }, [invoiceDetail]);

  const currency = useMemo(() => extractCurrency(invoiceDetail), [invoiceDetail]);
  const ibans = useMemo(() => extractIbans(invoiceDetail), [invoiceDetail]);
  const ivas = useMemo(() => extractIvas(invoiceDetail), [invoiceDetail]);
  const descuentos = useMemo(() => extractDescuentos(invoiceDetail), [invoiceDetail]);
  const products = useMemo(() => extractProducts(invoiceDetail), [invoiceDetail]);
  const reviewReasonsArr = useMemo(() => parseReviewReasons(fields.needsReviewReasons.value), [fields.needsReviewReasons.value]);

  const formRef = useRef<HTMLDivElement>(null);

  // ─── Collapsible state ──────────────────────────────────────────────────

  const [expandedGroups, setExpandedGroups] = useState<Set<GroupId>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const autoExpandRef = useRef<{ group: GroupId | null; items: Set<string>; dirty: boolean }>({
    group: null, items: new Set(), dirty: false,
  });

  const toggleGroup = useCallback((id: GroupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (autoExpandRef.current.group === id) {
      autoExpandRef.current = { group: null, items: new Set(), dirty: false };
    }
  }, []);

  const toggleItem = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const markDirty = useCallback((groupId: GroupId) => {
    if (autoExpandRef.current.group === groupId) {
      autoExpandRef.current.dirty = true;
    }
  }, []);

  // ─── BBox click → scroll, expand, select ────────────────────────────────

  const lastBBoxKeyRef = useRef('');
  const lastClickTimeRef = useRef(0);
  const cycleIndexRef = useRef(0);

  useEffect(() => {
    if (!highlightedFormFields || highlightedFormFields.length === 0) return;

    // Determine target group and item
    let targetGroup: GroupId | null = null;
    let targetItem: string | null = null;
    for (const name of highlightedFormFields) {
      const gi = fieldToGroupAndItem(name);
      if (gi) { targetGroup = gi.group; targetItem = gi.item; break; }
    }

    // Auto-collapse previous group if navigating away and not dirty
    const prev = autoExpandRef.current;
    if (prev.group && prev.group !== targetGroup && !prev.dirty) {
      const groupToCollapse = prev.group;
      const itemsToCollapse = prev.items;
      setExpandedGroups((s) => { const n = new Set(s); n.delete(groupToCollapse); return n; });
      if (itemsToCollapse.size > 0) {
        setExpandedItems((s) => { const n = new Set(s); for (const it of itemsToCollapse) n.delete(it); return n; });
      }
    }

    // Auto-expand target
    if (targetGroup) {
      const newAutoItems = new Set<string>();
      setExpandedGroups((s) => s.has(targetGroup!) ? s : new Set(s).add(targetGroup!));
      if (targetItem) {
        setExpandedItems((s) => s.has(targetItem!) ? s : new Set(s).add(targetItem!));
        newAutoItems.add(targetItem);
      }
      autoExpandRef.current = { group: targetGroup, items: newAutoItems, dirty: false };
    } else {
      autoExpandRef.current = { group: null, items: new Set(), dirty: false };
    }

    // Wait for DOM to update after expansion, then scroll + select
    const timer = setTimeout(() => {
      if (!formRef.current) return;
      const elements: HTMLElement[] = [];
      for (const name of highlightedFormFields) {
        let el = formRef.current.querySelector(`[data-field-name="${name}"]`) as HTMLElement | null;
        if (!el) {
          const all = formRef.current.querySelectorAll('[data-field-name]');
          for (const candidate of all) {
            const attr = candidate.getAttribute('data-field-name') || '';
            if (attr === name || attr.endsWith('.' + name)) { el = candidate as HTMLElement; break; }
          }
        }
        if (el) elements.push(el);
      }
      if (elements.length === 0) return;

      const bboxKey = highlightedFormFields.slice().sort().join('|');
      const now = Date.now();
      if (bboxKey === lastBBoxKeyRef.current && now - lastClickTimeRef.current < 5000) {
        cycleIndexRef.current = (cycleIndexRef.current + 1) % elements.length;
      } else {
        cycleIndexRef.current = 0;
      }
      lastBBoxKeyRef.current = bboxKey;
      lastClickTimeRef.current = now;

      const target = elements[cycleIndexRef.current];
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = target.querySelector('input, textarea, select') as HTMLInputElement | null;
      if (input) { input.focus(); input.select(); }
    }, 60);

    return () => clearTimeout(timer);
  }, [highlightedFormFields]);

  // ─── Collapsed summaries ────────────────────────────────────────────────

  const vatSummary = useMemo(() => {
    const total = ivas.reduce((s, v) => s + (parseFloat(v.amount.value) || 0), 0);
    return `${ivas.length} ${ivas.length !== 1 ? t('annotation.form.vatSummaryLines') : t('annotation.form.vatSummaryLine')} · ${t('annotation.form.totalVat')}: €${total.toFixed(2)}`;
  }, [ivas, t]);

  const discountsSummary = useMemo(() => {
    const total = descuentos.reduce((s, d) => s + (parseFloat(d.amount.value) || 0), 0);
    return `${descuentos.length} ${descuentos.length !== 1 ? t('annotation.form.discountSummary') : t('annotation.form.discountSummarySingular')} · €${total.toFixed(2)}`;
  }, [descuentos, t]);

  const productsSummary = useMemo(() => {
    const total = products.reduce((s, p) => s + (parseFloat(p.final_price.value) || 0), 0);
    return `${products.length} ${products.length !== 1 ? t('annotation.form.itemSummary') : t('annotation.form.itemSummarySingular')} · ${t('annotation.form.total')}: €${total.toFixed(2)}`;
  }, [products, t]);

  const classificationSummary = useMemo(() => {
    const kind = fields.documentKind.value || '—';
    const conf = parseFloat(fields.documentKindConfidence.value);
    const multi = fields.multiInvoiceDetected.value;
    let s = kind;
    if (!isNaN(conf)) s += ` (${(conf * 100).toFixed(0)}%)`;
    if (multi === 'true') s += ` · ${t('annotation.form.multiInvoiceLabel')}`;
    return s;
  }, [fields.documentKind, fields.documentKindConfidence, fields.multiInvoiceDetected, t]);

  const reviewSummary = useMemo(() => {
    const needs = fields.needsReview.value === 'true';
    const verified = fields.talkyVerified.value === 'true';
    const reason = fields.needsReviewReason.value;
    if (!needs && verified) return t('annotation.form.verified');
    if (!needs) return t('annotation.form.ok');
    return `${t('annotation.form.needsReviewSummary')}${reason ? ` · ${reason}` : ''}`;
  }, [fields.needsReview, fields.talkyVerified, fields.needsReviewReason, t]);

  // ─── Render helpers ─────────────────────────────────────────────────────

  return (
    <div ref={formRef} className="space-y-4">
      {/* ── Invoice Header (always visible) ── */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-800">{t('annotation.form.invoiceHeader')}</h4>
        <TextField label={t('annotation.panel.invoiceNumber')} value={fields.invoice_number.value} confidence={fields.invoice_number.confidence} fieldName="invoice_number" onSelect={onFieldSelect} />
        <TextField label={t('annotation.panel.supplierName')} value={fields.supplier.value} confidence={fields.supplier.confidence} fieldName="supplier" onSelect={onFieldSelect} />
        <TextField label={t('annotation.panel.supplierVat')} value={fields.supplier_cif.value} confidence={fields.supplier_cif.confidence} fieldName="supplier_cif" onSelect={onFieldSelect} />
        <TextField label={t('annotation.form.supplierProvince')} value={fields.supplier_province.value} confidence={fields.supplier_province.confidence} fieldName="supplier_province" onSelect={onFieldSelect} />
        <TextField label={t('annotation.form.supplierAddress')} value={fields.supplier_address.value} confidence={fields.supplier_address.confidence} fieldName="supplier_address" onSelect={onFieldSelect} />
        <TextField label={t('annotation.panel.invoiceDate')} value={fields.invoice_date.value} confidence={fields.invoice_date.confidence} fieldName="invoice_date" onSelect={onFieldSelect} />
        <TextField label={t('annotation.form.dueDate')} value={fields.due_date.value} confidence={fields.due_date.confidence} fieldName="due_date" onSelect={onFieldSelect} />
        <TextField label={t('annotation.form.period')} value={fields.period.value} confidence={fields.period.confidence} fieldName="period" onSelect={onFieldSelect} />
        <TextField label={t('annotation.form.concept')} value={fields.concept.value} confidence={fields.concept.confidence} fieldName="concept" onSelect={onFieldSelect} />
        <TextField label={t('annotation.form.category')} value={fields.category.value} confidence={fields.category.confidence} fieldName="category" onSelect={onFieldSelect} />
        <div className="space-y-1">
          <FieldLabel label={t('annotation.form.currency')} confidence={null} />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-[10px] text-gray-500">{t('annotation.form.currencyCode')}</label>
              <input type="text" defaultValue={currency.code} className={smallInputCls} />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-gray-500">{t('annotation.form.currencySymbol')}</label>
              <input type="text" defaultValue={currency.symbol} className={smallInputCls} />
            </div>
          </div>
        </div>
        {ibans.length > 0 ? (
          <div className="space-y-1">
            <FieldLabel label={t('annotation.form.ibans')} confidence={null} />
            {ibans.map((item, i) => (
              <div key={i} className="bg-gray-100 rounded p-2 space-y-1.5 text-xs">
                <TextField label={t('annotation.form.iban')} value={item.iban.value} confidence={item.iban.confidence} fieldName={item.iban.fieldPath} onSelect={onFieldSelect} />
                <div className="grid grid-cols-2 gap-1.5">
                  <TextField label={t('annotation.form.owner')} value={item.owner.value} confidence={item.owner.confidence} fieldName={item.owner.fieldPath} onSelect={onFieldSelect} />
                  <TextField label={t('annotation.form.role')} value={item.role.value} confidence={item.role.confidence} fieldName={item.role.fieldPath} onSelect={onFieldSelect} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TextField label={t('annotation.form.ibans')} value="" confidence={null} />
        )}
      </section>

      {/* ── Amount Fields (always visible) ── */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-800">{t('annotation.panel.amounts')}</h4>
        <FloatField label={t('annotation.form.subtotal')} value={fields.importe.value} confidence={fields.importe.confidence} fieldName="importe" onSelect={onFieldSelect} />
        <FloatField label={t('annotation.panel.totalAmount')} value={fields.total.value} confidence={fields.total.confidence} fieldName="total" onSelect={onFieldSelect} />
        <FloatField label={t('annotation.form.withholding')} value={fields.retencion.value} confidence={fields.retencion.confidence} fieldName="retencion" onSelect={onFieldSelect} />
        <TextField label={t('annotation.form.withholdingType')} value={fields.retencion_type.value} confidence={fields.retencion_type.confidence} fieldName="retencion_type" onSelect={onFieldSelect} />
      </section>

      {/* ── VAT Lines (collapsible) ── */}
      {ivas.length > 0 && (
        <div onInput={() => markDirty('vat')}>
          <CollapsibleSection
            title={`${t('annotation.form.vatLines')} (${ivas.length})`}
            expanded={expandedGroups.has('vat')}
            onToggle={() => toggleGroup('vat')}
            summary={vatSummary}
          >
            <div className="mt-1 space-y-2">
              {ivas.map((iva, i) => {
                const itemId = `iva-${i}`;
                return (
                  <div key={i} className="bg-gray-100 rounded-lg p-2.5">
                    <CollapsibleSection
                      title={`${t('annotation.form.iva')} ${i + 1}`}
                      expanded={expandedItems.has(itemId)}
                      onToggle={() => toggleItem(itemId)}
                      summary={`${iva.rate.value || '?'}% · ${t('annotation.form.base')}: ${iva.base.value || '—'} · ${t('annotation.form.amount')}: ${iva.amount.value || '—'}`}
                      size="sm"
                    >
                      <div className="mt-1 space-y-2">
                        <FloatField label={t('annotation.form.base')} value={iva.base.value} confidence={iva.base.confidence} fieldName={iva.base.fieldPath} onSelect={onFieldSelect} />
                        <FloatField label={t('annotation.form.ratePercent')} value={iva.rate.value} confidence={iva.rate.confidence} fieldName={iva.rate.fieldPath} onSelect={onFieldSelect} />
                        <FloatField label={t('annotation.form.amount')} value={iva.amount.value} confidence={iva.amount.confidence} fieldName={iva.amount.fieldPath} onSelect={onFieldSelect} />
                      </div>
                    </CollapsibleSection>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── General Discounts (collapsible) ── */}
      {descuentos.length > 0 && (
        <div onInput={() => markDirty('discounts')}>
          <CollapsibleSection
            title={`${t('annotation.form.generalDiscounts')} (${descuentos.length})`}
            expanded={expandedGroups.has('discounts')}
            onToggle={() => toggleGroup('discounts')}
            summary={discountsSummary}
          >
            <div className="mt-1 space-y-2">
              {descuentos.map((desc, i) => {
                const itemId = `discount-${i}`;
                return (
                  <div key={i} className="bg-gray-100 rounded-lg p-2.5">
                    <CollapsibleSection
                      title={`${t('annotation.form.discount')} ${i + 1}`}
                      expanded={expandedItems.has(itemId)}
                      onToggle={() => toggleItem(itemId)}
                      summary={`${desc.name.value || '—'} · €${desc.amount.value || '—'}`}
                      size="sm"
                    >
                      <div className="mt-1 space-y-2">
                        <TextField label={t('annotation.form.name')} value={desc.name.value} confidence={desc.name.confidence} fieldName={desc.name.fieldPath} onSelect={onFieldSelect} />
                        <FloatField label={t('annotation.form.amount')} value={desc.amount.value} confidence={desc.amount.confidence} fieldName={desc.amount.fieldPath} onSelect={onFieldSelect} />
                      </div>
                    </CollapsibleSection>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Products / Line Items (collapsible) ── */}
      {products.length > 0 && (
        <div onInput={() => markDirty('products')}>
          <CollapsibleSection
            title={`${t('annotation.form.products')} (${products.length})`}
            expanded={expandedGroups.has('products')}
            onToggle={() => toggleGroup('products')}
            summary={productsSummary}
          >
            <div className="mt-1 space-y-2">
              {products.map((prod, i) => {
                const itemId = `product-${i}`;
                return (
                  <div key={i} className="bg-gray-100 rounded-lg p-2.5">
                    <CollapsibleSection
                      title={`${t('annotation.form.product')} ${i + 1}`}
                      expanded={expandedItems.has(itemId)}
                      onToggle={() => toggleItem(itemId)}
                      summary={`${prod.product_name.value || '—'}${prod.quantity.value ? ` · ${prod.quantity.value}` : ''}${prod.unit_price.value ? ` × €${prod.unit_price.value}` : ''}${prod.final_price.value ? ` = €${prod.final_price.value}` : ''}`}
                      size="sm"
                    >
                      <div className="mt-1 space-y-1.5">
                        <TextField label={t('annotation.form.name')} value={prod.product_name.value} confidence={prod.product_name.confidence} fieldName={prod.product_name.fieldPath} onSelect={onFieldSelect} />
                        <div className="grid grid-cols-2 gap-1.5">
                          <FloatField label={t('annotation.form.qty')} value={prod.quantity.value} confidence={prod.quantity.confidence} fieldName={prod.quantity.fieldPath} onSelect={onFieldSelect} />
                          <FloatField label={t('annotation.form.unitPrice')} value={prod.unit_price.value} confidence={prod.unit_price.confidence} fieldName={prod.unit_price.fieldPath} onSelect={onFieldSelect} />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <FloatField label={t('annotation.form.total')} value={prod.final_price.value} confidence={prod.final_price.confidence} fieldName={prod.final_price.fieldPath} onSelect={onFieldSelect} />
                          <FloatField label={t('annotation.form.disc')} value={prod.discount.value} confidence={prod.discount.confidence} fieldName={prod.discount.fieldPath} onSelect={onFieldSelect} />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <TextField label={t('annotation.form.category')} value={prod.category.value} confidence={prod.category.confidence} fieldName={prod.category.fieldPath} onSelect={onFieldSelect} />
                          <TextField label={t('annotation.form.productId')} value={prod.product_id.value} confidence={prod.product_id.confidence} fieldName={prod.product_id.fieldPath} onSelect={onFieldSelect} />
                        </div>
                        {prod.pack_ai && (
                          <div className="mt-1 border-t border-gray-200 pt-1.5 space-y-1">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase">{t('annotation.form.packAi')}</p>
                            <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-500">
                              <span>{`${t('annotation.form.type')}:`} <span className="font-medium text-gray-800">{prod.pack_ai.product_type}</span></span>
                              <span>{`${t('annotation.form.usable')}:`} <span className={`font-medium ${prod.pack_ai.usable ? 'text-green-700' : 'text-red-700'}`}>{prod.pack_ai.usable ? t('annotation.form.yes') : t('annotation.form.no')}</span></span>
                              <span>{`${t('annotation.form.conf')}:`} {prod.pack_ai.confidence > 0 && <ConfidenceBadge value={prod.pack_ai.confidence} />}</span>
                            </div>
                            {prod.pack_ai.line_total && (
                              <div className="text-[10px] text-gray-500">{`${t('annotation.form.lineTotal')}:`} <span className="font-medium text-gray-800">{prod.pack_ai.line_total}</span></div>
                            )}
                            {(prod.pack_ai.unit_quantity || prod.pack_ai.unit_uom || prod.pack_ai.unit_price) && (
                              <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-500">
                                <span>{`${t('annotation.form.unitQty')}:`} <span className="font-medium text-gray-800">{prod.pack_ai.unit_quantity} {prod.pack_ai.unit_uom}</span></span>
                                <span>{`${t('annotation.form.unitPriceLabel')}:`} <span className="font-medium text-gray-800">{prod.pack_ai.unit_price}</span></span>
                              </div>
                            )}
                            {(prod.pack_ai.packs || prod.pack_ai.pack_unit || prod.pack_ai.units_per_pack) && (
                              <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-500">
                                <span>{`${t('annotation.form.packs')}:`} <span className="font-medium text-gray-800">{prod.pack_ai.packs}</span></span>
                                <span>{`${t('annotation.form.packUnit')}:`} <span className="font-medium text-gray-800">{prod.pack_ai.pack_unit}</span></span>
                                <span>{`${t('annotation.form.perPack')}:`} <span className="font-medium text-gray-800">{prod.pack_ai.units_per_pack}</span></span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CollapsibleSection>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Document Classification (collapsible) ── */}
      <div onInput={() => markDirty('classification')}>
        <CollapsibleSection
          title={t('annotation.form.docClassification')}
          expanded={expandedGroups.has('classification')}
          onToggle={() => toggleGroup('classification')}
          summary={classificationSummary}
        >
          <div className="mt-1 space-y-3">
            <TextField label={t('annotation.form.documentKind')} value={fields.documentKind.value} confidence={fields.documentKind.confidence} fieldName="documentKind" onSelect={onFieldSelect} />
            <FloatField label={t('annotation.form.kindConfidence')} value={fields.documentKindConfidence.value} confidence={fields.documentKindConfidence.confidence} fieldName="documentKindConfidence" onSelect={onFieldSelect} />
            <BoolField label={t('annotation.form.multiInvoice')} value={fields.multiInvoiceDetected.value} confidence={fields.multiInvoiceDetected.confidence} fieldName="multiInvoiceDetected" onSelect={onFieldSelect} />
          </div>
        </CollapsibleSection>
      </div>

      {/* ── Review Flags & Reasons (collapsible) ── */}
      <div onInput={() => markDirty('review')}>
        <CollapsibleSection
          title={t('annotation.form.reviewFlags')}
          expanded={expandedGroups.has('review')}
          onToggle={() => toggleGroup('review')}
          summary={reviewSummary}
        >
          <div className="mt-1 space-y-3">
            <BoolField label={t('annotation.form.needsReview')} value={fields.needsReview.value} confidence={fields.needsReview.confidence} fieldName="needsReview" onSelect={onFieldSelect} />
            <BoolField label={t('annotation.form.talkyVerified')} value={fields.talkyVerified.value} confidence={fields.talkyVerified.confidence} fieldName="talkyVerified" onSelect={onFieldSelect} />
            <SelectField label={t('annotation.form.reviewReason')} value={fields.needsReviewReason.value} confidence={fields.needsReviewReason.confidence} options={REVIEW_REASONS} fieldName="needsReviewReason" onSelect={onFieldSelect} />
            <MultiSelectField label={t('annotation.form.allReviewReasons')} value={reviewReasonsArr} confidence={fields.needsReviewReasons.confidence} options={REVIEW_REASONS} fieldName="needsReviewReasons" onSelect={onFieldSelect} />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
