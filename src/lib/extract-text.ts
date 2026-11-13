export async function extractText(filename: string, mime: string, bytes: Uint8Array): Promise<string> {
  const kind = fileKind(filename, mime);
  if (kind === "text") return new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 200_000);
  if (kind === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value.slice(0, 200_000);
  }
  if (kind === "pdf") {
    const { extractText: extractPdf } = await import("unpdf");
    const result = await extractPdf(bytes, { mergePages: true });
    const text = result.text;
    return (Array.isArray(text) ? text.join("\n") : text).slice(0, 200_000);
  }
  throw new Error("Use a PDF, Word, text, Markdown or CSV file.");
}

export function fileKind(filename: string, mime: string): "pdf" | "docx" | "text" | null {
  const name = filename.toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime.includes("wordprocessingml") || name.endsWith(".docx")) return "docx";
  if (
    mime.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv")
  ) {
    return "text";
  }
  return null;
}

export function safeFilename(name: string): string {
  return name.replace(/[^\w.\- ()]/g, "").slice(0, 120) || "document";
}
