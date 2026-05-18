export type DocType = 'expense' | 'income' | 'payroll' | 'delivery_note';

export type ErrorCategory =
  | 'missing_field'
  | 'wrong_amount'
  | 'wrong_date'
  | 'wrong_supplier'
  | 'ocr_error'
  | 'duplicate'
  | 'format_error'
  | 'calculation_error';

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, { es: string; en: string }> = {
  missing_field: { es: 'Campo faltante', en: 'Missing field' },
  wrong_amount: { es: 'Importe incorrecto', en: 'Wrong amount' },
  wrong_date: { es: 'Fecha incorrecta', en: 'Wrong date' },
  wrong_supplier: { es: 'Proveedor incorrecto', en: 'Wrong supplier' },
  ocr_error: { es: 'Error OCR', en: 'OCR error' },
  duplicate: { es: 'Duplicado', en: 'Duplicate' },
  format_error: { es: 'Error de formato', en: 'Format error' },
  calculation_error: { es: 'Error de calculo', en: 'Calculation error' },
};

export const DOC_TYPE_LABELS: Record<DocType, { es: string; en: string }> = {
  expense: { es: 'Gastos', en: 'Expenses' },
  income: { es: 'Ingresos', en: 'Income' },
  payroll: { es: 'Nominas', en: 'Payrolls' },
  delivery_note: { es: 'Albaranes', en: 'Delivery Notes' },
};

export interface GoldenDocument {
  id: string;
  datasetId: string;
  docType: DocType;
  docNumber: string;
  supplier: string;
  date: string;
  totalAmount: number;
  currency: string;
  hasErrors: boolean;
  errorCategories: ErrorCategory[];
  imageUrl?: string;
  humanChecked: boolean;
  confidence: number;
}

export interface DatasetEvolution {
  date: string;
  docs: number;
}

export interface GoldenDataset {
  id: string;
  name: string;
  description: string;
  totalDocs: number;
  expenseDocs: number;
  incomeDocs: number;
  payrollDocs: number;
  deliveryNoteDocs: number;
  locationIds: string[];
  errorCategories: ErrorCategory[];
  evolution: DatasetEvolution[];
  createdAt: string;
  updatedAt: string;
  locationCount?: number;
  verified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  verifiedNote?: string;
}

export interface TestQueueItem {
  type: 'dataset' | 'document';
  id: string;
  label: string;
  sublabel: string;
  docCount?: number;
  /** 'ocr' = invoice/doc tests, 'stock' = stock pipeline tests */
  source?: 'ocr' | 'stock';
  /** Stock-specific: dataset ID for filtered runs */
  stockDatasetId?: string;
  /** Stock-specific: specific doc keys to test */
  stockDocKeys?: string[];
  /** Stock-specific: filter by supplier CIF */
  stockSupplierCif?: string;
  /** Stock-specific: filter by ingredient ID */
  stockIngredientId?: string;
}
