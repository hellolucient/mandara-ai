export type AnswerPiece =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; text: string; href: string };

const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>)\]]+)|(\*\*([^*]+)\*\*)/g;

export function answerPieces(input: string): AnswerPiece[] {
  const pieces: AnswerPiece[] = [];
  let last = 0;
  for (const match of input.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) pieces.push({ kind: "text", text: input.slice(last, start) });
    const markdownLabel = match[1];
    const markdownUrl = match[2];
    const bareUrl = match[3];
    const strong = match[5];
    if (strong) {
      pieces.push({ kind: "strong", text: strong });
    } else {
      const href = safeHttpUrl(markdownUrl || bareUrl || "");
      if (href) pieces.push({ kind: "link", text: shortLabel(markdownLabel, href), href });
      else pieces.push({ kind: "text", text: match[0] });
    }
    last = start + match[0].length;
  }
  if (last < input.length) pieces.push({ kind: "text", text: input.slice(last) });
  return pieces;
}

export function safeHttpUrl(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.replace(/[),.;]+$/g, "");
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function shortLabel(label: string | undefined, href: string): string {
  const host = hostname(href);
  const clean = label?.trim() ?? "";
  if (!clean || /^https?:\/\//i.test(clean) || clean.length > 48) return host;
  return clean;
}

function hostname(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}
