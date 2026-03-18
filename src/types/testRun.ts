import type { DocType, ErrorCategory } from './golden';
import type { ApiTestRun, ApiTraceParams } from '../services/ocrTestingApi';

export type TestRunStatus = 'completed' | 'in_progress' | 'failed' | 'queued';

export type DocTestStatus = 'passed' | 'failed' | 'no_output' | 'copy_failed' | 'ocr_error' | 'timeout' | 'processing' | 'pending';

export type FieldComparisonResult = 'match' | 'mismatch' | 'missing' | 'extra';

export interface FieldComparison {
  fieldName: string;
  expected: string;
  actual: string;
  result: FieldComparisonResult;
  similarity?: number;
  reason?: string;
  errorCategory?: ErrorCategory;
}

export interface DocTestResult {
  id: string;
  testRunId: string;
  docId: string;
  docNumber: string;
  docType: DocType;
  locationId: string;
  categoryDate: string;
  supplier: string;
  date: string;
  totalAmount: number;
  currency: string;
  status: DocTestStatus;
  errorCategories: ErrorCategory[];
  errorReasons: string[];
  fieldComparisons: FieldComparison[];
  accuracy: number;
  imageUrl?: string;
  traceParams?: ApiTraceParams;
}

export interface TestRun {
  id: string;
  name: string;
  datasetId: string;
  datasetName: string;
  status: TestRunStatus;
  progress: number; // 0-100
  totalDocs: number;
  processedDocs: number;
  passedDocs: number;
  failedDocs: number;
  accuracy: number;
  locationIds: string[];
  docTypes: DocType[];
  errorSummary: Partial<Record<ErrorCategory, number>>;
  createdAt: string;
  duration?: string; // e.g. "2m 34s"
  model: string;
  _raw?: ApiTestRun;
}
