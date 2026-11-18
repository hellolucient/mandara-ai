"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { safeHttpUrl, safeImageSrc } from "@/lib/answer-text";
import { MarkdownMessage } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calculator } from "@/components/calculator";
import type { CalculatorSpec } from "@/lib/calculator-spec";

type Citation = { documentId: string; title: string; excerpt: string; sample: boolean; url?: string };
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachment_name: string;
  citations: string;
  mode: string;
  model?: string;
  images?: string;
};

const PHOTO_ACCEPT = "image/*,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp";
const FILE_ACCEPT = ".pdf,.docx,.txt,.md,.csv,text/plain,application/pdf";
const ATTACHMENT_MAX_BYTES = 2_000_000;

const MODE: Record<string, string> = {
  sales: "From stored sales records",
  knowledge: "From company documents",
  general: "General assistant",
  unavailable: "Model not connected",
};

export function ChatPanel({
  conversationId,
  conversationMode,
  initialMessages,
  modelOn,
  initialDraft = "",
}: {
  conversationId: string;
  conversationMode?: string;
  initialDraft?: string;
  initialMessages: Message[];
  modelOn: boolean;
}) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [mode, setMode] = useState<string>(conversationMode || "general");
  const [draft, setDraft] = useState(initialDraft);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
    const optimistic: Message = {
      id: "pending-user",
      role: "user",
      content,
      attachment_name: attached?.name ?? "",
      citations: "[]",
      mode,
      images: "[]",
    };
    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setFile(null);
    if (photoRef.current) photoRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
    const form = new FormData();
    form.set("content", content);
    form.set("mode", mode);
    if (conversationId) form.set("conversationId", conversationId);
    if (attached) form.set("file", attached);
    try {
      const response = await fetch("/api/chat", { method: "POST", body: form });
      const body = (await response.json()) as { error?: string; conversationId?: string; messages?: Message[] };
      if (!response.ok || !body.messages || !body.conversationId) {
        setMessages((current) => current.filter((message) => message.id !== "pending-user"));
        setDraft(content);
        if (attached) {
          setFile(attached);
          setPreviewUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return isImageFile(attached) ? URL.createObjectURL(attached) : "";
          });
        }
        setError(body.error || "The message could not be answered.");
        return;
      }
      setMessages(body.messages);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      if (body.conversationId !== conversationId) {
        router.replace(`/chat/${body.conversationId}`);
      } else {
        router.refresh();
      }
    } catch {
      setMessages((current) => current.filter((message) => message.id !== "pending-user"));
      setDraft(content);
      if (attached) setFile(attached);
      setError("The message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  const pendingPreview = messages.some((message) => message.id === "pending-user") ? previewUrl : "";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col md:min-h-screen">
      <div className="border-b bg-background px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Mode:</span>
          <div className="flex gap-1 rounded-lg border p-1">
            <button
              onClick={() => setMode("general")}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                mode === "general"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              General
            </button>
            <button
              onClick={() => setMode("mandara")}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                mode === "mandara"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mandara
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {mode === "general"
              ? "Normal chat with web search when needed"
              : "Answers only from Mandara data"}
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
        {messages.length === 0 && !busy ? (
          <div className="mx-auto max-w-2xl" />
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.map((message) => (
              <article key={message.id}>
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  {message.role === "user" ? "You" : "Mandara"}
                </p>
                <div className={message.role === "user" ? "mt-1" : "mt-2 rounded-xl border bg-card px-4 py-3"}>
                  {message.content ? (
                    message.role === "assistant" ? <Prose text={message.content} /> : <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  ) : null}
                  {message.role === "user" ? (
                    <UserAttachments
                      name={message.attachment_name}
                      raw={message.images}
                      liveSrc={message.id === "pending-user" ? pendingPreview : ""}
                    />
                  ) : (
                    <Pictures raw={message.images} />
                  )}
                  {message.role === "assistant" && MODE[message.mode] ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {message.mode === "general" && hasWebSource(message.citations) ? "Checked the web" : MODE[message.mode]}
                      {message.model ? ` · ${message.model}` : ""}
                    </p>
                  ) : null}
                  <Citations raw={message.citations} />
                </div>
              </article>
            ))}
            {busy ? <ThinkingIndicator /> : null}
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
          {!modelOn ? (
            <p className="mb-2 rounded-lg bg-accent px-3 py-2 text-sm leading-6">
              Open conversation is waiting for an OpenRouter key. Document search and sales figures still answer, and they do not call a model.
            </p>
          ) : null}
          {file ? (
            <div className="mb-2 flex items-center gap-3 rounded-lg border bg-card p-2">
              {previewUrl ? (
                // Preview is a local object URL created from the file the person just chose.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
              <button type="button" className="text-sm text-muted-foreground underline-offset-2 hover:underline" onClick={clearFile}>
                Remove
              </button>
            </div>
          ) : null}
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <label>
                <span className="cursor-pointer underline-offset-2 hover:underline">Add a photo</span>
                <input ref={photoRef} type="file" accept={PHOTO_ACCEPT} className="sr-only" disabled={busy} onChange={(event) => void onPick(event)} />
              </label>
              <label>
                <span className="cursor-pointer underline-offset-2 hover:underline">Attach a file</span>
                <input ref={fileRef} type="file" accept={FILE_ACCEPT} className="sr-only" disabled={busy} onChange={(event) => void onPick(event)} />
              </label>
            </div>
            <Button
              type="submit"
              disabled={busy || (!draft.trim() && !file)}
              aria-busy={busy}
              className={busy ? "send-busy min-w-28 gap-2 disabled:opacity-100" : "min-w-28"}
            >
              {busy ? (
                <>
                  <span className="send-spinner" aria-hidden="true" />
                  Thinking
                </>
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <article aria-live="polite" aria-label="Thinking">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">Mandara</p>
      <div className="thinking-bubble mt-2 rounded-xl border bg-card px-4 py-3">
        <div className="thinking-dots" aria-hidden="true">
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="thinking-dot" />
        </div>
        <span className="thinking-label">Thinking…</span>
      </div>
    </article>
  );
}

function isImageFile(file: File): boolean {
  if (file.type.toLowerCase().startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

async function prepareAttachment(file: File): Promise<File> {
  if (!isImageFile(file)) {
    if (file.size > ATTACHMENT_MAX_BYTES) throw new Error("Attachments are limited to 2 MB.");
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      if (file.size > ATTACHMENT_MAX_BYTES) throw new Error("Attachments are limited to 2 MB.");
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    let quality = 0.85;
    let blob = await canvasBlob(canvas, quality);
    while (blob && blob.size > ATTACHMENT_MAX_BYTES && quality > 0.45) {
      quality -= 0.1;
      blob = await canvasBlob(canvas, quality);
    }
    if (!blob || blob.size > ATTACHMENT_MAX_BYTES) {
      if (file.size <= ATTACHMENT_MAX_BYTES) return file;
      throw new Error("Attachments are limited to 2 MB.");
    }
    const heic = isHeicName(file);
    if (!heic && file.size <= ATTACHMENT_MAX_BYTES && blob.size >= file.size) return file;
    const name = file.name.replace(/\.(heic|heif|png|webp|jpe?g)$/i, ".jpg") || "photo.jpg";
    return new File([blob], name.endsWith(".jpg") ? name : `${name}.jpg`, { type: "image/jpeg" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("2 MB")) throw error;
    if (file.size > ATTACHMENT_MAX_BYTES) throw new Error("Attachments are limited to 2 MB.");
    if (isHeicName(file)) throw new Error("This photo format couldn't be read. Save it as JPEG or PNG and try again.");
    return file;
  }
}

function isHeicName(file: File): boolean {
  return file.type.toLowerCase().includes("heic") || file.type.toLowerCase().includes("heif") || /\.(heic|heif)$/i.test(file.name);
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function Prose({ text }: { text: string }) {
  const calculatorMatch = text.match(/```calculator\s*\n([\s\S]*?)\n```/);
  let calculatorSpec: CalculatorSpec | null = null;
  let textWithoutCalculator = text;

  if (calculatorMatch) {
    try {
      calculatorSpec = JSON.parse(calculatorMatch[1]) as CalculatorSpec;
      textWithoutCalculator = text.replace(/```calculator\s*\n[\s\S]*?\n```/, "").trim();
    } catch {
      calculatorSpec = null;
    }
  }

  return (
    <>
      <MarkdownMessage text={textWithoutCalculator} />
      {calculatorSpec && <Calculator spec={calculatorSpec} />}
    </>
  );
}

function UserAttachments({ name, raw, liveSrc }: { name: string; raw?: string; liveSrc?: string }) {
  const src = liveSrc || storedUserImage(raw);
  if (!src && !name) return null;
  return (
    <div className="mt-2">
      {src ? (
        // Stored previews are data URLs; live previews are object URLs created in this session.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name || "Attached photo"} className="max-h-48 max-w-xs rounded-lg border object-cover" />
      ) : null}
      {name ? <p className={src ? "mt-2 text-xs text-muted-foreground" : "text-xs text-muted-foreground"}>Attached: {name}</p> : null}
    </div>
  );
}

function storedUserImage(raw?: string): string {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(parsed) || typeof parsed[0] !== "string") return "";
    const value = parsed[0];
    const raster = safeImageSrc(value);
    if (raster) return raster;
    return /^data:image\/heic;base64,[a-z0-9+/]+=*$/i.test(value) ? value : "";
  } catch {
    return "";
  }
}

function Pictures({ raw }: { raw?: string }) {
  let sources: string[] = [];
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (Array.isArray(parsed)) sources = parsed.map((item) => safeImageSrc(typeof item === "string" ? item : "")).filter(Boolean);
  } catch {
    sources = [];
  }
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 space-y-3">
      {sources.map((src) => (
        // The picture is a data URL from this reply, which the image optimizer cannot fetch.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src.slice(-24)} src={src} alt="Concept created for this reply" className="w-full rounded-lg border" />
      ))}
    </div>
  );
}

function hasWebSource(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Array<{ url?: string }>;
    return Array.isArray(parsed) && parsed.some((item) => Boolean(safeHttpUrl(item?.url)));
  } catch {
    return false;
  }
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
      {citations.map((citation) => {
        const href = safeHttpUrl(citation.url);
        return (
          <li key={href || citation.documentId || citation.title} className="text-xs leading-5 text-muted-foreground">
            {href ? (
              <a className="text-foreground underline-offset-2 hover:underline" href={href} target="_blank" rel="noreferrer noopener">
                {citation.title}
              </a>
            ) : (
              <span className="text-foreground">Source: {citation.title}</span>
            )}
            {citation.sample ? " · Sample document" : ""}
          </li>
        );
      })}
    </ul>
  );
}
