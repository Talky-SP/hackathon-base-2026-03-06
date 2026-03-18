import { config } from '../config/environment';
import { authenticatedFetch } from './authFetch';

const BASE = config.ocrTestingBaseUrl;

// ─── Types ────────────────────────────────────────────────────────────────

export interface ApiDataset {
  datasetId: string;
  name: string;
  description?: string;
  documentCount: number;
  documentTypes: Record<string, number>;
  locationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiDatasetDocument {
  datasetId: string;
  locationId: string;
  documentType: string;
  categoryDate: string;
  companyCif?: string;
  addedAt: string;
  SK?: string;
  PK?: string;
}

export interface ApiAnnotation {
  locationId: string;
  documentType: string;
  categoryDate: string;
  companyCif?: string;
  // Document fields
  supplier?: string;
  invoice_number?: string;
  invoice_date?: string;
  total?: number;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  currency?: string;
  // File URL
  invoice_url?: string;
  document_url?: string;
  file_url?: string;
  // All other fields
  [key: string]: unknown;
}

export interface SeedDatasetRequest {
  locationId: string;
  documentTypes?: string[];
  limit?: number;
  datasetName?: string;
  filterDateFrom?: string;
  filterDateTo?: string;
  filterStatus?: string;
}

export interface SeedDatasetResponse {
  message: string;
  datasetId: string;
  datasetName: string;
  annotations: number;
  documentTypes: Record<string, number>;
  sourceLocationId: string;
  companyCif?: string;
}

export interface CreateDatasetRequest {
  name: string;
  description?: string;
}

export type ApiVerdict = 'PASS' | 'FAIL' | 'NO_OUTPUT' | 'COPY_FAILED' | 'OCR_ERROR' | 'TIMEOUT';

export interface ApiFieldResult {
  match: boolean;
  similarity: number;
  reason: string;
  expectedDisplay: string;
  actualDisplay: string;
  expected?: unknown;
  actual?: unknown;
}

export interface ApiTestRun {
  testRunId: string;
  name: string;
  runStatus: string;
  mode?: string;
  datasetId?: string;
  totalDocs: number;
  processedDocs?: number;
  perfectDocs?: number;
  totalFields?: number;
  correctFields?: number;
  fieldAccuracy?: number;  // 0-100
  docAccuracy?: number;
  errorMessage?: string;
  byField?: Record<string, { total: number; correct: number; accuracy: number; avgSimilarity?: number }>;
  byDocType?: Record<string, { totalDocs: number; perfectDocs: number; docAccuracy: number; fieldAccuracy: number }>;
  documents?: ApiTestRunDoc[];
  createdAt: string;
  date?: string;
  completedAt?: string;
}

export interface ApiTraceParams {
  original: { userId: string; docId: string };
  testRun: { userId: string; docId: string };
}

export interface ApiTestRunDoc {
  SK?: string;
  docKey?: string;
  locationId: string;
  tempLocationId?: string;
  documentType: string;
  categoryDate: string;
  verdict: ApiVerdict;
  fieldAccuracy: number;  // 0-1
  fieldsTotal: number;
  fieldsCorrect: number;
  hasError?: string;
  errorCategories?: string[];
  fieldResults: Record<string, ApiFieldResult>;
  originalDocId?: string;
  ocrDocId?: string;
  traceParams?: ApiTraceParams;
}

export interface ApiDocDetail extends ApiTestRunDoc {
  summary?: {
    matchedFields: string[];
    mismatchedFields: string[];
    missingFields: string[];
    totalFields: number;
    matchedCount: number;
    mismatchedCount: number;
    missingCount: number;
  };
}

export interface TestRunStatus {
  testRunId: string;
  runStatus: 'INITIALIZING' | 'COPYING_PDFS' | 'FIRING_OCR' | 'PROCESSING_OCR' | 'COMPARING' | 'COMPLETED' | 'FAILED';
  processedDocs: number;
  totalDocs: number;
  progress: number;
  fieldAccuracy: number;
  docAccuracy: number;
  errorMessage?: string;
}

export interface StartTestRunRequest {
  mode?: 'compare' | 'reprocess';
  datasetId: string;
  name?: string;
}

// ─── API Functions ────────────────────────────────────────────────────────

async function jsonPost<T>(url: string, body: unknown): Promise<T> {
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function jsonGet<T>(url: string): Promise<T> {
  const res = await authenticatedFetch(url);
  return res.json();
}

async function jsonDelete<T>(url: string): Promise<T> {
  const res = await authenticatedFetch(url, { method: 'DELETE' });
  return res.json();
}

// ─── Datasets ─────────────────────────────────────────────────────────────

export async function seedDataset(req: SeedDatasetRequest): Promise<SeedDatasetResponse> {
  return jsonPost(`${BASE}/datasets/seed`, req);
}

export async function createDataset(req: CreateDatasetRequest): Promise<{ message: string; datasetId: string }> {
  return jsonPost(`${BASE}/datasets`, req);
}

export async function listDatasets(): Promise<{ items: ApiDataset[]; count: number }> {
  return jsonGet(`${BASE}/datasets`);
}

export async function getDataset(datasetId: string): Promise<ApiDataset> {
  return jsonGet(`${BASE}/datasets/${datasetId}`);
}

export async function listDatasetDocuments(
  datasetId: string,
  limit = 50,
  nextToken?: string,
): Promise<{ items: ApiDatasetDocument[]; count: number; nextToken: string | null }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (nextToken) params.set('nextToken', nextToken);
  return jsonGet(`${BASE}/datasets/${datasetId}/documents?${params}`);
}

export async function deleteDataset(datasetId: string): Promise<{ message: string }> {
  return jsonDelete(`${BASE}/datasets/${datasetId}`);
}

export async function removeDocumentFromDataset(datasetId: string, docKey: string): Promise<{ message: string }> {
  return jsonDelete(`${BASE}/datasets/${datasetId}/documents/${encodeURIComponent(docKey)}`);
}

// ─── Annotations ─────────────────────────────────────────────────────────

export async function getAnnotation(locationId: string, sk: string): Promise<ApiAnnotation> {
  return jsonGet(`${BASE}/annotations/${encodeURIComponent(locationId)}/${encodeURIComponent(sk)}`);
}

// ─── Test Runs ────────────────────────────────────────────────────────────

export async function startTestRun(req: StartTestRunRequest): Promise<{ message: string; testRunId: string; status: string; totalDocs: number }> {
  return jsonPost(`${BASE}/test-runs`, req);
}

export async function listTestRuns(): Promise<{ items: ApiTestRun[]; count: number }> {
  return jsonGet(`${BASE}/test-runs`);
}

export async function getTestRun(testRunId: string): Promise<ApiTestRun> {
  return jsonGet(`${BASE}/test-runs/${testRunId}`);
}

export async function getTestRunStatus(testRunId: string): Promise<TestRunStatus> {
  return jsonGet(`${BASE}/test-runs/${testRunId}/status`);
}

export async function getTestRunDocument(testRunId: string, docSK: string): Promise<ApiDocDetail> {
  // docSK should have DOC# prefix stripped, will be URL-encoded
  return jsonGet(`${BASE}/test-runs/${testRunId}/documents/${encodeURIComponent(docSK)}`);
}

export async function cleanupTestRun(testRunId: string): Promise<{ message: string; cleaned: Record<string, number> }> {
  return jsonDelete(`${BASE}/test-runs/${testRunId}/cleanup`);
}

// ─── Analytics Dashboard ──────────────────────────────────────────────────

export interface ApiCostMetrics {
  total_usd: number;
  avg_per_doc_usd: number;
  avg_per_page_usd?: number;
  total_pages?: number;
}

export interface ApiLatencyMetrics {
  avg_execution_time_ms: number;
  min_execution_time_ms?: number;
  max_execution_time_ms?: number;
}

export interface ApiDocTypeStats {
  totalDocs: number;
  perfectDocs: number;
  fieldAccuracy: number;
  docAccuracy: number;
  costMetrics?: ApiCostMetrics;
  latencyMetrics?: ApiLatencyMetrics;
}

export interface ApiDashboardLatest {
  testRunId: string;
  date: string;
  name: string;
  totalDocs: number;
  fieldAccuracy: number;
  docAccuracy: number;
  perfectDocs: number;
  costMetrics?: ApiCostMetrics;
  latencyMetrics?: ApiLatencyMetrics;
  byDocType?: Record<string, ApiDocTypeStats>;
}

export interface ApiDashboardEvolutionPoint {
  testRunId: string;
  date: string;
  name?: string;
  fieldAccuracy: number;
  totalCostUsd: number;
  avgCostPerDocUsd: number;
  avgCostPerPageUsd?: number;
  avgExecutionTimeMs: number;
  totalDocs: number;
  totalPages?: number;
}

export interface ApiErrorEvolutionPoint {
  testRunId: string;
  date: string;
  categories: Record<string, number>;
}

export interface ApiDashboardResponse {
  latest: ApiDashboardLatest | null;
  evolution: ApiDashboardEvolutionPoint[];
  errorEvolution: {
    dataPoints: ApiErrorEvolutionPoint[];
    categoryMeta: Record<string, { name: string; color: string }>;
  };
  currentErrors: { categoryId: string; name: string; color: string; docsAffected: number }[];
  availableDocTypes: string[];
  filters: { datasetId: string | null; docType: string | null; limit: number };
  count: number;
}

export async function getAnalyticsDashboard(params?: {
  limit?: number;
  datasetId?: string;
  docType?: string;
}): Promise<ApiDashboardResponse> {
  const qs = new URLSearchParams();
  qs.set('limit', String(params?.limit ?? 20));
  if (params?.datasetId) qs.set('datasetId', params.datasetId);
  if (params?.docType) qs.set('docType', params.docType);
  return jsonGet(`${BASE}/analytics/dashboard?${qs}`);
}
