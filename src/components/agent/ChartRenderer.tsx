import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import type { ChartData } from '../../hooks/useAgentChat';

Chart.register(...registerables);

// Brand colors: orange #f2764b, pink #ffd2d5
const CHART_COLORS = [
  '#f2764b',   // brand orange (primary)
  '#ffd2d5',   // brand pink
  '#e85d30',   // darker orange
  '#ffb8bc',   // lighter pink
  '#c44a2a',   // deep orange
  '#ff9ea3',   // mid pink
  '#f59572',   // soft orange
  '#ffebec',   // pale pink
];

const CHART_COLORS_ALPHA = CHART_COLORS.map(c => c + 'cc');

type Props = {
  data: ChartData;
};

export default function ChartRenderer({ data }: Props) {
  if (!data || !data.type || !data.datasets || data.datasets.length === 0) return null;
  if (data.type === 'table') {
    return <TableChart data={data} />;
  }
  return <CanvasChart data={data} />;
}

function CanvasChart({ data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.labels || !data.datasets) return;

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const isPie = data.type === 'pie';

    try {
    chartRef.current = new Chart(canvasRef.current, {
      type: data.type as 'bar' | 'line' | 'pie',
      data: {
        labels: data.labels,
        datasets: data.datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data as number[],
          backgroundColor: isPie
            ? CHART_COLORS_ALPHA.slice(0, data.labels.length)
            : CHART_COLORS_ALPHA[i % CHART_COLORS_ALPHA.length],
          borderColor: isPie
            ? CHART_COLORS.slice(0, data.labels.length)
            : CHART_COLORS[i % CHART_COLORS.length],
          borderWidth: isPie ? 2 : 2,
          borderRadius: data.type === 'bar' ? 4 : undefined,
          tension: data.type === 'line' ? 0.3 : undefined,
          pointBackgroundColor: data.type === 'line' ? CHART_COLORS[i % CHART_COLORS.length] : undefined,
          pointRadius: data.type === 'line' ? 4 : undefined,
          fill: data.type === 'line' ? { target: 'origin', above: CHART_COLORS[i % CHART_COLORS.length] + '1a' } : undefined,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: !!data.title,
            text: data.title,
            font: { size: 14, weight: '600' },
            color: '#1f2937',
            padding: { bottom: 16 },
          },
          legend: {
            display: data.datasets.length > 1 || isPie,
            position: isPie ? 'right' : 'top',
            labels: {
              font: { size: 11 },
              color: '#6b7280',
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12,
            },
          },
          tooltip: {
            backgroundColor: '#1f2937',
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            cornerRadius: 8,
            padding: 10,
          },
        },
        scales: isPie ? {} : {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#9ca3af' },
          },
          y: {
            grid: { color: '#f3f4f6' },
            ticks: { font: { size: 11 }, color: '#9ca3af' },
            beginAtZero: true,
          },
        },
      },
    });

    } catch (e) {
      console.warn('Chart render error:', e);
    }

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm max-w-2xl">
      <canvas ref={canvasRef} />
    </div>
  );
}

function TableChart({ data }: Props) {
  const headers = data.labels ?? [];
  const rawRows = data.datasets?.[0]?.data ?? [];
  // Ensure each row is an array; if data is flat numbers, skip rendering
  const rows = rawRows.filter((r): r is unknown[] => Array.isArray(r));

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-2xl p-4">
        {data.title && <h4 className="text-sm font-semibold text-gray-800 mb-2">{data.title}</h4>}
        <p className="text-sm text-gray-500">Sin datos para mostrar en la tabla.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-2xl overflow-hidden">
      {data.title && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-800">{data.title}</h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#fdf5f3' }}>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                {row.map((cell, ci) => {
                  const isNumber = typeof cell === 'number';
                  const isStatus = typeof cell === 'string' && (cell === 'Pagada' || cell === 'Pendiente');
                  return (
                    <td key={ci} className={`px-4 py-2.5 ${isNumber ? 'text-right font-medium tabular-nums' : ''}`}>
                      {isStatus ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          cell === 'Pagada' ? 'bg-green-50 text-green-700' : 'text-amber-700'
                        }`} style={cell === 'Pendiente' ? { backgroundColor: '#ffd2d5', color: '#c44a2a' } : undefined}>
                          {cell}
                        </span>
                      ) : isNumber ? (
                        (cell as number).toLocaleString('es-ES', { minimumFractionDigits: 2 })
                      ) : (
                        String(cell ?? '')
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
