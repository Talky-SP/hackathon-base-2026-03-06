import type { TestRun, DocTestResult, FieldComparison, DocTestStatus, FieldComparisonResult } from '../types/testRun';
import type { DocType, ErrorCategory } from '../types/golden';

const errorCats: ErrorCategory[] = [
  'missing_field', 'wrong_amount', 'wrong_date', 'wrong_supplier',
  'ocr_error', 'duplicate', 'format_error', 'calculation_error',
];

const suppliers = [
  'Makro España S.A.', 'Coca-Cola European Partners', 'Pescanova S.A.',
  'Campofrio Food Group', 'Mahou San Miguel', 'Grupo Calvo',
  'El Pozo Alimentacion', 'Danone S.A.', 'Nestle España',
  'Heineken España', 'Bimbo Iberia', 'Mercadona S.A.',
];

const fieldNames = [
  'invoice_number', 'supplier', 'supplier_cif', 'invoice_date',
  'due_date', 'total', 'importe', 'category', 'concept',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateFieldComparisons(rand: () => number, failed: boolean): FieldComparison[] {
  return fieldNames.map(name => {
    const isMismatch = failed && rand() > 0.6;
    const results: FieldComparisonResult[] = ['match', 'mismatch', 'missing', 'extra'];
    const result: FieldComparisonResult = isMismatch ? pick(results.slice(1)) : 'match';
    return {
      fieldName: name,
      expected: `expected_${name}`,
      actual: result === 'match' ? `expected_${name}` : `wrong_${name}`,
      result,
      ...(result !== 'match' ? { errorCategory: pick(errorCats) } : {}),
    };
  });
}

function generateDocResults(testRunId: string, totalDocs: number, status: TestRun['status'], progress: number, seed: number): DocTestResult[] {
  const rand = seededRandom(seed);
  const docTypes: DocType[] = ['expense', 'income', 'payroll', 'delivery_note'];
  const prefixes: Record<DocType, string> = { expense: 'FG', income: 'FI', payroll: 'NOM', delivery_note: 'ALB' };
  const processedCount = Math.floor(totalDocs * progress / 100);

  return Array.from({ length: totalDocs }, (_, i) => {
    const docType = docTypes[i % 4];
    const isProcessed = i < processedCount;
    const isFailed = isProcessed && rand() > 0.62;
    const isPending = !isProcessed && status === 'in_progress';

    let docStatus: DocTestStatus;
    if (!isProcessed && status === 'queued') docStatus = 'pending';
    else if (isPending) docStatus = i < processedCount + 3 ? 'processing' : 'pending';
    else if (isFailed) docStatus = 'failed';
    else docStatus = 'passed';

    const fieldComps = generateFieldComparisons(rand, isFailed);
    const matchCount = fieldComps.filter(f => f.result === 'match').length;
    const accuracy = isProcessed ? Math.round((matchCount / fieldComps.length) * 100) : 0;

    const docErrors: ErrorCategory[] = isFailed
      ? fieldComps.filter(f => f.errorCategory).map(f => f.errorCategory!)
        .filter((v, idx, arr) => arr.indexOf(v) === idx).slice(0, 3)
      : [];

    const month = String((i % 12) + 1).padStart(2, '0');
    const day = String((i % 28) + 1).padStart(2, '0');

    return {
      id: `${testRunId}-doc-${String(i + 1).padStart(4, '0')}`,
      testRunId,
      docId: `doc-${String(i + 1).padStart(4, '0')}`,
      docNumber: `${prefixes[docType]}-2025-${String(i + 1).padStart(5, '0')}`,
      docType,
      locationId: `mock-loc-${i % 5}`,
      categoryDate: `${docType}#2025-${month}-${day}`,
      supplier: suppliers[i % suppliers.length],
      date: `2025-${month}-${day}`,
      totalAmount: Math.round((rand() * 12000 + 50) * 100) / 100,
      currency: 'EUR',
      status: docStatus,
      errorCategories: docErrors,
      errorReasons: isFailed ? ['string_mismatch'] : [],
      fieldComparisons: fieldComps,
      accuracy,
    };
  });
}

function buildErrorSummary(docs: DocTestResult[]): Partial<Record<ErrorCategory, number>> {
  const summary: Partial<Record<ErrorCategory, number>> = {};
  docs.forEach(d => d.errorCategories.forEach(cat => {
    summary[cat] = (summary[cat] ?? 0) + 1;
  }));
  return summary;
}

// Pre-generate test runs
const runConfigs: Array<{
  id: string; name: string; datasetId: string; datasetName: string;
  status: TestRun['status']; progress: number; totalDocs: number;
  createdAt: string; duration?: string; model: string; seed: number;
}> = [
  {
    id: 'tr-001', name: 'Restaurant Q4 - Full Run',
    datasetId: 'ds-001', datasetName: 'Restaurant Chain Q4 2025',
    status: 'completed', progress: 100, totalDocs: 342,
    createdAt: '2026-03-07T14:30:00Z', duration: '4m 12s', model: 'claude-sonnet-4-6', seed: 42,
  },
  {
    id: 'tr-002', name: 'Hotel Invoices - Regression',
    datasetId: 'ds-002', datasetName: 'Hotel Group Invoices',
    status: 'in_progress', progress: 67, totalDocs: 128,
    createdAt: '2026-03-08T09:15:00Z', model: 'claude-sonnet-4-6', seed: 99,
  },
  {
    id: 'tr-003', name: 'Retail Expenses - v2 Model',
    datasetId: 'ds-003', datasetName: 'Retail Expenses 2025',
    status: 'completed', progress: 100, totalDocs: 567,
    createdAt: '2026-03-06T18:00:00Z', duration: '8m 45s', model: 'claude-opus-4-6', seed: 77,
  },
  {
    id: 'tr-004', name: 'Clinic Payrolls - Quick Test',
    datasetId: 'ds-004', datasetName: 'Clinic Network Payrolls',
    status: 'completed', progress: 100, totalDocs: 89,
    createdAt: '2026-03-05T11:20:00Z', duration: '1m 08s', model: 'claude-haiku-4-5', seed: 55,
  },
  {
    id: 'tr-005', name: 'Delivery Notes - Baseline',
    datasetId: 'ds-005', datasetName: 'Delivery Notes Validation',
    status: 'failed', progress: 43, totalDocs: 234,
    createdAt: '2026-03-04T16:45:00Z', duration: '2m 01s', model: 'claude-sonnet-4-6', seed: 33,
  },
  {
    id: 'tr-006', name: 'Stress Test - All Docs',
    datasetId: 'ds-006', datasetName: 'Mixed Docs - Stress Test',
    status: 'queued', progress: 0, totalDocs: 1024,
    createdAt: '2026-03-08T10:00:00Z', model: 'claude-sonnet-4-6', seed: 11,
  },
  {
    id: 'tr-007', name: 'Restaurant Q4 - Haiku Compare',
    datasetId: 'ds-001', datasetName: 'Restaurant Chain Q4 2025',
    status: 'completed', progress: 100, totalDocs: 342,
    createdAt: '2026-03-07T16:00:00Z', duration: '1m 52s', model: 'claude-haiku-4-5', seed: 88,
  },
];

// Cache generated results per run
const docResultsCache = new Map<string, DocTestResult[]>();

function getOrGenerate(config: typeof runConfigs[0]): DocTestResult[] {
  if (!docResultsCache.has(config.id)) {
    docResultsCache.set(
      config.id,
      generateDocResults(config.id, config.totalDocs, config.status, config.progress, config.seed),
    );
  }
  return docResultsCache.get(config.id)!;
}

export const MOCK_TEST_RUNS: TestRun[] = runConfigs.map(cfg => {
  const docs = getOrGenerate(cfg);
  const processed = docs.filter(d => d.status === 'passed' || d.status === 'failed');
  const passed = docs.filter(d => d.status === 'passed').length;
  const failed = docs.filter(d => d.status === 'failed').length;
  const avgAccuracy = processed.length > 0
    ? Math.round(processed.reduce((s, d) => s + d.accuracy, 0) / processed.length)
    : 0;
  const docTypes = [...new Set(docs.map(d => d.docType))];
  return {
    ...cfg,
    processedDocs: processed.length,
    passedDocs: passed,
    failedDocs: failed,
    accuracy: avgAccuracy,
    locationIds: cfg.datasetId === 'ds-001' ? ['loc-001', 'loc-002', 'loc-003'] : ['loc-006', 'loc-007'],
    docTypes,
    errorSummary: buildErrorSummary(docs),
  };
});

export function getTestRunResults(testRunId: string): DocTestResult[] {
  const cfg = runConfigs.find(c => c.id === testRunId);
  if (!cfg) return [];
  return getOrGenerate(cfg);
}
