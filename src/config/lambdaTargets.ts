export interface LambdaTargetOption {
  id: string;
  label: string;
  stage: string;
  description: string;
}

export interface InvoiceOcrTargetOption {
  value: 'legacy' | 'invoices_ocr_v2' | 'invoices_ocr_v2_starter';
  label: string;
  description: string;
}

export const INVOICE_OCR_TARGETS: InvoiceOcrTargetOption[] = [
  {
    value: 'legacy',
    label: 'Legacy Invoices OCR',
    description: 'Parallel_Process_Invoices Step Function',
  },
  {
    value: 'invoices_ocr_v2',
    label: 'Invoices OCR V2 Workflow',
    description: 'Invoices_OCR_V2_Workflow Step Function',
  },
  {
    value: 'invoices_ocr_v2_starter',
    label: 'Invoices OCR V2 Starter Lambda',
    description: 'Invoices_OCR_V2_Starter Lambda',
  },
];

export const OCR_LAMBDA_TARGETS: LambdaTargetOption[] = [
  {
    id: 'Invoices_OCR',
    label: 'Invoices OCR',
    stage: 'ocr',
    description: 'Invoice extraction pipeline',
  },
  {
    id: 'Delivery_Notes_OCR',
    label: 'Delivery Notes OCR',
    stage: 'ocr',
    description: 'Delivery note extraction pipeline',
  },
  {
    id: 'Payroll_OCR',
    label: 'Payroll OCR',
    stage: 'ocr',
    description: 'Payroll extraction pipeline',
  },
];

export const STOCK_LAMBDA_TARGETS: LambdaTargetOption[] = [
  {
    id: 'Delivery_Notes_OCR',
    label: 'Delivery Notes OCR',
    stage: 'ocr',
    description: 'Extract delivery note fields and lines',
  },
  {
    id: 'Products_Normalizer',
    label: 'Products Normalizer',
    stage: 'normalization',
    description: 'Normalize products and assign ingredient IDs',
  },
  {
    id: 'PO_Materials_Batch_Resolver',
    label: 'PO Materials Batch Resolver',
    stage: 'materials',
    description: 'Resolve material batches',
  },
  {
    id: 'Purchase_Orders_Matching',
    label: 'Purchase Orders Matching',
    stage: 'matching',
    description: 'Match purchase orders and delivery note lines',
  },
];

