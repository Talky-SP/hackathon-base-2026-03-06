import type { GoldenDataset, GoldenDocument, ErrorCategory, DocType } from '../types/golden';

export const MOCK_DATASETS: GoldenDataset[] = [
  {
    id: 'ds-001',
    name: 'Restaurant Chain Q4 2025',
    description: 'Dataset completo de cadena de restaurantes para Q4 2025',
    totalDocs: 342,
    expenseDocs: 156,
    incomeDocs: 89,
    payrollDocs: 45,
    deliveryNoteDocs: 52,
    locationIds: ['loc-001', 'loc-002', 'loc-003', 'loc-004', 'loc-005'],
    errorCategories: ['missing_field', 'wrong_amount', 'ocr_error'],
    evolution: [
      { date: '2025-10-01', docs: 45 },
      { date: '2025-10-15', docs: 98 },
      { date: '2025-11-01', docs: 156 },
      { date: '2025-11-15', docs: 220 },
      { date: '2025-12-01', docs: 289 },
      { date: '2025-12-15', docs: 342 },
    ],
    createdAt: '2025-10-01',
    updatedAt: '2025-12-15',
  },
  {
    id: 'ds-002',
    name: 'Hotel Group Invoices',
    description: 'Facturas del grupo hotelero para validacion',
    totalDocs: 128,
    expenseDocs: 67,
    incomeDocs: 41,
    payrollDocs: 12,
    deliveryNoteDocs: 8,
    locationIds: ['loc-006', 'loc-007'],
    errorCategories: ['wrong_date', 'format_error'],
    evolution: [
      { date: '2025-11-01', docs: 30 },
      { date: '2025-11-15', docs: 65 },
      { date: '2025-12-01', docs: 98 },
      { date: '2025-12-15', docs: 128 },
    ],
    createdAt: '2025-11-01',
    updatedAt: '2025-12-15',
  },
  {
    id: 'ds-003',
    name: 'Retail Expenses 2025',
    description: 'Gastos de retail para entrenamiento del modelo',
    totalDocs: 567,
    expenseDocs: 312,
    incomeDocs: 145,
    payrollDocs: 68,
    deliveryNoteDocs: 42,
    locationIds: ['loc-008', 'loc-009', 'loc-010', 'loc-011', 'loc-012', 'loc-013', 'loc-014', 'loc-015'],
    errorCategories: ['missing_field', 'wrong_amount', 'calculation_error', 'duplicate'],
    evolution: [
      { date: '2025-06-01', docs: 80 },
      { date: '2025-07-01', docs: 160 },
      { date: '2025-08-01', docs: 270 },
      { date: '2025-09-01', docs: 380 },
      { date: '2025-10-01', docs: 450 },
      { date: '2025-11-01', docs: 520 },
      { date: '2025-12-01', docs: 567 },
    ],
    createdAt: '2025-06-01',
    updatedAt: '2025-12-01',
  },
  {
    id: 'ds-004',
    name: 'Clinic Network Payrolls',
    description: 'Nominas de red de clinicas',
    totalDocs: 89,
    expenseDocs: 12,
    incomeDocs: 5,
    payrollDocs: 67,
    deliveryNoteDocs: 5,
    locationIds: ['loc-016', 'loc-017', 'loc-018'],
    errorCategories: ['wrong_supplier', 'ocr_error'],
    evolution: [
      { date: '2025-09-01', docs: 20 },
      { date: '2025-10-01', docs: 45 },
      { date: '2025-11-01', docs: 70 },
      { date: '2025-12-01', docs: 89 },
    ],
    createdAt: '2025-09-01',
    updatedAt: '2025-12-01',
  },
  {
    id: 'ds-005',
    name: 'Delivery Notes Validation',
    description: 'Albaranes para validacion de modelo de delivery notes',
    totalDocs: 234,
    expenseDocs: 23,
    incomeDocs: 15,
    payrollDocs: 8,
    deliveryNoteDocs: 188,
    locationIds: ['loc-019', 'loc-020', 'loc-021', 'loc-022'],
    errorCategories: ['missing_field', 'format_error', 'wrong_amount'],
    evolution: [
      { date: '2025-08-01', docs: 40 },
      { date: '2025-09-01', docs: 95 },
      { date: '2025-10-01', docs: 148 },
      { date: '2025-11-01', docs: 200 },
      { date: '2025-12-01', docs: 234 },
    ],
    createdAt: '2025-08-01',
    updatedAt: '2025-12-01',
  },
  {
    id: 'ds-006',
    name: 'Mixed Docs - Stress Test',
    description: 'Dataset mixto para pruebas de estres del sistema',
    totalDocs: 1024,
    expenseDocs: 412,
    incomeDocs: 298,
    payrollDocs: 156,
    deliveryNoteDocs: 158,
    locationIds: ['loc-001', 'loc-006', 'loc-008', 'loc-016', 'loc-019', 'loc-023'],
    errorCategories: ['missing_field', 'wrong_amount', 'wrong_date', 'wrong_supplier', 'ocr_error', 'calculation_error'],
    evolution: [
      { date: '2025-07-01', docs: 150 },
      { date: '2025-08-01', docs: 320 },
      { date: '2025-09-01', docs: 510 },
      { date: '2025-10-01', docs: 720 },
      { date: '2025-11-01', docs: 890 },
      { date: '2025-12-01', docs: 1024 },
    ],
    createdAt: '2025-07-01',
    updatedAt: '2025-12-01',
  },
];

const suppliers = [
  'Makro España S.A.', 'Coca-Cola European Partners', 'Pescanova S.A.',
  'Campofrio Food Group', 'Mahou San Miguel', 'Grupo Calvo',
  'El Pozo Alimentacion', 'Danone S.A.', 'Nestle España',
  'Heineken España', 'Bimbo Iberia', 'Mercadona S.A.',
  'Distribuciones Garcia', 'Servicios Integrales SL', 'Limpieza Total SA',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDocs(datasetId: string, docType: DocType, count: number): GoldenDocument[] {
  const prefixes: Record<DocType, string> = {
    expense: 'FG',
    income: 'FI',
    payroll: 'NOM',
    delivery_note: 'ALB',
  };

  const errorCats: ErrorCategory[] = [
    'missing_field', 'wrong_amount', 'wrong_date', 'wrong_supplier',
    'ocr_error', 'duplicate', 'format_error', 'calculation_error',
  ];

  return Array.from({ length: count }, (_, i) => {
    const hasErrors = Math.random() > 0.65;
    const numErrors = hasErrors ? Math.floor(Math.random() * 3) + 1 : 0;
    const docErrors: ErrorCategory[] = [];
    for (let j = 0; j < numErrors; j++) {
      const cat = randomFrom(errorCats);
      if (!docErrors.includes(cat)) docErrors.push(cat);
    }

    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');

    return {
      id: `${datasetId}-${docType}-${String(i + 1).padStart(4, '0')}`,
      datasetId,
      docType,
      docNumber: `${prefixes[docType]}-2025-${String(i + 1).padStart(5, '0')}`,
      supplier: randomFrom(suppliers),
      date: `2025-${month}-${day}`,
      totalAmount: Math.round((Math.random() * 15000 + 50) * 100) / 100,
      currency: 'EUR',
      hasErrors,
      errorCategories: docErrors,
      humanChecked: Math.random() > 0.3,
      confidence: Math.round((Math.random() * 40 + 60) * 100) / 100,
    };
  });
}

export function getDocumentsForDataset(datasetId: string): GoldenDocument[] {
  const dataset = MOCK_DATASETS.find(d => d.id === datasetId);
  if (!dataset) return [];

  return [
    ...generateDocs(datasetId, 'expense', dataset.expenseDocs),
    ...generateDocs(datasetId, 'income', dataset.incomeDocs),
    ...generateDocs(datasetId, 'payroll', dataset.payrollDocs),
    ...generateDocs(datasetId, 'delivery_note', dataset.deliveryNoteDocs),
  ];
}
