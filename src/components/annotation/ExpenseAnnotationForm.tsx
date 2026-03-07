import { useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
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

  console.warn(`[ExpenseAnnotationForm] Field "${fieldName}" not found in invoice detail`);
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
  fieldPath: string; // full unique path for bbox linking, e.g. "invoice_amounts.ivas[0].base_imponible"
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
  fieldPath: string; // e.g. "all_products[0].product_name"
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

// ─── Component ──────────────────────────────────────────────────────────────

interface ExpenseAnnotationFormProps {
  invoiceDetail: Record<string, unknown> | null;
  onFieldSelect?: (fieldName: string) => void;
}

export default function ExpenseAnnotationForm({ invoiceDetail, onFieldSelect }: ExpenseAnnotationFormProps) {
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
  const products = useMemo(() => extractProducts(invoiceDetail), [invoiceDetail]);
  const reviewReasonsArr = useMemo(() => parseReviewReasons(fields.needsReviewReasons.value), [fields.needsReviewReasons.value]);

  return (
    <>
      {/* Invoice Header Fields (AI-Extracted) */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-800">Invoice Header</h4>
        <TextField label={t('annotation.panel.invoiceNumber')} value={fields.invoice_number.value} confidence={fields.invoice_number.confidence} fieldName="invoice_number" onSelect={onFieldSelect} />
        <TextField label={t('annotation.panel.supplierName')} value={fields.supplier.value} confidence={fields.supplier.confidence} fieldName="supplier" onSelect={onFieldSelect} />
        <TextField label={t('annotation.panel.supplierVat')} value={fields.supplier_cif.value} confidence={fields.supplier_cif.confidence} fieldName="supplier_cif" onSelect={onFieldSelect} />
        <TextField label="Supplier Province" value={fields.supplier_province.value} confidence={fields.supplier_province.confidence} fieldName="supplier_province" onSelect={onFieldSelect} />
        <TextField label="Supplier Address" value={fields.supplier_address.value} confidence={fields.supplier_address.confidence} fieldName="supplier_address" onSelect={onFieldSelect} />
        <TextField label={t('annotation.panel.invoiceDate')} value={fields.invoice_date.value} confidence={fields.invoice_date.confidence} fieldName="invoice_date" onSelect={onFieldSelect} />
        <TextField label="Due Date" value={fields.due_date.value} confidence={fields.due_date.confidence} fieldName="due_date" onSelect={onFieldSelect} />
        <TextField label="Period" value={fields.period.value} confidence={fields.period.confidence} fieldName="period" onSelect={onFieldSelect} />
        <TextField label="Concept" value={fields.concept.value} confidence={fields.concept.confidence} fieldName="concept" onSelect={onFieldSelect} />
        <TextField label="Category" value={fields.category.value} confidence={fields.category.confidence} fieldName="category" onSelect={onFieldSelect} />
        {/* Currency */}
        <div className="space-y-1">
          <FieldLabel label="Currency" confidence={null} />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-[10px] text-gray-500">Code</label>
              <input type="text" defaultValue={currency.code} className={smallInputCls} />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-gray-500">Symbol</label>
              <input type="text" defaultValue={currency.symbol} className={smallInputCls} />
            </div>
          </div>
        </div>
        {/* IBANs */}
        {ibans.length > 0 ? (
          <div className="space-y-1">
            <FieldLabel label="IBANs" confidence={null} />
            {ibans.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded p-2 space-y-1.5 text-xs">
                <TextField label="IBAN" value={item.iban.value} confidence={item.iban.confidence} fieldName={item.iban.fieldPath} onSelect={onFieldSelect} />
                <div className="grid grid-cols-2 gap-1.5">
                  <TextField label="Owner" value={item.owner.value} confidence={item.owner.confidence} fieldName={item.owner.fieldPath} onSelect={onFieldSelect} />
                  <TextField label="Role" value={item.role.value} confidence={item.role.confidence} fieldName={item.role.fieldPath} onSelect={onFieldSelect} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TextField label="IBANs" value="" confidence={null} />
        )}
      </section>

      {/* Amount Fields (AI-Extracted) */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-800">{t('annotation.panel.amounts')}</h4>
        <FloatField label="Subtotal (importe)" value={fields.importe.value} confidence={fields.importe.confidence} fieldName="importe" onSelect={onFieldSelect} />
        <FloatField label={t('annotation.panel.totalAmount')} value={fields.total.value} confidence={fields.total.confidence} fieldName="total" onSelect={onFieldSelect} />
        <FloatField label="Withholding (retencion)" value={fields.retencion.value} confidence={fields.retencion.confidence} fieldName="retencion" onSelect={onFieldSelect} />
        <TextField label="Withholding Type" value={fields.retencion_type.value} confidence={fields.retencion_type.confidence} fieldName="retencion_type" onSelect={onFieldSelect} />
      </section>

      {/* VAT Lines (IVAs) */}
      {ivas.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-800">VAT Lines (IVAs)</h4>
          {ivas.map((iva, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-2.5 space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">IVA {i + 1}</p>
              <FloatField label="Base" value={iva.base.value} confidence={iva.base.confidence} fieldName={iva.base.fieldPath} onSelect={onFieldSelect} />
              <FloatField label="Rate %" value={iva.rate.value} confidence={iva.rate.confidence} fieldName={iva.rate.fieldPath} onSelect={onFieldSelect} />
              <FloatField label="Amount" value={iva.amount.value} confidence={iva.amount.confidence} fieldName={iva.amount.fieldPath} onSelect={onFieldSelect} />
            </div>
          ))}
        </section>
      )}

      {/* Products / Line Items + PackAI Analysis */}
      {products.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-800">Products / Line Items ({products.length})</h4>
          {products.map((prod, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-2.5 space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Product {i + 1}</p>
              <div className="space-y-1.5">
                <TextField label="Name" value={prod.product_name.value} confidence={prod.product_name.confidence} fieldName={prod.product_name.fieldPath} onSelect={onFieldSelect} />
                <div className="grid grid-cols-2 gap-1.5">
                  <FloatField label="Qty" value={prod.quantity.value} confidence={prod.quantity.confidence} fieldName={prod.quantity.fieldPath} onSelect={onFieldSelect} />
                  <FloatField label="Unit €" value={prod.unit_price.value} confidence={prod.unit_price.confidence} fieldName={prod.unit_price.fieldPath} onSelect={onFieldSelect} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <FloatField label="Total" value={prod.final_price.value} confidence={prod.final_price.confidence} fieldName={prod.final_price.fieldPath} onSelect={onFieldSelect} />
                  <FloatField label="Disc." value={prod.discount.value} confidence={prod.discount.confidence} fieldName={prod.discount.fieldPath} onSelect={onFieldSelect} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <TextField label="Category" value={prod.category.value} confidence={prod.category.confidence} fieldName={prod.category.fieldPath} onSelect={onFieldSelect} />
                  <TextField label="Product ID" value={prod.product_id.value} confidence={prod.product_id.confidence} fieldName={prod.product_id.fieldPath} onSelect={onFieldSelect} />
                </div>
              </div>
              {prod.pack_ai && (
                <div className="mt-1 border-t border-gray-200 pt-1.5 space-y-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">PackAI</p>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-600">
                    <span>Type: <span className="font-medium text-gray-800">{prod.pack_ai.product_type}</span></span>
                    <span>Usable: <span className={`font-medium ${prod.pack_ai.usable ? 'text-green-700' : 'text-red-700'}`}>{prod.pack_ai.usable ? 'Yes' : 'No'}</span></span>
                    <span>Conf: {prod.pack_ai.confidence > 0 && <ConfidenceBadge value={prod.pack_ai.confidence} />}</span>
                  </div>
                  {prod.pack_ai.line_total && (
                    <div className="text-[10px] text-gray-600">Line total: <span className="font-medium text-gray-800">{prod.pack_ai.line_total}</span></div>
                  )}
                  {(prod.pack_ai.unit_quantity || prod.pack_ai.unit_uom || prod.pack_ai.unit_price) && (
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-600">
                      <span>Unit qty: <span className="font-medium text-gray-800">{prod.pack_ai.unit_quantity} {prod.pack_ai.unit_uom}</span></span>
                      <span>Unit €: <span className="font-medium text-gray-800">{prod.pack_ai.unit_price}</span></span>
                    </div>
                  )}
                  {(prod.pack_ai.packs || prod.pack_ai.pack_unit || prod.pack_ai.units_per_pack) && (
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-600">
                      <span>Packs: <span className="font-medium text-gray-800">{prod.pack_ai.packs}</span></span>
                      <span>Pack unit: <span className="font-medium text-gray-800">{prod.pack_ai.pack_unit}</span></span>
                      <span>Per pack: <span className="font-medium text-gray-800">{prod.pack_ai.units_per_pack}</span></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Document Classification */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-800">Document Classification</h4>
        <TextField label="Document Kind" value={fields.documentKind.value} confidence={fields.documentKind.confidence} fieldName="documentKind" onSelect={onFieldSelect} />
        <FloatField label="Kind Confidence" value={fields.documentKindConfidence.value} confidence={fields.documentKindConfidence.confidence} fieldName="documentKindConfidence" onSelect={onFieldSelect} />
        <BoolField label="Multi-Invoice Detected" value={fields.multiInvoiceDetected.value} confidence={fields.multiInvoiceDetected.confidence} fieldName="multiInvoiceDetected" onSelect={onFieldSelect} />
      </section>

      {/* Review Flags & Reasons */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-800">Review Flags &amp; Reasons</h4>
        <BoolField label="Needs Review" value={fields.needsReview.value} confidence={fields.needsReview.confidence} fieldName="needsReview" onSelect={onFieldSelect} />
        <BoolField label="Talky Verified" value={fields.talkyVerified.value} confidence={fields.talkyVerified.confidence} fieldName="talkyVerified" onSelect={onFieldSelect} />
        <SelectField label="Review Reason" value={fields.needsReviewReason.value} confidence={fields.needsReviewReason.confidence} options={REVIEW_REASONS} fieldName="needsReviewReason" onSelect={onFieldSelect} />
        <MultiSelectField label="All Review Reasons" value={reviewReasonsArr} confidence={fields.needsReviewReasons.confidence} options={REVIEW_REASONS} fieldName="needsReviewReasons" onSelect={onFieldSelect} />
      </section>
    </>
  );
}
