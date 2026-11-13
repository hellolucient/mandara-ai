"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "cn";

export function ConversationList({
  items,
  activeId,
}: {
  items: Array<{ id: string; title: string }>;
  activeId: string;
}) {
  const router = useRouter();
  return (
    <div className="border-b md:w-64 md:shrink-0 md:border-r md:border-b-0">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Conversations</p>
        <Link href="/chat" className="text-sm text-primary">
          New
        </Link>
      </div>
      <ul className="max-h-40 overflow-auto md:max-h-[calc(100vh-4rem)]">
        {items.length === 0 ? (
          <li className="px-4 pb-4 text-sm text-muted-foreground">No conversations yet.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="group flex items-start">
              <Link
                href={`/chat/${item.id}`}
                className={cn(
                  "min-w-0 flex-1 truncate px-4 py-2 text-sm",
                  item.id === activeId ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                {item.title}
              </Link>
              <button
                type="button"
                className="px-3 py-2 text-xs text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100"
                onClick={async () => {
                  await fetch(`/api/conversations/${item.id}`, { method: "DELETE" });
                  if (item.id === activeId) router.push("/chat");
                  router.refresh();
                }}
              >
                Delete
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
