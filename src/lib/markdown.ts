export type MarkdownBlock =
  | { kind: "paragraph"; pieces: MarkdownPiece[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "list"; ordered: boolean; items: MarkdownPiece[][] }
  | { kind: "code"; language: string; code: string };

export type MarkdownPiece =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "code"; text: string };

/**
 * Parse GitHub-flavored markdown into structured blocks.
 * Handles: paragraphs, tables, lists, bold, links, inline code.
 * Safe: no raw HTML, all text is escaped by React.
 */
export function parseMarkdown(input: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = input.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Code block (```lang\ncode\n```)
    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // Skip closing ```
      blocks.push({ kind: "code", language, code: codeLines.join("\n") });
      continue;
    }

    // Table (| header | header |)
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = [line];
      i++;
      // Collect all consecutive table lines
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      
      if (tableLines.length >= 2) {
        const headers = parseTableRow(tableLines[0]);
        // Skip separator line (| --- | --- |)
        const dataStart = tableLines[1].includes("---") || tableLines[1].includes(":--") ? 2 : 1;
        const rows = tableLines.slice(dataStart).map(parseTableRow);
        blocks.push({ kind: "table", headers, rows });
        continue;
      }
    }

    // Unordered list (- item or * item)
    if (/^[\s]*[-*]\s/.test(line)) {
      const items: MarkdownPiece[][] = [];
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^[\s]*[-*]\s/, "");
        items.push(parseInline(itemText));
        i++;
      }
      blocks.push({ kind: "list", ordered: false, items });
      continue;
    }

    // Ordered list (1. item)
    if (/^[\s]*\d+\.\s/.test(line)) {
      const items: MarkdownPiece[][] = [];
      while (i < lines.length && /^[\s]*\d+\.\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^[\s]*\d+\.\s/, "");
        items.push(parseInline(itemText));
        i++;
      }
      blocks.push({ kind: "list", ordered: true, items });
      continue;
    }

    // Paragraph - collect consecutive non-empty lines
    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("|") && !lines[i].trim().startsWith("```") && !/^[\s]*[-*]\s/.test(lines[i]) && !/^[\s]*\d+\.\s/.test(lines[i])) {
      paragraphLines.push(lines[i]);
      i++;
    }
    
    if (paragraphLines.length > 0) {
      blocks.push({ kind: "paragraph", pieces: parseInline(paragraphLines.join("\n")) });
    }
  }

  return blocks;
}

function parseTableRow(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1) // Remove leading and trailing empty strings from split
    .map((cell) => cell.trim());
}

/**
 * Parse inline markdown: **bold**, [links](url), `code`, bare URLs
 */
function parseInline(input: string): MarkdownPiece[] {
  const pieces: MarkdownPiece[] = [];
  const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>)\]]+)|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
  let last = 0;

  for (const match of input.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) pieces.push({ kind: "text", text: input.slice(last, start) });

    const markdownLabel = match[1];
    const markdownUrl = match[2];
    const bareUrl = match[3];
    const strong = match[5];
    const inlineCode = match[7];

    if (inlineCode) {
      pieces.push({ kind: "code", text: inlineCode });
    } else if (strong) {
      pieces.push({ kind: "strong", text: strong });
    } else {
      const href = safeHttpUrl(markdownUrl || bareUrl || "");
      if (href) {
        pieces.push({ kind: "link", text: shortLabel(markdownLabel, href), href });
      } else {
        pieces.push({ kind: "text", text: match[0] });
      }
    }

    last = start + match[0].length;
  }

  if (last < input.length) pieces.push({ kind: "text", text: input.slice(last) });
  return pieces;
}

function safeHttpUrl(value: string | undefined): string {
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
