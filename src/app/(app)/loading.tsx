export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8" aria-busy="true" aria-label="Loading">
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-10 w-64 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl border bg-card" />
        <div className="h-28 animate-pulse rounded-xl border bg-card" />
        <div className="h-28 animate-pulse rounded-xl border bg-card" />
      </div>
      <div className="mt-6 h-64 animate-pulse rounded-2xl border bg-card" />
    </div>
  );
}
