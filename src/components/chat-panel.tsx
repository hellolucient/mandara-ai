"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Citation = { documentId: string; title: string; excerpt: string; sample: boolean };
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachment_name: string;
  citations: string;
  mode: string;
};

const SUGGESTIONS = [
  "What were total spa sales yesterday?",
  "Which locations need attention?",
  "What does the insurance note say about certificates?",
];

const MODE: Record<string, string> = {
  sales: "From stored sales records",
  knowledge: "From company documents",
  general: "General assistant",
  unavailable: "Model not connected",
};

export function ChatPanel({
  conversationId,
  initialMessages,
  modelOn,
}: {
  conversationId: string;
  initialMessages: Message[];
  modelOn: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("content", content);
    if (conversationId) form.set("conversationId", conversationId);
    if (file) form.set("file", file);
    try {
      const response = await fetch("/api/chat", { method: "POST", body: form });
      const body = (await response.json()) as { error?: string; conversationId?: string; messages?: Message[] };
      if (!response.ok || !body.messages || !body.conversationId) {
        setError(body.error || "The message could not be answered.");
        return;
      }
      setMessages(body.messages);
      setDraft("");
      setFile(null);
      if (body.conversationId !== conversationId) {
        router.replace(`/chat/${body.conversationId}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("The message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col md:min-h-screen">
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-2xl pt-10">
            <p className="font-heading text-4xl text-primary">What do you need done?</p>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              Ask about a treatment, a company document, or the sales figures already stored. Sales answers are calculated from the records. They are not guessed by the model.
            </p>
            {!modelOn ? (
              <p className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm leading-6">
                Open conversation is waiting for an OpenRouter key. Document search and sales figures still answer, and they do not call a model.
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-lg border bg-card px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.map((message) => (
              <article key={message.id}>
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  {message.role === "user" ? "You" : "Mandara"}
                </p>
                <div className={message.role === "user" ? "mt-1" : "mt-2 rounded-xl border bg-card px-4 py-3"}>
                  <Prose text={message.content} />
                  {message.attachment_name ? (
                    <p className="mt-2 text-xs text-muted-foreground">Attached: {message.attachment_name}</p>
                  ) : null}
                  {message.role === "assistant" && MODE[message.mode] ? (
                    <p className="mt-3 text-xs text-muted-foreground">{MODE[message.mode]}</p>
                  ) : null}
                  <Citations raw={message.citations} />
                </div>
              </article>
            ))}
            {busy ? <p className="text-sm text-muted-foreground">Looking that up…</p> : null}
          </div>
        )}
      </div>
      <form
        className="border-t bg-background px-4 py-3 md:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <div className="mx-auto max-w-2xl">
          {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask Mandara"
            rows={3}
            className="min-h-20 resize-none bg-card"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <label className="text-sm text-muted-foreground">
              <span className="cursor-pointer underline-offset-2 hover:underline">Attach a file</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv,text/plain,application/pdf"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {file ? <span className="ml-2">{file.name}</span> : null}
            </label>
            <Button type="submit" disabled={busy || !draft.trim()}>
              {busy ? "Sending" : "Send"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-6">
      {text.split(/\n{2,}/).map((block, index) => (
        <p key={index} className="whitespace-pre-wrap">
          {block}
        </p>
      ))}
    </div>
  );
}

function Citations({ raw }: { raw: string }) {
  let citations: Citation[] = [];
  try {
    const parsed = JSON.parse(raw) as Citation[];
    if (Array.isArray(parsed)) citations = parsed.filter((item) => item && item.title);
  } catch {
    citations = [];
  }
  if (citations.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2 border-t pt-3">
      {citations.map((citation) => (
        <li key={citation.documentId} className="text-xs leading-5 text-muted-foreground">
          <span className="text-foreground">Source: {citation.title}</span>
          {citation.sample ? " · Sample document" : ""}
        </li>
      ))}
    </ul>
  );
}
