import { useState, useEffect, useMemo, useCallback } from 'react';
import { TrendingUp, TrendingDown, Loader2, AlertCircle, DollarSign, Clock, Target, FileText, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { DOC_TYPE_LABELS } from '../types/golden';
import { getAnalyticsDashboard, listDatasets, type ApiDashboardResponse, type ApiDashboardEvolutionPoint, type ApiDataset } from '../services/ocrTestingApi';

type DocTypeFilter = 'all' | string;

// ─── SVG Chart Components ─────────────────────────────────────────────────

const CHART_COLORS = {
  accuracy: '#f97316',     // brand orange
  cost: '#8b5cf6',         // purple
  latency: '#3b82f6',      // blue
  gridLine: '#f3f4f6',
  gridText: '#9ca3af',
};

interface DayGroup {
  date: string;
  label: string;
  runs: ApiDashboardEvolutionPoint[];
  avg: Record<string, number>;
}

function MultiLineChart({ data, lines, height = 240, onPointClick, selectedIndex }: {
  data: { label: string; values: Record<string, number> }[];
  lines: { key: string; color: string; label: string; format: (v: number) => string; yMin?: number; yMax?: number }[];
  height?: number;
  onPointClick?: (index: number) => void;
  selectedIndex?: number | null;
}) {
  if (data.length < 2 || lines.length === 0) return null;

  const padding = { top: 20, right: 16, bottom: 32, left: 48 };
  const w = 700;
  const h = height;
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const primaryLine = lines[0];
  const vals = data.map(d => d.values[primaryLine.key] ?? 0);
  const minV = primaryLine.yMin ?? Math.max(0, Math.min(...vals) * 0.9);
  const maxV = primaryLine.yMax ?? (Math.max(...vals) * 1.1 || 1);
  const range = maxV - minV || 1;

  const toX = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => padding.top + (1 - (v - minV) / range) * chartH;

  const gridSteps = 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const v = minV + (range * i) / gridSteps;
    return { y: toY(v), label: primaryLine.format(v) };
  });

  const xLabels = data.map((d, i) => ({
    x: toX(i), label: d.label,
    show: data.length <= 10 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1,
  }));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padding.left} y1={g.y} x2={w - padding.right} y2={g.y} stroke={CHART_COLORS.gridLine} strokeWidth="1" />
          <text x={padding.left - 6} y={g.y + 3} textAnchor="end" fill={CHART_COLORS.gridText} fontSize="10" fontFamily="system-ui">{g.label}</text>
        </g>
      ))}
      {xLabels.filter(l => l.show).map((l, i) => (
        <text key={i} x={l.x} y={h - 6} textAnchor="middle" fill={CHART_COLORS.gridText} fontSize="10" fontFamily="system-ui">{l.label}</text>
      ))}

      {/* Selected day highlight */}
      {selectedIndex != null && (
        <line
          x1={toX(selectedIndex)} y1={padding.top}
          x2={toX(selectedIndex)} y2={padding.top + chartH}
          stroke="#f97316" strokeWidth="1" strokeDasharray="4 2" opacity="0.4"
        />
      )}

      {lines.map(line => {
        const lineVals = data.map(d => d.values[line.key] ?? 0);
        const lMin = line.yMin ?? Math.max(0, Math.min(...lineVals) * 0.9);
        const lMax = line.yMax ?? (Math.max(...lineVals) * 1.1 || 1);
        const lRange = lMax - lMin || 1;
        const ly = (v: number) => padding.top + (1 - (v - lMin) / lRange) * chartH;

        const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${ly(d.values[line.key] ?? 0).toFixed(1)}`).join(' ');
        const area = `${path} L${toX(data.length - 1).toFixed(1)},${(padding.top + chartH).toFixed(1)} L${padding.left},${(padding.top + chartH).toFixed(1)} Z`;

        return (
          <g key={line.key}>
            <path d={area} fill={line.color} opacity="0.05" />
            <path d={path} fill="none" stroke={line.color} strokeWidth="2" />
            {data.map((d, i) => (
              <g key={i}
                onClick={() => onPointClick?.(i)}
                className={onPointClick ? 'cursor-pointer' : ''}
              >
                {/* Invisible larger hit area */}
                {onPointClick && (
                  <circle cx={toX(i)} cy={ly(d.values[line.key] ?? 0)} r="10" fill="transparent" />
                )}
                <circle
                  cx={toX(i)} cy={ly(d.values[line.key] ?? 0)}
                  r={selectedIndex === i ? 5 : 3}
                  fill={selectedIndex === i ? line.color : 'white'}
                  stroke={line.color} strokeWidth="2"
                />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function StackedBarChart({ data, categories, colorMap, height = 200 }: {
  data: { label: string; values: Record<string, number> }[];
  categories: string[];
  colorMap: Record<string, string>;
  height?: number;
}) {
  if (data.length === 0) return null;

  const padding = { top: 12, right: 16, bottom: 32, left: 40 };
  const w = 700;
  const h = height;
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const totals = data.map(d => categories.reduce((s, c) => s + (d.values[c] ?? 0), 0));
  const maxTotal = Math.max(...totals, 1);

  const barW = Math.min(32, (chartW / data.length) * 0.6);
  const gap = (chartW - barW * data.length) / (data.length + 1);

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const v = (maxTotal * i) / gridSteps;
    return { y: padding.top + chartH - (v / maxTotal) * chartH, label: String(Math.round(v)) };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padding.left} y1={g.y} x2={w - padding.right} y2={g.y} stroke={CHART_COLORS.gridLine} strokeWidth="1" />
          <text x={padding.left - 6} y={g.y + 3} textAnchor="end" fill={CHART_COLORS.gridText} fontSize="10" fontFamily="system-ui">{g.label}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = padding.left + gap + i * (barW + gap);
        let yOffset = 0;
        return (
          <g key={i}>
            {categories.map(cat => {
              const val = d.values[cat] ?? 0;
              const barH = (val / maxTotal) * chartH;
              const y = padding.top + chartH - yOffset - barH;
              yOffset += barH;
              return barH > 0 ? (
                <rect key={cat} x={x} y={y} width={barW} height={barH}
                  fill={colorMap[cat] ?? '#6b7280'} rx="1" />
              ) : null;
            })}
            {(data.length <= 12 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && (
              <text x={x + barW / 2} y={h - 6} textAnchor="middle" fill={CHART_COLORS.gridText} fontSize="10" fontFamily="system-ui">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ data, size = 140 }: {
  data: { id: string; label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const inner = r * 0.6;

  let angle = -Math.PI / 2;
  const arcs = data.map(d => {
    const sweep = (d.value / total) * Math.PI * 2;
    const startAngle = angle;
    angle += sweep;
    const endAngle = angle;
    const largeArc = sweep > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + inner * Math.cos(endAngle);
    const iy1 = cy + inner * Math.sin(endAngle);
    const ix2 = cx + inner * Math.cos(startAngle);
    const iy2 = cy + inner * Math.sin(startAngle);
    const path = `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${ix1},${iy1} A${inner},${inner} 0 ${largeArc} 0 ${ix2},${iy2} Z`;
    return { ...d, path };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map(a => (
        <path key={a.id} d={a.path} fill={a.color} opacity="0.85" />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#374151" fontSize="18" fontWeight="600" fontFamily="system-ui">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#9ca3af" fontSize="10" fontFamily="system-ui">
        errores
      </text>
    </svg>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, delta, sub, icon: Icon }: {
  label: string;
  value: string;
  delta?: number;
  sub?: string;
  icon?: typeof Target;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={13} className="text-gray-400" />}
        <p className="text-[11px] text-gray-400">{label}</p>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
        {delta !== undefined && delta !== 0 && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium mb-0.5 ${delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] text-gray-300 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string, lang: string): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function fmtUsd(v: number): string {
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

const DOC_TYPE_LABEL_MAP: Record<string, { es: string; en: string }> = {
  expense: { es: 'Gastos', en: 'Expenses' },
  income: { es: 'Ingresos', en: 'Income' },
  payroll: { es: 'Nominas', en: 'Payrolls' },
  delivery_note: { es: 'Albaranes', en: 'Delivery Notes' },
};

/** Group evolution points by calendar day, computing averages */
function groupByDay(points: ApiDashboardEvolutionPoint[], lang: string): DayGroup[] {
  const byDate = new Map<string, ApiDashboardEvolutionPoint[]>();
  for (const p of points) {
    const dateKey = p.date.split('T')[0]; // YYYY-MM-DD
    const existing = byDate.get(dateKey);
    if (existing) existing.push(p);
    else byDate.set(dateKey, [p]);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, runs]) => {
      const n = runs.length;
      const avg: Record<string, number> = {
        accuracy: Math.round(runs.reduce((s, r) => s + r.fieldAccuracy * 100, 0) / n),
        costPerDoc: runs.reduce((s, r) => s + r.avgCostPerDocUsd, 0) / n,
        costPerPage: runs.reduce((s, r) => s + (r.avgCostPerPageUsd ?? 0), 0) / n,
        totalCost: runs.reduce((s, r) => s + r.totalCostUsd, 0) / n,
        latency: runs.reduce((s, r) => s + r.avgExecutionTimeMs, 0) / n,
      };
      return { date, label: formatDate(date, lang), runs, avg };
    });
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t, language } = useLanguage();
  const [docTypeFilter, setDocTypeFilter] = useState<DocTypeFilter>('all');
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<ApiDashboardResponse | null>(null);
  const [datasets, setDatasets] = useState<ApiDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // Load datasets for filter dropdown
  useEffect(() => {
    listDatasets().then(r => setDatasets(r.items)).catch(() => {});
  }, []);

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnalyticsDashboard({
        limit: 20,
        datasetId: datasetId ?? undefined,
        docType: docTypeFilter !== 'all' ? docTypeFilter : undefined,
      });
      setDashboard(data);
      setSelectedDayIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [docTypeFilter, datasetId]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Derived chart data
  const chartData = useMemo(() => {
    if (!dashboard) return null;

    const evo = dashboard.evolution ?? [];

    // Group by day
    const dayGroups = groupByDay(evo, language);

    // If multiple days exist, show day averages; if single day with multiple runs, show individual runs
    const isDayView = dayGroups.length >= 2;
    const chartPoints: { label: string; values: Record<string, number> }[] = isDayView
      ? dayGroups.map(g => ({ label: g.label, values: g.avg }))
      : evo.map(p => ({
          label: p.name ?? formatDateTime(p.date, language),
          values: {
            accuracy: Math.round(p.fieldAccuracy * 100),
            costPerDoc: p.avgCostPerDocUsd,
            costPerPage: p.avgCostPerPageUsd ?? 0,
            totalCost: p.totalCostUsd,
            latency: p.avgExecutionTimeMs,
          },
        }));

    // Error evolution
    const errorEvo = dashboard.errorEvolution ?? { dataPoints: [], categoryMeta: {} };
    const errorCategories = Object.keys(errorEvo.categoryMeta ?? {});
    const errorColorMap = Object.fromEntries(
      Object.entries(errorEvo.categoryMeta ?? {}).map(([k, v]) => [k, v.color])
    );
    const errorBars = (errorEvo.dataPoints ?? []).map(p => ({
      label: formatDate(p.date, language),
      values: p.categories,
    }));

    // Donut data
    const donutData = (dashboard.currentErrors ?? []).map(e => ({
      id: e.categoryId,
      label: e.name,
      value: e.docsAffected,
      color: e.color,
    }));

    // Deltas (latest vs penultimate evolution point)
    let accuracyDelta: number | undefined;
    let costDelta: number | undefined;
    let latencyDelta: number | undefined;
    if (evo.length >= 2) {
      const curr = evo[evo.length - 1];
      const prev = evo[evo.length - 2];
      accuracyDelta = (curr.fieldAccuracy - prev.fieldAccuracy) * 100;
      if (prev.avgCostPerDocUsd > 0) {
        costDelta = ((curr.avgCostPerDocUsd - prev.avgCostPerDocUsd) / prev.avgCostPerDocUsd) * 100;
      }
      if (prev.avgExecutionTimeMs > 0) {
        latencyDelta = ((curr.avgExecutionTimeMs - prev.avgExecutionTimeMs) / prev.avgExecutionTimeMs) * 100;
      }
    }

    return { dayGroups, isDayView, chartPoints, errorBars, errorCategories, errorColorMap, donutData, accuracyDelta, costDelta, latencyDelta };
  }, [dashboard, language]);

  // Active chart tab
  const [activeChart, setActiveChart] = useState<'accuracy' | 'cost' | 'latency'>('accuracy');

  // Selected day's runs
  const selectedDay = chartData && selectedDayIndex != null ? chartData.dayGroups[selectedDayIndex] ?? null : null;

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle size={28} className="text-red-400" />
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={loadDashboard} className="text-sm text-brand-500 hover:text-brand-600">
          {language === 'es' ? 'Reintentar' : 'Retry'}
        </button>
      </div>
    );
  }

  const latest = dashboard?.latest;
  const availableDocTypes = dashboard?.availableDocTypes ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('analytics.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('analytics.subtitle')}</p>
        </div>

        {/* Dataset filter */}
        <div className="flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin text-gray-300" />}
          <select
            value={datasetId ?? ''}
            onChange={e => setDatasetId(e.target.value || null)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
          >
            <option value="">{language === 'es' ? 'Todos los datasets' : 'All datasets'}</option>
            {datasets.map(ds => (
              <option key={ds.datasetId} value={ds.datasetId}>{ds.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {latest && (
        <div className="grid grid-cols-5 gap-3">
          <StatCard
            icon={Target}
            label={language === 'es' ? 'Precision campos' : 'Field Accuracy'}
            value={`${Math.round(latest.fieldAccuracy * 100)}%`}
            delta={chartData?.accuracyDelta}
            sub={latest.name}
          />
          <StatCard
            icon={FileText}
            label={language === 'es' ? 'Docs perfectos' : 'Perfect Docs'}
            value={`${Math.round(latest.docAccuracy * 100)}%`}
            sub={`${latest.perfectDocs}/${latest.totalDocs}`}
          />
          <StatCard
            icon={DollarSign}
            label={language === 'es' ? 'Coste total' : 'Total Cost'}
            value={latest.costMetrics ? fmtUsd(latest.costMetrics.total_usd) : '--'}
            delta={chartData?.costDelta ? -chartData.costDelta : undefined}
            sub={latest.costMetrics
              ? `${fmtUsd(latest.costMetrics.avg_per_doc_usd)}/doc${latest.costMetrics.avg_per_page_usd != null ? ` · ${fmtUsd(latest.costMetrics.avg_per_page_usd)}/pag` : ''}`
              : undefined}
          />
          <StatCard
            icon={Clock}
            label={language === 'es' ? 'Latencia media' : 'Avg Latency'}
            value={latest.latencyMetrics ? fmtMs(latest.latencyMetrics.avg_execution_time_ms) : '--'}
            delta={chartData?.latencyDelta ? -chartData.latencyDelta : undefined}
            sub={latest.latencyMetrics ? `min ${fmtMs(latest.latencyMetrics.min_execution_time_ms ?? 0)} / max ${fmtMs(latest.latencyMetrics.max_execution_time_ms ?? 0)}` : undefined}
          />
          <StatCard
            icon={BarChart3}
            label={language === 'es' ? 'Docs procesados' : 'Docs Processed'}
            value={String(latest.totalDocs)}
            sub={latest.costMetrics?.total_pages != null
              ? `${latest.costMetrics.total_pages} ${language === 'es' ? 'paginas' : 'pages'}`
              : (language === 'es' ? 'Ultimo test run' : 'Latest test run')}
          />
        </div>
      )}

      {/* Doc type filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setDocTypeFilter('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            docTypeFilter === 'all'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {language === 'es' ? 'Todos' : 'All'}
        </button>
        {availableDocTypes.map(dt => (
          <button
            key={dt}
            onClick={() => setDocTypeFilter(dt)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              docTypeFilter === dt
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {DOC_TYPE_LABEL_MAP[dt]?.[language] ?? dt}
          </button>
        ))}
      </div>

      {/* Evolution chart with metric tabs — grouped by day or individual runs */}
      {chartData && chartData.chartPoints.length >= 2 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                {language === 'es' ? 'Evolucion' : 'Evolution'}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {chartData.isDayView
                  ? (language === 'es'
                    ? 'Media por dia — click en un punto para ver ejecuciones'
                    : 'Daily average — click a point to see runs')
                  : (language === 'es'
                    ? 'Por ejecucion'
                    : 'Per run')}
              </p>
            </div>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              {([
                { key: 'accuracy' as const, labelEs: 'Precision', labelEn: 'Accuracy', color: CHART_COLORS.accuracy },
                { key: 'cost' as const, labelEs: 'Coste', labelEn: 'Cost', color: CHART_COLORS.cost },
                { key: 'latency' as const, labelEs: 'Latencia', labelEn: 'Latency', color: CHART_COLORS.latency },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveChart(tab.key)}
                  className={`px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeChart === tab.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="w-2 h-0.5 rounded" style={{ backgroundColor: tab.color }} />
                  {language === 'es' ? tab.labelEs : tab.labelEn}
                </button>
              ))}
            </div>
          </div>

          {activeChart === 'accuracy' && (
            <MultiLineChart
              data={chartData.chartPoints}
              lines={[{
                key: 'accuracy',
                color: CHART_COLORS.accuracy,
                label: language === 'es' ? 'Precision' : 'Accuracy',
                format: v => `${Math.round(v)}%`,
                yMin: 0,
                yMax: 100,
              }]}
              onPointClick={chartData.isDayView ? (i => setSelectedDayIndex(selectedDayIndex === i ? null : i)) : undefined}
              selectedIndex={chartData.isDayView ? selectedDayIndex : undefined}
            />
          )}
          {activeChart === 'cost' && (
            <MultiLineChart
              data={chartData.chartPoints}
              lines={[{
                key: 'costPerPage',
                color: CHART_COLORS.cost,
                label: language === 'es' ? 'Coste/pag' : 'Cost/page',
                format: v => fmtUsd(v),
              }]}
              onPointClick={chartData.isDayView ? (i => setSelectedDayIndex(selectedDayIndex === i ? null : i)) : undefined}
              selectedIndex={chartData.isDayView ? selectedDayIndex : undefined}
            />
          )}
          {activeChart === 'latency' && (
            <MultiLineChart
              data={chartData.chartPoints}
              lines={[{
                key: 'latency',
                color: CHART_COLORS.latency,
                label: language === 'es' ? 'Latencia' : 'Latency',
                format: v => fmtMs(v),
              }]}
              onPointClick={chartData.isDayView ? (i => setSelectedDayIndex(selectedDayIndex === i ? null : i)) : undefined}
              selectedIndex={chartData.isDayView ? selectedDayIndex : undefined}
            />
          )}

          {/* Day drill-down: individual runs */}
          {selectedDay && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setSelectedDayIndex(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown size={14} />
                </button>
                <h4 className="text-xs font-medium text-gray-700">
                  {selectedDay.label} — {selectedDay.runs.length} {language === 'es' ? 'ejecuciones' : 'runs'}
                </h4>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left px-3 py-2 font-medium">{language === 'es' ? 'Ejecucion' : 'Run'}</th>
                      <th className="text-right px-3 py-2 font-medium">{language === 'es' ? 'Precision' : 'Accuracy'}</th>
                      <th className="text-right px-3 py-2 font-medium">{language === 'es' ? 'Coste/pag' : 'Cost/page'}</th>
                      <th className="text-right px-3 py-2 font-medium">{language === 'es' ? 'Coste/doc' : 'Cost/doc'}</th>
                      <th className="text-right px-3 py-2 font-medium">{language === 'es' ? 'Coste total' : 'Total cost'}</th>
                      <th className="text-right px-3 py-2 font-medium">{language === 'es' ? 'Latencia' : 'Latency'}</th>
                      <th className="text-right px-3 py-2 font-medium">Docs</th>
                      <th className="text-right px-3 py-2 font-medium">{language === 'es' ? 'Paginas' : 'Pages'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDay.runs.map((run, i) => {
                      const accPct = Math.round(run.fieldAccuracy * 100);
                      const accColor = accPct >= 90 ? 'text-green-600' : accPct >= 75 ? 'text-yellow-600' : 'text-red-600';
                      return (
                        <tr key={run.testRunId} className={`border-t border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                          <td className="px-3 py-2">
                            <span className="text-gray-700 font-medium">{run.name ?? formatDateTime(run.date, language)}</span>
                            <span className="text-gray-400 ml-1.5">{run.testRunId.slice(0, 8)}</span>
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${accColor}`}>
                            {accPct}%
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {run.avgCostPerPageUsd != null ? fmtUsd(run.avgCostPerPageUsd) : '--'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {fmtUsd(run.avgCostPerDocUsd)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {fmtUsd(run.totalCostUsd)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {fmtMs(run.avgExecutionTimeMs)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {run.totalDocs}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {run.totalPages ?? '--'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Two-column: Error evolution + Current error donut */}
      {chartData && (
        <div className="grid grid-cols-5 gap-4">
          {/* Error Evolution */}
          <div className="col-span-3 bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              {language === 'es' ? 'Evolucion de errores' : 'Error Evolution'}
            </h3>
            <p className="text-[11px] text-gray-400 mb-4">
              {language === 'es' ? 'Errores por run, por categoria' : 'Errors per run, by category'}
            </p>
            {chartData.errorBars.length > 0 ? (
              <>
                <StackedBarChart
                  data={chartData.errorBars}
                  categories={chartData.errorCategories}
                  colorMap={chartData.errorColorMap}
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100">
                  {chartData.errorCategories.map(cat => {
                    const meta = (dashboard?.errorEvolution ?? { categoryMeta: {} }).categoryMeta[cat];
                    return (
                      <span key={cat} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: meta?.color ?? '#6b7280' }} />
                        {meta?.name ?? cat}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">
                {language === 'es' ? 'Sin datos de errores' : 'No error data'}
              </p>
            )}
          </div>

          {/* Current error distribution */}
          <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              {language === 'es' ? 'Distribucion actual' : 'Current Distribution'}
            </h3>
            <p className="text-[11px] text-gray-400 mb-4">
              {language === 'es' ? 'Ultimo test run' : 'Latest test run'}
            </p>
            {chartData.donutData.length > 0 ? (
              <div className="flex items-start gap-4">
                <DonutChart data={chartData.donutData} />
                <div className="flex-1 space-y-2 pt-2">
                  {chartData.donutData.map(d => (
                    <div key={d.id} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-600 flex-1 truncate">{d.label}</span>
                      <span className="text-xs tabular-nums text-gray-500 font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">
                {language === 'es' ? 'Sin errores' : 'No errors'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Doc type breakdown table */}
      {latest?.byDocType && Object.keys(latest.byDocType).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              {language === 'es' ? 'Desglose por tipo de documento' : 'Breakdown by Document Type'}
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Tipo' : 'Type'}
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-gray-400">Docs</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Precision' : 'Accuracy'}
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Docs OK' : 'Perfect'}
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Coste/pag' : 'Cost/page'}
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Coste/doc' : 'Cost/doc'}
                </th>
                <th className="text-right px-5 py-2.5 text-[11px] font-medium text-gray-400">
                  {language === 'es' ? 'Latencia' : 'Latency'}
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(latest.byDocType).map(([dt, stats]) => {
                const accPct = Math.round(stats.fieldAccuracy * 100);
                const docPct = Math.round(stats.docAccuracy * 100);
                const accColor = accPct >= 90 ? 'text-green-600' : accPct >= 75 ? 'text-yellow-600' : 'text-red-600';
                return (
                  <tr key={dt} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-2.5">
                      <span className="text-sm font-medium text-gray-700">
                        {(DOC_TYPE_LABELS as Record<string, Record<string, string>>)[dt]?.[language] ?? DOC_TYPE_LABEL_MAP[dt]?.[language] ?? dt}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-sm tabular-nums text-gray-600">{stats.totalDocs}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-sm tabular-nums font-medium ${accColor}`}>{accPct}%</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-sm tabular-nums text-gray-600">{docPct}%</span>
                      <span className="text-[10px] text-gray-400 ml-1">({stats.perfectDocs}/{stats.totalDocs})</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-sm tabular-nums text-gray-600">
                        {stats.costMetrics?.avg_per_page_usd != null ? fmtUsd(stats.costMetrics.avg_per_page_usd) : '--'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-sm tabular-nums text-gray-600">
                        {stats.costMetrics ? fmtUsd(stats.costMetrics.avg_per_doc_usd) : '--'}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span className="text-sm tabular-nums text-gray-600">
                        {stats.latencyMetrics ? fmtMs(stats.latencyMetrics.avg_execution_time_ms) : '--'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!latest && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center">
          <BarChart3 size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {language === 'es' ? 'No hay datos de analytics disponibles. Ejecuta un test run para empezar.' : 'No analytics data available. Run a test to get started.'}
          </p>
        </div>
      )}
    </div>
  );
}
