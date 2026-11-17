export function Sparkline({ data }: { data: Array<{ date: string; revenue: number | null }> }) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.revenue ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;

  const width = 100;
  const height = 24;
  const padding = 2;

  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(" L ")}`;

  return (
    <svg width={width} height={height} className="inline-block">
      <path d={pathData} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
    </svg>
  );
}
