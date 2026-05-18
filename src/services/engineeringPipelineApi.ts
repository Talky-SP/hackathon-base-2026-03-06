import { config } from '../config/environment';
import { authenticatedFetch } from './authFetch';

const BASE = config.engineeringPipelineBaseUrl;

export type PipelineEventType =
  | 'stage_start'
  | 'stage_complete'
  | 'stage_error'
  | 'ai_call'
  | 'textract_call'
  | 'lambda_invocation'
  | string;

export interface PipelineEvent {
  eventId?: string;
  eventKey?: string;
  eventType?: PipelineEventType;
  eventAt?: string;
  stage?: string;
  stageScope?: string;
  docId?: string;
  batchId?: string;
  locationId?: string;
  documentType?: string;
  flowKind?: string;
  provider?: string;
  model?: string;
  costType?: string;
  costUsd?: number | string;
  totalCostUsd?: number | string;
  costConfidence?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  durationMs?: number;
  pages?: number;
  operation?: string;
  status?: string;
  errorClass?: string;
  errorMessage?: string;
  requestId?: string;
  traceUri?: string;
  [key: string]: unknown;
}

export interface PipelineDagNode {
  id?: string;
  stage?: string;
  label?: string;
  name?: string;
  status?: string;
  eventCount?: number;
  completed?: number;
  errors?: number;
  costUsd?: number;
  totalCostUsd?: number;
  p50Ms?: number;
  p95Ms?: number;
  [key: string]: unknown;
}

export interface PipelineDagResponse {
  nodes?: PipelineDagNode[];
  events?: PipelineEvent[];
  totalCostUsd?: number;
  costUsd?: number;
  [key: string]: unknown;
}

export interface PipelineLiveResponse {
  recentEvents?: PipelineEvent[];
  events?: PipelineEvent[];
  recentDocuments?: unknown[];
  queueStatus?: unknown;
  lambdaMetrics?: unknown;
  [key: string]: unknown;
}

export interface PipelineCostsResponse {
  totalUsd?: number;
  perDocUsd?: number;
  perPageUsd?: number;
  unknownCostEvents?: number;
  breakdown?: unknown;
  events?: PipelineEvent[];
  [key: string]: unknown;
}

export interface PipelineDocumentsResponse {
  documents?: unknown[];
  items?: unknown[];
  [key: string]: unknown;
}

export interface PipelineErrorsResponse {
  errors?: unknown[];
  items?: unknown[];
  [key: string]: unknown;
}

export interface PipelineDocumentDetailResponse {
  timeline?: PipelineEvent[];
  events?: PipelineEvent[];
  aiCalls?: PipelineEvent[];
  ai_calls?: PipelineEvent[];
  textractCalls?: PipelineEvent[];
  textract_calls?: PipelineEvent[];
  lambdaInvocations?: PipelineEvent[];
  lambda_invocations?: PipelineEvent[];
  errors?: PipelineEvent[];
  requestIds?: string[];
  traceUris?: string[];
  [key: string]: unknown;
}

async function jsonGet<T>(url: string): Promise<T> {
  const res = await authenticatedFetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}${text ? `: ${text.slice(0, 240)}` : ''}`);
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function qs(params?: Record<string, string | number | undefined>): string {
  const out = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') out.set(key, String(value));
  });
  const text = out.toString();
  return text ? `?${text}` : '';
}

export function getPipelineLive(
  locationId: string,
  params?: { from?: string; to?: string; limit?: number },
): Promise<PipelineLiveResponse> {
  return jsonGet(`${BASE}/locations/${encodeURIComponent(locationId)}/engineering/pipeline/live${qs(params)}`);
}

export function getPipelineDag(
  locationId: string,
  params?: { from?: string; to?: string; limit?: number },
): Promise<PipelineDagResponse> {
  return jsonGet(`${BASE}/locations/${encodeURIComponent(locationId)}/engineering/pipeline/dag${qs(params)}`);
}

export function getPipelineCosts(
  locationId: string,
  params?: { from?: string; to?: string; limit?: number; documentType?: string; stage?: string; costType?: string; provider?: string; model?: string },
): Promise<PipelineCostsResponse> {
  return jsonGet(`${BASE}/locations/${encodeURIComponent(locationId)}/engineering/pipeline/costs${qs(params)}`);
}

export function getPipelineDocuments(
  locationId: string,
  params?: { from?: string; to?: string; limit?: number },
): Promise<PipelineDocumentsResponse> {
  return jsonGet(`${BASE}/locations/${encodeURIComponent(locationId)}/engineering/pipeline/documents${qs(params)}`);
}

export function getPipelineDocumentDetail(
  locationId: string,
  docId: string,
): Promise<PipelineDocumentDetailResponse> {
  return jsonGet(
    `${BASE}/locations/${encodeURIComponent(locationId)}/engineering/pipeline/documents/${encodeURIComponent(docId)}`,
  );
}

export function getPipelineErrors(
  locationId: string,
  params?: { from?: string; to?: string; limit?: number },
): Promise<PipelineErrorsResponse> {
  return jsonGet(`${BASE}/locations/${encodeURIComponent(locationId)}/engineering/pipeline/errors${qs(params)}`);
}
