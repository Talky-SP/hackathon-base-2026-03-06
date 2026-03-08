import { extractInvoiceFields } from './extractFields';
import type { InvoiceFields } from './extractFields';
import { centroidCluster } from './fuzzyCluster';
import { detectInvoiceNumberOutliers } from './invoiceNumberPattern';
import type { StrategySummary } from './invoiceNumberPattern';

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

const VALID_PRODUCT_TYPES = new Set(['PACK', 'UNIT', 'UNKNOWN']);
const VALID_DOCUMENT_KINDS = new Set(['invoice', 'credit_note', 'delivery_note', 'receipt', 'other']);

// ─── Validate ───────────────────────────────────────────────────────────────

// ─── Batch validation ────────────────────────────────────────────────────────

export interface CifPatternSummary {
  cif: string;
  invoiceCount: number;
  strategies: StrategySummary[];
}

export interface BatchValidationResult {
  results: ValidationResult[];
  totalOk: number;
  totalFailed: number;
  patternSummaries: CifPatternSummary[];
}

const MIN_BUCKET_SIZE = 5;
const SCORE_THRESHOLD = 0.9;     // 10% max dissimilarity
const MAIN_CLUSTER_RATIO = 0.75; // 75% of bucket must match centroid

export function validateBatch(invoices: Record<string, unknown>[]): BatchValidationResult {
  const results = invoices.map(validateInvoice);
  const patternSummaries: CifPatternSummary[] = [];

  // Group results by supplier_cif
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < results.length; i++) {
    const cif = results[i].fields.supplier_cif.value.trim();
    if (!cif) continue;
    const list = buckets.get(cif);
    if (list) list.push(i);
    else buckets.set(cif, [i]);
  }

  for (const [cif, indices] of buckets) {
    if (indices.length <= MIN_BUCKET_SIZE) {
      for (const idx of indices) {
        results[idx].issues.push({
          field: 'supplier_cif',
          message: `Supplier CIF bucket too small (${indices.length} invoices for CIF ${cif}, need >${MIN_BUCKET_SIZE})`,
          severity: 'warning',
        });
      }
      continue;
    }

    // Cluster supplier names within this CIF bucket
    const names = indices.map((idx) => results[idx].fields.supplier.value);
    const cluster = centroidCluster(names, SCORE_THRESHOLD);

    if (cluster.matched.length < indices.length * MAIN_CLUSTER_RATIO) {
      // Main cluster too small — flag the entire bucket
      for (const idx of indices) {
        results[idx].issues.push({
          field: 'supplier',
          message: `Supplier name inconsistency in CIF ${cif}: main cluster has ${cluster.matched.length}/${indices.length} names (need ${Math.ceil(indices.length * MAIN_CLUSTER_RATIO)}), centroid="${cluster.centroid}"`,
          severity: 'error',
        });
      }
    } else {
      // Flag only outliers
      for (const outlierPos of cluster.outliers) {
        const idx = indices[outlierPos];
        results[idx].issues.push({
          field: 'supplier',
          message: `Supplier name outlier for CIF ${cif}: "${results[idx].fields.supplier.value}" does not match centroid "${cluster.centroid}"`,
          severity: 'error',
        });
      }
    }

    // Invoice number pattern validation within this CIF bucket
    const invoiceNumbers = indices.map((idx) => results[idx].fields.invoice_number.value);
    const nonEmpty = invoiceNumbers.filter((n) => n !== '');
    if (nonEmpty.length > 1) {
      // Map back: nonEmpty index → original indices index
      const nonEmptyMap: number[] = [];
      for (let j = 0; j < invoiceNumbers.length; j++) {
        if (invoiceNumbers[j] !== '') nonEmptyMap.push(j);
      }

      const detection = detectInvoiceNumberOutliers(nonEmpty);
      const numberOutliers = detection.outlierIndices;
      const dominantCount = nonEmpty.length - numberOutliers.length;

      patternSummaries.push({
        cif,
        invoiceCount: nonEmpty.length,
        strategies: detection.strategySummaries,
      });

      if (dominantCount < nonEmpty.length * MAIN_CLUSTER_RATIO) {
        // Dominant pattern too small — flag entire bucket
        for (const idx of indices) {
          if (results[idx].fields.invoice_number.value === '') continue;
          results[idx].issues.push({
            field: 'invoice_number',
            message: `Invoice number pattern inconsistency in CIF ${cif}: dominant pattern covers ${dominantCount}/${nonEmpty.length} numbers (need ${Math.ceil(nonEmpty.length * MAIN_CLUSTER_RATIO)})`,
            severity: 'error',
          });
        }
      } else {
        // Flag only outliers
        for (const outlierPos of numberOutliers) {
          const bucketPos = nonEmptyMap[outlierPos];
          const idx = indices[bucketPos];
          results[idx].issues.push({
            field: 'invoice_number',
            message: `Invoice number pattern outlier for CIF ${cif}: "${results[idx].fields.invoice_number.value}" does not match the dominant pattern`,
            severity: 'error',
          });
        }
      }
    }

    // ─── Batch date checks within CIF bucket ──────────────────────────────

    // Collect parsed dates for this bucket
    const invoiceDates: { idx: number; date: Date }[] = [];
    const dateDiffs: { idx: number; days: number }[] = [];

    for (const idx of indices) {
      const invDate = parseDate(results[idx].fields.invoice_date.value);
      if (invDate) invoiceDates.push({ idx, date: invDate });

      const dueDate = parseDate(results[idx].fields.due_date.value);
      if (invDate && dueDate) {
        const days = (dueDate.getTime() - invDate.getTime()) / MS_PER_DAY;
        dateDiffs.push({ idx, days });
      }
    }

    // Check: invoice_date range outliers — max(10 days, IQR × 3)
    if (invoiceDates.length >= 4) {
      const timestamps = invoiceDates.map((d) => d.date.getTime());
      const stats = computeIQR(timestamps);
      if (stats) {
        const spread = Math.max(10 * MS_PER_DAY, 3 * stats.iqr);
        const lower = stats.q1 - spread;
        const upper = stats.q3 + spread;
        for (let pos = 0; pos < invoiceDates.length; pos++) {
          const ts = timestamps[pos];
          if (ts < lower || ts > upper) {
            const { idx, date } = invoiceDates[pos];
            results[idx].issues.push({
              field: 'invoice_date',
              message: `Invoice date outlier for CIF ${cif}: "${date.toISOString().slice(0, 10)}" is outside the expected date range (max(10d, IQR×3))`,
              severity: 'error',
            });
          }
        }
      }
    }

    // Check: date difference outliers (due_date - invoice_date) (IQR × 1.5)
    if (dateDiffs.length >= 4) {
      const days = dateDiffs.map((d) => d.days);
      const diffOutliers = iqrOutliers(days, 1.5);
      for (const pos of diffOutliers) {
        const { idx, days: d } = dateDiffs[pos];
        results[idx].issues.push({
          field: 'due_date',
          message: `Date difference outlier for CIF ${cif}: ${d.toFixed(0)} days between invoice and due date (IQR×1.5)`,
          severity: 'error',
        });
      }
    }
  }

  // Recompute ok status after batch-level checks
  for (const r of results) {
    r.ok = r.issues.filter((i) => i.severity === 'error').length === 0;
  }

  const totalOk = results.filter((r) => r.ok).length;
  return { results, totalOk, totalFailed: results.length - totalOk, patternSummaries };
}

// ─── Date helpers ────────────────────────────────────────────────────────────

const MIN_DATE = new Date('2017-01-01');

/** Try common non-ISO date formats and return a suggested ISO date if one parses. */
function suggestDateFormat(value: string): string | null {
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // YYYY/MM/DD or YYYY.MM.DD
  const ymd = value.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/);
  if (ymd) {
    const [, yyyy, mm, dd] = ymd;
    const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // DDMMYYYY (no separator)
  const compact = value.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) {
    const [, dd, mm, yyyy] = compact;
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(d.getTime())) return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

/** Parse a date string, returning null if invalid. */
function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Single-invoice date validation: invalid format, before 2017, future. */
function validateDate(value: string, fieldName: string, issues: ValidationIssue[], allowFuture = false) {
  if (!value) return;
  const d = parseDate(value);
  if (!d) {
    const suggestion = suggestDateFormat(value);
    const msg = suggestion
      ? `Invalid date "${value}" — did you mean "${suggestion}" (use YYYY-MM-DD)?`
      : `Invalid date "${value}" (expected format: YYYY-MM-DD)`;
    issues.push({ field: fieldName, message: msg, severity: 'error' });
  } else if (d < MIN_DATE) {
    issues.push({ field: fieldName, message: `Date "${value}" is before 2017`, severity: 'error' });
  } else if (!allowFuture && d > new Date()) {
    issues.push({ field: fieldName, message: `Date "${value}" is in the future`, severity: 'error' });
  }
}

// ─── IQR outlier detection ──────────────────────────────────────────────────

function computeIQR(values: number[]): { q1: number; q3: number; iqr: number } | null {
  if (values.length < 4) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  return { q1, q3, iqr: q3 - q1 };
}

function iqrOutliers(values: number[], multiplier: number): Set<number> {
  const stats = computeIQR(values);
  if (!stats) return new Set();
  const lower = stats.q1 - multiplier * stats.iqr;
  const upper = stats.q3 + multiplier * stats.iqr;
  const out = new Set<number>();
  for (let i = 0; i < values.length; i++) {
    if (values[i] < lower || values[i] > upper) out.add(i);
  }
  return out;
}

const MS_PER_DAY = 86_400_000;

export function validateInvoice(detail: Record<string, unknown>): ValidationResult {
  const fields = extractInvoiceFields(detail);
  const issues: ValidationIssue[] = [];

  // Check: invoice_date and due_date must be valid, not in the future, not before 2017
  validateDate(fields.invoice_date.value, 'invoice_date', issues);
  validateDate(fields.due_date.value, 'due_date', issues, true);

  // Check: inverted date range (due_date before invoice_date)
  const invoiceD = parseDate(fields.invoice_date.value);
  const dueD = parseDate(fields.due_date.value);
  if (invoiceD && dueD && dueD < invoiceD) {
    issues.push({
      field: 'due_date',
      message: `Due date "${fields.due_date.value}" is before invoice date "${fields.invoice_date.value}"`,
      severity: 'error',
    });
  }

  // Check: total should equal importe + sum(iva.amount)
  {
    const importe = num(fields.importe);
    const total = num(fields.total);
    const sumIva = fields.ivas.reduce((acc, iva) => acc + num(iva.amount), 0);
    if (importe !== 0 && total !== 0) {
      const expected = importe + sumIva;
      if (!close(expected, total)) {
        issues.push({
          field: 'total',
          message: `total (${total.toFixed(2)}) != importe (${importe.toFixed(2)}) + IVA (${sumIva.toFixed(2)}) = ${expected.toFixed(2)} (diff: ${(total - expected).toFixed(2)})`,
          severity: 'error',
        });
      }
    }
  }

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
