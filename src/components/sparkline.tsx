type Point = { date: string; revenue: number | null };

/**
 * Small trend line. Missing days break the line instead of dropping to zero.
 * `id` must be unique on the page (used for the gradient).
 *
 * End markers are drawn as paths rather than SVG circle elements. Global CSS (box-sizing, borders)
 * can shift SVG circles so the dot sits off the last point.
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
  const pad = 4;
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
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`inline-block shrink-0 overflow-visible ${className}`}
      aria-hidden="true"
    >
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
          <path key={`l${i}`} d={dotPath(run[0][0], run[0][1], 1.25)} fill="currentColor" />
        ),
      )}
      <path d={dotPath(end[0], end[1], 2.25)} fill="currentColor" />
    </svg>
  );
}

/** A filled circle as a path, so CSS cannot displace an SVG circle element. */
export function dotPath(cx: number, cy: number, r: number): string {
  const rr = r.toFixed(2);
  return `M${(cx - r).toFixed(2)},${cy.toFixed(2)}a${rr},${rr} 0 1,0 ${(r * 2).toFixed(2)},0a${rr},${rr} 0 1,0 ${(-r * 2).toFixed(2)},0`;
}
