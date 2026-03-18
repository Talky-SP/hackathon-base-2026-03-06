import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Package, FileText, Loader2,
  ChevronRight, ChevronLeft, Eye, X, TrendingUp, CheckCircle2,
  AlertCircle, ChevronDown, Plus, Check, Info, FlaskConical,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTestQueue } from '../context/TestQueueContext';
import * as stockApi from '../services/stockTestingApi';
import type {
  DatasetIngredientsResponse, DatasetCoverageResponse,
  StockHistoryEntryApi, GetIngredientDetailsResponse,
} from '../services/stockTestingApi';
import DeliveryNoteViewer from '../components/stock/DeliveryNoteViewer';
import { config } from '../config/environment';
import { authenticatedFetch } from '../services/authFetch';

type TabType = 'ingredients' | 'documents';

// ─── Types ────────────────────────────────────────────────────────────────

interface DatasetInfo {
  datasetId: string;
  datasetName: string;
  totalDocuments: number;
  totalIngredients: number;
  totalEntries: number;
}

type DsIngredient = DatasetIngredientsResponse['ingredients'][number];
type DsDocument = DatasetCoverageResponse['documents'][number];

// ─── Coverage Bar ─────────────────────────────────────────────────────────

function CoverageBar({ percent }: { percent: number }) {
  const color = percent === 100 ? 'bg-green-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-10 text-right">{percent.toFixed(0)}%</span>
    </div>
  );
}

// ─── Mini Price Chart (inline SVG sparkline for ingredient entries) ──────

function MiniEntryChart({ entries }: { entries: DsIngredient['entries'] }) {
  if (entries.length < 2) return null;
  const prices = entries.map(e => parseFloat(e.stockEntry.cost_per_unit) || 0);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={points} fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Full Stock Evolution Chart (from dataset ingredient entries) ────────

function GoldenEvolutionChart({
  entries,
  unit,
  language,
  onSelectEntry,
}: {
  entries: { date: string; price: number; qty: number; total: number; dn: string; idx: number }[];
  unit: string;
  language: 'es' | 'en';
  onSelectEntry: (idx: number) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-gray-400">
        {language === 'es' ? 'Sin entradas de stock' : 'No stock entries'}
      </div>
    );
  }

  const W = 640;
  const H = 240;
  const PAD = { top: 20, right: 50, bottom: 40, left: 55 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const prices = entries.map(e => e.price);
  const quantities = entries.map(e => e.qty);
  const minP = Math.min(...prices) * 0.9;
  const maxP = Math.max(...prices) * 1.1;
  const rangeP = maxP - minP || 1;
  const maxQ = Math.max(...quantities) * 1.2;
  const rangeQ = maxQ || 1;
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  const xPos = (i: number) => PAD.left + (i / Math.max(entries.length - 1, 1)) * plotW;
  const yPrice = (p: number) => PAD.top + plotH - ((p - minP) / rangeP) * plotH;

  const pricePath = prices.map((p, i) => `${i === 0 ? 'M' : 'L'}${xPos(i)},${yPrice(p)}`).join(' ');
  const priceTicks = Array.from({ length: 5 }, (_, i) => minP + (rangeP / 4) * i);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full cursor-crosshair"
      style={{ maxHeight: 240 }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Grid */}
      {priceTicks.map((_, i) => {
        const y = PAD.top + (plotH / 4) * i;
        return <line key={`g${i}`} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />;
      })}
      {/* Avg line */}
      <line x1={PAD.left} y1={yPrice(avgPrice)} x2={W - PAD.right} y2={yPrice(avgPrice)} stroke="#9ca3af" strokeWidth="1" strokeDasharray="4 3" />
      <text x={PAD.left + 4} y={yPrice(avgPrice) - 4} fontSize="9" fill="#9ca3af">avg {avgPrice.toFixed(2)}</text>

      {/* Quantity bars */}
      {entries.map((e, i) => {
        const barW = Math.max(plotW / entries.length * 0.5, 4);
        const barH = (quantities[i] / rangeQ) * plotH;
        const isActive = hoveredIdx === i;
        return (
          <rect
            key={`bar-${i}`}
            x={xPos(i) - barW / 2}
            y={PAD.top + plotH - barH}
            width={barW}
            height={barH}
            rx={2}
            fill="#bbf7d0"
            opacity={isActive ? 0.9 : 0.5}
            stroke={isActive ? '#22c55e' : 'none'}
            strokeWidth={isActive ? 1 : 0}
          />
        );
      })}

      {/* Price line */}
      <path d={pricePath} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />

      {/* Data points + hit areas */}
      {entries.map((e, i) => {
        const isActive = hoveredIdx === i;
        const cx = xPos(i);
        const cy = yPrice(prices[i]);
        return (
          <g key={`pt-${i}`}>
            <circle cx={cx} cy={cy} r={12} fill="transparent" className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onClick={() => onSelectEntry(i)}
            />
            {isActive && <line x1={cx} y1={PAD.top} x2={cx} y2={PAD.top + plotH} stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 2" />}
            <circle cx={cx} cy={cy} r={isActive ? 5 : 3.5} fill="#22c55e" stroke="white" strokeWidth={isActive ? 2 : 1.5} className="pointer-events-none" />
          </g>
        );
      })}

      {/* Tooltip */}
      {hoveredIdx !== null && (
        <foreignObject
          x={Math.min(xPos(hoveredIdx) - 80, W - 180)}
          y={Math.max(yPrice(prices[hoveredIdx]) - 90, 2)}
          width="165" height="85"
          className="pointer-events-none"
        >
          <div className="bg-gray-900/95 text-white rounded-lg px-2.5 py-1.5 text-[10px] shadow-lg backdrop-blur-sm">
            <div className="font-semibold text-[11px] mb-0.5">{entries[hoveredIdx].date}</div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-400">{language === 'es' ? 'Precio' : 'Price'}</span>
              <span className="font-medium tabular-nums text-orange-300">{prices[hoveredIdx].toFixed(4)} \u20AC/{unit}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-400">{language === 'es' ? 'Cantidad' : 'Qty'}</span>
              <span className="font-medium tabular-nums">{quantities[hoveredIdx].toFixed(2)} {unit}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-400">Total</span>
              <span className="font-medium tabular-nums">{entries[hoveredIdx].total.toFixed(2)} \u20AC</span>
            </div>
          </div>
        </foreignObject>
      )}

      {/* Y axis labels */}
      {priceTicks.map((v, i) => (
        <text key={`lp${i}`} x={PAD.left - 6} y={PAD.top + plotH - (plotH / 4) * i + 3} fontSize="9" fill="#9ca3af" textAnchor="end">{v.toFixed(2)}</text>
      ))}
      <text x={12} y={PAD.top + plotH / 2} fontSize="9" fill="#f97316" textAnchor="middle" transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}>
        \u20AC/{unit}
      </text>

      {/* X axis date labels */}
      {entries.map((e, i) => {
        if (entries.length > 8 && i % Math.ceil(entries.length / 8) !== 0 && i !== entries.length - 1) return null;
        return (
          <text key={`xd${i}`} x={xPos(i)} y={H - 12} fontSize="8" fill="#9ca3af" textAnchor="middle">{e.date.substring(5)}</text>
        );
      })}
    </svg>
  );
}

// ─── Ingredient Detail Modal ────────────────────────────────────────────

function IngredientDetailModal({
  ing,
  onClose,
  onViewDeliveryNote,
  language,
}: {
  ing: DsIngredient;
  onClose: () => void;
  onViewDeliveryNote: (entry: DsIngredient['entries'][number]) => void;
  language: 'es' | 'en';
}) {
  // Build chart data from dataset entries
  const chartEntries = useMemo(() =>
    ing.entries.map((e, idx) => {
      const date = e.categoryDate.split('#')[1] ?? e.categoryDate.split('#')[0] ?? '';
      return {
        date,
        price: parseFloat(e.stockEntry.cost_per_unit) || 0,
        qty: parseFloat(e.stockEntry.quantity_added) || 0,
        total: parseFloat(e.stockEntry.total_cost) || 0,
        dn: e.deliveryNoteNumber,
        idx,
      };
    }),
  [ing.entries]);

  const unit = ing.entries[0]?.stockEntry.unit_of_measure || 'uds';

  // Price stats
  const prices = chartEntries.map(e => e.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const variation = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

  // Also try to load the full stock history from the API for richer data
  const [fullHistory, setFullHistory] = useState<StockHistoryEntryApi[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Get locationId from entries
  const locationId = ing.entries[0]?.locationId;

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    setLoadingDetail(true);
    stockApi.getIngredientDetails({ locationId, ingredientId: ing.ingredientId })
      .then(res => {
        if (cancelled) return;
        const entries = res.ingredient?.stock_history ?? res.ingredient?.stock ?? [];
        setFullHistory(entries);
      })
      .catch(() => {/* Non-blocking */})
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [locationId, ing.ingredientId]);

  // Build richer chart from full history if available
  const fullChartEntries = useMemo(() => {
    if (!fullHistory || fullHistory.length === 0) return null;
    return fullHistory.map((e, idx) => ({
      date: e.timestamp?.substring(0, 10) || '',
      price: parseFloat(e.calculated_stock_values.cost_per_stock_unit) || 0,
      qty: parseFloat(e.calculated_stock_values.quantity_added) || 0,
      total: parseFloat(e.calculated_stock_values.total_cost_entry) || 0,
      dn: e.delivery_note_number,
      idx,
    }));
  }, [fullHistory]);

  const displayEntries = fullChartEntries ?? chartEntries;
  const displayUnit = fullHistory?.[0]?.calculated_stock_values.unit_of_measure_stock ?? unit;

  // Full history stats
  const fullPrices = displayEntries.map(e => e.price);
  const fMin = fullPrices.length > 0 ? Math.min(...fullPrices) : minPrice;
  const fMax = fullPrices.length > 0 ? Math.max(...fullPrices) : maxPrice;
  const fAvg = fullPrices.length > 0 ? fullPrices.reduce((a, b) => a + b, 0) / fullPrices.length : avgPrice;
  const fVar = fMin > 0 ? ((fMax - fMin) / fMin) * 100 : variation;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
        <div
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <Package size={18} className="text-brand-500" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">{ing.ingredientName}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400 font-mono">{ing.productId}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                    ing.productType === 'PACK' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>{ing.productType}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700">
                    Golden \u00B7 {ing.entries.length} {language === 'es' ? 'entradas' : 'entries'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Price stats strip */}
          <div className="px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-brand-500" />
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                {language === 'es' ? 'Evolucion de stock' : 'Stock evolution'}
              </span>
              {loadingDetail && <Loader2 size={12} className="animate-spin text-gray-300" />}
              {fullChartEntries && (
                <span className="text-[10px] text-gray-400">
                  ({fullChartEntries.length} {language === 'es' ? 'entradas totales' : 'total entries'})
                </span>
              )}
            </div>

            <div className="grid grid-cols-5 gap-3 mb-4">
              {[
                { label: 'Min', value: `${fMin.toFixed(2)}\u20AC`, sub: `/${displayUnit}` },
                { label: 'Avg', value: `${fAvg.toFixed(2)}\u20AC`, sub: `/${displayUnit}` },
                { label: 'Max', value: `${fMax.toFixed(2)}\u20AC`, sub: `/${displayUnit}` },
                { label: language === 'es' ? 'Variacion' : 'Variation', value: `${fVar.toFixed(1)}%`, sub: '' },
                { label: language === 'es' ? 'En golden' : 'In golden', value: `${ing.entries.length}`, sub: ` / ${displayEntries.length}` },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">{s.label}</span>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {s.value}<span className="text-xs text-gray-400 font-normal">{s.sub}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <GoldenEvolutionChart
                entries={displayEntries}
                unit={displayUnit}
                language={language}
                onSelectEntry={(idx) => {
                  // Map back: if fullHistory, find matching dataset entry, else use dataset entry directly
                  if (fullChartEntries && fullHistory) {
                    const histEntry = fullHistory[idx];
                    // Find matching dataset entry by delivery note number + date
                    const dsEntry = ing.entries.find(e =>
                      e.deliveryNoteNumber === histEntry.delivery_note_number
                    );
                    if (dsEntry) {
                      onViewDeliveryNote(dsEntry);
                    } else if (histEntry.delivery_note_category_date) {
                      // Open DN viewer with info from full history
                      onViewDeliveryNote({
                        stockEntryId: histEntry.stock_entry_id,
                        categoryDate: histEntry.delivery_note_category_date,
                        locationId: locationId || '',
                        supplierName: '',
                        deliveryNoteNumber: histEntry.delivery_note_number,
                        stockEntry: { quantity_added: '', unit_of_measure: '', cost_per_unit: '', total_cost: '' },
                      });
                    }
                  } else if (ing.entries[idx]) {
                    onViewDeliveryNote(ing.entries[idx]);
                  }
                }}
              />
            </div>
          </div>

          {/* Entries table */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Fecha' : 'Date'}</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Albaran' : 'DN'}</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Proveedor' : 'Supplier'}</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Cantidad' : 'Qty'}</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Precio/u' : 'Price/u'}</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {ing.entries.map((entry, idx) => {
                  const date = entry.categoryDate.split('#')[1] ?? entry.categoryDate.split('#')[0] ?? '';
                  return (
                    <tr
                      key={idx}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors text-xs"
                    >
                      <td className="px-4 py-2 text-gray-500 tabular-nums">{date}</td>
                      <td className="px-3 py-2 font-mono text-gray-900 font-medium">{entry.deliveryNoteNumber || '\u2014'}</td>
                      <td className="px-3 py-2 text-gray-500 truncate max-w-[160px]">{entry.supplierName || entry.locationId}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-800 font-medium">
                        {parseFloat(entry.stockEntry.quantity_added).toFixed(2)} {entry.stockEntry.unit_of_measure}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                        {parseFloat(entry.stockEntry.cost_per_unit).toFixed(4)}\u20AC
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-800 font-medium">
                        {parseFloat(entry.stockEntry.total_cost).toFixed(2)}\u20AC
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => onViewDeliveryNote(entry)}
                          className="p-1 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                          title={language === 'es' ? 'Ver albaran' : 'View DN'}
                        >
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Delivery Note Product (from all_products in API response) ───────────

interface DnProduct {
  product_name: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  final_price: number;
  product_type: string;
  category: string;
  pack_ai?: {
    llm_ui_explanation?: string;
    unit_view?: { uom: string; quantity: number; unit_price: number };
    pack_view?: { units_per_pack: number | null; pack_unit: string; price_per_pack: number | null };
    escandallo?: {
      purchasing_unit?: string;
      recipe_base_uom?: string;
      recipe_unit_price?: number;
      derived_prices?: { per_purchasing_unit?: number; per_recipe_base?: number };
    };
    confidence?: number;
    product_type?: string;
  };
  validation_details?: { is_valid: boolean; calculation: string };
  _page_image_key?: string;
}

interface DnHeaderInfo {
  supplier?: string;
  supplier_cif?: string;
  delivery_note_number?: string;
  delivery_note_date?: string;
  importe?: number;
  total?: number;
}

// ─── Product Detail Modal (full-screen modal like IngredientDetailModal) ──

function ProductDetailModal({
  product,
  isInGolden,
  stockHistory,
  loadingHistory,
  onClose,
  onAddToGolden,
  onViewDeliveryNote,
  addingToGolden,
  language,
}: {
  product: DnProduct;
  isInGolden: boolean;
  stockHistory: StockHistoryEntryApi[] | null;
  loadingHistory: boolean;
  onClose: () => void;
  onAddToGolden: () => void;
  onViewDeliveryNote: (entry: StockHistoryEntryApi) => void;
  addingToGolden: boolean;
  language: 'es' | 'en';
}) {
  const packAi = product.pack_ai;

  // Build chart data from stock history
  const chartEntries = useMemo(() => {
    if (!stockHistory || stockHistory.length === 0) return [];
    return stockHistory.map((e, idx) => ({
      date: e.timestamp?.substring(0, 10) || '',
      price: parseFloat(e.calculated_stock_values.cost_per_stock_unit) || 0,
      qty: parseFloat(e.calculated_stock_values.quantity_added) || 0,
      total: parseFloat(e.calculated_stock_values.total_cost_entry) || 0,
      dn: e.delivery_note_number,
      idx,
    }));
  }, [stockHistory]);

  const unit = stockHistory?.[0]?.calculated_stock_values.unit_of_measure_stock
    || packAi?.unit_view?.uom || product.unit || 'uds';

  // Price stats
  const prices = chartEntries.map(e => e.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : product.unit_price;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : product.unit_price;
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : product.unit_price;
  const variation = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[70]" onClick={onClose} />
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
        <div
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isInGolden ? 'bg-green-50' : 'bg-brand-50'
              }`}>
                <Package size={18} className={isInGolden ? 'text-green-500' : 'text-brand-500'} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">{product.product_name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400 font-mono">{product.product_id}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                    product.product_type === 'PACK' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>{product.product_type}</span>
                  {isInGolden ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700">
                      <Check size={8} /> Golden
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-50 text-red-600">
                      {language === 'es' ? 'No en golden' : 'Not in golden'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isInGolden && (
                <button
                  onClick={onAddToGolden}
                  disabled={addingToGolden}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {addingToGolden
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Plus size={14} />
                  }
                  {language === 'es' ? 'Añadir al Golden' : 'Add to Golden'}
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Line item info strip */}
          <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 shrink-0">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Cantidad' : 'Quantity'}</span>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{product.quantity} {product.unit}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Precio unitario' : 'Unit price'}</span>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{product.unit_price.toFixed(2)}€/{unit}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Total</span>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{product.final_price.toFixed(2)}€</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Confianza' : 'Confidence'}</span>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{((packAi?.confidence ?? 0) * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>

          {/* AI explanation */}
          {packAi?.llm_ui_explanation && (
            <div className="px-6 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-start gap-2.5 bg-blue-50/60 rounded-xl p-3">
                <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 leading-relaxed">{packAi.llm_ui_explanation}</p>
              </div>
            </div>
          )}

          {/* Stock evolution section */}
          <div className="px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-brand-500" />
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                {language === 'es' ? 'Evolución de stock' : 'Stock evolution'}
              </span>
              {loadingHistory && <Loader2 size={12} className="animate-spin text-gray-300" />}
              {chartEntries.length > 0 && (
                <span className="text-[10px] text-gray-400">
                  ({chartEntries.length} {language === 'es' ? 'entradas' : 'entries'})
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-3 mb-4">
              {[
                { label: 'Min', value: `${minPrice.toFixed(2)}€`, sub: `/${unit}` },
                { label: 'Avg', value: `${avgPrice.toFixed(2)}€`, sub: `/${unit}` },
                { label: 'Max', value: `${maxPrice.toFixed(2)}€`, sub: `/${unit}` },
                { label: language === 'es' ? 'Variación' : 'Variation', value: `${variation.toFixed(1)}%`, sub: '' },
                { label: language === 'es' ? 'Entradas' : 'Entries', value: `${chartEntries.length}`, sub: '' },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">{s.label}</span>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {s.value}<span className="text-xs text-gray-400 font-normal">{s.sub}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Chart */}
            {loadingHistory && (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-gray-300" />
                <span className="text-sm text-gray-400 ml-3">
                  {language === 'es' ? 'Cargando historial de stock...' : 'Loading stock history...'}
                </span>
              </div>
            )}
            {!loadingHistory && chartEntries.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <GoldenEvolutionChart
                  entries={chartEntries}
                  unit={unit}
                  language={language}
                  onSelectEntry={(idx) => {
                    if (stockHistory?.[idx]) onViewDeliveryNote(stockHistory[idx]);
                  }}
                />
              </div>
            )}
            {!loadingHistory && chartEntries.length === 0 && (
              <div className="flex items-center justify-center py-8 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-400">
                  {language === 'es' ? 'Sin historial de stock disponible' : 'No stock history available'}
                </p>
              </div>
            )}
          </div>

          {/* Escandallo + Validation */}
          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Escandallo */}
              {packAi?.escandallo && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Escandallo</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {packAi.escandallo.purchasing_unit && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-gray-400 uppercase">{language === 'es' ? 'Formato compra' : 'Purchase format'}</span>
                        <p className="text-sm font-medium text-gray-700">{packAi.escandallo.purchasing_unit}</p>
                      </div>
                    )}
                    {packAi.escandallo.recipe_base_uom && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-gray-400 uppercase">{language === 'es' ? 'Uds receta' : 'Recipe unit'}</span>
                        <p className="text-sm font-medium text-gray-700">{packAi.escandallo.recipe_base_uom}</p>
                      </div>
                    )}
                    {packAi.escandallo.derived_prices?.per_purchasing_unit != null && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-gray-400 uppercase">{language === 'es' ? 'Precio/ud compra' : 'Price/purch. unit'}</span>
                        <p className="text-sm font-medium text-gray-700 tabular-nums">{packAi.escandallo.derived_prices.per_purchasing_unit.toFixed(2)}€</p>
                      </div>
                    )}
                    {packAi.escandallo.derived_prices?.per_recipe_base != null && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-gray-400 uppercase">{language === 'es' ? 'Precio/ud receta' : 'Price/recipe unit'}</span>
                        <p className="text-sm font-medium text-gray-700 tabular-nums">{packAi.escandallo.derived_prices.per_recipe_base.toFixed(4)}€</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Validation + Pack info */}
              <div className="space-y-4">
                {product.validation_details && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                      {language === 'es' ? 'Validación' : 'Validation'}
                    </h4>
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg ${
                      product.validation_details.is_valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      {product.validation_details.is_valid
                        ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                        : <AlertCircle size={14} className="text-red-500 shrink-0" />
                      }
                      <span className={`text-sm font-mono ${product.validation_details.is_valid ? 'text-green-700' : 'text-red-700'}`}>
                        {product.validation_details.calculation}
                      </span>
                    </div>
                  </div>
                )}

                {packAi?.pack_view && packAi.pack_view.units_per_pack != null && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Pack</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-gray-400 uppercase">{language === 'es' ? 'Uds/pack' : 'Units/pack'}</span>
                        <p className="text-sm font-medium text-gray-700 tabular-nums">{packAi.pack_view.units_per_pack} {packAi.pack_view.pack_unit}</p>
                      </div>
                      {packAi.pack_view.price_per_pack != null && (
                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-[10px] text-gray-400 uppercase">{language === 'es' ? 'Precio/pack' : 'Price/pack'}</span>
                          <p className="text-sm font-medium text-gray-700 tabular-nums">{packAi.pack_view.price_per_pack.toFixed(2)}€</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stock history table */}
            {!loadingHistory && stockHistory && stockHistory.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  {language === 'es' ? 'Historial de entradas' : 'Entry history'}
                </h4>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Fecha' : 'Date'}</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Albarán' : 'DN'}</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Cantidad' : 'Qty'}</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Precio/u' : 'Price/u'}</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total</th>
                        <th className="w-8 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {stockHistory.slice(0, 20).map((entry, idx) => (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors text-xs">
                          <td className="px-3 py-2 text-gray-500 tabular-nums">{entry.timestamp?.substring(0, 10)}</td>
                          <td className="px-3 py-2 font-mono text-gray-900 font-medium">{entry.delivery_note_number}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700 font-medium">
                            {parseFloat(entry.calculated_stock_values.quantity_added).toFixed(2)} {entry.calculated_stock_values.unit_of_measure_stock}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {parseFloat(entry.calculated_stock_values.cost_per_stock_unit).toFixed(4)}€
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700 font-medium">
                            {parseFloat(entry.calculated_stock_values.total_cost_entry).toFixed(2)}€
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => onViewDeliveryNote(entry)}
                              className="p-1 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                              title={language === 'es' ? 'Ver albarán' : 'View DN'}
                            >
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {stockHistory.length > 20 && (
                    <div className="px-3 py-2 text-center text-[10px] text-gray-400 border-t border-gray-100">
                      +{stockHistory.length - 20} {language === 'es' ? 'entradas más' : 'more entries'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Document Drawer (side panel with DN image + ALL products) ───────────

function DocumentDrawer({
  doc,
  allDocs,
  datasetId,
  datasetIngredients,
  onClose,
  onNavigate,
  onSelectIngredient,
  onDatasetUpdated,
  language,
}: {
  doc: DsDocument;
  allDocs: DsDocument[];
  datasetId: string;
  datasetIngredients: DsIngredient[];
  onClose: () => void;
  onNavigate: (doc: DsDocument) => void;
  onSelectIngredient: (ing: DsIngredient) => void;
  onDatasetUpdated: () => void;
  language: 'es' | 'en';
}) {
  const [images, setImages] = useState<{ url: string; page: number | string }[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // All products from the delivery note API
  const [allProducts, setAllProducts] = useState<DnProduct[]>([]);
  const [dnInfo, setDnInfo] = useState<DnHeaderInfo | null>(null);

  // Stock history per ingredient
  const [stockHistories, setStockHistories] = useState<Map<string, StockHistoryEntryApi[]>>(new Map());
  const [loadingHistories, setLoadingHistories] = useState<Set<string>>(new Set());
  const [addingProducts, setAddingProducts] = useState<Set<string>>(new Set());

  // Product panel filter + selected product modal + DN viewer
  const [productFilter, setProductFilter] = useState<'all' | 'missing' | 'golden'>('all');
  const [selectedProduct, setSelectedProduct] = useState<DnProduct | null>(null);
  const [productDnViewer, setProductDnViewer] = useState<{
    locationId: string;
    categoryDate: string;
    deliveryNoteNumber: string;
  } | null>(null);

  const currentIndex = allDocs.findIndex(d => d.categoryDate === doc.categoryDate && d.locationId === doc.locationId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allDocs.length - 1;

  // Find ingredients that belong to this document (already in golden)
  const goldenIngredientIds = useMemo(() => {
    const ids = new Set<string>();
    datasetIngredients.forEach(ing => {
      if (ing.entries.some(e => e.categoryDate === doc.categoryDate && e.locationId === doc.locationId)) {
        ids.add(ing.ingredientId);
        ids.add(ing.productId);
      }
    });
    return ids;
  }, [datasetIngredients, doc]);

  // Classify products
  const { goldenProducts, missingProducts } = useMemo(() => {
    const golden: DnProduct[] = [];
    const missing: DnProduct[] = [];
    allProducts.forEach(p => {
      if (goldenIngredientIds.has(p.ingredient_id) || goldenIngredientIds.has(p.product_id)) {
        golden.push(p);
      } else {
        missing.push(p);
      }
    });
    return { goldenProducts: golden, missingProducts: missing };
  }, [allProducts, goldenIngredientIds]);

  const displayProducts = productFilter === 'all' ? allProducts
    : productFilter === 'missing' ? missingProducts
    : goldenProducts;

  // Load delivery note data (images + products)
  useEffect(() => {
    if (!doc.categoryDate || !doc.locationId) return;
    let cancelled = false;
    setImageLoading(true);
    setImageError(null);
    setImages([]);
    setAllProducts([]);
    setDnInfo(null);
    setCurrentPage(0);
    setStockHistories(new Map());

    const url = `${config.talkyDeliveryNotesBaseUrl}/delivery-note-by-id/${encodeURIComponent(doc.locationId)}/${encodeURIComponent(doc.categoryDate)}`;

    authenticatedFetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data: Record<string, unknown>) => {
        if (cancelled) return;
        const imgs = extractImages(data);
        if (imgs.length === 0) {
          setImageError(language === 'es' ? 'No se encontraron imagenes' : 'No images found');
        }
        setImages(imgs);

        // Extract all_products from delivery_note
        const dn = data.delivery_note as Record<string, unknown> | undefined;
        if (dn) {
          setDnInfo({
            supplier: dn.supplier as string | undefined,
            supplier_cif: dn.supplier_cif as string | undefined,
            delivery_note_number: dn.delivery_note_number as string | undefined,
            delivery_note_date: dn.delivery_note_date as string | undefined,
            importe: dn.importe as number | undefined,
            total: dn.total as number | undefined,
          });

          const products = dn.all_products as DnProduct[] | undefined;
          if (Array.isArray(products)) {
            setAllProducts(products);
          }
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setImageError(err.message);
      })
      .finally(() => {
        if (!cancelled) setImageLoading(false);
      });

    return () => { cancelled = true; };
  }, [doc.categoryDate, doc.locationId, language]);

  // Load stock history for each unique ingredient in allProducts
  useEffect(() => {
    if (allProducts.length === 0 || !doc.locationId) return;
    let cancelled = false;

    const uniqueIngredients = new Map<string, string>();
    allProducts.forEach(p => {
      if (p.ingredient_id && !uniqueIngredients.has(p.ingredient_id)) {
        uniqueIngredients.set(p.ingredient_id, p.product_name);
      }
    });

    const loadingSet = new Set<string>();
    uniqueIngredients.forEach((_, ingId) => loadingSet.add(ingId));
    setLoadingHistories(loadingSet);

    const newHistories = new Map<string, StockHistoryEntryApi[]>();

    Promise.allSettled(
      Array.from(uniqueIngredients.keys()).map(async (ingId) => {
        try {
          const res = await stockApi.getIngredientDetails({
            locationId: doc.locationId,
            ingredientId: ingId,
          });
          const entries = res.ingredient?.stock_history ?? res.ingredient?.stock ?? [];
          if (!cancelled) {
            newHistories.set(ingId, entries);
          }
        } catch {
          // Non-blocking
        }
      })
    ).then(() => {
      if (!cancelled) {
        setStockHistories(newHistories);
        setLoadingHistories(new Set());
      }
    });

    return () => { cancelled = true; };
  }, [allProducts, doc.locationId]);

  // Add product to golden dataset
  const handleAddToGolden = useCallback(async (product: DnProduct) => {
    if (!doc.locationId || !datasetId) return;
    setAddingProducts(prev => new Set(prev).add(product.ingredient_id));

    try {
      // Find the matching stock entry from history
      const history = stockHistories.get(product.ingredient_id);
      const matchingEntry = history?.find(e => e.delivery_note_category_date === doc.categoryDate);

      if (!matchingEntry) {
        // Create a synthetic entry from the product data
        await stockApi.addEntriesToDataset(datasetId, {
          locationId: doc.locationId,
          entries: [{
            ingredientId: product.ingredient_id,
            ingredientName: product.product_name,
            productId: product.product_id,
            stockEntry: {
              stock_entry_id: `synth-${product.product_id}-${Date.now()}`,
              timestamp: new Date().toISOString(),
              entry_type: 'delivery_note',
              delivery_note_doc_id: '',
              delivery_note_number: doc.deliveryNoteNumber,
              delivery_note_category_date: doc.categoryDate,
              provider_cif: dnInfo?.supplier_cif || '',
              raw_product_data: {
                product_name: product.product_name,
                billed_quantity: String(product.quantity),
                billed_unit: product.unit,
                listed_unit_price: String(product.unit_price),
                line_total_price_before_discount: String(product.final_price),
                discounts: [],
                extra_costs: [],
              },
              initial_interpretation: {
                product_type: product.product_type,
                category: product.category,
                confidence_level: String(product.pack_ai?.confidence ?? 0.9),
                final_price_of_line: String(product.final_price),
              },
              calculated_stock_values: {
                quantity_added: String(product.quantity),
                unit_of_measure_stock: product.pack_ai?.unit_view?.uom || product.unit,
                cost_per_stock_unit: String(product.unit_price),
                total_cost_entry: String(product.final_price),
              },
            },
          }],
        });
      } else {
        await stockApi.addEntriesToDataset(datasetId, {
          locationId: doc.locationId,
          entries: [{
            ingredientId: product.ingredient_id,
            ingredientName: product.product_name,
            productId: product.product_id,
            stockEntry: matchingEntry,
          }],
        });
      }

      onDatasetUpdated();
    } catch (err) {
      console.error('Failed to add to golden:', err);
    } finally {
      setAddingProducts(prev => {
        const next = new Set(prev);
        next.delete(product.ingredient_id);
        return next;
      });
    }
  }, [doc, datasetId, dnInfo, stockHistories, onDatasetUpdated]);

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(allDocs[currentIndex - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(allDocs[currentIndex + 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hasPrev, hasNext, currentIndex, allDocs, onNavigate]);

  const date = doc.categoryDate.split('#')[1] ?? doc.categoryDate.split('#')[0] ?? '';

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[1100px] max-w-[95vw] bg-white z-50 shadow-2xl flex flex-col border-l border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 font-mono truncate">{doc.deliveryNoteNumber || '\u2014'}</p>
              <p className="text-xs text-gray-400 truncate">
                {dnInfo?.supplier || doc.supplierName} \u00B7 {date}
                {dnInfo?.total != null && <> \u00B7 <span className="font-medium text-gray-600">{dnInfo.total.toFixed(2)}€</span></>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Coverage badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200">
              <span className="text-[10px] text-gray-500">
                {language === 'es' ? 'Golden' : 'Golden'}:
              </span>
              <span className="text-xs font-semibold text-green-600 tabular-nums">{goldenProducts.length}</span>
              <span className="text-[10px] text-gray-400">/</span>
              <span className="text-xs font-medium text-gray-600 tabular-nums">{allProducts.length}</span>
              {missingProducts.length > 0 && (
                <span className="text-[10px] text-red-500 font-medium">
                  ({missingProducts.length} {language === 'es' ? 'faltan' : 'missing'})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => hasPrev && onNavigate(allDocs[currentIndex - 1])}
                disabled={!hasPrev}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
              >
                <ChevronLeft size={16} className="text-gray-500" />
              </button>
              <span className="text-xs text-gray-400 tabular-nums px-1">{currentIndex + 1} / {allDocs.length}</span>
              <button
                onClick={() => hasNext && onNavigate(allDocs[currentIndex + 1])}
                disabled={!hasNext}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
              >
                <ChevronRight size={16} className="text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          {/* Image viewer */}
          <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
            {imageLoading && (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-gray-300" />
              </div>
            )}
            {imageError && !imageLoading && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <AlertCircle size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">{imageError}</p>
                </div>
              </div>
            )}
            {!imageLoading && !imageError && images.length > 0 && (
              <>
                <div className="flex-1 overflow-auto p-4 min-h-0">
                  <div className="relative mx-auto" style={{ maxWidth: 600 }}>
                    <img
                      src={images[currentPage]?.url}
                      alt={`Page ${currentPage + 1}`}
                      className="w-full rounded-lg shadow-sm border border-gray-200"
                      draggable={false}
                    />
                  </div>
                </div>
                {images.length > 1 && (
                  <div className="flex items-center justify-center gap-3 px-4 py-2 border-t border-gray-100 shrink-0 bg-white">
                    <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                      <ChevronLeft size={16} className="text-gray-500" />
                    </button>
                    <span className="text-xs text-gray-500 tabular-nums">{currentPage + 1} / {images.length}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(images.length - 1, p + 1))} disabled={currentPage === images.length - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                      <ChevronRight size={16} className="text-gray-500" />
                    </button>
                  </div>
                )}
              </>
            )}
            {!imageLoading && !imageError && images.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileText size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    {language === 'es' ? 'Cargando imagen...' : 'Loading image...'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Products panel */}
          <div className="w-[380px] shrink-0 border-l border-gray-100 flex flex-col min-h-0">
            {/* Panel header with filter tabs */}
            <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Package size={14} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {language === 'es' ? 'Productos del albarán' : 'Delivery note products'}
                </span>
                {imageLoading && <Loader2 size={12} className="animate-spin text-gray-300" />}
              </div>
              <div className="flex gap-1">
                {([
                  { key: 'all' as const, label: language === 'es' ? 'Todos' : 'All', count: allProducts.length },
                  { key: 'missing' as const, label: language === 'es' ? 'Faltan' : 'Missing', count: missingProducts.length },
                  { key: 'golden' as const, label: 'Golden', count: goldenProducts.length },
                ]).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setProductFilter(f.key)}
                    className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                      productFilter === f.key
                        ? f.key === 'missing'
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : f.key === 'golden'
                            ? 'bg-green-50 text-green-600 border border-green-200'
                            : 'bg-brand-50 text-brand-600 border border-brand-200'
                        : 'text-gray-500 hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {allProducts.length === 0 && !imageLoading && (
                <div className="text-center py-8">
                  <Package size={24} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">
                    {language === 'es' ? 'No se encontraron productos' : 'No products found'}
                  </p>
                </div>
              )}

              <div className="divide-y divide-gray-100">
                {displayProducts.map((product) => {
                  const isInGolden = goldenIngredientIds.has(product.ingredient_id) || goldenIngredientIds.has(product.product_id);
                  const historyCount = stockHistories.get(product.ingredient_id)?.length ?? 0;
                  return (
                    <button
                      key={product.product_id || product.ingredient_id}
                      onClick={() => setSelectedProduct(product)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2.5 group"
                    >
                      {/* Status dot */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isInGolden ? 'bg-green-500' : 'bg-gray-300'}`} />

                      {/* Name + price */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{product.product_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] tabular-nums text-gray-500">
                            {product.quantity} {product.unit} × {product.unit_price.toFixed(2)}€
                          </span>
                          <span className="text-[10px] tabular-nums font-medium text-gray-700">
                            = {product.final_price.toFixed(2)}€
                          </span>
                          {historyCount > 0 && (
                            <span className="text-[10px] text-gray-400">
                              · {historyCount} hist.
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer summary */}
            {missingProducts.length > 0 && productFilter !== 'golden' && (
              <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50 shrink-0">
                <p className="text-[10px] text-gray-500 text-center">
                  <span className="font-semibold text-red-500">{missingProducts.length}</span>{' '}
                  {language === 'es' ? 'productos sin añadir al golden dataset' : 'products not yet in golden dataset'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isInGolden={goldenIngredientIds.has(selectedProduct.ingredient_id) || goldenIngredientIds.has(selectedProduct.product_id)}
          stockHistory={stockHistories.get(selectedProduct.ingredient_id) ?? null}
          loadingHistory={loadingHistories.has(selectedProduct.ingredient_id)}
          onClose={() => setSelectedProduct(null)}
          onAddToGolden={() => handleAddToGolden(selectedProduct)}
          onViewDeliveryNote={(entry) => {
            setProductDnViewer({
              locationId: doc.locationId,
              categoryDate: entry.delivery_note_category_date,
              deliveryNoteNumber: entry.delivery_note_number,
            });
          }}
          addingToGolden={addingProducts.has(selectedProduct.ingredient_id)}
          language={language}
        />
      )}

      {/* DN Viewer from product history */}
      {productDnViewer && (
        <DeliveryNoteViewer
          isOpen
          onClose={() => setProductDnViewer(null)}
          locationId={productDnViewer.locationId}
          categoryDate={productDnViewer.categoryDate}
          deliveryNoteNumber={productDnViewer.deliveryNoteNumber}
          language={language}
        />
      )}
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm text-gray-700 font-medium">{value}</p>
    </div>
  );
}

// ─── Image extraction (same cascading logic as DeliveryNoteViewer) ───────

interface RawGenImage {
  image_key?: string;
  key?: string;
  page_number?: number | string;
  page?: number | string;
  image_url?: string;
  url?: string;
}

function extractImages(data: Record<string, unknown>): { url: string; page: number | string }[] {
  const dn = data.delivery_note as Record<string, unknown> | undefined;

  const fi1 = dn?.frontend_images as RawGenImage[] | undefined;
  if (Array.isArray(fi1) && fi1.length > 0) return mapImages(fi1);

  const fi2 = data.frontend_images as RawGenImage[] | undefined;
  if (Array.isArray(fi2) && fi2.length > 0) return mapImages(fi2);

  const gi = (dn?.generated_images ?? data.generated_images) as RawGenImage[] | undefined;
  if (Array.isArray(gi) && gi.length > 0) return mapImages(gi);

  const singleUrl = (dn?.delivery_note_url ?? data.delivery_note_url) as string | undefined;
  if (typeof singleUrl === 'string' && singleUrl.startsWith('http')) {
    return [{ url: singleUrl, page: 0 }];
  }

  // Deep scan
  const found: { url: string; page: number | string }[] = [];
  const visited = new WeakSet();
  const scan = (obj: unknown, depth: number) => {
    if (depth > 5 || !obj || typeof obj !== 'object') return;
    if (visited.has(obj as object)) return;
    visited.add(obj as object);
    const rec = obj as Record<string, unknown>;
    const urlVal = rec.url ?? rec.image_url;
    if (typeof urlVal === 'string' && urlVal.startsWith('http')) {
      found.push({ url: urlVal, page: (rec.page ?? rec.page_number ?? found.length) as number | string });
    }
    for (const v of Object.values(rec)) {
      if (Array.isArray(v)) v.forEach(item => scan(item, depth + 1));
      else if (v && typeof v === 'object') scan(v, depth + 1);
    }
  };
  scan(data, 0);
  return found;
}

function mapImages(raw: RawGenImage[]): { url: string; page: number | string }[] {
  return raw
    .map((img, i) => ({
      url: (img.url ?? img.image_url ?? '') as string,
      page: (img.page ?? img.page_number ?? i) as number | string,
    }))
    .filter(img => img.url)
    .sort((a, b) => Number(a.page) - Number(b.page));
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function StockGoldenDatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<DatasetInfo | null>(null);
  const [ingredients, setIngredients] = useState<DsIngredient[]>([]);
  const [documents, setDocuments] = useState<DsDocument[]>([]);

  const [tab, setTab] = useState<TabType>('ingredients');
  const [search, setSearch] = useState('');
  const [docPage, setDocPage] = useState(0);
  const DOC_PAGE_SIZE = 20;

  // Modal / drawer state
  const { toggleItem, isInQueue } = useTestQueue();
  const [selectedIngredient, setSelectedIngredient] = useState<DsIngredient | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DsDocument | null>(null);
  const [dnViewer, setDnViewer] = useState<{
    locationId: string;
    categoryDate: string;
    deliveryNoteNumber: string;
  } | null>(null);

  // Load data
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadAll = async () => {
      try {
        const [ingRes, covRes] = await Promise.all([
          stockApi.getDatasetIngredients(id),
          stockApi.getDatasetCoverage(id),
        ]);

        if (cancelled) return;

        setIngredients(ingRes.ingredients ?? []);
        setDocuments(covRes.documents ?? []);
        setInfo({
          datasetId: id,
          datasetName: ingRes.datasetName ?? covRes.datasetName ?? id,
          totalDocuments: covRes.totalDocuments ?? covRes.documents?.length ?? 0,
          totalIngredients: ingRes.totalIngredients ?? ingRes.ingredients?.length ?? 0,
          totalEntries: ingRes.totalEntries ?? 0,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dataset');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, [id]);

  const handleViewDnFromIngModal = useCallback((entry: DsIngredient['entries'][number]) => {
    setDnViewer({
      locationId: entry.locationId,
      categoryDate: entry.categoryDate,
      deliveryNoteNumber: entry.deliveryNoteNumber,
    });
  }, []);

  // Filtered lists
  const filteredIngredients = useMemo(() => {
    if (!search) return ingredients;
    const q = search.toLowerCase();
    return ingredients.filter(i =>
      i.ingredientName.toLowerCase().includes(q) ||
      i.productId.toLowerCase().includes(q)
    );
  }, [ingredients, search]);

  const filteredDocuments = useMemo(() => {
    if (!search) return documents;
    const q = search.toLowerCase();
    return documents.filter(d =>
      d.supplierName.toLowerCase().includes(q) ||
      d.deliveryNoteNumber.toLowerCase().includes(q)
    );
  }, [documents, search]);

  const paginatedDocs = useMemo(() => {
    const start = docPage * DOC_PAGE_SIZE;
    return filteredDocuments.slice(start, start + DOC_PAGE_SIZE);
  }, [filteredDocuments, docPage]);
  const docTotalPages = Math.ceil(filteredDocuments.length / DOC_PAGE_SIZE) || 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!info || error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">{error ?? 'Dataset not found'}</p>
        <button onClick={() => navigate('/stock-golden-datasets')} className="mt-2 text-sm text-brand-500 hover:text-brand-600">
          {language === 'es' ? 'Volver a datasets' : 'Back to datasets'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/stock-golden-datasets')}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 truncate">{info.datasetName}</h1>
          <p className="text-sm text-gray-400">
            {info.totalDocuments} {language === 'es' ? 'documentos' : 'documents'}
            {' \u00B7 '}
            {info.totalIngredients} {language === 'es' ? 'ingredientes' : 'ingredients'}
            {' \u00B7 '}
            {info.totalEntries} {language === 'es' ? 'entradas' : 'entries'}
          </p>
        </div>
        <button
          onClick={() => toggleItem({
            type: 'dataset',
            id: `stock-ds-${info.datasetId}`,
            label: info.datasetName,
            sublabel: `${info.totalDocuments} docs · ${info.totalIngredients} ing`,
            docCount: info.totalDocuments,
            source: 'stock',
            stockDatasetId: info.datasetId,
          })}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors shrink-0 ${
            isInQueue(`stock-ds-${info.datasetId}`)
              ? 'bg-purple-50 border-purple-300 text-purple-600'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {isInQueue(`stock-ds-${info.datasetId}`) ? (
            <Check size={14} />
          ) : (
            <FlaskConical size={14} />
          )}
          {language === 'es' ? 'Test dataset' : 'Test dataset'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white">
          <FileText size={16} className="text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">{language === 'es' ? 'Documentos' : 'Documents'}</p>
            <p className="text-lg font-semibold text-gray-900">{info.totalDocuments}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white">
          <Package size={16} className="text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">{language === 'es' ? 'Ingredientes' : 'Ingredients'}</p>
            <p className="text-lg font-semibold text-gray-900">{info.totalIngredients}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white">
          <TrendingUp size={16} className="text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">{language === 'es' ? 'Entradas' : 'Entries'}</p>
            <p className="text-lg font-semibold text-gray-900">{info.totalEntries}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {(['ingredients', 'documents'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearch(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'ingredients'
              ? (language === 'es' ? 'Ingredientes' : 'Ingredients')
              : (language === 'es' ? 'Documentos' : 'Documents')
            }
            <span className="ml-1.5 text-xs text-gray-400">
              {t === 'ingredients' ? ingredients.length : documents.length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setDocPage(0); }}
            placeholder={
              tab === 'ingredients'
                ? (language === 'es' ? 'Buscar ingredientes...' : 'Search ingredients...')
                : (language === 'es' ? 'Buscar documentos...' : 'Search documents...')
            }
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
          />
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          {tab === 'ingredients' ? filteredIngredients.length : filteredDocuments.length} {language === 'es' ? 'resultados' : 'results'}
        </span>
      </div>

      {/* Ingredients tab */}
      {tab === 'ingredients' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Ingrediente' : 'Ingredient'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Tipo' : 'Type'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Entradas' : 'Entries'}
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Precio' : 'Price'}
                </th>
                <th className="w-10 px-2 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                  Test
                </th>
                <th className="w-8 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.map(ing => {
                const ingQueueId = `stock-ing-${ing.ingredientId}`;
                return (
                <tr
                  key={ing.ingredientId}
                  onClick={() => setSelectedIngredient(ing)}
                  className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Package size={13} className="text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[220px]">{ing.ingredientName}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{ing.productId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      ing.productType === 'PACK' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {ing.productType}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-medium text-gray-900 tabular-nums">{ing.entries.length}</span>
                  </td>
                  <td className="px-3 py-3">
                    <MiniEntryChart entries={ing.entries} />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleItem({
                          type: 'document',
                          id: ingQueueId,
                          label: ing.ingredientName,
                          sublabel: `${ing.entries.length} entries · ${ing.ingredientId.slice(0, 12)}`,
                          docCount: ing.entries.length,
                          source: 'stock',
                          stockDatasetId: id!,
                          stockIngredientId: ing.ingredientId,
                        });
                      }}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        isInQueue(ingQueueId)
                          ? 'bg-purple-500 border-purple-500 text-white'
                          : 'border-gray-300 hover:border-purple-400'
                      }`}
                    >
                      {isInQueue(ingQueueId) && <Check size={11} />}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          {filteredIngredients.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Package size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {language === 'es' ? 'No se encontraron ingredientes' : 'No ingredients found'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Documents tab */}
      {tab === 'documents' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Documento' : 'Document'}
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Proveedor' : 'Supplier'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'es' ? 'Golden' : 'Golden'}
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  {language === 'es' ? 'Cobertura' : 'Coverage'}
                </th>
                <th className="w-10 px-2 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                  Test
                </th>
                <th className="w-8 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginatedDocs.map((doc, idx) => {
                const date = doc.categoryDate.split('#')[1] ?? doc.categoryDate.split('#')[0] ?? '';
                const docQueueId = `stock-doc-${doc.locationId}-${doc.categoryDate}`;
                const docKey = `${doc.locationId}#delivery_note#${doc.categoryDate}`;
                return (
                  <tr
                    key={idx}
                    onClick={() => setSelectedDoc(doc)}
                    className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 font-mono">{doc.deliveryNoteNumber || '\u2014'}</p>
                        <p className="text-[11px] text-gray-400">{date}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-gray-600 truncate block max-w-[180px]">{doc.supplierName || doc.locationId}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-medium text-green-600 tabular-nums">{doc.goldenProductCount}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm text-gray-600 tabular-nums">{doc.sourceProductCount}</span>
                    </td>
                    <td className="px-3 py-3">
                      <CoverageBar percent={doc.coveragePercent} />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleItem({
                            type: 'document',
                            id: docQueueId,
                            label: doc.deliveryNoteNumber || doc.categoryDate.slice(0, 20),
                            sublabel: doc.supplierName || doc.locationId,
                            docCount: 1,
                            source: 'stock',
                            stockDatasetId: id!,
                            stockDocKeys: [docKey],
                          });
                        }}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isInQueue(docQueueId)
                            ? 'bg-purple-500 border-purple-500 text-white'
                            : 'border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        {isInQueue(docQueueId) && <Check size={11} />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredDocuments.length === 0 && (
            <div className="px-4 py-12 text-center">
              <FileText size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {language === 'es' ? 'No se encontraron documentos' : 'No documents found'}
              </p>
            </div>
          )}

          {docTotalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {docPage * DOC_PAGE_SIZE + 1}-{Math.min((docPage + 1) * DOC_PAGE_SIZE, filteredDocuments.length)} {language === 'es' ? 'de' : 'of'} {filteredDocuments.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setDocPage(p => Math.max(0, p - 1))} disabled={docPage === 0} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={14} className="text-gray-500" />
                </button>
                <span className="text-xs text-gray-500 tabular-nums px-2">{docPage + 1} / {docTotalPages}</span>
                <button onClick={() => setDocPage(p => Math.min(docTotalPages - 1, p + 1))} disabled={docPage >= docTotalPages - 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <ChevronRight size={14} className="text-gray-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ingredient Detail Modal */}
      {selectedIngredient && (
        <IngredientDetailModal
          ing={selectedIngredient}
          onClose={() => setSelectedIngredient(null)}
          onViewDeliveryNote={handleViewDnFromIngModal}
          language={language}
        />
      )}

      {/* Document Drawer */}
      {selectedDoc && (
        <DocumentDrawer
          doc={selectedDoc}
          allDocs={filteredDocuments}
          datasetId={id!}
          datasetIngredients={ingredients}
          onClose={() => setSelectedDoc(null)}
          onNavigate={setSelectedDoc}
          onSelectIngredient={(ing) => {
            setSelectedDoc(null);
            setSelectedIngredient(ing);
          }}
          onDatasetUpdated={() => {
            // Reload dataset data
            if (!id) return;
            Promise.all([
              stockApi.getDatasetIngredients(id),
              stockApi.getDatasetCoverage(id),
            ]).then(([ingRes, covRes]) => {
              setIngredients(ingRes.ingredients ?? []);
              setDocuments(covRes.documents ?? []);
              setInfo(prev => prev ? {
                ...prev,
                totalDocuments: covRes.totalDocuments ?? covRes.documents?.length ?? 0,
                totalIngredients: ingRes.totalIngredients ?? ingRes.ingredients?.length ?? 0,
                totalEntries: ingRes.totalEntries ?? 0,
              } : prev);
            }).catch(() => {});
          }}
          language={language}
        />
      )}

      {/* Delivery Note Viewer (from ingredient modal clicks) */}
      {dnViewer && (
        <DeliveryNoteViewer
          isOpen
          onClose={() => setDnViewer(null)}
          locationId={dnViewer.locationId}
          categoryDate={dnViewer.categoryDate}
          deliveryNoteNumber={dnViewer.deliveryNoteNumber}
          language={language}
        />
      )}
    </div>
  );
}
