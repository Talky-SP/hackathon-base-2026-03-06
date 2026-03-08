// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExtractedField {
  value: string;
  confidence: number | null;
}

export interface IbanField {
  iban: ExtractedField;
  owner: ExtractedField;
  role: ExtractedField;
}

export interface IvaField {
  base: ExtractedField;
  rate: ExtractedField;
  amount: ExtractedField;
}

export interface ProductField {
  product_name: ExtractedField;
  quantity: ExtractedField;
  unit_price: ExtractedField;
  final_price: ExtractedField;
  discount: ExtractedField;
  category: ExtractedField;
  product_id: ExtractedField;
}

export interface InvoiceFields {
  // Header
  invoiceid: ExtractedField;
  invoice_number: ExtractedField;
  supplier: ExtractedField;
  supplier_cif: ExtractedField;
  supplier_province: ExtractedField;
  supplier_address: ExtractedField;
  invoice_date: ExtractedField;
  due_date: ExtractedField;
  period: ExtractedField;
  concept: ExtractedField;
  category: ExtractedField;
  currency: { code: string; symbol: string };
  ibans: IbanField[];

  // Amounts
  importe: ExtractedField;
  total: ExtractedField;
  retencion: ExtractedField;
  retencion_type: ExtractedField;
  ivas: IvaField[];

  // Products
  products: ProductField[];

  // Classification
  documentKind: ExtractedField;
  documentKindConfidence: ExtractedField;
  multiInvoiceDetected: ExtractedField;

  // Review
  needsReview: ExtractedField;
  talkyVerified: ExtractedField;
  needsReviewReason: ExtractedField;
  needsReviewReasons: string[];
}

// ─── Extraction helpers (mirrors ExpenseAnnotationForm.tsx) ─────────────────

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
    if ('code' in obj && 'symbol' in obj) return `${obj.symbol} ${obj.code}`;
    if ('iban_normalized' in obj) return String(obj.iban_normalized);
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

function extractCurrency(detail: Record<string, unknown>): { code: string; symbol: string } {
  const direct = detail.currency;
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    const obj = direct as Record<string, unknown>;
    return { code: String(obj.code ?? ''), symbol: String(obj.symbol ?? '') };
  }
  if (typeof direct === 'string') return { code: direct, symbol: '' };
  return { code: '', symbol: '' };
}

function extractIbans(detail: Record<string, unknown>): IbanField[] {
  const ibans = detail.ibans as Record<string, unknown>[] | undefined;
  if (!ibans || !Array.isArray(ibans)) return [];
  return ibans.map((item) => {
    const conf = typeof item.confidence === 'number' ? item.confidence : null;
    return {
      iban: { value: String(item.iban_normalized ?? item.value ?? ''), confidence: conf },
      owner: { value: String(item.owner ?? ''), confidence: null },
      role: { value: String(item.role ?? ''), confidence: null },
    };
  });
}

function extractIvas(detail: Record<string, unknown>): IvaField[] {
  const directIvas = detail.ivas as { base_imponible?: unknown; type?: unknown; amount?: unknown }[] | undefined;
  if (directIvas && Array.isArray(directIvas)) {
    return directIvas.map((iva) => ({
      base: { value: iva.base_imponible !== undefined ? String(iva.base_imponible) : '', confidence: null },
      rate: { value: iva.type !== undefined ? String(iva.type) : '', confidence: null },
      amount: { value: iva.amount !== undefined ? String(iva.amount) : '', confidence: null },
    }));
  }
  return [];
}

function extractProducts(detail: Record<string, unknown>): ProductField[] {
  const products = detail.all_products as Record<string, unknown>[] | undefined;
  if (!products || !Array.isArray(products)) return [];
  return products.map((p) => ({
    product_name: { value: p.product_name !== undefined ? String(p.product_name) : '', confidence: null },
    quantity: { value: p.quantity !== undefined ? String(p.quantity) : '', confidence: null },
    unit_price: { value: p.unit_price !== undefined ? String(p.unit_price) : '', confidence: null },
    final_price: { value: p.final_price !== undefined ? String(p.final_price) : '', confidence: null },
    discount: { value: p.discount !== undefined ? String(p.discount) : '', confidence: null },
    category: { value: p.category !== undefined ? String(p.category) : '', confidence: null },
    product_id: { value: p.product_id !== undefined ? String(p.product_id) : '', confidence: null },
  }));
}

function parseReviewReasons(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* not JSON */ }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

// ─── Main extraction ────────────────────────────────────────────────────────

export function extractInvoiceFields(detail: Record<string, unknown>): InvoiceFields {
  const f = (name: string) => extractField(detail, name);
  const reviewReasons = f('needsReviewReasons');

  return {
    invoiceid: f('invoiceid'),
    invoice_number: f('invoice_number'),
    supplier: f('supplier'),
    supplier_cif: f('supplier_cif'),
    supplier_province: f('supplier_province'),
    supplier_address: f('supplier_address'),
    invoice_date: f('invoice_date'),
    due_date: f('due_date'),
    period: f('period'),
    concept: f('concept'),
    category: f('category'),
    currency: extractCurrency(detail),
    ibans: extractIbans(detail),

    importe: f('importe'),
    total: f('total'),
    retencion: f('retencion'),
    retencion_type: f('retencion_type'),
    ivas: extractIvas(detail),

    products: extractProducts(detail),

    documentKind: f('documentKind'),
    documentKindConfidence: f('documentKindConfidence'),
    multiInvoiceDetected: f('multiInvoiceDetected'),

    needsReview: f('needsReview'),
    talkyVerified: f('talkyVerified'),
    needsReviewReason: f('needsReviewReason'),
    needsReviewReasons: parseReviewReasons(reviewReasons.value),
  };
}
