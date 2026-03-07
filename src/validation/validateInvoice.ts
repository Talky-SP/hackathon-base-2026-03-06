import { extractInvoiceFields } from './extractFields';
import type { InvoiceFields } from './extractFields';

// ─── Validation result types ────────────────────────────────────────────────

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  invoiceId: string;
  ok: boolean;
  issues: ValidationIssue[];
  fields: InvoiceFields;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function num(field: { value: string }): number {
  const n = parseFloat(field.value);
  return isNaN(n) ? 0 : n;
}

const TOLERANCE = 0.02;

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

const VALID_IVA_RATES = new Set([0, 4, 10, 21]);
const VALID_PRODUCT_TYPES = new Set(['PACK', 'UNIT', 'UNKNOWN']);
const VALID_DOCUMENT_KINDS = new Set(['invoice', 'credit_note', 'delivery_note', 'receipt', 'other']);

// ─── Validate ───────────────────────────────────────────────────────────────

export function validateInvoice(detail: Record<string, unknown>): ValidationResult {
  const fields = extractInvoiceFields(detail);
  const issues: ValidationIssue[] = [];

  if (fields.products.length > 0) {
    // Check 1: sum(unit_price * quantity) should equal importe
    // Unit prices may include VAT, so try both:
    //   a) sum(unit_price × quantity) == importe
    //   b) sum(unit_price × quantity) - sum(ivas.amount) == importe
    const importe = num(fields.importe);
    const sumUnitTimesQty = fields.products.reduce(
      (acc, p) => acc + num(p.unit_price) * num(p.quantity), 0,
    );
    const sumIvaAmount = fields.ivas.reduce(
      (acc, iva) => acc + num(iva.amount), 0,
    );
    const importeMatchesDirect = close(sumUnitTimesQty, importe);
    const importeMatchesMinusVat = close(sumUnitTimesQty - sumIvaAmount, importe);
    if (importe !== 0 && !importeMatchesDirect && !importeMatchesMinusVat) {
      issues.push({
        field: 'importe',
        message: `sum(unit_price × quantity) = ${sumUnitTimesQty.toFixed(2)}, sum(iva) = ${sumIvaAmount.toFixed(2)}, importe = ${importe.toFixed(2)} (diff direct: ${(sumUnitTimesQty - importe).toFixed(2)}, minus VAT: ${(sumUnitTimesQty - sumIvaAmount - importe).toFixed(2)})`,
        severity: 'error',
      });
    }

    // Check 2: sum(final_price) should equal total
    // VAT may be separate from product final_price, so try both:
    //   a) sum(final_price) == total
    //   b) sum(final_price) + sum(ivas.amount) == total
    const total = num(fields.total);
    const sumFinalPrice = fields.products.reduce(
      (acc, p) => acc + num(p.final_price), 0,
    );
    const matchesWithoutVat = close(sumFinalPrice, total);
    const matchesWithVat = close(sumFinalPrice + sumIvaAmount, total);
    if (total !== 0 && !matchesWithoutVat && !matchesWithVat) {
      issues.push({
        field: 'total',
        message: `sum(final_price) = ${sumFinalPrice.toFixed(2)}, sum(iva) = ${sumIvaAmount.toFixed(2)}, total = ${total.toFixed(2)} (diff without VAT: ${(sumFinalPrice - total).toFixed(2)}, with VAT: ${(sumFinalPrice + sumIvaAmount - total).toFixed(2)})`,
        severity: 'error',
      });
    }
  }

  // Check: IVA rate must be 0, 4, 10, or 21 and base_imponible * type / 100 = amount
  for (let i = 0; i < fields.ivas.length; i++) {
    const iva = fields.ivas[i];
    const rate = num(iva.rate);
    const base = num(iva.base);
    const amount = num(iva.amount);

    if (iva.rate.value !== '' && !VALID_IVA_RATES.has(rate)) {
      issues.push({
        field: `ivas[${i}].type`,
        message: `IVA rate ${rate} is not a valid Spanish VAT rate (expected 0, 4, 10, or 21)`,
        severity: 'error',
      });
    }

    if (base !== 0 && rate !== 0 && amount !== 0) {
      const expected = base * rate / 100;
      if (!close(expected, amount)) {
        issues.push({
          field: `ivas[${i}].amount`,
          message: `base_imponible × type / 100 = ${expected.toFixed(2)}, but amount = ${amount.toFixed(2)} (diff: ${(expected - amount).toFixed(2)})`,
          severity: 'error',
        });
      }
    }
  }

  // Check: pack_ai.product_type must be PACK, UNIT, or UNKNOWN
  const products = detail.all_products as Record<string, unknown>[] | undefined;
  if (Array.isArray(products)) {
    for (let i = 0; i < products.length; i++) {
      const packAi = products[i].pack_ai as Record<string, unknown> | undefined;
      if (packAi && packAi.product_type !== undefined && packAi.product_type !== '') {
        const pt = String(packAi.product_type);
        if (!VALID_PRODUCT_TYPES.has(pt)) {
          issues.push({
            field: `all_products[${i}].pack_ai.product_type`,
            message: `Invalid product_type "${pt}" (expected PACK, UNIT, or UNKNOWN)`,
            severity: 'error',
          });
        }
      }
    }
  }

  // Check: documentKind must be a known value
  const dk = fields.documentKind.value;
  if (dk !== '' && !VALID_DOCUMENT_KINDS.has(dk)) {
    issues.push({
      field: 'documentKind',
      message: `Invalid documentKind "${dk}" (expected invoice, credit_note, delivery_note, receipt, or other)`,
      severity: 'error',
    });
  }

  return {
    invoiceId: fields.invoiceid.value || 'unknown',
    ok: issues.length === 0,
    issues,
    fields,
  };
}
