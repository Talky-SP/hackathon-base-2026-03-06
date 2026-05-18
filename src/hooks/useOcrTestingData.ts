import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../services/ocrTestingApi';
import { MOCK_DATASETS } from '../data/goldenMockData';
import { MOCK_TEST_RUNS, getTestRunResults } from '../data/testMockData';
import type { GoldenDataset } from '../types/golden';
import type { TestRun, DocTestResult } from '../types/testRun';

// Set to true to use real API, false for mock data
const USE_API = true;

// ─── Datasets ─────────────────────────────────────────────────────────────

function apiDatasetToLocal(d: api.ApiDataset): GoldenDataset {
  return {
    id: d.datasetId,
    name: d.name,
    description: d.description ?? '',
    totalDocs: d.documentCount,
    expenseDocs: d.documentTypes['expense'] ?? 0,
    incomeDocs: d.documentTypes['income'] ?? 0,
    payrollDocs: d.documentTypes['payroll'] ?? 0,
    deliveryNoteDocs: d.documentTypes['delivery_note'] ?? 0,
    locationIds: [], // not returned by list API
    errorCategories: [],
    evolution: [],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    locationCount: d.locationCount,
  };
}

export function useDatasets() {
  const [datasets, setDatasets] = useState<GoldenDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const res = await api.listDatasets();
        setDatasets(res.items.map(apiDatasetToLocal));
      } else {
        setDatasets(MOCK_DATASETS);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch datasets');
      // Fall back to mock data on error
      setDatasets(MOCK_DATASETS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDatasets(); }, [fetchDatasets]);

  return { datasets, loading, error, refetch: fetchDatasets };
}

// ─── Seed Dataset ─────────────────────────────────────────────────────────

export function useSeedDataset() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seed = useCallback(async (req: api.SeedDatasetRequest) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.seedDataset(req);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to seed dataset';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { seed, loading, error };
}

// ─── Dataset Detail ──────────────────────────────────────────────────────

export function useDeleteDataset() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteDataset = useCallback(async (datasetId: string) => {
    setLoading(true);
    setError(null);
    try {
      return await api.deleteDataset(datasetId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete dataset';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteDataset, loading, error };
}

export function useDatasetDetail(datasetId: string | undefined) {
  const [dataset, setDataset] = useState<GoldenDataset | null>(null);
  const [documents, setDocuments] = useState<api.ApiDatasetDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const [ds, docsRes] = await Promise.all([
          api.getDataset(datasetId),
          api.listDatasetDocuments(datasetId, 200),
        ]);
        setDataset(apiDatasetToLocal(ds));
        setDocuments(docsRes.items);
      } else {
        const ds = MOCK_DATASETS.find(d => d.id === datasetId) ?? null;
        setDataset(ds);
        setDocuments([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dataset');
      const ds = MOCK_DATASETS.find(d => d.id === datasetId) ?? null;
      setDataset(ds);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  return { dataset, documents, loading, error, refetch: fetchDetail };
}

// ─── Test Runs ────────────────────────────────────────────────────────────

function apiTestRunToLocal(r: api.ApiTestRun): TestRun {
  const statusMap: Record<string, TestRun['status']> = {
    COMPLETED: 'completed',
    PROCESSING_OCR: 'in_progress',
    COMPARING: 'in_progress',
    FIRING_OCR: 'in_progress',
    COPYING_PDFS: 'in_progress',
    INITIALIZING: 'queued',
    FAILED: 'failed',
  };
  // OCR testing API returns accuracy ratios in 0..1.
  const fieldAccPct = r.fieldAccuracy != null ? Math.round(r.fieldAccuracy * 100) : 0;
  return {
    id: r.testRunId,
    name: r.name,
    datasetId: r.datasetId ?? '',
    datasetName: r.datasetName ?? r.datasetId ?? '',
    status: statusMap[r.runStatus] ?? 'queued',
    progress: r.totalDocs > 0 ? Math.round(((r.processedDocs ?? 0) / r.totalDocs) * 100) : 0,
    totalDocs: r.totalDocs,
    processedDocs: r.processedDocs ?? 0,
    passedDocs: r.perfectDocs ?? 0,
    failedDocs: (r.processedDocs ?? 0) - (r.perfectDocs ?? 0),
    accuracy: fieldAccPct,
    locationIds: [],
    docTypes: Object.keys(r.byDocType ?? {}) as TestRun['docTypes'],
    errorSummary: {},
    createdAt: r.createdAt,
    duration: r.completedAt
      ? formatDuration(new Date(r.createdAt), new Date(r.completedAt))
      : undefined,
    model: r.mode ?? 'reprocess',
    // Pass through raw API data for detail page
    _raw: r,
  };
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return mins > 0 ? `${mins}m ${String(remainSecs).padStart(2, '0')}s` : `${secs}s`;
}

export function useTestRuns() {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTestRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const res = await api.listTestRuns();
        setTestRuns(res.items.map(apiTestRunToLocal));
      } else {
        setTestRuns(MOCK_TEST_RUNS);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch test runs');
      setTestRuns(MOCK_TEST_RUNS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTestRuns(); }, [fetchTestRuns]);

  return { testRuns, loading, error, refetch: fetchTestRuns };
}

// ─── Single Test Run + Results ────────────────────────────────────────────

export function useTestRunDetail(testRunId: string | undefined) {
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [results, setResults] = useState<DocTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!testRunId) return;
    setLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const data = await api.getTestRun(testRunId);
        setTestRun(apiTestRunToLocal(data));
        // Transform API doc results to local format
        setResults((data.documents ?? []).map(d => apiDocToLocal(testRunId, d)));
      } else {
        const run = MOCK_TEST_RUNS.find(r => r.id === testRunId) ?? null;
        setTestRun(run);
        setResults(testRunId ? getTestRunResults(testRunId) : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch test run');
      const run = MOCK_TEST_RUNS.find(r => r.id === testRunId) ?? null;
      setTestRun(run);
      setResults(testRunId ? getTestRunResults(testRunId) : []);
    } finally {
      setLoading(false);
    }
  }, [testRunId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { testRun, results, loading, error, refetch: fetch_ };
}

const VERDICT_STATUS: Record<string, DocTestResult['status']> = {
  PASS: 'passed',
  FAIL: 'failed',
  NO_OUTPUT: 'no_output',
  COPY_FAILED: 'copy_failed',
  OCR_ERROR: 'ocr_error',
  TIMEOUT: 'timeout',
};

function getDocumentNumber(d: api.ApiTestRunDoc): string {
  const fieldNameByDocType: Record<string, string> = {
    expense: 'invoice_number',
    income: 'invoice_number',
    delivery_note: 'delivery_note_number',
    payroll: 'payroll_number',
  };
  const fieldName = fieldNameByDocType[d.documentType];
  if (!fieldName) return '';
  const field = d.fieldResults?.[fieldName];
  return field?.actualDisplay || field?.expectedDisplay || '';
}

function apiDocToLocal(testRunId: string, d: api.ApiTestRunDoc): DocTestResult {
  const fieldComparisons = Object.entries(d.fieldResults ?? {}).map(([name, r]) => ({
    fieldName: name,
    // Prefer display strings from API, fall back to raw values
    expected: r.expectedDisplay ?? String(r.expected ?? ''),
    actual: r.actualDisplay ?? String(r.actual ?? ''),
    result: r.match ? 'match' as const : 'mismatch' as const,
    similarity: r.similarity,
    reason: r.reason || undefined,
  }));

  // Extract supplier/total from display strings
  const supplierResult = d.fieldResults?.supplier;
  const supplier = supplierResult?.actualDisplay || supplierResult?.expectedDisplay || '';

  const totalResult = d.fieldResults?.total ?? d.fieldResults?.importe;
  const totalAmount = totalResult
    ? parseFloat(totalResult.actualDisplay || totalResult.expectedDisplay || '0') || 0
    : 0;

  // Collect unique error reasons from mismatched fields
  const errorReasons = [...new Set(
    Object.values(d.fieldResults ?? {})
      .filter(r => !r.match && r.reason)
      .map(r => r.reason)
  )];

  const parts = d.categoryDate.split('#');
  const category = parts[0] ?? '';
  const date = parts.length > 1 ? parts[1] : '';
  const docId = parts.length > 2 ? parts[2]?.substring(0, 8) : '';

  return {
    id: `${testRunId}-${d.locationId}-${d.categoryDate}`,
    testRunId,
    docId: d.SK ? d.SK.replace(/^DOC#/, '') : `${d.locationId}||${d.categoryDate}`,
    docNumber: `${category}${docId ? ` #${docId}` : ''}`,
    documentNumber: getDocumentNumber(d),
    docType: (d.documentType as DocTestResult['docType']) ?? 'expense',
    locationId: d.locationId,
    categoryDate: d.categoryDate,
    supplier,
    date,
    totalAmount,
    currency: 'EUR',
    status: VERDICT_STATUS[d.verdict] ?? 'failed',
    errorCategories: [],
    errorReasons,
    fieldComparisons,
    // fieldAccuracy from doc is 0-1
    accuracy: Math.round((d.fieldAccuracy ?? 0) * 100),
    traceParams: d.traceParams,
  };
}

// ─── Start Test Run ───────────────────────────────────────────────────────

export function useStartTestRun() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (req: api.StartTestRunRequest) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.startTestRun(req);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start test run';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { start, loading, error };
}

// ─── Poll Test Run Status ─────────────────────────────────────────────────

export function useTestRunPolling(testRunId: string | null) {
  const [status, setStatus] = useState<api.TestRunStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!testRunId || !USE_API) return;

    const poll = async () => {
      try {
        const s = await api.getTestRunStatus(testRunId);
        setStatus(s);
        if (s.runStatus === 'COMPLETED' || s.runStatus === 'FAILED') {
          clearInterval(intervalRef.current);
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => clearInterval(intervalRef.current);
  }, [testRunId]);

  return status;
}
