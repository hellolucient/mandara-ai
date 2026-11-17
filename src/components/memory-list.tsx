"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Memory } from "@/lib/memory";

export function MemoryList({ initialMemories }: { initialMemories: Memory[] }) {
  const router = useRouter();
  const [memories, setMemories] = useState(initialMemories);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  async function deleteMemory(id: string) {
    setDeleting(id);
    try {
      const response = await fetch("/api/memories", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      
      if (response.ok) {
        setMemories(memories.filter((m) => m.id !== id));
        router.refresh();
      } else {
        alert("Could not delete memory");
      }
    } catch {
      alert("Could not delete memory");
    } finally {
      setDeleting(null);
    }
  }
  
  if (memories.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-muted-foreground">No memories saved yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell me something to remember in a chat, and it&apos;ll appear here.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {memories.map((memory) => (
        <div key={memory.id} className="rounded-xl border bg-card p-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm">{memory.content}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(memory.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteMemory(memory.id)}
            disabled={deleting === memory.id}
            className="shrink-0"
          >
            {deleting === memory.id ? "..." : "Delete"}
          </Button>
        </div>
      ))}
    </div>
  );
}
