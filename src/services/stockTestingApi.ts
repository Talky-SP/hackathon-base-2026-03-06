import { config } from '../config/environment';
import { authenticatedFetch } from './authFetch';

// ─── Base URLs ───────────────────────────────────────────────────────────

const STOCK_API = config.talkyStockBaseUrl;           // Read: ingredients, details, consumption
const STOCK_TESTING = config.stockTestingBaseUrl;      // Stock golden annotations & test runs
const DN_VIEWER = config.talkyDeliveryNoteViewerBaseUrl; // Provider product details
const ANALYTICS_V2 = config.talkyCombinedMetricsBaseUrl; // Write: edit entries, stock operations

// ─── Helpers ─────────────────────────────────────────────────────────────

async function jsonGet<T>(url: string): Promise<T> {
  const res = await authenticatedFetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function jsonPost<T>(url: string, body: unknown): Promise<T> {
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json();
}

async function jsonPut<T>(url: string, body: unknown): Promise<T> {
  const res = await authenticatedFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${url} failed: ${res.status}`);
  return res.json();
}

async function jsonDelete<T>(url: string): Promise<T> {
  const res = await authenticatedFetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status}`);
  return res.json();
}

// ─── Types: Stock API (read) ─────────────────────────────────────────────

// Matches the REAL GET /get-ingredients response shape
export interface StockApiIngredient {
  ingredientId: string;
  name: string;
  originalProductIdOCR: string;
  classification?: {
    level_1: string;
    level_2: string;
    level_3: string;
    path: string[];
  };
  currentStock?: {
    quantity: number;
    unit: string;
    lastCost: number;
    totalValue: number;
    lastUpdated: string;
    orderCount: number;
    totalOrderedQuantity: number;
    totalOrderedUnit: string;
    firstOrderDate: string;
    lastOrderDate: string;
  };
  lastPrice?: {
    pricePerUnit: number;
    unit: string;
    provider_name: string;
    provider_cif: string;
    lastUpdated: string;
    delivery_note_number: string;
    delivery_date: string;
  };
  packUnitSummary?: {
    unit: { uom: string; price: number };
    pack: {
      variant_id: string;
      usable: boolean;
      confidence: number;
      pack_unit: string;
      units_per_pack: number;
      price_per_pack: number;
    } | null;
  };
  suppliers?: {
    name: string;
    cif: string;
    deliveryCount: number;
    firstSeenDate: string;
    lastDeliveryDate: string;
    lastPrice: number;
    lastPriceUnit: string;
    lastPriceDate: string;
    lastPurchaseCost: number;
    lastPurchaseQuantity: number;
  }[];
  priceStats?: {
    minPrice: number;
    maxPrice: number;
    averagePrice?: number;
    totalPriceChanges: number;
    firstRecordedPrice: number;
    firstRecordedDate: string;
    minPriceDate?: string;
    maxPriceDate?: string;
  };
  priceMonitoring?: {
    currentAlert: {
      alertType: string;
      severity: string;
      changePercent: number;
      alertDate: string;
    } | null;
    statistics?: {
      allTimeMin: number;
      allTimeMax: number;
      allTimeAverage: number | null;
      totalPriceChanges: number;
    };
    [key: string]: unknown;
  };
  pack_variants?: unknown[];
  escandalloSchema?: unknown;
  supplierPrice?: unknown;
  [key: string]: unknown;
}

export interface GetIngredientsResponse {
  items: StockApiIngredient[];
  total?: number;
  nextToken?: string | null;
}

export interface StockHistoryEntryApi {
  stock_entry_id: string;
  timestamp: string;
  entry_type: string;
  delivery_note_doc_id: string;
  delivery_note_number: string;
  delivery_note_category_date: string;
  provider_cif: string;
  excluded_from_current_stock?: boolean;
  raw_product_data: {
    product_name: string;
    billed_quantity: string;
    billed_unit: string | null;
    listed_unit_price: string;
    line_total_price_before_discount: string;
    discounts: unknown[];
    extra_costs: unknown[];
    product_id_original?: string | null;
    ean_code_original?: string | null;
    expiry_date_original?: string | null;
  };
  initial_interpretation: {
    product_type: string;
    category: string;
    confidence_level: string;
    final_price_of_line: string;
    notes?: string | null;
    unit_of_measure_interpreted?: string;
    total_quantity_interpreted?: string;
    price_per_unit_interpreted?: string;
    unit_price_interpreted?: string;
    number_of_packs_interpreted?: string;
    price_per_pack_interpreted?: string;
    pack_details_extracted?: {
      subunits_in_pack: string;
      subunit_uom: string;
      subunit_measure: string;
      total_content_per_pack: string;
    } | null;
  };
  calculated_stock_values: {
    quantity_added: string;
    unit_of_measure_stock: string;
    cost_per_stock_unit: string;
    total_cost_entry: string;
  };
  normalized?: {
    entry_type: string;
    timestamp?: string;
    kind: 'in' | 'out' | 'set';
    signed_quantity: number;
    unit: string;
    pricePerUnit: number;
    totalCost: number;
    excluded_from_current_stock: boolean;
  };
  ocr_bbox?: unknown;
  ocr_page_number?: unknown;
  page_image_url?: string | null;
  [key: string]: unknown;
}

// The real API wraps everything in { ingredient: {...}, metadata: {...} }
export interface GetIngredientDetailsResponse {
  ingredient: {
    ingredientId: string;
    name: string;
    stock_history: StockHistoryEntryApi[];
    stock?: StockHistoryEntryApi[];
    currentStock?: {
      quantity: number;
      unit: string;
      lastUpdated: string;
      [key: string]: unknown;
    };
    computed_stock_from_history?: {
      quantity: number;
      unit: string;
      updatedAt: string;
    };
    [key: string]: unknown;
  };
  metadata?: {
    mode: string;
    ingredientId: string;
    timestamp: string;
    dataIncluded: string[];
  };
}

// ─── Types: Stock Testing API (annotations/datasets) ─────────────────────

export interface IngredientStatusResponse {
  locationId: string;
  filter: string;
  summary: {
    total: number;
    covered: number;
    partial: number;
    new: number;
  };
  ingredients: {
    ingredientId: string;
    ingredientName: string;
    productIdOCR: string;
    status: 'covered' | 'partial' | 'new';
    totalStockEntries: number;
    goldenStockEntries: number;
    currentStock: string;
    unit: string;
    suppliers: string[];
  }[];
}

export interface CheckEntriesRequest {
  locationId: string;
  entries: { ingredientId: string; categoryDate: string; stockEntryId: string }[];
}

export interface CheckEntriesResponse {
  results: {
    ingredientId: string;
    categoryDate: string;
    stockEntryId: string;
    inGolden: boolean;
    datasetIds: string[];
  }[];
}

export interface StockDataset {
  datasetId: string;
  datasetName: string;
  documentCount: number;
  documentTypes?: string[];
  createdAt?: string;
}

export interface AddEntriesRequest {
  locationId: string;
  entries: {
    ingredientId: string;
    ingredientName: string;
    productId: string;
    stockEntry: StockHistoryEntryApi;
  }[];
}

export interface AddEntriesResponse {
  datasetId: string;
  productsAdded: number;
  newDocuments: number;
  updatedDocuments: number;
  totalDocumentsInDataset: number;
}

export interface DatasetCoverageResponse {
  datasetId: string;
  datasetName: string;
  documents: {
    locationId: string;
    categoryDate: string;
    supplierName: string;
    deliveryNoteNumber: string;
    goldenProductCount: number;
    sourceProductCount: number;
    coveragePercent: number;
  }[];
  totalDocuments: number;
  fullyConveredDocs: number;
}

export interface DatasetIngredientsResponse {
  datasetId: string;
  datasetName: string;
  totalIngredients: number;
  totalEntries: number;
  ingredients: {
    ingredientId: string;
    ingredientName: string;
    productId: string;
    productType: 'PACK' | 'DIRECT';
    entries: {
      stockEntryId: string;
      categoryDate: string;
      locationId: string;
      supplierName: string;
      deliveryNoteNumber: string;
      stockEntry: {
        quantity_added: string;
        unit_of_measure: string;
        cost_per_unit: string;
        total_cost: string;
      };
    }[];
  }[];
}

export interface SeedDatasetRequest {
  locationId: string;
  limit?: number;
  datasetName?: string;
  filterSupplier?: string;
  filterDateFrom?: string;
  filterDateTo?: string;
}

export interface SeedDatasetResponse {
  datasetId: string;
  datasetName: string;
  created: number;
  skipped: number;
  total: number;
}

// Stock test runs
export interface StockTestRun {
  testRunId: string;
  runName: string;
  mode: 'compare' | 'reprocess';
  runStatus: 'INITIALIZING' | 'COPYING_PDFS' | 'FIRING_OCR' | 'PROCESSING_PIPELINE' | 'COMPARING' | 'COMPLETED' | 'FAILED' | 'RUNNING';
  date?: string;
  datasetId?: string;
  totalDocs: number;
  processedDocs: number;
  productAccuracy: number;
  docAccuracy: number;
  perfectDocs: number;
  errorMessage?: string;
  byErrorType: Record<string, number>;
  documents?: StockTestRunDoc[];
}

export interface StockTestRunDoc {
  docKey: string;
  locationId?: string;
  deliveryNoteNumber: string;
  supplierName?: string;
  supplierCif?: string;
  verdict: 'PASS' | 'FAIL' | 'TIMEOUT' | 'PIPELINE_ERROR' | 'COPY_FAILED';
  productAccuracy: number;
  productsCorrect: number;
  productsTotal: number;
  errorCount: number;
  errorSummary?: Record<string, number>;
}

export interface StockProductResult {
  expectedProductName: string;
  actualProductName?: string;
  expectedProductId?: string;
  actualIngredientId?: string;
  verdict: 'PASS' | 'FAIL';
  errors: {
    type: string;
    expected?: unknown;
    actual?: unknown;
    diffPercent?: number;
    message?: string;
  }[];
  packAiSummary?: Record<string, unknown>;
}

export interface StockTestDocDetail {
  deliveryNoteNumber: string;
  supplierName?: string;
  verdict: 'PASS' | 'FAIL';
  productAccuracy: number;
  productResults: StockProductResult[];
  errors: { type: string; message?: string }[];
  errorSummary: Record<string, number>;
  errorMessage?: string;
}

export interface StockTestRunStatus {
  testRunId: string;
  runStatus: string;
  totalDocs: number;
  processedDocs: number;
  progress: number;
  productAccuracy: number;
  docAccuracy: number;
  perfectDocs: number;
  errorMessage?: string;
}

// Edit stock entry (Analytics v2)
export interface EditStockEntryRequest {
  reason: string;
  editedBy?: string;
  billed_quantity?: number;
  billed_unit?: string;
  final_price_of_line?: number;
  delivery_note_category_date?: string;
}

// Manual stock operation (Analytics v2)
export interface StockOperationRequest {
  locationId: string;
  ingredientId: string;
  operationType: 'manual_entry' | 'waste' | 'initial_stock' | 'real_stock_adjustment';
  timestamp: string;
  data: Record<string, unknown>;
  userInfo?: Record<string, unknown>;
}

// ─── API 1: Stock API — GET /get-ingredients ──────────────────────────────

export async function getIngredients(params: {
  locationId: string;
  limit?: number;
  nextToken?: string;
  includePriceMonitoring?: boolean;
}): Promise<GetIngredientsResponse> {
  // Stock API uses lowercase query param names
  const qs = new URLSearchParams({ locationid: params.locationId });
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.nextToken) qs.set('nextToken', params.nextToken);
  if (params.includePriceMonitoring) qs.set('includePriceMonitoring', 'true');
  return jsonGet(`${STOCK_API}/get-ingredients?${qs}`);
}

// ─── API 2: Stock API — GET /get-ingredient-details ───────────────────────

export async function getIngredientDetails(params: {
  locationId: string;
  ingredientId: string;
}): Promise<GetIngredientDetailsResponse> {
  const qs = new URLSearchParams({
    locationid: params.locationId,
    ingredientid: params.ingredientId,
  });
  return jsonGet(`${STOCK_API}/get-ingredient-details?${qs}`);
}

// ─── API 3: Stock API — GET /get-ingredient-consumption ───────────────────

export async function getIngredientConsumption(params: {
  locationId: string;
  ingredientId: string;
}): Promise<unknown> {
  const qs = new URLSearchParams({
    locationid: params.locationId,
    ingredientid: params.ingredientId,
  });
  return jsonGet(`${STOCK_API}/get-ingredient-consumption?${qs}`);
}

// ─── API 4: DN Viewer — GET /provider-product-details/{locationId} ────────

export async function getProviderProductDetails(locationId: string): Promise<unknown> {
  return jsonGet(`${DN_VIEWER}/provider-product-details/${encodeURIComponent(locationId)}`);
}

// ─── API 5: Analytics v2 — PUT /stock/entries/{loc}/{ing}/{entryId} ───────

export async function editStockEntry(
  locationId: string,
  ingredientId: string,
  stockEntryId: string,
  body: EditStockEntryRequest,
): Promise<void> {
  await jsonPut(
    `${ANALYTICS_V2}/stock/entries/${encodeURIComponent(locationId)}/${encodeURIComponent(ingredientId)}/${encodeURIComponent(stockEntryId)}`,
    body,
  );
}

// ─── API 6: Analytics v2 — POST /stock/operations ────────────────────────

export async function createStockOperation(body: StockOperationRequest): Promise<void> {
  await jsonPost(`${ANALYTICS_V2}/stock/operations`, body);
}

// ─── Stock Testing: Annotations ──────────────────────────────────────────

export async function createAnnotation(body: Record<string, unknown>): Promise<unknown> {
  return jsonPost(`${STOCK_TESTING}/annotations`, body);
}

export async function listAnnotations(locationId: string, limit = 50): Promise<unknown> {
  const qs = new URLSearchParams({ locationId, limit: String(limit) });
  return jsonGet(`${STOCK_TESTING}/annotations?${qs}`);
}

export async function getAnnotation(locationId: string, sk: string): Promise<unknown> {
  return jsonGet(`${STOCK_TESTING}/annotations/${encodeURIComponent(locationId)}/${encodeURIComponent(sk)}`);
}

export async function deleteAnnotation(locationId: string, sk: string): Promise<unknown> {
  return jsonDelete(`${STOCK_TESTING}/annotations/${encodeURIComponent(locationId)}/${encodeURIComponent(sk)}`);
}

export async function checkEntries(body: CheckEntriesRequest): Promise<CheckEntriesResponse> {
  return jsonPost(`${STOCK_TESTING}/annotations/check-entries`, body);
}

// ─── Stock Testing: Datasets ─────────────────────────────────────────────

export async function createStockDataset(body: { datasetName: string }): Promise<{ datasetId: string }> {
  return jsonPost(`${STOCK_TESTING}/datasets`, body);
}

export async function listStockDatasets(): Promise<{ datasets: StockDataset[] }> {
  return jsonGet(`${STOCK_TESTING}/datasets`);
}

export async function getStockDataset(datasetId: string): Promise<StockDataset> {
  return jsonGet(`${STOCK_TESTING}/datasets/${datasetId}`);
}

export async function deleteStockDataset(datasetId: string): Promise<{ message: string }> {
  return jsonDelete(`${STOCK_TESTING}/datasets/${datasetId}`);
}

export async function seedStockDataset(body: SeedDatasetRequest): Promise<SeedDatasetResponse> {
  return jsonPost(`${STOCK_TESTING}/datasets/seed`, body);
}

export async function addEntriesToDataset(
  datasetId: string,
  body: AddEntriesRequest,
): Promise<AddEntriesResponse> {
  return jsonPost(`${STOCK_TESTING}/datasets/${datasetId}/add-entries`, body);
}

export async function getDatasetCoverage(datasetId: string): Promise<DatasetCoverageResponse> {
  return jsonGet(`${STOCK_TESTING}/datasets/${datasetId}/coverage`);
}

export async function getDatasetIngredients(datasetId: string): Promise<DatasetIngredientsResponse> {
  return jsonGet(`${STOCK_TESTING}/datasets/${datasetId}/ingredients`);
}

// ─── Stock Testing: Ingredient Status ────────────────────────────────────

export async function getIngredientStatus(params: {
  locationId: string;
  filter?: 'all' | 'new' | 'partial' | 'covered';
}): Promise<IngredientStatusResponse> {
  const qs = new URLSearchParams({ locationId: params.locationId });
  if (params.filter) qs.set('filter', params.filter);
  return jsonGet(`${STOCK_TESTING}/ingredients/status?${qs}`);
}

// ─── Stock Testing: Test Runs ────────────────────────────────────────────

export async function startStockTestRun(body: {
  mode: 'compare' | 'reprocess';
  datasetId?: string;
  name?: string;
  docKeys?: string[];
  supplierCif?: string;
  ingredientId?: string;
  documents?: { locationId: string; documentType: string; categoryDate: string }[];
}): Promise<{ testRunId: string; status: string; totalDocs?: number }> {
  return jsonPost(`${STOCK_TESTING}/test-runs`, body);
}

export async function listStockTestRuns(params?: {
  status?: string;
  limit?: number;
}): Promise<{ runs: StockTestRun[] }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.limit) qs.set('limit', String(params.limit));
  const data = await jsonGet<{ runs?: StockTestRun[]; items?: StockTestRun[] }>(`${STOCK_TESTING}/test-runs?${qs}`);
  return { runs: data.runs ?? data.items ?? [] };
}

export async function getStockTestRun(testRunId: string): Promise<StockTestRun> {
  return jsonGet(`${STOCK_TESTING}/test-runs/${testRunId}`);
}

export async function getStockTestRunStatus(testRunId: string): Promise<StockTestRunStatus> {
  return jsonGet(`${STOCK_TESTING}/test-runs/${testRunId}/status`);
}

export async function getStockTestRunDocument(testRunId: string, docSK: string): Promise<StockTestDocDetail> {
  return jsonGet(`${STOCK_TESTING}/test-runs/${testRunId}/documents/${encodeURIComponent(docSK)}`);
}

export async function cleanupStockTestRun(testRunId: string): Promise<{ message: string; cleaned: Record<string, number> }> {
  return jsonDelete(`${STOCK_TESTING}/test-runs/${testRunId}/cleanup`);
}

// ─── Stock Testing: Generator ────────────────────────────────────────────

export async function listGeneratorCatalogs(): Promise<{ catalogs: Record<string, { name: string; suppliers: number; totalProducts: number }> }> {
  return jsonGet(`${STOCK_TESTING}/generate/catalogs`);
}

export async function generateSyntheticDataset(body: {
  industry: string;
  numDeliveryNotes: number;
  productsPerNote: [number, number];
  datasetName?: string;
  features?: Record<string, unknown>;
}): Promise<{ datasetId: string; datasetName: string; created: number; syntheticLocationId: string; industry: string }> {
  return jsonPost(`${STOCK_TESTING}/generate`, body);
}

// ─── Stock Testing: Categories ───────────────────────────────────────────

export async function createCategory(body: Record<string, unknown>): Promise<unknown> {
  return jsonPost(`${STOCK_TESTING}/categories`, body);
}

export async function listCategories(): Promise<unknown> {
  return jsonGet(`${STOCK_TESTING}/categories`);
}
