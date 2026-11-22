/**
 * Home's "Ask Mandara AI" box sends people to /chat?q=…&mode=…&ask=….
 * The chat must fire that question once, then forget it so a re-render,
 * back navigation, or a tab switch cannot send it again.
 */

export type AskMode = "mandara" | "general";

export type HomeAsk = {
  q: string;
  mode: AskMode;
  ask: string;
};

export function parseHomeAsk(params: { q?: string | string[]; mode?: string | string[]; ask?: string | string[] }): HomeAsk {
  const q = typeof params.q === "string" ? params.q.slice(0, 2000) : "";
  const mode: AskMode = params.mode === "mandara" || params.mode === "general" ? params.mode : "general";
  const ask = typeof params.ask === "string" ? params.ask.slice(0, 80) : "";
  return { q, mode, ask };
}

function askKey(askId: string, q: string): string | null {
  const text = q.trim();
  if (!text) return null;
  const id = askId.trim();
  return `mandara.home-ask.${id || `q:${text}`}`;
}

const started = new Set<string>();

function storage(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

/** True when this Home question was already started or finished in this tab. */
export function homeAskStarted(askId: string, q: string): boolean {
  const key = askKey(askId, q);
  if (!key) return false;
  if (started.has(key)) return true;
  try {
    return storage()?.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * Marks a Home question as in-flight and returns the text to send.
 * Returns null when there is nothing to send, or it was already started.
 */
export function beginHomeAsk(askId: string, q: string): string | null {
  const text = q.trim();
  const key = askKey(askId, q);
  if (!text || !key) return null;
  if (started.has(key)) return null;
  try {
    const store = storage();
    if (store?.getItem(key) === "1") return null;
    store?.setItem(key, "1");
  } catch {
    /* private mode: memory only */
  }
  started.add(key);
  return text;
}

/** Test helper: clear the in-memory once-only lock. */
export function resetHomeAskForTests(): void {
  started.clear();
}

/** Drop q and ask from the current URL without a Next.js navigation, so the question cannot be sent again. */
export function stripHomeAskFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("q") && !url.searchParams.has("ask")) return;
  url.searchParams.delete("q");
  url.searchParams.delete("ask");
  const search = url.searchParams.toString();
  window.history.replaceState(window.history.state, "", url.pathname + (search ? `?${search}` : "") + url.hash);
}

/**
 * After a new chat is created, only jump to /chat/{id} if the person is still on that new chat.
 * If they already switched Mandara ↔ General (or left the page), leave them where they are.
 */
export function shouldAdoptNewConversation(opts: {
  currentConversationId: string;
  pathname: string;
  search: string;
  sentMode: string;
}): boolean {
  const path = opts.pathname;
  if (opts.currentConversationId) return path === `/chat/${opts.currentConversationId}`;
  if (path !== "/chat" && path !== "/chat/") return false;
  const query = opts.search.startsWith("?") ? opts.search.slice(1) : opts.search;
  const urlMode = new URLSearchParams(query).get("mode");
  const expected = opts.sentMode === "mandara" ? "mandara" : "general";
  if (!urlMode) return expected === "general";
  return urlMode === expected;
}
