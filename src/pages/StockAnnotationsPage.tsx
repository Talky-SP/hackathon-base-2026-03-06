import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Search, ChevronDown, Package, FileText, CheckCircle2,
  AlertCircle, Clock, ArrowRight, X, TrendingUp, Plus,
  ChevronLeft, ChevronRight, Copy, Eye, ExternalLink,
  ShieldAlert, Layers, AlertTriangle, MapPin, Loader2, Trash2,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  StockIngredient, StockHistoryEntry, StockDocument,
  IngredientGoldenStatus, StockAnnotationsSummary,
  PackVariant, EscandalloSchema, OcrBBox,
} from '../data/stockAnnotationsMockData';
import {
  MOCK_INGREDIENTS, MOCK_DOCUMENTS,
  findDuplicateEntries,
} from '../data/stockAnnotationsMockData';
import DeliveryNoteViewer from '../components/stock/DeliveryNoteViewer';
import { useLocations } from '../hooks/useLocations';
import {
  useStockIngredients, useStockDocuments, useStockDatasets,
  useAddToGolden, useIngredientDetail, computeSummary,
} from '../hooks/useStockAnnotations';

type ViewTab = 'ingredients' | 'documents';
type StatusFilter = 'all' | 'covered' | 'partial' | 'new' | 'priceAlert';

const PAGE_SIZE = 10;

const SUPPLIERS_MAP: Record<string, string> = {
  B41234567: 'DISTRIBUCIONES SUR S.L.',
  A28765432: 'ACEITES DEL CAMPO',
  B91234567: 'FRUTAS GARCIA',
  B29876543: 'CARNICAS MARTINEZ',
  A33456789: 'PESCADOS NORTE S.A.',
};

// ─── Price Alert Badge ────────────────────────────────────────────────────

function PriceAlertBadge({ variationPercent }: { variationPercent: number }) {
  if (variationPercent < 1) return null;
  const cfg = variationPercent >= 25
    ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
    : variationPercent >= 10
    ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
    : { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' };
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <AlertTriangle size={9} />
      {variationPercent.toFixed(0)}%
    </span>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status, language }: { status: IngredientGoldenStatus; language: 'es' | 'en' }) {
  const cfg = {
    covered: { bg: 'bg-green-50', text: 'text-green-700', labelEs: 'Completo', labelEn: 'Covered' },
    partial: { bg: 'bg-yellow-50', text: 'text-yellow-700', labelEs: 'Parcial', labelEn: 'Partial' },
    new: { bg: 'bg-gray-100', text: 'text-gray-600', labelEs: 'Nuevo', labelEn: 'New' },
  };
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded ${c.bg} ${c.text}`}>
      {language === 'es' ? c.labelEs : c.labelEn}
    </span>
  );
}

// ─── Coverage Bar ──────────────────────────────────────────────────────────

function CoverageBar({ percent }: { percent: number }) {
  const color = percent === 100 ? 'bg-green-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-10 text-right">{percent.toFixed(0)}%</span>
    </div>
  );
}

// ─── Mini Price Chart (SVG sparkline) ──────────────────────────────────────

function PriceSparkline({ entries }: { entries: StockHistoryEntry[] }) {
  if (entries.length < 2) return null;
  const prices = entries.map(e => parseFloat(e.calculated_stock_values.cost_per_stock_unit));
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

// ─── Format helpers ─────────────────────────────────────────────────────────

type DisplayFormat = 'base' | 'escandallo' | string; // string = pack variant_id

function getFormatInfo(
  format: DisplayFormat,
  baseUnit: string,
  packVariants?: PackVariant[],
  escandallo?: EscandalloSchema,
): { qtyFactor: number; priceDivisor: number; displayUnit: string } {
  if (format === 'escandallo' && escandallo) {
    const factor = escandallo.purchasing_unit_size_base || 1;
    const uom = escandallo.recipe_base_uom || baseUnit;
    // auto-scale: if ml >= 1000 show as L, if g >= 1000 show as kg
    return { qtyFactor: factor, priceDivisor: factor, displayUnit: uom };
  }
  if (format !== 'base' && packVariants) {
    const pack = packVariants.find(pv => pv.variant_id === format);
    if (pack && pack.pack_view.units_per_pack && pack.pack_view.units_per_pack > 0) {
      return {
        qtyFactor: 1 / pack.pack_view.units_per_pack,
        priceDivisor: 1 / pack.pack_view.units_per_pack,
        displayUnit: pack.pack_view.pack_unit || pack.label || 'pack',
      };
    }
  }
  return { qtyFactor: 1, priceDivisor: 1, displayUnit: baseUnit };
}

// ─── Stock Evolution Chart (full SVG, interactive) ──────────────────────────

function StockEvolutionChart({
  entries,
  ingredient,
  language,
  onViewDeliveryNote,
}: {
  entries: StockHistoryEntry[];
  ingredient: StockIngredient;
  language: 'es' | 'en';
  onViewDeliveryNote: (entry: StockHistoryEntry) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>('base');
  const svgRef = useRef<SVGSVGElement>(null);

  const baseUnit = ingredient.currentStock.unit || 'uds';
  const { qtyFactor, priceDivisor, displayUnit } = getFormatInfo(
    displayFormat, baseUnit, ingredient.packVariants, ingredient.escandalloSchema,
  );

  const hasEscandallo = !!ingredient.escandalloSchema;
  const packOptions = (ingredient.packVariants ?? []).filter(pv => pv.usable && pv.pack_view.units_per_pack);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        {language === 'es' ? 'Sin entradas de stock' : 'No stock entries'}
      </div>
    );
  }

  const W = 720;
  const H = 300;
  const PAD = { top: 24, right: 60, bottom: 50, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Data series (apply format conversion)
  const prices = entries.map(e => parseFloat(e.calculated_stock_values.cost_per_stock_unit) / priceDivisor);
  const quantities = entries.map(e => parseFloat(e.calculated_stock_values.quantity_added) * qtyFactor);
  const dates = entries.map(e => e.timestamp.substring(0, 10));

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
  const qtyTicks = Array.from({ length: 5 }, (_, i) => (maxQ / 4) * i);

  const activeIdx = selectedIdx ?? hoveredIdx;
  const activeEntry = activeIdx !== null ? entries[activeIdx] : null;

  return (
    <div>
      {/* Format selector */}
      {(hasEscandallo || packOptions.length > 0) && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
            {language === 'es' ? 'Formato' : 'Format'}
          </span>
          <select
            value={displayFormat}
            onChange={e => setDisplayFormat(e.target.value)}
            className="text-[11px] text-gray-600 border border-gray-200 rounded-md px-2 py-0.5 bg-white cursor-pointer"
          >
            <option value="base">Stock ({baseUnit})</option>
            {hasEscandallo && (
              <option value="escandallo">
                Escandallo ({ingredient.escandalloSchema!.recipe_base_uom})
                {ingredient.escandalloSchema!.purchasing_unit_size_base > 1
                  ? ` · 1 ${ingredient.escandalloSchema!.purchasing_unit} = ${ingredient.escandalloSchema!.purchasing_unit_size_base}${ingredient.escandalloSchema!.recipe_base_uom}`
                  : ''}
              </option>
            )}
            {packOptions.map(pv => (
              <option key={pv.variant_id} value={pv.variant_id}>
                {language === 'es' ? 'Compra' : 'Purchase'} · {pv.pack_view.pack_unit || pv.label}
                {pv.pack_view.units_per_pack ? ` · ${pv.pack_view.units_per_pack} ${baseUnit}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* SVG chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        style={{ maxHeight: 300 }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Grid lines */}
        {priceTicks.map((_, i) => {
          const y = PAD.top + (plotH / 4) * i;
          return <line key={`g${i}`} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />;
        })}

        {/* Average price dashed line */}
        <line
          x1={PAD.left} y1={yPrice(avgPrice)} x2={W - PAD.right} y2={yPrice(avgPrice)}
          stroke="#9ca3af" strokeWidth="1" strokeDasharray="4 3"
        />
        <text x={PAD.left + 4} y={yPrice(avgPrice) - 4} fontSize="9" fill="#9ca3af">
          avg {avgPrice.toFixed(2)}
        </text>

        {/* Quantity bars */}
        {entries.map((e, i) => {
          const barW = Math.max(plotW / entries.length * 0.5, 4);
          const barH = (quantities[i] / rangeQ) * plotH;
          const isActive = activeIdx === i;
          return (
            <rect
              key={`bar-${i}`}
              x={xPos(i) - barW / 2}
              y={PAD.top + plotH - barH}
              width={barW}
              height={barH}
              rx={2}
              fill={e.inGolden ? '#bbf7d0' : '#e5e7eb'}
              opacity={isActive ? 0.9 : 0.5}
              stroke={isActive ? (e.inGolden ? '#22c55e' : '#9ca3af') : 'none'}
              strokeWidth={isActive ? 1 : 0}
            />
          );
        })}

        {/* Price line */}
        <path d={pricePath} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />

        {/* Interactive hit areas + data points */}
        {entries.map((e, i) => {
          const isOutlier = Math.abs(prices[i] - avgPrice) > avgPrice * 0.3;
          const isActive = activeIdx === i;
          const cx = xPos(i);
          const cy = yPrice(prices[i]);
          return (
            <g key={`pt-${i}`}>
              {/* Invisible wider hit area */}
              <circle
                cx={cx} cy={cy} r={12}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
              />
              {/* Vertical guide line when active */}
              {isActive && (
                <line x1={cx} y1={PAD.top} x2={cx} y2={PAD.top + plotH} stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 2" />
              )}
              {/* Data point */}
              <circle
                cx={cx} cy={cy}
                r={isActive ? 6 : isOutlier ? 5 : 3.5}
                fill={e.inGolden ? '#22c55e' : isOutlier ? '#ef4444' : '#f97316'}
                stroke="white" strokeWidth={isActive ? 2 : 1.5}
                className="pointer-events-none"
              />
              {isOutlier && !isActive && (
                <circle cx={cx} cy={cy} r={8} fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4" className="pointer-events-none" />
              )}
            </g>
          );
        })}

        {/* Tooltip (rendered inside SVG as foreignObject for HTML) */}
        {activeIdx !== null && activeEntry && (
          <foreignObject
            x={Math.min(xPos(activeIdx) - 90, W - 200)}
            y={Math.max(yPrice(prices[activeIdx]) - 110, 2)}
            width="185"
            height="105"
            className="pointer-events-none"
          >
            <div className="bg-gray-900/95 text-white rounded-lg px-3 py-2 text-[10px] shadow-lg backdrop-blur-sm">
              <div className="font-semibold text-[11px] mb-1">{dates[activeIdx]}</div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">{language === 'es' ? 'Precio' : 'Price'}</span>
                <span className="font-medium tabular-nums text-orange-300">{prices[activeIdx].toFixed(4)} €/{displayUnit}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">{language === 'es' ? 'Cantidad' : 'Qty'}</span>
                <span className="font-medium tabular-nums">{quantities[activeIdx].toFixed(2)} {displayUnit}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-400">Total</span>
                <span className="font-medium tabular-nums">{parseFloat(activeEntry.calculated_stock_values.total_cost_entry).toFixed(2)} €</span>
              </div>
              <div className="flex items-center justify-between gap-3 mt-0.5 pt-0.5 border-t border-gray-700">
                <span className="text-gray-400">{language === 'es' ? 'Albaran' : 'DN'}</span>
                <span className="font-mono text-[9px]">{activeEntry.delivery_note_number || '—'}</span>
              </div>
              {activeEntry.inGolden && (
                <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-medium rounded bg-green-500/20 text-green-300">Golden</span>
              )}
            </div>
          </foreignObject>
        )}

        {/* Left Y axis labels (price) */}
        {priceTicks.map((v, i) => (
          <text key={`lp${i}`} x={PAD.left - 8} y={PAD.top + plotH - (plotH / 4) * i + 3} fontSize="10" fill="#9ca3af" textAnchor="end">
            {v.toFixed(2)}
          </text>
        ))}
        <text x={14} y={PAD.top + plotH / 2} fontSize="10" fill="#f97316" textAnchor="middle" transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}>
          {language === 'es' ? `Precio (€/${displayUnit})` : `Price (€/${displayUnit})`}
        </text>

        {/* Right Y axis labels (quantity) */}
        {qtyTicks.map((v, i) => (
          <text key={`lq${i}`} x={W - PAD.right + 8} y={PAD.top + plotH - (plotH / 4) * i + 3} fontSize="10" fill="#9ca3af" textAnchor="start">
            {v.toFixed(1)}
          </text>
        ))}
        <text x={W - 14} y={PAD.top + plotH / 2} fontSize="10" fill="#9ca3af" textAnchor="middle" transform={`rotate(90, ${W - 14}, ${PAD.top + plotH / 2})`}>
          {language === 'es' ? `Cantidad (${displayUnit})` : `Quantity (${displayUnit})`}
        </text>

        {/* X axis date labels */}
        {entries.map((_, i) => {
          if (entries.length > 8 && i % Math.ceil(entries.length / 8) !== 0 && i !== entries.length - 1) return null;
          return (
            <text key={`xd${i}`} x={xPos(i)} y={H - 16} fontSize="9" fill="#9ca3af" textAnchor="middle">
              {dates[i].substring(5)}
            </text>
          );
        })}

        {/* Legend */}
        <circle cx={PAD.left} cy={H - 6} r={3} fill="#22c55e" />
        <text x={PAD.left + 7} y={H - 3} fontSize="9" fill="#6b7280">Golden</text>
        <circle cx={PAD.left + 50} cy={H - 6} r={3} fill="#f97316" />
        <text x={PAD.left + 57} y={H - 3} fontSize="9" fill="#6b7280">{language === 'es' ? 'Pendiente' : 'Pending'}</text>
        <circle cx={PAD.left + 115} cy={H - 6} r={3.5} fill="#ef4444" />
        <text x={PAD.left + 122} y={H - 3} fontSize="9" fill="#6b7280">Outlier</text>
        <text x={W - PAD.right} y={H - 3} fontSize="9" fill="#9ca3af" textAnchor="end">
          {language === 'es' ? 'Clic punto = ver albaran' : 'Click point = view DN'}
        </text>
      </svg>

      {/* Selected entry action bar */}
      {selectedIdx !== null && activeEntry && (
        <div className="mt-2 flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-gray-900">{dates[selectedIdx]}</span>
              <span className="text-gray-400">·</span>
              <span className="font-mono text-gray-600">{activeEntry.delivery_note_number}</span>
              <span className="text-gray-400">·</span>
              <span className="tabular-nums text-gray-600">{prices[selectedIdx].toFixed(2)} €/{displayUnit}</span>
              <span className="text-gray-400">·</span>
              <span className="tabular-nums text-gray-600">{quantities[selectedIdx].toFixed(2)} {displayUnit}</span>
              {activeEntry.inGolden && (
                <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-green-100 text-green-700">Golden</span>
              )}
            </div>
          </div>
          {activeEntry.delivery_note_category_date && (
            <button
              onClick={() => onViewDeliveryNote(activeEntry)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shrink-0"
            >
              <FileText size={12} />
              {language === 'es' ? 'Ver albaran' : 'View DN'}
            </button>
          )}
          <button
            onClick={() => setSelectedIdx(null)}
            className="p-1 hover:bg-gray-200 rounded transition-colors shrink-0"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Entry Detail Modal ────────────────────────────────────────────────────

function EntryDetailModal({
  entry,
  ingredient,
  isDuplicate,
  onClose,
  onViewDeliveryNote,
  language,
}: {
  entry: StockHistoryEntry;
  ingredient: StockIngredient;
  isDuplicate: boolean;
  onClose: () => void;
  onViewDeliveryNote?: () => void;
  language: 'es' | 'en';
}) {
  const supplierName = SUPPLIERS_MAP[entry.provider_cif] ?? entry.provider_cif;
  const interp = entry.initial_interpretation;
  const calc = entry.calculated_stock_values;
  const raw = entry.raw_product_data;
  const norm = entry.normalized;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">{title}</h4>
      {children}
    </div>
  );

  const Row = ({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) => (
    <div className="flex items-start justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium tabular-nums text-right max-w-[55%] ${warn ? 'text-red-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <Eye size={16} className="text-brand-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {language === 'es' ? 'Detalle de entrada' : 'Entry detail'}
                </h2>
                <p className="text-xs text-gray-400">{entry.delivery_note_number} &middot; {entry.timestamp.substring(0, 10)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onViewDeliveryNote && entry.delivery_note_category_date && (
                <button
                  onClick={onViewDeliveryNote}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                >
                  <FileText size={12} />
                  {language === 'es' ? 'Ver albaran' : 'View DN'}
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {isDuplicate && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
                <Copy size={14} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-700">
                    {language === 'es' ? 'Posible entrada duplicada' : 'Possible duplicate entry'}
                  </p>
                  <p className="text-[11px] text-red-500 mt-0.5">
                    {language === 'es'
                      ? `Mismo albaran (${entry.delivery_note_number}) y fecha (${entry.timestamp.substring(0, 10)}) encontrado en otra entrada`
                      : `Same delivery note (${entry.delivery_note_number}) and date (${entry.timestamp.substring(0, 10)}) found in another entry`
                    }
                  </p>
                </div>
              </div>
            )}

            {entry.inGolden && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-green-50 border border-green-100 rounded-lg">
                <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                <p className="text-xs font-medium text-green-700">
                  {language === 'es' ? 'Esta entrada ya esta en el golden dataset' : 'This entry is already in the golden dataset'}
                </p>
              </div>
            )}

            <Section title={language === 'es' ? 'Documento' : 'Document'}>
              <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
                <Row label={language === 'es' ? 'Albaran' : 'Delivery Note'} value={entry.delivery_note_number} />
                <Row label={language === 'es' ? 'Fecha' : 'Date'} value={entry.timestamp.substring(0, 10)} />
                <Row label={language === 'es' ? 'Proveedor' : 'Supplier'} value={supplierName} />
                <Row label="CIF" value={entry.provider_cif} />
                <Row label="Doc ID" value={<span className="font-mono text-[10px]">{entry.delivery_note_doc_id}</span>} />
              </div>
            </Section>

            <Section title={language === 'es' ? 'Datos OCR originales' : 'Raw OCR data'}>
              <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
                <Row label={language === 'es' ? 'Producto (OCR)' : 'Product (OCR)'} value={raw.product_name} />
                <Row label={language === 'es' ? 'Cantidad facturada' : 'Billed quantity'} value={`${raw.billed_quantity} ${raw.billed_unit ?? '—'}`} />
                <Row label={language === 'es' ? 'Precio unitario' : 'Unit price'} value={`${parseFloat(raw.listed_unit_price).toFixed(2)}€`} />
                <Row label={language === 'es' ? 'Total linea' : 'Line total'} value={`${parseFloat(raw.line_total_price_before_discount).toFixed(2)}€`} />
              </div>
            </Section>

            <Section title={language === 'es' ? 'Interpretacion IA' : 'AI interpretation'}>
              <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
                <Row label={language === 'es' ? 'Tipo producto' : 'Product type'} value={
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                    interp.product_type === 'PACK' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>{interp.product_type}</span>
                } />
                <Row label={language === 'es' ? 'Categoria' : 'Category'} value={interp.category} />
                <Row label={language === 'es' ? 'Confianza' : 'Confidence'} value={
                  (() => {
                    const cl = interp.confidence_level;
                    const num = parseFloat(cl);
                    const level = !isNaN(num) ? (num >= 0.8 ? 'high' : num >= 0.5 ? 'medium' : 'low') : cl;
                    return (
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                        level === 'high' ? 'bg-green-50 text-green-700' :
                        level === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-red-50 text-red-700'
                      }`}>{!isNaN(num) ? `${(num * 100).toFixed(0)}%` : cl}</span>
                    );
                  })()
                } />
                {interp.product_type === 'PACK' && interp.number_of_packs_interpreted && (
                  <Row label={language === 'es' ? 'Packs interpretados' : 'Packs interpreted'} value={interp.number_of_packs_interpreted} />
                )}
                {interp.product_type === 'PACK' && interp.price_per_pack_interpreted && (
                  <Row label={language === 'es' ? 'Precio por pack' : 'Price per pack'} value={`${parseFloat(String(interp.price_per_pack_interpreted)).toFixed(2)}€`} />
                )}
                {interp.total_quantity_interpreted && (
                  <Row label={language === 'es' ? 'Cantidad interpretada' : 'Quantity interpreted'} value={`${interp.total_quantity_interpreted} ${interp.unit_of_measure_interpreted ?? ''}`} />
                )}
                {interp.price_per_unit_interpreted && (
                  <Row label={language === 'es' ? 'Precio/u interpretado' : 'Unit price interpreted'} value={`${parseFloat(String(interp.price_per_unit_interpreted)).toFixed(4)}€`} />
                )}
                {interp.pack_details_extracted && (
                  <>
                    <div className="border-t border-gray-200 my-1.5" />
                    <Row label={language === 'es' ? 'Subunidades/pack' : 'Subunits/pack'} value={interp.pack_details_extracted.subunits_in_pack} />
                    <Row label={language === 'es' ? 'Contenido total/pack' : 'Total content/pack'} value={interp.pack_details_extracted.total_content_per_pack} />
                  </>
                )}
              </div>
            </Section>

            <Section title={language === 'es' ? 'Valores de stock calculados' : 'Calculated stock values'}>
              <div className="bg-brand-50/30 rounded-lg p-3 space-y-0.5 border border-brand-100">
                <Row label={language === 'es' ? 'Cantidad anadida' : 'Quantity added'} value={`${calc.quantity_added} ${calc.unit_of_measure_stock}`} />
                <Row label={language === 'es' ? 'Coste por unidad stock' : 'Cost per stock unit'} value={`${parseFloat(calc.cost_per_stock_unit).toFixed(4)}€/${calc.unit_of_measure_stock}`} />
                <Row label={language === 'es' ? 'Coste total entrada' : 'Total entry cost'} value={`${parseFloat(calc.total_cost_entry).toFixed(2)}€`} />
              </div>
            </Section>

            {norm && (
              <Section title={language === 'es' ? 'Datos normalizados' : 'Normalized data'}>
                <div className="bg-gray-50 rounded-lg p-3 space-y-0.5">
                  <Row label="Kind" value={
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      norm.kind === 'in' ? 'bg-green-50 text-green-700' :
                      norm.kind === 'out' ? 'bg-red-50 text-red-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>{norm.kind}</span>
                  } />
                  <Row label={language === 'es' ? 'Cantidad con signo' : 'Signed quantity'} value={`${norm.signed_quantity > 0 ? '+' : ''}${norm.signed_quantity} ${norm.unit}`} />
                  <Row label={language === 'es' ? 'Precio por unidad' : 'Price per unit'} value={`${norm.pricePerUnit.toFixed(4)}€`} />
                  <Row label={language === 'es' ? 'Coste total' : 'Total cost'} value={`${norm.totalCost.toFixed(2)}€`} />
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Ingredient Evolution Modal (replaces old drawer) ─────────────────────

function IngredientModal({
  ingredient,
  locationId,
  onClose,
  onAddToGolden,
  language,
}: {
  ingredient: StockIngredient;
  locationId: string;
  onClose: () => void;
  onAddToGolden: (ingredient: StockIngredient, entryIds: string[]) => void;
  language: 'es' | 'en';
}) {
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [detailEntry, setDetailEntry] = useState<StockHistoryEntry | null>(null);
  const [dnViewer, setDnViewer] = useState<{
    categoryDate: string;
    deliveryNoteNumber: string;
    pageImageUrl?: string | null;
    ocrBBox?: OcrBBox | null;
    ocrPageNumber?: string | null;
  } | null>(null);

  const toggleEntry = (id: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pendingEntries = useMemo(() => ingredient.stockHistory.filter(e => !e.inGolden), [ingredient.stockHistory]);

  const selectAllNew = () => {
    setSelectedEntries(new Set(pendingEntries.map(e => e.stock_entry_id)));
  };

  const { priceStats } = ingredient;
  const duplicateIds = useMemo(() => findDuplicateEntries(ingredient.stockHistory), [ingredient.stockHistory]);
  const duplicateCount = duplicateIds.size;

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
                <h2 className="text-base font-semibold text-gray-900 truncate">{ingredient.ingredientName}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400 font-mono">{ingredient.originalProductIdOCR}</span>
                  <StatusBadge status={ingredient.status} language={language} />
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                    ingredient.currentMeasurementFormat.type === 'PACK' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {ingredient.currentMeasurementFormat.type}
                  </span>
                  <PriceAlertBadge variationPercent={ingredient.priceAlert.changePercent} />
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Price stats strip + chart */}
          <div className="px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-brand-500" />
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                {language === 'es' ? 'Evolucion de stock' : 'Stock evolution'}
              </span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-6 gap-3 mb-4">
              {[
                { label: 'Min', value: `${priceStats.minPrice.toFixed(2)}€`, sub: `/${ingredient.currentStock.unit}` },
                { label: 'Avg', value: `${priceStats.avgPrice.toFixed(2)}€`, sub: `/${ingredient.currentStock.unit}` },
                { label: 'Max', value: `${priceStats.maxPrice.toFixed(2)}€`, sub: `/${ingredient.currentStock.unit}` },
                { label: language === 'es' ? 'Variacion' : 'Variation', value: `${priceStats.variationPercent.toFixed(1)}%`, sub: '' },
                { label: 'Stock', value: `${ingredient.currentStock.quantity}`, sub: ` ${ingredient.currentStock.unit}` },
                { label: language === 'es' ? 'Pedidos' : 'Orders', value: `${ingredient.currentStock.orderCount}`, sub: '' },
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
              <StockEvolutionChart
                entries={ingredient.stockHistory}
                ingredient={ingredient}
                language={language}
                onViewDeliveryNote={(entry) => setDnViewer({
                  categoryDate: entry.delivery_note_category_date,
                  deliveryNoteNumber: entry.delivery_note_number,
                  pageImageUrl: entry.page_image_url as string | undefined,
                  ocrBBox: entry.ocr_bbox as OcrBBox | undefined,
                  ocrPageNumber: entry.ocr_page_number as string | undefined,
                })}
              />
            </div>
          </div>

          {/* Duplicate warning */}
          {duplicateCount > 0 && (
            <div className="flex items-center gap-2 px-6 py-2 bg-red-50 border-b border-red-100 shrink-0">
              <ShieldAlert size={13} className="text-red-500 shrink-0" />
              <span className="text-xs text-red-600 font-medium">
                {language === 'es'
                  ? `${Math.floor(duplicateCount / 2)} posible(s) duplicado(s) detectados`
                  : `${Math.floor(duplicateCount / 2)} possible duplicate(s) detected`
                }
              </span>
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center justify-between px-6 py-2.5 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {ingredient.goldenStockEntries}/{ingredient.totalStockEntries} {language === 'es' ? 'en golden' : 'in golden'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {pendingEntries.length > 0 && (
                <button onClick={selectAllNew} className="text-xs text-brand-500 hover:text-brand-600 transition-colors">
                  {language === 'es' ? 'Seleccionar pendientes' : 'Select pending'}
                </button>
              )}
              {pendingEntries.length > 0 && selectedEntries.size === 0 && (
                <button
                  onClick={() => onAddToGolden(ingredient, pendingEntries.map(e => e.stock_entry_id))}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Plus size={12} />
                  {language === 'es' ? `Anadir todo (${pendingEntries.length}) al golden` : `Add all (${pendingEntries.length}) to golden`}
                </button>
              )}
              {selectedEntries.size > 0 && (
                <button
                  onClick={() => { onAddToGolden(ingredient, Array.from(selectedEntries)); setSelectedEntries(new Set()); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Plus size={12} />
                  {language === 'es' ? `Anadir ${selectedEntries.size} al golden` : `Add ${selectedEntries.size} to golden`}
                </button>
              )}
            </div>
          </div>

          {/* Entries table */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  <th className="w-8 px-3 py-2" />
                  <th className="text-left px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Fecha' : 'Date'}</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Albaran' : 'Note'}</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Proveedor' : 'Supplier'}</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Cantidad' : 'Qty'}</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{language === 'es' ? 'Precio/u' : 'Price/u'}</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total</th>
                  <th className="text-center px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Golden</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {ingredient.stockHistory.map((entry) => {
                  const isSelected = selectedEntries.has(entry.stock_entry_id);
                  const price = parseFloat(entry.calculated_stock_values.cost_per_stock_unit);
                  const avgPrice = priceStats.avgPrice;
                  const isOutlier = Math.abs(price - avgPrice) > avgPrice * 0.3;
                  const isDup = duplicateIds.has(entry.stock_entry_id);

                  return (
                    <tr
                      key={entry.stock_entry_id}
                      className={`border-b border-gray-50 transition-colors cursor-pointer text-xs ${
                        entry.inGolden ? 'bg-green-50/30' : isDup ? 'bg-red-50/20' : 'hover:bg-gray-50/50'
                      }`}
                      onClick={() => setDetailEntry(entry)}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        {entry.inGolden ? (
                          <div className="w-4 h-4 rounded border border-green-300 bg-green-100 flex items-center justify-center">
                            <CheckCircle2 size={12} className="text-green-500" />
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleEntry(entry.stock_entry_id)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isSelected ? 'bg-brand-500 border-brand-500' : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {isSelected && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500 tabular-nums">{entry.timestamp.substring(0, 10)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-gray-900 font-mono text-[11px]">{entry.delivery_note_number}</span>
                          {isDup && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-medium rounded bg-red-100 text-red-600">
                              <Copy size={8} />DUP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-500 truncate max-w-[140px]">
                        {(SUPPLIERS_MAP[entry.provider_cif] ?? entry.provider_cif).split(' ')[0]}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-800">
                        {entry.calculated_stock_values.quantity_added} {entry.calculated_stock_values.unit_of_measure_stock}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${isOutlier ? 'text-red-600' : 'text-gray-800'}`}>
                        {price.toFixed(2)}€
                        {isOutlier && <AlertCircle size={10} className="inline ml-0.5 text-red-400 -mt-0.5" />}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-800">
                        {parseFloat(entry.calculated_stock_values.total_cost_entry).toFixed(2)}€
                      </td>
                      <td className="px-3 py-2 text-center">
                        {entry.inGolden ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded bg-green-100 text-green-700">
                            {language === 'es' ? 'Si' : 'Yes'}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                        {entry.delivery_note_category_date ? (
                          <button
                            onClick={() => setDnViewer({
                              categoryDate: entry.delivery_note_category_date,
                              deliveryNoteNumber: entry.delivery_note_number,
                              pageImageUrl: entry.page_image_url as string | undefined,
                              ocrBBox: entry.ocr_bbox as OcrBBox | undefined,
                              ocrPageNumber: entry.ocr_page_number as string | undefined,
                            })}
                            className="p-0.5 hover:bg-blue-50 rounded transition-colors"
                            title={language === 'es' ? 'Ver albaran' : 'View delivery note'}
                          >
                            <FileText size={12} className="text-blue-400 hover:text-blue-600" />
                          </button>
                        ) : (
                          <ExternalLink size={11} className="text-gray-300" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Entry Detail Modal (nested) */}
      {detailEntry && (
        <EntryDetailModal
          entry={detailEntry}
          ingredient={ingredient}
          isDuplicate={duplicateIds.has(detailEntry.stock_entry_id)}
          onClose={() => setDetailEntry(null)}
          onViewDeliveryNote={detailEntry.delivery_note_category_date ? () => {
            setDnViewer({
              categoryDate: detailEntry.delivery_note_category_date,
              deliveryNoteNumber: detailEntry.delivery_note_number,
              pageImageUrl: detailEntry.page_image_url as string | undefined,
              ocrBBox: detailEntry.ocr_bbox as OcrBBox | undefined,
              ocrPageNumber: detailEntry.ocr_page_number as string | undefined,
            });
          } : undefined}
          language={language}
        />
      )}

      {/* Delivery Note Viewer */}
      {dnViewer && (
        <DeliveryNoteViewer
          isOpen
          onClose={() => setDnViewer(null)}
          locationId={locationId}
          categoryDate={dnViewer.categoryDate}
          deliveryNoteNumber={dnViewer.deliveryNoteNumber}
          pageImageUrl={dnViewer.pageImageUrl}
          ocrBBox={dnViewer.ocrBBox}
          ocrPageNumber={dnViewer.ocrPageNumber}
          language={language}
        />
      )}
    </>
  );
}

// ─── Summary Cards ─────────────────────────────────────────────────────────

function SummaryCards({
  summary, priceAlertCount, statusFilter, onFilterChange, language,
}: {
  summary: StockAnnotationsSummary; priceAlertCount: number; statusFilter: StatusFilter;
  onFilterChange: (f: StatusFilter) => void; language: 'es' | 'en';
}) {
  const cards: { key: StatusFilter; value: number; labelEs: string; labelEn: string; color: string; icon: typeof Package; iconColor: string }[] = [
    { key: 'all', value: summary.total, labelEs: 'Total', labelEn: 'Total', color: 'border-gray-200', icon: Package, iconColor: 'text-gray-400' },
    { key: 'covered', value: summary.covered, labelEs: 'Completos', labelEn: 'Covered', color: 'border-green-200', icon: CheckCircle2, iconColor: 'text-green-500' },
    { key: 'partial', value: summary.partial, labelEs: 'Parciales', labelEn: 'Partial', color: 'border-yellow-200', icon: Clock, iconColor: 'text-yellow-500' },
    { key: 'new', value: summary.new, labelEs: 'Nuevos', labelEn: 'New', color: 'border-gray-200', icon: AlertCircle, iconColor: 'text-gray-400' },
    { key: 'priceAlert', value: priceAlertCount, labelEs: 'Alertas precio', labelEn: 'Price alerts', color: 'border-red-200', icon: AlertTriangle, iconColor: 'text-red-500' },
  ];
  return (
    <div className="grid grid-cols-5 gap-3">
      {cards.map(card => (
        <button
          key={card.key}
          onClick={() => onFilterChange(card.key)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
            statusFilter === card.key ? 'border-brand-300 bg-brand-50/50' : `${card.color} bg-white hover:bg-gray-50`
          }`}
        >
          <card.icon size={16} className={statusFilter === card.key ? 'text-brand-500' : card.iconColor} />
          <div className="text-left">
            <p className="text-xs text-gray-500">{language === 'es' ? card.labelEs : card.labelEn}</p>
            <p className="text-lg font-semibold text-gray-900">{card.value}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Ingredients Table ─────────────────────────────────────────────────────

function IngredientsView({
  ingredients, statusFilter, onFilterChange, search, onSearchChange, onSelectIngredient, language,
}: {
  ingredients: StockIngredient[]; statusFilter: StatusFilter;
  onFilterChange: (f: StatusFilter) => void; search: string;
  onSearchChange: (s: string) => void; onSelectIngredient: (i: StockIngredient) => void;
  language: 'es' | 'en';
}) {
  const [page, setPage] = useState(0);
  const summary = useMemo(() => computeSummary(ingredients), [ingredients]);
  const priceAlertCount = useMemo(() => ingredients.filter(i => i.priceAlert.changePercent >= 10).length, [ingredients]);

  const filtered = useMemo(() => {
    let result = ingredients;
    if (statusFilter === 'priceAlert') {
      result = result.filter(i => i.priceAlert.changePercent >= 10);
    } else if (statusFilter !== 'all') {
      result = result.filter(i => i.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.ingredientName.toLowerCase().includes(q) ||
        i.originalProductIdOCR.toLowerCase().includes(q) ||
        i.suppliers.some(s => s.toLowerCase().includes(q))
      );
    }
    // Sort: most stock entries first, then price alerts, then alphabetical
    result = [...result].sort((a, b) => {
      // Primary: total stock entries descending
      if (a.totalStockEntries !== b.totalStockEntries) return b.totalStockEntries - a.totalStockEntries;
      // Secondary: price alerts first (highest variation first)
      const aAlert = a.priceAlert.changePercent >= 10 ? 1 : 0;
      const bAlert = b.priceAlert.changePercent >= 10 ? 1 : 0;
      if (aAlert !== bAlert) return bAlert - aAlert;
      if (aAlert && bAlert) return b.priceAlert.changePercent - a.priceAlert.changePercent;
      return a.ingredientName.localeCompare(b.ingredientName);
    });
    return result;
  }, [ingredients, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [statusFilter, search]);

  return (
    <>
      <SummaryCards summary={summary} priceAlertCount={priceAlertCount} statusFilter={statusFilter} onFilterChange={onFilterChange} language={language} />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={language === 'es' ? 'Buscar ingrediente, producto o proveedor...' : 'Search ingredient, product or supplier...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
          />
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} {language === 'es' ? 'ingredientes' : 'ingredients'}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{language === 'es' ? 'Ingrediente' : 'Ingredient'}</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{language === 'es' ? 'Producto' : 'Product ID'}</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{language === 'es' ? 'Estado' : 'Status'}</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{language === 'es' ? 'Entradas' : 'Entries'}</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">{language === 'es' ? 'Cobertura' : 'Coverage'}</th>
              <th className="text-right px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{language === 'es' ? 'Precio' : 'Price'}</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{language === 'es' ? 'Alerta' : 'Alert'}</th>
              <th className="w-8 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {paginated.map(ing => {
              const effectiveTotal = Math.max(ing.totalStockEntries, ing.goldenStockEntries, ing.currentStock.orderCount);
              const coveragePct = effectiveTotal > 0 ? (ing.goldenStockEntries / effectiveTotal) * 100 : 0;
              const dups = findDuplicateEntries(ing.stockHistory);
              return (
                <tr
                  key={ing.ingredientId}
                  onClick={() => onSelectIngredient(ing)}
                  className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Package size={14} className="text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-900 truncate block max-w-[200px]">{ing.ingredientName}</span>
                        {dups.size > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500 font-medium">
                            <Copy size={9} /> {Math.floor(dups.size / 2)} dup
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div>
                      <span className="text-xs font-mono text-gray-500">{ing.originalProductIdOCR}</span>
                      <span className={`ml-1.5 inline-flex items-center px-1 py-0.5 text-[9px] font-medium rounded ${
                        ing.currentMeasurementFormat.type === 'PACK' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {ing.currentMeasurementFormat.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <StatusBadge status={ing.status} language={language} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm text-gray-600 tabular-nums">
                      <span className="font-medium text-gray-900">{ing.goldenStockEntries}</span>
                      <span className="text-gray-400">/{effectiveTotal}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3"><CoverageBar percent={coveragePct} /></td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-sm font-medium text-gray-900 tabular-nums">{ing.currentStock.quantity}</span>
                    <span className="text-xs text-gray-400 ml-0.5">{ing.currentStock.unit}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <PriceSparkline entries={ing.stockHistory} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <PriceAlertBadge variationPercent={ing.priceAlert.changePercent} />
                  </td>
                  <td className="px-3 py-3">
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Package size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{language === 'es' ? 'No se encontraron ingredientes' : 'No ingredients found'}</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} {language === 'es' ? 'de' : 'of'} {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={14} className="text-gray-500" />
              </button>
              <span className="text-xs text-gray-500 tabular-nums px-2">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={14} className="text-gray-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Documents View ────────────────────────────────────────────────────────

function DocumentsView({
  documents, search, onSearchChange, onNavigateToIngredient, language,
}: {
  documents: StockDocument[]; search: string; onSearchChange: (s: string) => void;
  onNavigateToIngredient: (ingredientId: string) => void; language: 'es' | 'en';
}) {
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'complete' | 'incomplete'>('all');

  const filtered = useMemo(() => {
    let result = documents;
    if (coverageFilter === 'complete') result = result.filter(d => d.coveragePercent === 100);
    if (coverageFilter === 'incomplete') result = result.filter(d => d.coveragePercent < 100);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d => d.supplierName.toLowerCase().includes(q) || d.deliveryNoteNumber.toLowerCase().includes(q));
    }
    return result;
  }, [documents, coverageFilter, search]);

  const stats = useMemo(() => ({
    total: documents.length,
    complete: documents.filter(d => d.coveragePercent === 100).length,
    incomplete: documents.filter(d => d.coveragePercent < 100).length,
  }), [documents]);

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: 'all' as const, value: stats.total, labelEs: 'Total Documentos', labelEn: 'Total Documents', icon: FileText, iconColor: 'text-gray-400' },
          { key: 'complete' as const, value: stats.complete, labelEs: 'Cobertura Completa', labelEn: 'Full Coverage', icon: CheckCircle2, iconColor: 'text-green-500' },
          { key: 'incomplete' as const, value: stats.incomplete, labelEs: 'Pendientes', labelEn: 'Incomplete', icon: AlertCircle, iconColor: 'text-yellow-500' },
        ]).map(card => (
          <button
            key={card.key}
            onClick={() => setCoverageFilter(card.key)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
              coverageFilter === card.key ? 'border-brand-300 bg-brand-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <card.icon size={16} className={coverageFilter === card.key ? 'text-brand-500' : card.iconColor} />
            <div className="text-left">
              <p className="text-xs text-gray-500">{language === 'es' ? card.labelEs : card.labelEn}</p>
              <p className="text-lg font-semibold text-gray-900">{card.value}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={e => onSearchChange(e.target.value)}
            placeholder={language === 'es' ? 'Buscar por albaran o proveedor...' : 'Search by delivery note or supplier...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
          />
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} {language === 'es' ? 'documentos' : 'documents'}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{language === 'es' ? 'Albaran' : 'Delivery Note'}</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{language === 'es' ? 'Proveedor' : 'Supplier'}</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{language === 'es' ? 'Fecha' : 'Date'}</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{language === 'es' ? 'Productos' : 'Products'}</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-40">{language === 'es' ? 'Cobertura' : 'Coverage'}</th>
              <th className="w-8 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(doc => {
              const isExpanded = expandedDoc === doc.categoryDate;
              return (
                <tr key={doc.categoryDate} className="border-b border-gray-50">
                  <td colSpan={6} className="p-0">
                    <div onClick={() => setExpandedDoc(isExpanded ? null : doc.categoryDate)} className="flex items-center hover:bg-gray-50/50 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0" style={{ width: '22%' }}>
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <FileText size={14} className="text-gray-500" />
                        </div>
                        <span className="text-sm font-medium text-gray-900 font-mono truncate">{doc.deliveryNoteNumber}</span>
                      </div>
                      <div className="px-3 py-3" style={{ width: '22%' }}>
                        <span className="text-sm text-gray-600 truncate block max-w-[180px]">{doc.supplierName}</span>
                      </div>
                      <div className="px-3 py-3" style={{ width: '14%' }}>
                        <span className="text-sm text-gray-500">{doc.date}</span>
                      </div>
                      <div className="px-3 py-3 text-center" style={{ width: '14%' }}>
                        <span className="text-sm text-gray-600 tabular-nums">
                          <span className="font-medium text-gray-900">{doc.goldenProducts}</span>
                          <span className="text-gray-400">/{doc.totalProducts}</span>
                        </span>
                      </div>
                      <div className="px-3 py-3" style={{ width: '22%' }}>
                        <CoverageBar percent={doc.coveragePercent} />
                      </div>
                      <div className="px-3 py-3" style={{ width: '6%' }}>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="bg-gray-50/50 border-t border-gray-100 px-4 py-2">
                        <div className="grid gap-1">
                          {doc.ingredients.map(ing => (
                            <div
                              key={ing.ingredientId}
                              className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white transition-colors cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); onNavigateToIngredient(ing.ingredientId); }}
                            >
                              <div className="flex items-center gap-2">
                                {ing.inGolden ? (
                                  <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                                ) : (
                                  <div className="w-[13px] h-[13px] rounded-full border-2 border-gray-300 shrink-0" />
                                )}
                                <span className={`text-xs ${ing.inGolden ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>{ing.ingredientName}</span>
                              </div>
                              {!ing.inGolden && (
                                <div className="flex items-center gap-1 text-xs text-brand-500">
                                  <span>{language === 'es' ? 'Ver entradas' : 'View entries'}</span>
                                  <ArrowRight size={11} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center">
            <FileText size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{language === 'es' ? 'No se encontraron documentos' : 'No documents found'}</p>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function StockAnnotationsPage() {
  const { language } = useLanguage();

  // Location selector (same as annotations / test pages)
  const { locations, loading: locsLoading } = useLocations();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // UI state (declared before hooks that depend on them)
  const [activeView, setActiveView] = useState<ViewTab>('ingredients');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<StockIngredient | null>(null);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [showDatasetPicker, setShowDatasetPicker] = useState(false);

  // Data hooks
  const { ingredients, loading: ingredientsLoading, useMock, refresh: refreshIngredients } = useStockIngredients(selectedLocationId || null);
  const { datasets, createDataset, deleteDataset, refresh: refreshDatasets } = useStockDatasets();
  const { documents } = useStockDocuments(selectedLocationId || null, selectedDataset || null);
  const { addEntries } = useAddToGolden();
  const { loadDetail, loading: detailLoading } = useIngredientDetail(selectedLocationId || null);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [creatingDataset, setCreatingDataset] = useState(false);

  // Auto-select first dataset when loaded
  useEffect(() => {
    if (datasets.length > 0 && !selectedDataset) {
      setSelectedDataset(datasets[0].datasetId);
    }
  }, [datasets, selectedDataset]);

  // If selected dataset was deleted, clear selection
  useEffect(() => {
    if (selectedDataset && datasets.length > 0 && !datasets.find(d => d.datasetId === selectedDataset)) {
      setSelectedDataset(datasets[0]?.datasetId ?? '');
    }
  }, [datasets, selectedDataset]);

  const selectedDatasetName = datasets.find(d => d.datasetId === selectedDataset)?.datasetName ?? '';

  const handleCreateDataset = useCallback(async () => {
    if (!newDatasetName.trim()) return;
    setCreatingDataset(true);
    try {
      const id = await createDataset(newDatasetName.trim());
      setSelectedDataset(id);
      setNewDatasetName('');
      setShowDatasetPicker(false);
    } catch (err) {
      console.error('Failed to create dataset:', err);
    } finally {
      setCreatingDataset(false);
    }
  }, [newDatasetName, createDataset]);

  const handleDeleteDataset = useCallback(async (datasetId: string) => {
    if (!confirm(language === 'es' ? 'Eliminar este dataset?' : 'Delete this dataset?')) return;
    try {
      await deleteDataset(datasetId);
    } catch (err) {
      console.error('Failed to delete dataset:', err);
    }
  }, [deleteDataset, language]);

  const handleAddToGolden = useCallback(async (ingredient: StockIngredient, entryIds: string[]) => {
    if (!selectedDataset) {
      alert(language === 'es' ? 'Selecciona o crea un dataset primero' : 'Select or create a dataset first');
      return;
    }
    if (!selectedLocationId) {
      alert(language === 'es' ? 'Selecciona un location primero' : 'Select a location first');
      return;
    }
    try {
      const result = await addEntries(selectedDataset, selectedLocationId, ingredient, entryIds);
      alert(language === 'es'
        ? `Anadido: ${result.productsAdded} productos, ${result.newDocuments} docs nuevos, ${result.updatedDocuments} actualizados`
        : `Added: ${result.productsAdded} products, ${result.newDocuments} new docs, ${result.updatedDocuments} updated`
      );
      setSelectedIngredient(null);
      refreshIngredients();
      refreshDatasets();
    } catch {
      // error shown by hook
    }
  }, [selectedDataset, selectedLocationId, addEntries, refreshIngredients, refreshDatasets, language]);

  const openIngredientModal = useCallback(async (ing: StockIngredient) => {
    const detailed = await loadDetail(ing);
    setSelectedIngredient(detailed);
  }, [loadDetail]);

  const handleNavigateToIngredient = useCallback((ingredientId: string) => {
    const ing = ingredients.find(i => i.ingredientId === ingredientId)
      ?? MOCK_INGREDIENTS.find(i => i.ingredientId === ingredientId);
    if (ing) {
      setActiveView('ingredients');
      openIngredientModal(ing);
    }
  }, [ingredients, openIngredientModal]);

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Stock Annotations</h1>
          <p className="mt-1 text-sm text-gray-500">
            {language === 'es'
              ? 'Gestiona anotaciones de ingredientes y entradas de stock para golden datasets'
              : 'Manage ingredient annotations and stock entries for golden datasets'
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Location selector */}
          <div className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white">
            <MapPin size={14} className="text-gray-400 shrink-0" />
            {locsLoading ? (
              <Loader2 size={14} className="text-gray-400 animate-spin" />
            ) : (
              <select
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
                className="text-sm text-gray-600 bg-transparent border-none outline-none cursor-pointer max-w-[180px] truncate"
              >
                <option value="">{language === 'es' ? 'Seleccionar location...' : 'Select location...'}</option>
                {locations.map(loc => (
                  <option key={loc.locationId} value={loc.locationId} className="text-gray-900">
                    {loc.locationName || loc.locationId}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dataset Selector */}
          <div className="relative">
            <button
              onClick={() => setShowDatasetPicker(!showDatasetPicker)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg bg-white hover:bg-gray-50 transition-colors ${
                selectedDataset ? 'border-gray-200' : 'border-red-300 bg-red-50'
              }`}
            >
              <Layers size={14} className={selectedDataset ? 'text-gray-400' : 'text-red-400'} />
              <span className={`text-sm max-w-[200px] truncate ${selectedDataset ? 'text-gray-600' : 'text-red-500'}`}>
                {selectedDatasetName || (language === 'es' ? 'Seleccionar dataset...' : 'Select dataset...')}
              </span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>
            {showDatasetPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDatasetPicker(false)} />
                <div className="absolute top-full mt-1 right-0 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                      {language === 'es' ? 'Dataset destino' : 'Target dataset'}
                    </p>
                  </div>

                  {/* Dataset list */}
                  <div className="max-h-48 overflow-y-auto">
                    {datasets.length === 0 && (
                      <p className="px-3 py-3 text-xs text-gray-400 text-center">
                        {language === 'es' ? 'No hay datasets. Crea uno nuevo.' : 'No datasets. Create one.'}
                      </p>
                    )}
                    {datasets.map(ds => (
                      <div
                        key={ds.datasetId}
                        className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors group ${
                          selectedDataset === ds.datasetId ? 'bg-brand-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <button
                          onClick={() => { setSelectedDataset(ds.datasetId); setShowDatasetPicker(false); }}
                          className={`flex-1 text-left min-w-0 ${
                            selectedDataset === ds.datasetId ? 'text-brand-600' : 'text-gray-600'
                          }`}
                        >
                          <p className="font-medium truncate">{ds.datasetName}</p>
                          <p className="text-xs text-gray-400">{ds.documentCount} docs</p>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDataset(ds.datasetId); }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all shrink-0"
                          title={language === 'es' ? 'Eliminar dataset' : 'Delete dataset'}
                        >
                          <Trash2 size={12} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Create new dataset */}
                  <div className="border-t border-gray-100 px-3 py-2">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                      {language === 'es' ? 'Crear nuevo dataset' : 'Create new dataset'}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newDatasetName}
                        onChange={e => setNewDatasetName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateDataset(); }}
                        placeholder={language === 'es' ? 'Nombre del dataset...' : 'Dataset name...'}
                        className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-100"
                      />
                      <button
                        onClick={handleCreateDataset}
                        disabled={!newDatasetName.trim() || creatingDataset}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors shrink-0"
                      >
                        {creatingDataset ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        {language === 'es' ? 'Crear' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mock data warning */}
      {useMock && selectedLocationId && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle size={14} className="text-yellow-600 shrink-0" />
          <span className="text-xs text-yellow-700">
            {language === 'es'
              ? 'APIs no disponibles — mostrando datos de ejemplo'
              : 'APIs unavailable — showing mock data'
            }
          </span>
        </div>
      )}

      {/* Loading state */}
      {ingredientsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="text-brand-500 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">
            {language === 'es' ? 'Cargando ingredientes...' : 'Loading ingredients...'}
          </span>
        </div>
      )}

      {/* View Tabs */}
      {!ingredientsLoading && (
        <>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden w-fit">
            <button
              onClick={() => setActiveView('ingredients')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeView === 'ingredients' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Package size={14} />
              {language === 'es' ? 'Ingredientes' : 'Ingredients'}
            </button>
            <button
              onClick={() => setActiveView('documents')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeView === 'documents' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <FileText size={14} />
              {language === 'es' ? 'Documentos' : 'Documents'}
            </button>
          </div>

          {activeView === 'ingredients' ? (
            <IngredientsView
              ingredients={ingredients} statusFilter={statusFilter} onFilterChange={setStatusFilter}
              search={ingredientSearch} onSearchChange={setIngredientSearch} onSelectIngredient={openIngredientModal} language={language}
            />
          ) : (
            <DocumentsView
              documents={documents} search={docSearch} onSearchChange={setDocSearch}
              onNavigateToIngredient={handleNavigateToIngredient} language={language}
            />
          )}
        </>
      )}

      {detailLoading && !selectedIngredient && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-4 flex items-center gap-3 shadow-lg">
            <Loader2 size={20} className="text-brand-500 animate-spin" />
            <span className="text-sm text-gray-600">{language === 'es' ? 'Cargando historial...' : 'Loading history...'}</span>
          </div>
        </div>
      )}

      {selectedIngredient && (
        <IngredientModal
          ingredient={selectedIngredient}
          locationId={selectedLocationId || ''}
          onClose={() => setSelectedIngredient(null)}
          onAddToGolden={handleAddToGolden}
          language={language}
        />
      )}
    </div>
  );
}
