/* eslint-disable @next/next/no-img-element */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(196,120,84,0.35), rgba(196,120,84,0) 70%)" }}
      />
      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <img src="/icon-192.png" alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-[22px] shadow-md" />
          <p className="mt-5 text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Mandara Spa Maldives</p>
          <h1 className="mt-2 font-heading text-4xl text-primary">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="mt-8 rounded-2xl border bg-card/90 p-6 shadow-sm backdrop-blur">{children}</div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Private workspace for invited Mandara staff.</p>
      </div>
    </main>
  );
}
