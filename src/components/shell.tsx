import { NavLinks } from "@/components/nav-links";
import type { Member } from "@/lib/members";

const MARK = (
  <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="3.2" fill="currentColor" />
    <path
      d="M16 4.5c1.4 3.6 1.4 6.1 0 8.2-1.4-2.1-1.4-4.6 0-8.2Zm0 23c-1.4-3.6-1.4-6.1 0-8.2 1.4 2.1 1.4 4.6 0 8.2ZM4.5 16c3.6-1.4 6.1-1.4 8.2 0-2.1 1.4-4.6 1.4-8.2 0Zm23 0c-3.6 1.4-6.1 1.4-8.2 0 2.1-1.4 4.6-1.4 8.2 0Z"
      fill="currentColor"
    />
  </svg>
);

export function Shell({
  member,
  companyName,
  children,
}: {
  member: Member;
  companyName: string;
  children: React.ReactNode;
}) {
  const items = [
    { href: "/chat", label: "Assistant" },
    { href: "/knowledge", label: "Knowledge" },
    { href: "/sales", label: "Sales" },
    { href: "/agents", label: "Agents" },
  ];
  if (member.role === "admin") items.push({ href: "/admin", label: "Admin" });
  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden bg-primary text-primary-foreground md:flex md:flex-col md:px-4 md:py-6">
        <div className="flex items-center gap-3 px-2">
          {MARK}
          <div>
            <p className="font-heading text-xl leading-none">Mandara</p>
            <p className="mt-1 text-[11px] tracking-[0.18em] text-white/70 uppercase">AI</p>
          </div>
        </div>
        <div className="mt-8">
          <NavLinks items={items} tone="rail" />
        </div>
        <div className="mt-auto px-2 text-sm text-white/75">
          <p className="break-words text-white">{member.name || "Staff"}</p>
          <p className="capitalize">{member.role}</p>
          <p className="mt-3 text-xs leading-5 break-words text-white/60">{companyName}</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="border-b bg-card md:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-primary">{MARK}</span>
            <div>
              <p className="font-heading text-lg leading-none">Mandara AI</p>
              <p className="text-xs text-muted-foreground">{member.name || "Staff"}</p>
            </div>
          </div>
          <div className="px-3 pb-3">
            <NavLinks items={items} tone="bar" />
          </div>
        </header>
        {member.simulated ? (
          <p className="border-b bg-accent px-4 py-2 text-sm text-accent-foreground">
            Local preview uses an invented administrator named Dev Viewer. This is not a real sign-in.
          </p>
        ) : null}
        {member.stage === "preview" ? (
          <p className="border-b bg-secondary px-4 py-2 text-sm">
            This is the preview workspace. Its records stay separate from the live workspace.
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function SignedOut() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="font-heading text-4xl text-primary">Mandara AI</p>
      <p className="mt-4 text-lg leading-7">
        This workspace is for invited Mandara staff. Sign-in is handled by the host before the app opens.
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        If you reached this page, the host did not accept a person. Ask the workspace owner to invite you, and open the private or team address rather than a public one.
      </p>
    </main>
  );
}
