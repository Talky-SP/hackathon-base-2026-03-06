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

  return {
    invoiceId: fields.invoiceid.value || 'unknown',
    ok: issues.length === 0,
    issues,
    fields,
  };
}
