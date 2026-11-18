/**
 * Pure helpers for the chat-only view (ChatGPT-style screen for chat-only people).
 * Times are read in the Maldives, where the spas are, so the server and the browser agree.
 */
export const VIEW_TIME_ZONE = "Indian/Maldives";

export type HistoryItem = { id: string; title: string; updated_at?: string; mode?: string };
export type HistoryGroup = { label: "Today" | "Previous 7 days" | "Older"; items: HistoryItem[] };

/** yyyy-mm-dd of an instant in the given zone. */
export function zonedDate(instant: Date, timeZone = VIEW_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

/** Postgres text timestamps ("2026-11-18 04:12:00.12+00") and ISO strings both parse. */
export function parseTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  let text = value.trim().replace(" ", "T");
  if (/[+-]\d\d$/.test(text)) text += ":00";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Today / Previous 7 days / Older, newest first inside each group, empty groups left out. */
export function groupConversations(items: HistoryItem[], now: Date, timeZone = VIEW_TIME_ZONE): HistoryGroup[] {
  const today = dayNumber(zonedDate(now, timeZone));
  const groups: HistoryGroup[] = [
    { label: "Today", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const item of items) {
    const at = parseTimestamp(item.updated_at);
    const age = at ? today - dayNumber(zonedDate(at, timeZone)) : Number.POSITIVE_INFINITY;
    if (age <= 0) groups[0].items.push(item);
    else if (age <= 7) groups[1].items.push(item);
    else groups[2].items.push(item);
  }
  return groups.filter((group) => group.items.length > 0);
}

/** "Good morning, Tenille" from a display name such as "Tenille Smith" or "Tenille (test)". */
export function greeting(name: string, now: Date, timeZone = VIEW_TIME_ZONE): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now),
  );
  const part = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = firstName(name);
  return first ? `${part}, ${first}` : part;
}

export function firstName(name: string): string {
  const word = String(name ?? "")
    .replace(/\([^)]*\)/g, " ")
    .trim()
    .split(/\s+/)[0];
  if (!word || /@/.test(word)) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Up to two initials for the account avatar. */
export function initials(name: string): string {
  const words = String(name ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/@.*/, "")
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) return "M";
  const letters = words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[words.length - 1][0]}`;
  return letters.toUpperCase();
}

export type Suggestion = { id: string; title: string; hint: string; prompt: string };
export type ChatTab = "mandara" | "general";

export function chatTab(value: unknown): ChatTab {
  return value === "mandara" ? "mandara" : "general";
}

export function chatDisclaimer(tab: ChatTab): string {
  return tab === "general"
    ? "Mandara AI can make mistakes."
    : "Mandara AI can make mistakes. Check important figures against the DSR.";
}

/**
 * Starter cards on the empty chat screen, per tab. Every one sends straight away, so the Mandara cards are
 * worded to land on stored figures and the General cards are everyday tasks.
 */
export function chatSuggestions(tab: ChatTab = "mandara"): Suggestion[] {
  if (tab === "general") {
    return [
      { id: "guest", title: "Guest message", hint: "Warm, Maldives-ready", prompt: "Write a short, warm welcome message for a guest arriving at the spa tomorrow." },
      { id: "translate", title: "Translate", hint: "A guest note into French", prompt: "Translate into French: Your treatment starts at 4pm. Please arrive 10 minutes early and enjoy a welcome tea." },
      { id: "ideas", title: "Spa ideas", hint: "Seasonal promotions", prompt: "Suggest three seasonal spa promotions for December." },
      { id: "weather", title: "Weather in Malé", hint: "The week ahead", prompt: "What's the weather forecast for Malé this week?" },
    ];
  }
  return [
    { id: "sales", title: "Yesterday's sales", hint: "Treatment, retail and vs budget", prompt: "What were total spa sales yesterday?" },
    { id: "compare", title: "Compare the spas", hint: "Who is leading this month", prompt: "Which spas have the highest sales this month?" },
    { id: "hakuraa", title: "Hakuraa yesterday", hint: "One spa, one day", prompt: "How did Hakuraa do yesterday?" },
    { id: "budget", title: "Below budget", hint: "Spas that need attention", prompt: "Which spas were below budget yesterday?" },
  ];
}

/**
 * Stored sales answers are plain lines. Turn them into Markdown so line breaks survive and the short
 * section labels ("By location", "Needs attention") read as headings.
 */
export function salesAnswerMarkdown(text: string): string {
  const lines = String(text ?? "").split("\n").map((line) => line.trim());
  const out: string[] = [];
  const row = /^([A-Za-z][^:|]{1,40}):\s+((?:[A-Z]{3}\s?)?\$?-?[\d,]+(?:\.\d+)?.*)$/;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      out.push("");
      continue;
    }
    // Four or more "Spa: $figure" lines in a row read best as a table.
    let end = index;
    while (end < lines.length && row.test(lines[end])) end += 1;
    if (end - index >= 4) {
      const cells = lines.slice(index, end).map((item) => {
        const [, name, value] = item.match(row) ?? [];
        return [name, ...salesCells(value)].map((cell) => cell.replace(/\|/g, "/"));
      });
      const third = cells.some((cell) => cell[2]);
      const extra = cells.every((cell) => !cell[2] || /^[+−-]|^—$/.test(cell[2])) ? "vs budget" : "Note";
      out.push("", third ? `| Spa | Sales | ${extra} |` : "| Spa | Sales |", third ? "| --- | ---: | ---: |" : "| --- | ---: |");
      for (const cell of cells) out.push(third ? `| ${cell[0]} | ${cell[1]} | ${cell[2] || "—"} |` : `| ${cell[0]} | ${cell[1]} |`);
      out.push("");
      index = end - 1;
      continue;
    }
    const label = index > 0 && line.length <= 30 && !/[.:!?),]$/.test(line) && !/[\d:$]/.test(line);
    if (label) {
      out.push("", `**${line}**`, "");
      continue;
    }
    out.push(`${line}  `);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** "$1,375. $37 above the stored budget of $1,339." becomes ["$1,375", "+$37"]. */
function salesCells(value: string): [string, string] {
  const money = value.match(/^((?:[A-Z]{3}\s?)?\$?-?[\d,]+(?:\.\d+)?)[.,]?\s*(.*)$/);
  if (!money) return [value, ""];
  const rest = money[2].trim();
  const budget = rest.match(/^((?:[A-Z]{3}\s?)?\$?[\d,]+(?:\.\d+)?) (above|below) the stored budget/i);
  if (budget) return [money[1], `${budget[2].toLowerCase() === "above" ? "+" : "−"}${budget[1]}`];
  if (/^no budget/i.test(rest)) return [money[1], "—"];
  return [money[1], rest.replace(/\.$/, "")];
}

/** Pull the trailing "Source: …" line off a stored sales answer so the view can show it as a quiet footnote. */
export function splitSalesSource(text: string): { body: string; source: string } {
  const lines = String(text ?? "").split("\n");
  const index = lines.findIndex((line) => /^Source:/.test(line.trim()));
  if (index < 0) return { body: text, source: "" };
  const source = lines[index].trim();
  lines.splice(index, 1);
  return { body: lines.join("\n").trim(), source };
}
