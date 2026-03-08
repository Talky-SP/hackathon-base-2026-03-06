import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { validateInvoice, type ValidationIssue } from '../validation/validateInvoice';

// ─── Types ──────────────────────────────────────────────────────────────────

type FormValue = string | boolean | string[] | Record<string, unknown>;

interface FormStateContextValue {
  // Form data
  formData: Record<string, FormValue>;

  // Setters
  setValue: (path: string, value: FormValue) => void;
  setValues: (updates: Record<string, FormValue>) => void;

  // Original invoice detail (for resetting)
  originalData: Record<string, unknown> | null;

  // Validation
  validationIssues: ValidationIssue[];

  // Reset form to original data
  reset: () => void;

  // Get modified invoice detail JSON
  getModifiedData: () => Record<string, unknown>;
}

const FormStateContext = createContext<FormStateContextValue | null>(null);

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useFormState(): FormStateContextValue {
  const ctx = useContext(FormStateContext);
  if (!ctx) throw new Error('useFormState must be used within FormStateProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

interface FormStateProviderProps {
  children: React.ReactNode;
  invoiceDetail: Record<string, unknown> | null;
}

export function FormStateProvider({ children, invoiceDetail }: FormStateProviderProps) {
  const [formData, setFormData] = useState<Record<string, FormValue>>({});
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  // Initialize form data from invoice detail
  useEffect(() => {
    if (!invoiceDetail) {
      setFormData({});
      setValidationIssues([]);
      return;
    }

    // Flatten the invoice detail into form fields
    const flattened = flattenInvoiceDetail(invoiceDetail);
    setFormData(flattened);

    // Run initial validation
    const result = validateInvoice(invoiceDetail);
    setValidationIssues(result.issues);
  }, [invoiceDetail]);

  // Update single value
  const setValue = useCallback((path: string, value: FormValue) => {
    setFormData((prev) => {
      const next = { ...prev, [path]: value };

      // Rerun validation after state update
      setTimeout(() => {
        const modifiedData = unflattenFormData(next, invoiceDetail ?? {});
        const result = validateInvoice(modifiedData);
        setValidationIssues(result.issues);
      }, 0);

      return next;
    });
  }, [invoiceDetail]);

  // Update multiple values at once
  const setValues = useCallback((updates: Record<string, FormValue>) => {
    setFormData((prev) => {
      const next = { ...prev, ...updates };

      // Rerun validation after state update
      setTimeout(() => {
        const modifiedData = unflattenFormData(next, invoiceDetail ?? {});
        const result = validateInvoice(modifiedData);
        setValidationIssues(result.issues);
      }, 0);

      return next;
    });
  }, [invoiceDetail]);

  // Reset to original data
  const reset = useCallback(() => {
    if (!invoiceDetail) return;
    const flattened = flattenInvoiceDetail(invoiceDetail);
    setFormData(flattened);
    const result = validateInvoice(invoiceDetail);
    setValidationIssues(result.issues);
  }, [invoiceDetail]);

  // Get modified invoice detail
  const getModifiedData = useCallback(() => {
    return unflattenFormData(formData, invoiceDetail ?? {});
  }, [formData, invoiceDetail]);

  const value = useMemo<FormStateContextValue>(() => ({
    formData,
    setValue,
    setValues,
    originalData: invoiceDetail,
    validationIssues,
    reset,
    getModifiedData,
  }), [formData, setValue, setValues, invoiceDetail, validationIssues, reset, getModifiedData]);

  return (
    <FormStateContext.Provider value={value}>
      {children}
    </FormStateContext.Provider>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Flatten invoice detail into a flat key-value structure for form fields.
 * Top-level fields are stored as-is, nested arrays use [index].field notation.
 */
function flattenInvoiceDetail(detail: Record<string, unknown>): Record<string, FormValue> {
  const flattened: Record<string, FormValue> = {};

  // Helper to get value from detail or textract_metadata
  const getValue = (key: string): unknown => {
    const meta = detail.textract_metadata as Record<string, unknown> | undefined;
    if (meta) {
      // Check invoice_details and invoice_amounts sections
      for (const section of ['invoice_details', 'invoice_amounts']) {
        const sec = meta[section] as Record<string, unknown> | undefined;
        if (sec?.[key]) {
          const entry = sec[key] as Record<string, unknown>;
          if (entry.value !== undefined) return entry.value;
        }
      }
      // Check top-level metadata
      if (meta[key]) {
        const entry = meta[key] as Record<string, unknown>;
        if (entry.value !== undefined) return entry.value;
      }
    }
    return detail[key];
  };

  // Top-level simple fields
  const simpleFields = [
    'invoice_number', 'supplier', 'supplier_cif', 'supplier_province',
    'supplier_address', 'invoice_date', 'due_date', 'period', 'concept',
    'category', 'importe', 'total', 'retencion', 'retencion_type',
    'documentKind', 'documentKindConfidence', 'multiInvoiceDetected',
    'needsReview', 'talkyVerified', 'needsReviewReason', 'needsReviewReasons',
  ];

  for (const field of simpleFields) {
    const val = getValue(field);
    if (val !== undefined && val !== null) {
      if (typeof val === 'boolean') {
        flattened[field] = val;
      } else if (Array.isArray(val)) {
        flattened[field] = val.map(String);
      } else {
        flattened[field] = String(val);
      }
    } else {
      flattened[field] = '';
    }
  }

  // Currency
  const currency = getValue('currency');
  if (currency && typeof currency === 'object' && !Array.isArray(currency)) {
    const curr = currency as Record<string, unknown>;
    flattened['currency.code'] = String(curr.code ?? '');
    flattened['currency.symbol'] = String(curr.symbol ?? '');
  } else {
    flattened['currency.code'] = '';
    flattened['currency.symbol'] = '';
  }

  // IBANs
  const ibans = detail.ibans as Record<string, unknown>[] | undefined;
  if (Array.isArray(ibans)) {
    ibans.forEach((iban, i) => {
      flattened[`ibans[${i}].iban_normalized`] = String(iban.iban_normalized ?? iban.value ?? '');
      flattened[`ibans[${i}].owner`] = String(iban.owner ?? '');
      flattened[`ibans[${i}].role`] = String(iban.role ?? '');
    });
  }

  // IVAs from textract_metadata or direct
  const meta = detail.textract_metadata as Record<string, unknown> | undefined;
  const amounts = meta?.invoice_amounts as Record<string, unknown> | undefined;
  const metaIvas = amounts?.ivas as Record<string, unknown>[] | undefined;
  const directIvas = detail.ivas as Record<string, unknown>[] | undefined;
  const ivas = metaIvas ?? directIvas ?? [];

  if (Array.isArray(ivas)) {
    ivas.forEach((iva, i) => {
      if (metaIvas) {
        // Extract from textract metadata
        const base = iva.base_imponible as Record<string, unknown> | undefined;
        const rate = iva.type as Record<string, unknown> | undefined;
        const amount = iva.amount as Record<string, unknown> | undefined;
        flattened[`invoice_amounts.ivas[${i}].base_imponible`] = String(base?.value ?? '');
        flattened[`invoice_amounts.ivas[${i}].type`] = String(rate?.value ?? '');
        flattened[`invoice_amounts.ivas[${i}].amount`] = String(amount?.value ?? '');
      } else {
        // Direct values
        flattened[`invoice_amounts.ivas[${i}].base_imponible`] = String(iva.base_imponible ?? '');
        flattened[`invoice_amounts.ivas[${i}].type`] = String(iva.type ?? '');
        flattened[`invoice_amounts.ivas[${i}].amount`] = String(iva.amount ?? '');
      }
    });
  }

  // Descuentos generales
  const metaDesc = amounts?.descuentos_generales as Record<string, unknown>[] | undefined;
  const directDesc = detail.descuentos_generales as Record<string, unknown>[] | undefined;
  const descuentos = metaDesc ?? directDesc ?? [];

  if (Array.isArray(descuentos)) {
    descuentos.forEach((desc, i) => {
      if (metaDesc) {
        const name = desc.discount_name as Record<string, unknown> | undefined;
        const amount = desc.discount_amount as Record<string, unknown> | undefined;
        flattened[`invoice_amounts.descuentos_generales[${i}].discount_name`] = String(name?.value ?? '');
        flattened[`invoice_amounts.descuentos_generales[${i}].discount_amount`] = String(amount?.value ?? '');
      } else {
        flattened[`invoice_amounts.descuentos_generales[${i}].discount_name`] = String(desc.discount_name ?? '');
        flattened[`invoice_amounts.descuentos_generales[${i}].discount_amount`] = String(desc.discount_amount ?? '');
      }
    });
  }

  // Products
  const products = detail.all_products as Record<string, unknown>[] | undefined;
  if (Array.isArray(products)) {
    products.forEach((prod, i) => {
      const fields = ['product_name', 'quantity', 'unit_price', 'final_price', 'discount', 'category', 'product_id'];
      for (const field of fields) {
        flattened[`all_products[${i}].${field}`] = String(prod[field] ?? '');
      }
    });
  }

  return flattened;
}

/**
 * Convert flattened form data back into invoice detail structure.
 */
function unflattenFormData(formData: Record<string, FormValue>, originalDetail: Record<string, unknown>): Record<string, unknown> {
  const result = { ...originalDetail };

  // Top-level simple fields
  const simpleFields = [
    'invoice_number', 'supplier', 'supplier_cif', 'supplier_province',
    'supplier_address', 'invoice_date', 'due_date', 'period', 'concept',
    'category', 'importe', 'total', 'retencion', 'retencion_type',
    'documentKind', 'documentKindConfidence', 'multiInvoiceDetected',
    'needsReview', 'talkyVerified', 'needsReviewReason',
  ];

  for (const field of simpleFields) {
    const val = formData[field];
    if (val !== undefined) {
      // Try to preserve original type
      if (field === 'multiInvoiceDetected' || field === 'needsReview' || field === 'talkyVerified') {
        result[field] = val === true || val === 'true';
      } else if (field === 'importe' || field === 'total' || field === 'retencion' || field === 'documentKindConfidence') {
        const num = parseFloat(String(val));
        result[field] = isNaN(num) ? val : num;
      } else {
        result[field] = val;
      }
    }
  }

  // needsReviewReasons (array)
  const reasons = formData.needsReviewReasons;
  if (Array.isArray(reasons)) {
    result.needsReviewReasons = reasons;
  }

  // Currency
  if (formData['currency.code'] !== undefined || formData['currency.symbol'] !== undefined) {
    result.currency = {
      code: formData['currency.code'] || '',
      symbol: formData['currency.symbol'] || '',
    };
  }

  // IBANs
  const ibanIndices = new Set<number>();
  for (const key of Object.keys(formData)) {
    const match = key.match(/^ibans\[(\d+)\]/);
    if (match) ibanIndices.add(parseInt(match[1], 10));
  }
  if (ibanIndices.size > 0) {
    const ibans: Record<string, unknown>[] = [];
    for (const i of Array.from(ibanIndices).sort((a, b) => a - b)) {
      ibans.push({
        iban_normalized: formData[`ibans[${i}].iban_normalized`] || '',
        owner: formData[`ibans[${i}].owner`] || '',
        role: formData[`ibans[${i}].role`] || '',
      });
    }
    result.ibans = ibans;
  }

  // IVAs
  const ivaIndices = new Set<number>();
  for (const key of Object.keys(formData)) {
    const match = key.match(/^invoice_amounts\.ivas\[(\d+)\]/);
    if (match) ivaIndices.add(parseInt(match[1], 10));
  }
  if (ivaIndices.size > 0) {
    const ivas: Record<string, unknown>[] = [];
    for (const i of Array.from(ivaIndices).sort((a, b) => a - b)) {
      const base = parseFloat(String(formData[`invoice_amounts.ivas[${i}].base_imponible`] || '0'));
      const type = parseFloat(String(formData[`invoice_amounts.ivas[${i}].type`] || '0'));
      const amount = parseFloat(String(formData[`invoice_amounts.ivas[${i}].amount`] || '0'));
      ivas.push({
        base_imponible: isNaN(base) ? 0 : base,
        type: isNaN(type) ? 0 : type,
        amount: isNaN(amount) ? 0 : amount,
      });
    }
    result.ivas = ivas;
  }

  // Descuentos generales
  const descIndices = new Set<number>();
  for (const key of Object.keys(formData)) {
    const match = key.match(/^invoice_amounts\.descuentos_generales\[(\d+)\]/);
    if (match) descIndices.add(parseInt(match[1], 10));
  }
  if (descIndices.size > 0) {
    const descuentos: Record<string, unknown>[] = [];
    for (const i of Array.from(descIndices).sort((a, b) => a - b)) {
      const name = formData[`invoice_amounts.descuentos_generales[${i}].discount_name`] || '';
      const amount = parseFloat(String(formData[`invoice_amounts.descuentos_generales[${i}].discount_amount`] || '0'));
      descuentos.push({
        discount_name: name,
        discount_amount: isNaN(amount) ? 0 : amount,
      });
    }
    result.descuentos_generales = descuentos;
  }

  // Products
  const prodIndices = new Set<number>();
  for (const key of Object.keys(formData)) {
    const match = key.match(/^all_products\[(\d+)\]/);
    if (match) prodIndices.add(parseInt(match[1], 10));
  }
  if (prodIndices.size > 0) {
    const products: Record<string, unknown>[] = [];
    for (const i of Array.from(prodIndices).sort((a, b) => a - b)) {
      const prod: Record<string, unknown> = {};
      const fields = ['product_name', 'category', 'product_id'];
      for (const field of fields) {
        prod[field] = formData[`all_products[${i}].${field}`] || '';
      }
      const numFields = ['quantity', 'unit_price', 'final_price', 'discount'];
      for (const field of numFields) {
        const val = parseFloat(String(formData[`all_products[${i}].${field}`] || '0'));
        prod[field] = isNaN(val) ? 0 : val;
      }
      // Preserve pack_ai from original
      const origProducts = originalDetail.all_products as Record<string, unknown>[] | undefined;
      if (origProducts?.[i]?.pack_ai) {
        prod.pack_ai = origProducts[i].pack_ai;
      }
      products.push(prod);
    }
    result.all_products = products;
  }

  return result;
}
