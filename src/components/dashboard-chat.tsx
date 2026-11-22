"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "cn";
import { ConversationHistory } from "@/components/conversation-history";
import type { ChatTab, HistoryItem } from "@/lib/chat-view";

const OpenHistory = createContext<(() => void) | undefined>(undefined);

export function useOpenHistory(): (() => void) | undefined {
  return useContext(OpenHistory);
}

/**
 * Dashboard + chat layout: desktop keeps a sidebar; mobile opens straight into
 * the conversation with history in a slide-out drawer.
 */
export function DashboardChat({
  conversations,
  activeId,
  tab,
  children,
}: {
  conversations: HistoryItem[];
  activeId: string;
  tab: ChatTab;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const close = () => setDrawerOpen(false);
  const open = () => setDrawerOpen(true);

  return (
    <OpenHistory.Provider value={open}>
      <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
        <aside className="chat-sidebar hidden w-[272px] shrink-0 flex-col border-r md:flex" aria-label="Chat history">
          <div className="flex h-14 shrink-0 items-center px-4">
            <p className="text-[11.5px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Conversations</p>
          </div>
          <ConversationHistory tab={tab} activeId={activeId} conversations={conversations} onNavigate={() => undefined} />
        </aside>

        <div className={cn("fixed inset-0 z-40 md:hidden", drawerOpen ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!drawerOpen}>
          <button
            type="button"
            aria-label="Close chat history"
            tabIndex={drawerOpen ? 0 : -1}
            className={cn(
              "absolute inset-0 bg-[oklch(0.25_0.02_185/0.35)] backdrop-blur-[2px] transition-opacity duration-200",
              drawerOpen ? "opacity-100" : "opacity-0",
            )}
            onClick={close}
          />
          <aside
            className={cn(
              "chat-sidebar absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col shadow-2xl transition-transform duration-200 ease-out",
              drawerOpen ? "translate-x-0" : "-translate-x-full",
            )}
            role="dialog"
            aria-label="Chat history"
          >
            <div className="flex h-14 shrink-0 items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
              <p className="px-1.5 text-[11.5px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Conversations</p>
              <button type="button" className="icon-btn ml-auto" aria-label="Close chat history" onClick={close}>
                <X className="size-5" strokeWidth={1.75} />
              </button>
            </div>
            <ConversationHistory tab={tab} activeId={activeId} conversations={conversations} onNavigate={close} />
          </aside>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </OpenHistory.Provider>
  );
}
