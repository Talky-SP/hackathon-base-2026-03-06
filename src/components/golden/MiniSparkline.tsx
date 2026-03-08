import type { DatasetEvolution } from '../../types/golden';

interface Props {
  data: DatasetEvolution[];
  width?: number;
  height?: number;
}

export default function MiniSparkline({ data, width = 80, height = 28 }: Props) {
  if (data.length < 2) return null;

  const values = data.map(d => d.docs);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * chartW;
    const y = padding + chartH - ((v - min) / range) * chartH;
    return `${x},${y}`;
  });

  const isGrowing = values[values.length - 1] > values[0];

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={isGrowing ? '#16a34a' : '#6b7280'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
