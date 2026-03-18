import { useState, useEffect, useCallback } from 'react';
import * as stockApi from '../services/stockTestingApi';
import type {
  StockIngredient, StockHistoryEntry, PriceAlert, PriceStats,
  PackVariant, EscandalloSchema,
} from '../data/stockAnnotationsMockData';
import {
  MOCK_INGREDIENTS, MOCK_DOCUMENTS, getMockSummary,
} from '../data/stockAnnotationsMockData';
import type { StockDocument, StockAnnotationsSummary } from '../data/stockAnnotationsMockData';

// ─── Datasets hook ───────────────────────────────────────────────────────

export interface StockDatasetItem {
  datasetId: string;
  datasetName: string;
  documentCount: number;
}

export function useStockDatasets() {
  const [datasets, setDatasets] = useState<StockDatasetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stockApi.listStockDatasets();
      setDatasets((res.datasets ?? []).map(d => ({
        datasetId: d.datasetId,
        datasetName: d.datasetName,
        documentCount: d.documentCount ?? 0,
      })));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load datasets');
      setDatasets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDatasets(); }, [fetchDatasets]);

  const createDataset = useCallback(async (name: string) => {
    const res = await stockApi.createStockDataset({ datasetName: name });
    await fetchDatasets();
    return res.datasetId;
  }, [fetchDatasets]);

  const deleteDataset = useCallback(async (datasetId: string) => {
    await stockApi.deleteStockDataset(datasetId);
    await fetchDatasets();
  }, [fetchDatasets]);

  return { datasets, loading, error, refresh: fetchDatasets, createDataset, deleteDataset };
}

// ─── Price helpers ───────────────────────────────────────────────────────

function computePriceStatsFromHistory(history: StockHistoryEntry[]): PriceStats {
  const prices = history.map(e => parseFloat(e.calculated_stock_values.cost_per_stock_unit));
  if (prices.length === 0) return { minPrice: 0, maxPrice: 0, avgPrice: 0, totalPriceChanges: 0, variationPercent: 0 };
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variationPercent = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;
  let changes = 0;
  for (let i = 1; i < prices.length; i++) {
    if (Math.abs(prices[i] - prices[i - 1]) / prices[i - 1] > 0.01) changes++;
  }
  return { minPrice, maxPrice, avgPrice, totalPriceChanges: changes, variationPercent };
}

function buildPriceStatsFromApi(apiIng: stockApi.StockApiIngredient): PriceStats {
  const ps = apiIng.priceStats;
  if (!ps) {
    // Use lastPrice as single data point
    const price = apiIng.lastPrice?.pricePerUnit ?? apiIng.currentStock?.lastCost ?? 0;
    return { minPrice: price, maxPrice: price, avgPrice: price, totalPriceChanges: 0, variationPercent: 0 };
  }
  const minPrice = ps.minPrice ?? 0;
  const maxPrice = ps.maxPrice ?? 0;
  const avgPrice = ps.averagePrice ?? (minPrice + maxPrice) / 2;
  const variationPercent = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;
  return { minPrice, maxPrice, avgPrice, totalPriceChanges: ps.totalPriceChanges ?? 0, variationPercent };
}

function buildPriceAlert(stats: PriceStats, monitoring?: stockApi.StockApiIngredient['priceMonitoring']): PriceAlert {
  // Use backend alert if available
  if (monitoring?.currentAlert) {
    const a = monitoring.currentAlert;
    return {
      hasAlert: true,
      alertType: a.alertType as PriceAlert['alertType'],
      severity: a.severity as PriceAlert['severity'],
      changePercent: a.changePercent ?? stats.variationPercent,
      alertDate: a.alertDate ?? null,
    };
  }
  // Derive from price stats
  const hasAlert = stats.variationPercent >= 10;
  const severity: PriceAlert['severity'] = stats.variationPercent >= 25 ? 'critical'
    : stats.variationPercent >= 10 ? 'high'
    : stats.variationPercent >= 1 ? 'medium'
    : 'low';
  return {
    hasAlert,
    alertType: hasAlert ? 'price_increase' : null,
    severity: hasAlert ? severity : null,
    changePercent: stats.variationPercent,
    alertDate: null,
  };
}

// ─── Map API ingredient to frontend StockIngredient ──────────────────────

function mapApiIngredient(
  apiIng: stockApi.StockApiIngredient,
  goldenInfo?: { status: string; totalStockEntries: number; goldenStockEntries: number },
): StockIngredient {
  const ps = buildPriceStatsFromApi(apiIng);
  const pa = buildPriceAlert(ps, apiIng.priceMonitoring);

  const status = goldenInfo
    ? goldenInfo.status as 'covered' | 'partial' | 'new'
    : 'new';

  const packInfo = apiIng.packUnitSummary?.pack;
  const unitInfo = apiIng.packUnitSummary?.unit;
  const stockUnit = apiIng.currentStock?.unit ?? unitInfo?.uom ?? '';
  const hasPack = packInfo != null && packInfo.usable;

  return {
    ingredientId: apiIng.ingredientId,
    ingredientName: apiIng.name,
    originalProductIdOCR: apiIng.originalProductIdOCR ?? '',
    category: apiIng.classification?.level_1 ?? '',
    subCategory: apiIng.classification?.level_2 ?? '',
    currentStock: {
      quantity: apiIng.currentStock?.quantity ?? 0,
      unit: stockUnit,
      lastUpdated: apiIng.currentStock?.lastUpdated ?? '',
      orderCount: apiIng.currentStock?.orderCount ?? 0,
    },
    currentMeasurementFormat: {
      type: hasPack ? 'PACK' : 'DIRECT',
      unit_of_measure: stockUnit.toUpperCase(),
    },
    latestCost: String(apiIng.currentStock?.lastCost ?? apiIng.lastPrice?.pricePerUnit ?? '0'),
    priceAlert: pa,
    priceStats: ps,
    status,
    totalStockEntries: goldenInfo?.totalStockEntries ?? apiIng.currentStock?.orderCount ?? 0,
    goldenStockEntries: goldenInfo?.goldenStockEntries ?? 0,
    suppliers: (apiIng.suppliers ?? []).map(s => s.name),
    stockHistory: [], // Loaded on demand when modal opens
  };
}

// ─── Ingredients hook ────────────────────────────────────────────────────

export function useStockIngredients(locationId: string | null) {
  const [ingredients, setIngredients] = useState<StockIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMock, setUseMock] = useState(false);

  const fetchIngredients = useCallback(async () => {
    if (!locationId) {
      setIngredients(MOCK_INGREDIENTS);
      setUseMock(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Get ingredient list from Stock API
      const listRes = await stockApi.getIngredients({
        locationId,
        limit: 200,
        includePriceMonitoring: true,
      });

      const apiIngredients = listRes.items ?? [];

      // 2. Try to get golden status from stock-testing API (non-blocking)
      let statusMap = new Map<string, { status: string; totalStockEntries: number; goldenStockEntries: number }>();
      try {
        const statusRes = await stockApi.getIngredientStatus({ locationId, filter: 'all' });
        statusMap = new Map(
          (statusRes.ingredients ?? []).map(i => [i.ingredientId, {
            status: i.status,
            totalStockEntries: i.totalStockEntries,
            goldenStockEntries: i.goldenStockEntries,
          }])
        );
      } catch {
        // Golden status not available, all will show as 'new'
      }

      // 3. Map to frontend format
      const enriched = apiIngredients.map(apiIng =>
        mapApiIngredient(apiIng, statusMap.get(apiIng.ingredientId))
      );

      setIngredients(enriched);
      setUseMock(false);
    } catch (err) {
      console.warn('Stock API failed, falling back to mock data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ingredients');
      setIngredients(MOCK_INGREDIENTS);
      setUseMock(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

  return { ingredients, loading, error, useMock, refresh: fetchIngredients };
}

// ─── Load ingredient detail (stock history) on demand ────────────────────

export function useIngredientDetail(locationId: string | null) {
  const [loading, setLoading] = useState(false);

  const loadDetail = useCallback(async (ingredient: StockIngredient): Promise<StockIngredient> => {
    // If already has stock history loaded, return as-is
    if (ingredient.stockHistory.length > 0) return ingredient;
    if (!locationId) return ingredient;

    setLoading(true);
    try {
      const detail = await stockApi.getIngredientDetails({
        locationId,
        ingredientId: ingredient.ingredientId,
      });

      // Real API wraps in { ingredient: {...} }
      const ingData = detail.ingredient;

      // Check which entries are in golden — prefer stock_history, fallback to stock
      const entries = ingData.stock_history ?? ingData.stock ?? [];
      let goldenMap = new Map<string, { inGolden: boolean; datasetIds: string[] }>();
      if (entries.length > 0) {
        try {
          const checkRes = await stockApi.checkEntries({
            locationId,
            entries: entries.map(e => ({
              ingredientId: ingredient.ingredientId,
              categoryDate: e.delivery_note_category_date,
              stockEntryId: e.stock_entry_id,
            })),
          });
          goldenMap = new Map(checkRes.results.map(r => [r.stockEntryId, r]));
        } catch {
          // check-entries not available
        }
      }

      const stockHistory: StockHistoryEntry[] = entries.map(e => ({
        ...e,
        inGolden: goldenMap.get(e.stock_entry_id)?.inGolden ?? false,
        datasetIds: goldenMap.get(e.stock_entry_id)?.datasetIds ?? [],
      }));

      // Recompute price stats from actual history if available
      const ps = stockHistory.length > 0
        ? computePriceStatsFromHistory(stockHistory)
        : ingredient.priceStats;

      // Extract pack variants and escandallo from detail response
      const packVariants = (ingData.pack_variants as PackVariant[] | undefined) ?? undefined;
      const escandalloSchema = (ingData.escandalloSchema as EscandalloSchema | undefined)
        ?? (ingData.pack_recipe_schema as EscandalloSchema | undefined)
        ?? undefined;

      return {
        ...ingredient,
        stockHistory,
        priceStats: ps,
        totalStockEntries: Math.max(ingredient.totalStockEntries, stockHistory.length),
        goldenStockEntries: stockHistory.filter(e => e.inGolden).length || ingredient.goldenStockEntries,
        packVariants,
        escandalloSchema,
      };
    } catch (err) {
      console.warn('Failed to load ingredient detail:', err);
      return ingredient;
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  return { loadDetail, loading };
}

// ─── Documents hook (with mock fallback) ─────────────────────────────────

export function useStockDocuments(locationId: string | null, datasetId: string | null) {
  const [documents, setDocuments] = useState<StockDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId || !datasetId) {
      setDocuments(MOCK_DOCUMENTS);
      return;
    }
    let cancelled = false;
    setLoading(true);
    stockApi.getDatasetCoverage(datasetId)
      .then(res => {
        if (cancelled) return;
        setDocuments((res.documents ?? []).map(d => ({
          locationId: d.locationId,
          categoryDate: d.categoryDate,
          supplierName: d.supplierName,
          supplierCif: '',
          deliveryNoteNumber: d.deliveryNoteNumber,
          date: d.categoryDate.split('#')[0] ?? d.categoryDate,
          totalProducts: d.sourceProductCount,
          goldenProducts: d.goldenProductCount,
          coveragePercent: d.coveragePercent,
          ingredients: [],
        })));
        setError(null);
      })
      .catch(err => {
        if (cancelled) return;
        console.warn('Dataset coverage failed, falling back to mock:', err);
        setDocuments(MOCK_DOCUMENTS);
        setError(err instanceof Error ? err.message : 'Failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [locationId, datasetId]);

  return { documents, loading, error };
}

// ─── Summary helper ──────────────────────────────────────────────────────

export function computeSummary(ingredients: StockIngredient[]): StockAnnotationsSummary {
  if (ingredients.length === 0) return getMockSummary();
  return {
    total: ingredients.length,
    covered: ingredients.filter(i => i.status === 'covered').length,
    partial: ingredients.filter(i => i.status === 'partial').length,
    new: ingredients.filter(i => i.status === 'new').length,
  };
}

// ─── Add entries to golden ───────────────────────────────────────────────

/** Strip frontend-only fields so the backend gets the raw stock entry object */
function cleanStockEntry(entry: StockHistoryEntry): stockApi.StockHistoryEntryApi {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inGolden, datasetIds, ...raw } = entry;
  return raw as unknown as stockApi.StockHistoryEntryApi;
}

export function useAddToGolden() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addEntries = useCallback(async (
    datasetId: string,
    locationId: string,
    ingredient: StockIngredient,
    entryIds: string[],
  ) => {
    setLoading(true);
    setError(null);
    try {
      const entries = ingredient.stockHistory
        .filter(e => entryIds.includes(e.stock_entry_id))
        .map(e => ({
          ingredientId: ingredient.ingredientId,
          ingredientName: ingredient.ingredientName,
          productId: ingredient.originalProductIdOCR,
          stockEntry: cleanStockEntry(e),
        }));

      const result = await stockApi.addEntriesToDataset(datasetId, {
        locationId,
        entries,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add entries';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { addEntries, loading, error };
}
