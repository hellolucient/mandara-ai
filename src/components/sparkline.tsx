type Point = { date: string; revenue: number | null };

/**
 * Small trend line. Missing days break the line instead of dropping to zero.
 * `id` must be unique on the page (used for the gradient).
 */
export function Sparkline({
  data,
  id,
  width = 112,
  height = 28,
  className = "text-primary",
  strokeWidth = 1.5,
}: {
  data: Point[];
  id: string;
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const known = data.map((d) => d.revenue).filter((v): v is number => v !== null);
  if (data.length < 2 || known.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const max = Math.max(...known);
  const min = Math.min(...known);
  const range = max - min || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / (data.length - 1)) * (width - 2 * pad);
  const y = (v: number) => height - pad - ((v - min) / range) * (height - 2 * pad);

  // Split into continuous runs of known values.
  const runs: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  data.forEach((d, i) => {
    if (d.revenue === null) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push([x(i), y(d.revenue)]);
    }
  });
  if (current.length) runs.push(current);

  const line = (run: Array<[number, number]>) => run.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = (run: Array<[number, number]>) =>
    `${line(run)} L${run[run.length - 1][0].toFixed(1)},${height} L${run[0][0].toFixed(1)},${height} Z`;

  const last = runs[runs.length - 1];
  const end = last[last.length - 1];
  const gid = `spark-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={`inline-block overflow-visible ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {runs.map((run, i) =>
        run.length > 1 ? <path key={`a${i}`} d={area(run)} fill={`url(#${gid})`} /> : null,
      )}
      {runs.map((run, i) =>
        run.length > 1 ? (
          <path key={`l${i}`} d={line(run)} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
        ) : (
          <circle key={`l${i}`} cx={run[0][0]} cy={run[0][1]} r={1} fill="currentColor" />
        ),
      )}
      <circle cx={end[0]} cy={end[1]} r={2.25} fill="currentColor" />
    </svg>
  );
}
