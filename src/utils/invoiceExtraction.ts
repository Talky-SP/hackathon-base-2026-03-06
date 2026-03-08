// ─── Review reason options (from DocsPage documentation) ────────────────────

export const REVIEW_REASONS = [
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

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExtractedField {
  value: string;
  confidence: number | null;
}

export interface ProductItem {
  product_name: string;
  quantity: string;
  unit_price: string;
  final_price: string;
  discount: string;
  category: string;
  product_id: string;
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

// ─── Functions ──────────────────────────────────────────────────────────────

export function formatValue(val: unknown): string {
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

export function extractField(
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

export function extractCurrency(detail: Record<string, unknown> | null | undefined): { code: string; symbol: string } {
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

export function extractIbans(detail: Record<string, unknown> | null | undefined): { iban: string; owner: string; role: string; confidence: number }[] {
  if (!detail) return [];
  const ibans = detail.ibans as Record<string, unknown>[] | undefined;
  if (!ibans || !Array.isArray(ibans)) return [];
  return ibans.map((item) => ({
    iban: String(item.iban_normalized ?? item.value ?? ''),
    owner: String(item.owner ?? ''),
    role: String(item.role ?? ''),
    confidence: typeof item.confidence === 'number' ? item.confidence : 0,
  }));
}

export function extractIvas(detail: Record<string, unknown> | null | undefined): { base: string; rate: string; amount: string }[] {
  if (!detail) return [];

  const meta = detail.textract_metadata as Record<string, unknown> | undefined;
  const amounts = meta?.invoice_amounts as Record<string, unknown> | undefined;
  const metaIvas = amounts?.ivas as Record<string, unknown>[] | undefined;
  if (metaIvas && Array.isArray(metaIvas)) {
    return metaIvas.map((iva) => ({
      base: String((iva.base_imponible as Record<string, unknown>)?.value ?? ''),
      rate: String((iva.type as Record<string, unknown>)?.value ?? ''),
      amount: String((iva.amount as Record<string, unknown>)?.value ?? ''),
    }));
  }

  const directIvas = detail.ivas as { base_imponible?: number; type?: number; amount?: number }[] | undefined;
  if (directIvas && Array.isArray(directIvas)) {
    return directIvas.map((iva) => ({
      base: iva.base_imponible !== undefined ? String(iva.base_imponible) : '',
      rate: iva.type !== undefined ? String(iva.type) : '',
      amount: iva.amount !== undefined ? String(iva.amount) : '',
    }));
  }

  return [];
}

export function extractProducts(detail: Record<string, unknown> | null | undefined): ProductItem[] {
  if (!detail) return [];

  const products = detail.all_products as Record<string, unknown>[] | undefined;
  if (!products || !Array.isArray(products)) return [];

  return products.map((p) => {
    const packAi = p.pack_ai as Record<string, unknown> | undefined;
    const unitView = packAi?.unit_view as Record<string, unknown> | undefined;
    const packView = packAi?.pack_view as Record<string, unknown> | undefined;

    return {
      product_name: String(p.product_name ?? ''),
      quantity: p.quantity !== undefined && p.quantity !== null ? String(p.quantity) : '',
      unit_price: p.unit_price !== undefined && p.unit_price !== null ? String(p.unit_price) : '',
      final_price: p.final_price !== undefined && p.final_price !== null ? String(p.final_price) : '',
      discount: p.discount !== undefined && p.discount !== null ? String(p.discount) : '',
      category: String(p.category ?? ''),
      product_id: String(p.product_id ?? ''),
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

export function parseReviewReasons(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* not JSON */ }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}
