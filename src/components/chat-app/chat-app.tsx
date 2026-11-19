"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowUp,
  CloudSun,
  Languages,
  TrendingDown,
  Store,
  ChartColumn,
  Check,
  Copy,
  Ellipsis,
  FileText,
  ImagePlus,
  KeyRound,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquareHeart,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Pencil,
  Plus,
  SquarePen,
  Trash2,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import {
  Citations,
  FILE_ACCEPT,
  hasWebSource,
  isImageFile,
  MODE,
  PHOTO_ACCEPT,
  Pictures,
  prepareAttachment,
  Prose,
  UserAttachments,
  type ChatMessage,
} from "@/components/chat-panel";
import { askPlaceholder } from "@/lib/ask-placeholder";
import {
  chatDisclaimer,
  chatSuggestions,
  groupConversations,
  salesAnswerMarkdown,
  splitSalesSource,
  type ChatTab,
  type HistoryItem,
} from "@/lib/chat-view";
import { SalesTicker } from "@/components/sales-ticker";

const SUGGESTION_ICONS: Record<string, LucideIcon> = {
  sales: TrendingUp,
  compare: ChartColumn,
  hakuraa: Store,
  budget: TrendingDown,
  guest: MessageSquareHeart,
  translate: Languages,
  ideas: Lightbulb,
  weather: CloudSun,
};

export type ChatAppUser = { name: string; initials: string; roleLabel: string };

export function ChatApp({
  conversationId,
  conversationMode,
  conversations,
  initialMessages,
  user,
  greeting,
  modelOn,
  localAuth,
  initialDraft = "",
}: {
  conversationId: string;
  conversationMode: ChatTab;
  conversations: HistoryItem[];
  initialMessages: ChatMessage[];
  user: ChatAppUser;
  greeting: string;
  modelOn: boolean;
  localAuth: boolean;
  initialDraft?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Switching Mandara | General opens a fresh empty chat in that tab. Past chats stay in the sidebar.
  const tab = conversationMode;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("mandara.sidebar") === "collapsed");
    } catch {
      /* private mode */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("mandara.sidebar", next ? "collapsed" : "open");
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="chat-app flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "chat-sidebar hidden shrink-0 flex-col border-r transition-[width] duration-200 ease-out md:flex",
          collapsed ? "w-0 overflow-hidden border-r-0" : "w-[272px]",
        )}
        aria-hidden={collapsed}
      >
        <Sidebar
          tab={tab}
          activeId={conversationId}
          conversations={conversations}
          user={user}
          localAuth={localAuth}
          onClose={toggleCollapsed}
          closeLabel="Close sidebar"
          closeIcon={PanelLeftClose}
          onNavigate={() => undefined}
        />
      </aside>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-40 md:hidden", drawerOpen ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!drawerOpen}>
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={drawerOpen ? 0 : -1}
          className={cn("absolute inset-0 bg-[oklch(0.25_0.02_185/0.35)] backdrop-blur-[2px] transition-opacity duration-200", drawerOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={cn(
            "chat-sidebar absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col shadow-2xl transition-transform duration-250 ease-out",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
          role="dialog"
          aria-label="Chats"
        >
          <Sidebar
            tab={tab}
            activeId={conversationId}
            conversations={conversations}
            user={user}
            localAuth={localAuth}
            onClose={() => setDrawerOpen(false)}
            closeLabel="Close menu"
            closeIcon={X}
            onNavigate={() => setDrawerOpen(false)}
          />
        </aside>
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar
          collapsed={collapsed}
          tab={tab}
          onOpenDrawer={() => setDrawerOpen(true)}
          onExpand={toggleCollapsed}
        />
        <SalesTicker />
        <Conversation
          key={conversationId || "new"}
          conversationId={conversationId}
          tab={tab}
          initialMessages={initialMessages}
          greeting={greeting}
          modelOn={modelOn}
          initialDraft={initialDraft}
        />
      </main>
    </div>
  );
}

function Logo({ size = 28 }: { size?: number }) {
  return (
    // The app icon is a small static PNG from /public.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon-192.png" alt="" width={size} height={size} className="shrink-0 rounded-[30%] shadow-sm" style={{ width: size, height: size }} />
  );
}

function TopBar({
  collapsed,
  tab,
  onOpenDrawer,
  onExpand,
}: {
  collapsed: boolean;
  tab: ChatTab;
  onOpenDrawer: () => void;
  onExpand: () => void;
}) {
  return (
    <header className="chat-topbar relative z-10 flex h-14 shrink-0 items-center gap-1 px-2 md:h-16 md:px-3">
      <button type="button" className="icon-btn md:hidden" aria-label="Open menu" onClick={onOpenDrawer}>
        <Menu className="size-[22px]" strokeWidth={1.75} />
      </button>
      {collapsed ? (
        <div className="hidden items-center gap-1 md:flex">
          <button type="button" className="icon-btn" aria-label="Open sidebar" onClick={onExpand}>
            <PanelLeftOpen className="size-5" strokeWidth={1.75} />
          </button>
          <Link href={`/chat?mode=${tab}`} className="icon-btn" aria-label="New chat">
            <SquarePen className="size-5" strokeWidth={1.75} />
          </Link>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 flex justify-center">
        <TabSwitch tab={tab} />
      </div>
      <Link href={`/chat?mode=${tab}`} className="icon-btn ml-auto md:hidden" aria-label="New chat">
        <SquarePen className="size-[21px]" strokeWidth={1.75} />
      </Link>
    </header>
  );
}

const TABS: Array<{ id: ChatTab; label: string }> = [
  { id: "mandara", label: "Mandara" },
  { id: "general", label: "General" },
];

/** Segmented control with strong active contrast. The other tab is a link to a new empty chat in that mode; the active tab stays put. */
function TabSwitch({ tab }: { tab: ChatTab }) {
  const index = TABS.findIndex((item) => item.id === tab);
  return (
    <div role="tablist" aria-label="Chat mode" className="tab-switch pointer-events-auto relative grid grid-cols-2 rounded-full p-[3px]">
      <span
        aria-hidden="true"
        className="tab-switch-pill absolute top-[3px] bottom-[3px] left-[3px] rounded-full transition-transform duration-200 ease-out"
        style={{ width: "calc(50% - 3px)", transform: `translateX(${index * 100}%)` }}
      />
      {TABS.map((item) => {
        const selected = item.id === tab;
        const className = cn(
          "relative z-10 inline-flex h-[34px] min-w-[86px] items-center justify-center rounded-full px-4 text-[13.5px] leading-none tracking-[0.01em] transition-colors duration-150 before:absolute before:-inset-y-[5px] before:inset-x-0 before:content-['']",
          selected ? "font-bold text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        );
        if (selected) {
          return (
            <button key={item.id} type="button" role="tab" aria-selected="true" className={className}>
              {item.label}
            </button>
          );
        }
        return (
          <Link key={item.id} href={`/chat?mode=${item.id}`} role="tab" aria-selected={false} className={className}>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function Sidebar({
  tab,
  activeId,
  conversations,
  user,
  localAuth,
  onClose,
  closeLabel,
  closeIcon: CloseIcon,
  onNavigate,
}: {
  tab: ChatTab;
  activeId: string;
  conversations: HistoryItem[];
  user: ChatAppUser;
  localAuth: boolean;
  onClose: () => void;
  closeLabel: string;
  closeIcon: LucideIcon;
  onNavigate: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const groups = useMemo(() => groupConversations(conversations, now ?? new Date()), [conversations, now]);

  return (
    <div className="flex h-full min-w-[272px] flex-col pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-3">
        <Link href="/chat" onClick={onNavigate} className="flex min-h-11 items-center gap-2.5 rounded-xl px-1.5">
          <Logo size={30} />
          <span className="font-heading text-[19px] leading-none text-primary">Mandara</span>
        </Link>
        <button type="button" className="icon-btn ml-auto" aria-label={closeLabel} onClick={onClose}>
          <CloseIcon className="size-5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <Link
          href={`/chat?mode=${tab}`}
          onClick={onNavigate}
          className="new-chat-btn flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] font-medium"
        >
          <SquarePen className="size-[18px]" strokeWidth={1.75} />
          New chat
        </Link>
      </div>

      <nav className="chat-history min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3" aria-label="Chat history">
        {groups.length === 0 ? (
          <p className="px-3 pt-4 text-sm leading-6 text-muted-foreground">Your chats will appear here.</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mt-4 first:mt-2">
              <h2 className="px-3 pb-1.5 text-[11.5px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{group.label}</h2>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <HistoryRow key={item.id} item={item} active={item.id === activeId} onNavigate={onNavigate} />
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>

      <div className="shrink-0 border-t border-[oklch(0.87_0.02_88/0.7)] px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <AccountMenu user={user} localAuth={localAuth} />
      </div>
    </div>
  );
}

function HistoryRow({ item, active, onNavigate }: { item: HistoryItem; active: boolean; onNavigate: () => void }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [busy, setBusy] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTitle(item.title), [item.title]);
  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
        setMenu(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menu]);

  async function saveTitle() {
    const next = title.replace(/\s+/g, " ").trim();
    setRenaming(false);
    if (!next || next === item.title) {
      setTitle(item.title);
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/conversations/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: next }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) setTitle(item.title);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/conversations/${item.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setMenu(false);
    if (active) router.push("/chat");
    router.refresh();
  }

  if (renaming) {
    return (
      <li ref={rowRef} className="px-1">
        <input
          ref={inputRef}
          value={title}
          maxLength={80}
          aria-label="Chat name"
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void saveTitle();
            }
            if (event.key === "Escape") {
              setTitle(item.title);
              setRenaming(false);
            }
          }}
          className="h-11 w-full rounded-xl border border-ring/40 bg-card px-3 text-[15px] outline-none focus:ring-2 focus:ring-ring/30"
        />
      </li>
    );
  }

  return (
    <li ref={rowRef} className={cn("history-row group relative flex items-center rounded-xl", active && "is-active", busy && "opacity-60")}>
      <Link
        href={`/chat/${item.id}`}
        onClick={onNavigate}
        className="flex min-h-11 min-w-0 flex-1 items-center rounded-xl py-2 pr-10 pl-3 text-[14.5px] leading-5"
        aria-current={active ? "page" : undefined}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {item.mode === "mandara" ? (
          <span className="history-badge ml-2 shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-medium tracking-wide" title="Mandara chat">
            M
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        aria-label={`Options for ${title}`}
        aria-expanded={menu}
        className={cn(
          "row-more absolute right-0.5 flex size-10 items-center justify-center rounded-lg text-muted-foreground",
          menu || active ? "opacity-100" : "opacity-60 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
        )}
        onClick={() => {
          setMenu((open) => !open);
          setConfirmDelete(false);
        }}
      >
        <Ellipsis className="size-[18px]" />
      </button>
      {menu ? (
        <div className="popover-panel absolute top-full right-0 z-30 mt-1 w-48 p-1.5" role="menu">
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setMenu(false);
              setRenaming(true);
            }}
          >
            <Pencil className="size-4" strokeWidth={1.75} />
            Rename
          </button>
          {confirmDelete ? (
            <button type="button" role="menuitem" className="menu-item text-destructive" onClick={() => void remove()}>
              <Trash2 className="size-4" strokeWidth={1.75} />
              Tap again to delete
            </button>
          ) : (
            <button type="button" role="menuitem" className="menu-item text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" strokeWidth={1.75} />
              Delete
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}

function AccountMenu({ user, localAuth }: { user: ChatAppUser; localAuth: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {open ? (
        <div className="popover-panel absolute right-0 bottom-full left-0 z-30 mb-2 p-1.5" role="menu" aria-label="Account">
          <div className="px-3 pt-2 pb-2.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.roleLabel}</p>
          </div>
          <div className="mx-2 mb-1 border-t" />
          {localAuth ? (
            <>
              <Link href="/account/password" role="menuitem" className="menu-item">
                <KeyRound className="size-4" strokeWidth={1.75} />
                Change password
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" role="menuitem" className="menu-item">
                  <LogOut className="size-4" strokeWidth={1.75} />
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">Signed in through the workspace host.</p>
          )}
        </div>
      ) : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="account-btn flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left"
      >
        <span className="avatar flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tracking-wide">
          {user.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-medium leading-5">{user.name}</span>
          <span className="block truncate text-xs leading-4 text-muted-foreground">{user.roleLabel}</span>
        </span>
        <Ellipsis className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function Conversation({
  conversationId,
  tab,
  initialMessages,
  greeting,
  modelOn,
  initialDraft,
}: {
  conversationId: string;
  tab: ChatTab;
  initialMessages: ChatMessage[];
  greeting: string;
  modelOn: boolean;
  initialDraft: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState(initialDraft);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);

  // A refresh brings the stored messages; never let an older copy replace newer ones already on screen.
  useEffect(() => {
    setMessages((current) => {
      const shown = current.filter((message) => message.id !== "pending-user").length;
      return initialMessages.length >= shown ? initialMessages : current;
    });
  }, [initialMessages]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Keep the newest message in view.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  // Auto-grow the composer up to about eight lines.
  const resize = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);
  useLayoutEffect(resize, [draft, resize]);

  useEffect(() => {
    if (!attachOpen) return;
    const onDown = (event: PointerEvent) => {
      if (attachRef.current && !attachRef.current.contains(event.target as Node)) setAttachOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [attachOpen]);

  function clearFile() {
    setFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    if (photoRef.current) photoRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    setAttachOpen(false);
    const chosen = event.target.files?.[0] ?? null;
    setError("");
    if (!chosen) {
      clearFile();
      return;
    }
    try {
      const prepared = await prepareAttachment(chosen);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return isImageFile(prepared) ? URL.createObjectURL(prepared) : "";
      });
      setFile(prepared);
      textRef.current?.focus();
    } catch (caught) {
      clearFile();
      setError(caught instanceof Error ? caught.message : "That file could not be attached.");
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if ((!content && !file) || busy) return;
    setBusy(true);
    setError("");
    const attached = file;
    const livePreview = previewUrl;
    const optimistic: ChatMessage = {
      id: "pending-user",
      role: "user",
      content,
      attachment_name: attached?.name ?? "",
      citations: "[]",
      mode: tab,
      images: "[]",
    };
    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setFile(null);
    if (photoRef.current) photoRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
    const form = new FormData();
    form.set("content", content);
    form.set("mode", tab);
    if (conversationId) form.set("conversationId", conversationId);
    if (attached) form.set("file", attached);
    try {
      const response = await fetch("/api/chat", { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as { error?: string; conversationId?: string; messages?: ChatMessage[] };
      if (!response.ok || !body.messages || !body.conversationId) {
        setMessages((current) => current.filter((message) => message.id !== "pending-user"));
        setDraft(content);
        if (attached) {
          setFile(attached);
          setPreviewUrl(livePreview);
        }
        setError(body.error || "That message could not be answered. Please try again.");
        return;
      }
      setMessages(body.messages);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      if (body.conversationId !== conversationId) router.replace(`/chat/${body.conversationId}`);
      else router.refresh();
    } catch {
      setMessages((current) => current.filter((message) => message.id !== "pending-user"));
      setDraft(content);
      if (attached) setFile(attached);
      setError("The message could not be sent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0 && !busy;
  const pendingPreview = messages.some((message) => message.id === "pending-user") ? previewUrl : "";
  const canSend = !busy && (draft.trim() !== "" || file !== null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {empty ? (
          <EmptyState greeting={greeting} tab={tab} onPick={(prompt) => void send(prompt)} />
        ) : (
          <div className="mx-auto w-full max-w-[720px] px-4 pt-4 pb-6 md:px-6 md:pt-8">
            <div className="space-y-7">
              {messages.map((message) =>
                message.role === "user" ? (
                  <UserBubble key={message.id} message={message} livePreview={message.id === "pending-user" ? pendingPreview : ""} />
                ) : (
                  <AssistantMessage key={message.id} message={message} />
                ),
              )}
              {busy ? <TypingIndicator /> : null}
            </div>
          </div>
        )}
      </div>

      <div className="composer-wrap shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
        <form
          className="mx-auto w-full max-w-[720px]"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          {error ? (
            <p role="alert" className="mb-2 rounded-xl bg-[oklch(0.95_0.03_40)] px-3.5 py-2 text-sm leading-5 text-destructive">
              {error}
            </p>
          ) : null}
          {!modelOn ? (
            <p className="mb-2 rounded-xl bg-accent px-3.5 py-2 text-[13px] leading-5 text-accent-foreground">
              Open conversation is waiting for its AI key. Sales figures still answer.
            </p>
          ) : null}
          <div className="composer rounded-[26px] border bg-card">
            {file ? (
              <div className="flex items-center gap-3 px-3 pt-3">
                {previewUrl ? (
                  // Local object URL for the photo the person just chose.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="size-14 rounded-xl border object-cover" />
                ) : (
                  <span className="flex size-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <FileText className="size-6" strokeWidth={1.5} />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{file.name}</span>
                <button type="button" className="icon-btn" aria-label="Remove attachment" onClick={clearFile}>
                  <X className="size-4" />
                </button>
              </div>
            ) : null}
            <textarea
              ref={textRef}
              value={draft}
              rows={1}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              placeholder={askPlaceholder(tab)}
              aria-label={tab === "mandara" ? "Ask about Mandara" : "Ask anything"}
              enterKeyHint="send"
              className="block max-h-[200px] w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-base leading-6 outline-none placeholder:text-muted-foreground/75"
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <div ref={attachRef} className="relative">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Add a photo or file"
                  aria-expanded={attachOpen}
                  disabled={busy}
                  onClick={() => setAttachOpen((value) => !value)}
                >
                  <Plus className="size-[22px]" strokeWidth={1.75} />
                </button>
                {attachOpen ? (
                  <div className="popover-panel absolute bottom-full left-0 z-30 mb-2 w-52 p-1.5" role="menu">
                    <label className="menu-item cursor-pointer" role="menuitem">
                      <ImagePlus className="size-4" strokeWidth={1.75} />
                      Add a photo
                      <input ref={photoRef} type="file" accept={PHOTO_ACCEPT} className="sr-only" onChange={(event) => void onPick(event)} />
                    </label>
                    <label className="menu-item cursor-pointer" role="menuitem">
                      <Paperclip className="size-4" strokeWidth={1.75} />
                      Attach a file
                      <input ref={fileRef} type="file" accept={FILE_ACCEPT} className="sr-only" onChange={(event) => void onPick(event)} />
                    </label>
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                aria-label={busy ? "Answering" : "Send message"}
                disabled={!canSend}
                className={cn("send-btn flex size-11 items-center justify-center rounded-full", busy && "is-busy")}
              >
                {busy ? <span className="send-spinner" aria-hidden="true" /> : <ArrowUp className="size-5" strokeWidth={2.25} />}
              </button>
            </div>
          </div>
          <p className="mt-2 hidden text-center text-[11.5px] text-muted-foreground md:block">
            {chatDisclaimer(tab)}
          </p>
        </form>
      </div>
    </div>
  );
}

function EmptyState({ greeting, tab, onPick }: { greeting: string; tab: ChatTab; onPick: (prompt: string) => void }) {
  const suggestions = chatSuggestions(tab);
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col justify-center px-4 py-8 md:px-6">
      <div className="empty-hero flex flex-col items-center text-center">
        <Logo size={56} />
        <h1 className="mt-5 font-heading text-[30px] leading-[1.15] tracking-[-0.015em] text-primary md:text-[40px]">{greeting}</h1>
        <p className="mt-2 text-[15px] text-muted-foreground md:text-base">
          {tab === "mandara" ? "Ask about sales, spas and Mandara." : "Ask me anything."}
        </p>
      </div>
      {suggestions.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-2.5 md:mt-10 md:gap-3">
          {suggestions.map((item) => {
            const Icon = SUGGESTION_ICONS[item.id] ?? Lightbulb;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item.prompt)}
                className="suggestion-card flex min-h-[92px] flex-col items-start gap-2 rounded-2xl border bg-card/80 p-3.5 text-left md:min-h-[104px] md:p-4"
              >
                <span className="suggestion-icon flex size-8 items-center justify-center rounded-full">
                  <Icon className="size-[17px]" strokeWidth={1.75} />
                </span>
                <span>
                  <span className="block text-[14.5px] leading-5 font-medium">{item.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-4 text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function UserBubble({ message, livePreview }: { message: ChatMessage; livePreview: string }) {
  return (
    <div className="flex justify-end">
      <div className="user-bubble max-w-[85%] rounded-[22px] rounded-br-md px-4 py-2.5 md:max-w-[75%]">
        {message.content ? <p className="text-[15.5px] leading-6 break-words whitespace-pre-wrap">{message.content}</p> : null}
        <UserAttachments name={message.attachment_name} raw={message.images} liveSrc={livePreview} />
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const isError = message.mode === "error";
  const sales = message.mode === "sales" ? splitSalesSource(message.content) : null;
  const text = sales ? salesAnswerMarkdown(sales.body) : message.content;
  const label =
    message.mode === "general" && hasWebSource(message.citations)
      ? "Checked the web"
      : message.mode === "general" || sales?.source
        ? ""
        : MODE[message.mode] ?? "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="assistant-msg group flex gap-3">
      <span className="mt-0.5 hidden md:block">
        <Logo size={28} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("assistant-prose text-[15.5px] leading-7", isError && "text-destructive")}>
          {message.content ? <Prose className="space-y-4" text={isError ? message.content.replace(/^Error:\s*/, "Sorry, that didn't work: ") : text} /> : null}
          <Pictures raw={message.images} />
        </div>
        {sales?.source ? <p className="mt-3 text-[12.5px] leading-5 text-muted-foreground">{sales.source}</p> : null}
        <Citations raw={message.citations} />
        <div className="mt-1.5 -ml-2 flex items-center gap-1 text-muted-foreground">
          {message.content && !isError ? (
            <button type="button" className="icon-btn size-9" aria-label={copied ? "Copied" : "Copy answer"} onClick={() => void copy()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" strokeWidth={1.75} />}
            </button>
          ) : null}
          {label ? <span className="text-xs">{label}</span> : null}
        </div>
      </div>
    </article>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3" aria-live="polite" aria-label="Mandara AI is thinking">
      <span className="mt-0.5 hidden md:block">
        <Logo size={28} />
      </span>
      <div className="typing flex h-8 items-center gap-1.5 px-1">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}
