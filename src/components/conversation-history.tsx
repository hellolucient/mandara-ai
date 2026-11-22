"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { Ellipsis, Pencil, SquarePen, Trash2 } from "lucide-react";
import { cn } from "cn";
import { groupConversations, type ChatTab, type HistoryItem } from "@/lib/chat-view";

/**
 * Shared history list for the desktop sidebar and the mobile drawer.
 * New chat sits at the top. Delete lives in a small menu (or a left swipe),
 * never as an always-visible "Delete" label on every row.
 */
export function ConversationHistory({
  tab,
  activeId,
  conversations,
  onNavigate,
}: {
  tab: ChatTab;
  activeId: string;
  conversations: HistoryItem[];
  onNavigate: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const groups = useMemo(() => groupConversations(conversations, now ?? new Date()), [conversations, now]);

  return (
    <>
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
    </>
  );
}

function HistoryRow({ item, active, onNavigate }: { item: HistoryItem; active: boolean; onNavigate: () => void }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [busy, setBusy] = useState(false);
  const [swipe, setSwipe] = useState(0);
  const rowRef = useRef<HTMLLIElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startX = useRef<number | null>(null);

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
    setSwipe(0);
    if (active) router.push("/chat");
    router.refresh();
  }

  function onTouchStart(event: TouchEvent<HTMLLIElement>) {
    startX.current = event.touches[0]?.clientX ?? null;
  }
  function onTouchMove(event: TouchEvent<HTMLLIElement>) {
    if (startX.current == null) return;
    const dx = event.touches[0].clientX - startX.current;
    setSwipe(Math.max(-72, Math.min(0, dx)));
  }
  function onTouchEnd() {
    startX.current = null;
    setSwipe((current) => (current < -40 ? -72 : 0));
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
    <li
      ref={rowRef}
      className={cn("history-row group relative overflow-hidden rounded-xl", active && "is-active", busy && "opacity-60")}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {swipe < -8 ? (
        <button
          type="button"
          aria-label={`Delete ${title}`}
          className="absolute inset-y-0 right-0 flex w-[72px] items-center justify-center bg-destructive text-sm font-medium text-destructive-foreground"
          onClick={() => void remove()}
        >
          Delete
        </button>
      ) : null}
      <div
        className="relative z-[1] flex items-center"
        style={{ transform: swipe ? `translateX(${swipe}px)` : undefined, transition: startX.current == null ? "transform 0.18s ease-out" : undefined }}
      >
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
      </div>
    </li>
  );
}
