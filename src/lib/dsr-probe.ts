export type DsrTableSummary = {
  headers: string[];
  rows: number;
};

export type DsrLoginForm = {
  action: string;
  usernameField: string;
  passwordField: string;
};

export type DsrHtmlSummary = {
  title: string;
  passwordFieldPresent: boolean;
  loginFields: string[];
  tables: DsrTableSummary[];
  form: DsrLoginForm | null;
};

export type DsrProbeResult = {
  reachable: boolean;
  signedIn: boolean;
  title: string;
  host: string;
  loginFields: string[];
  passwordFieldPresent: boolean;
  tables: DsrTableSummary[];
  note: string;
};

export type DsrFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const BODY_CAP = 512 * 1024;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;

const UNAVAILABLE = "DSR sign-in is not available to this server.";

export function summarizeDsrHtml(html: string): DsrHtmlSummary {
  const source = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const form = readLoginForm(source);
  return {
    title: clip(pageTitle(source), 180),
    passwordFieldPresent: hasPasswordField(source),
    loginFields: form?.loginFields ?? [],
    tables: readTables(source),
    form: form ? { action: form.action, usernameField: form.usernameField, passwordField: form.passwordField } : null,
  };
}

export async function probeDsr(fetchImpl: DsrFetch = fetch): Promise<DsrProbeResult> {
  const baseUrl = process.env.DSR_BASE_URL?.trim() ?? "";
  const username = process.env.DSR_USERNAME?.trim() ?? "";
  const password = process.env.DSR_PASSWORD?.trim() ?? "";
  if (!baseUrl || !username || !password) return blank(false, "", UNAVAILABLE);

  let origin: URL;
  try {
    origin = new URL(baseUrl);
  } catch {
    return blank(false, "", UNAVAILABLE);
  }
  if (origin.protocol !== "http:" && origin.protocol !== "https:") return blank(false, "", UNAVAILABLE);
  origin.username = "";
  origin.password = "";
  origin.hash = "";
  const host = origin.host;

  try {
    const first = await fetchPage(fetchImpl, origin, origin, new Map(), "GET");
    if (first.kind === "unreachable") return blank(false, host, "The DSR server did not respond.");
    if (first.kind === "off-host") return blank(true, host, "A redirect left the DSR host, so the check stopped.");
    if (first.kind === "stopped") return blank(true, host, first.note);

    const login = summarizeDsrHtml(first.body);
    const partial = {
      reachable: true,
      title: login.title,
      host,
      loginFields: login.loginFields,
      passwordFieldPresent: login.passwordFieldPresent,
      tables: login.tables,
    };
    if (!login.passwordFieldPresent || !login.form) {
      return scrub(finish(partial, false, "The server did not receive a sign-in form."), password);
    }
    if (!login.form.usernameField || !login.form.passwordField) {
      return scrub(
        finish(partial, false, "The sign-in form could not be submitted, so the password was not sent."),
        password,
      );
    }

    let action: URL;
    try {
      action = new URL(login.form.action || first.url, first.url);
    } catch {
      return scrub(finish(partial, false, "The sign-in form could not be submitted, so the password was not sent."), password);
    }
    if (!sameSite(origin, action)) {
      return scrub(finish(partial, false, "The sign-in form points at another host, so the password was not sent."), password);
    }
    action.username = "";
    action.password = "";
    action.hash = "";

    const body = new URLSearchParams();
    body.set(login.form.usernameField, username);
    body.set(login.form.passwordField, password);
    const posted = await fetchPage(fetchImpl, action, origin, first.cookies, "POST", body.toString());
    if (posted.kind === "unreachable") {
      return scrub(finish(partial, false, "The DSR server did not respond."), password);
    }
    if (posted.kind === "off-host") {
      return scrub(finish(partial, false, "A redirect left the DSR host, so the check stopped."), password);
    }
    if (posted.kind === "stopped") return scrub(finish(partial, false, posted.note), password);

    const landed = summarizeDsrHtml(posted.body);
    const signedIn = accepted(posted.status, landed.passwordFieldPresent);
    return scrub(
      finish(
        {
          reachable: true,
          title: landed.title,
          host,
          loginFields: login.loginFields,
          passwordFieldPresent: landed.passwordFieldPresent,
          tables: landed.tables,
        },
        signedIn,
        noteFor(signedIn, posted.status, landed),
      ),
      password,
    );
  } catch {
    return blank(false, host, "The DSR sign-in check failed.");
  }
}

function blank(reachable: boolean, host: string, note: string): DsrProbeResult {
  return {
    reachable,
    signedIn: false,
    title: "",
    host,
    loginFields: [],
    passwordFieldPresent: false,
    tables: [],
    note,
  };
}

function finish(
  partial: Omit<DsrProbeResult, "signedIn" | "note">,
  signedIn: boolean,
  note: string,
): DsrProbeResult {
  return { ...partial, signedIn, note: clip(note, 500) };
}

function accepted(status: number, passwordFieldPresent: boolean): boolean {
  if (status === 401 || status === 403) return false;
  if (passwordFieldPresent) return false;
  return status >= 200 && status < 300;
}

function noteFor(signedIn: boolean, status: number, summary: DsrHtmlSummary): string {
  if (status === 401 || status === 403) return "The DSR server refused the sign-in. No figures were stored.";
  if (summary.passwordFieldPresent) return "The sign-in form is still on the page. No figures were stored.";
  if (!signedIn) return "The DSR server did not confirm the sign-in. No figures were stored.";
  if (summary.tables.length === 0) return "Signed in. The page has no table. No figures were stored.";
  const described = summary.tables.map((table) => {
    const headers = table.headers.length ? table.headers.join(", ") : "no headers";
    const rows = table.rows === 1 ? "1 row" : `${table.rows} rows`;
    return `${headers} (${rows})`;
  });
  const lead = summary.tables.length === 1 ? "One table lists" : `${summary.tables.length} tables list`;
  return `Signed in. ${lead} ${described.join("; ")}. No figures were stored.`;
}

function scrub(result: DsrProbeResult, password: string): DsrProbeResult {
  const clean = (value: string) => value.split(password).join("");
  return {
    ...result,
    title: clip(clean(result.title), 180),
    loginFields: result.loginFields.map((field) => clean(field)).filter((field) => field !== ""),
    tables: result.tables.map((table) => ({
      headers: table.headers.map((header) => clean(header).trim()).filter((header) => header !== ""),
      rows: table.rows,
    })),
    note: clip(clean(result.note), 500),
    host: result.host,
  };
}

type CookieJar = Map<string, string>;

type FetchStop =
  | { kind: "page"; url: string; status: number; body: string; cookies: CookieJar }
  | { kind: "off-host" }
  | { kind: "unreachable" }
  | { kind: "stopped"; note: string };

async function fetchPage(
  fetchImpl: DsrFetch,
  start: URL,
  origin: URL,
  jar: CookieJar,
  method: "GET" | "POST",
  body?: string,
): Promise<FetchStop> {
  let current = new URL(start.toString());
  let verb = method;
  let payload = body;
  let followed = 0;
  while (true) {
    if (!sameSite(origin, current)) return { kind: "off-host" };
    current.username = "";
    current.password = "";
    current.hash = "";
    let response: Response;
    try {
      const headers = new Headers();
      headers.set("accept", "text/html");
      const cookie = cookieHeader(jar);
      if (cookie) headers.set("cookie", cookie);
      if (payload !== undefined) headers.set("content-type", "application/x-www-form-urlencoded");
      response = await fetchImpl(current.toString(), {
        method: verb,
        headers,
        body: payload,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return { kind: "unreachable" };
    }
    rememberCookies(response.headers, jar);
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => undefined);
      const location = response.headers.get("location");
      if (!location) return { kind: "stopped", note: "The DSR server returned a redirect without a destination." };
      if (followed >= MAX_REDIRECTS) return { kind: "stopped", note: "The DSR server redirected too many times." };
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { kind: "stopped", note: "The DSR server returned a redirect that could not be read." };
      }
      if (!sameSite(origin, next)) return { kind: "off-host" };
      followed += 1;
      current = next;
      verb = "GET";
      payload = undefined;
      continue;
    }
    return { kind: "page", url: current.toString(), status: response.status, body: await readCapped(response), cookies: jar };
  }
}

function sameSite(origin: URL, target: URL): boolean {
  if (target.protocol !== "http:" && target.protocol !== "https:") return false;
  if (target.host.toLowerCase() !== origin.host.toLowerCase()) return false;
  if (origin.protocol === "https:" && target.protocol !== "https:") return false;
  return true;
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function rememberCookies(headers: Headers, jar: CookieJar) {
  const lines = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const cookies = lines.length > 0 ? lines : splitSetCookie(headers.get("set-cookie"));
  for (const cookie of cookies) {
    const pair = cookie.split(";")[0]?.trim() ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    if (!name) continue;
    jar.set(name, pair.slice(eq + 1).trim());
  }
}

function splitSetCookie(value: string | null): string[] {
  if (!value) return [];
  return [value];
}

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, BODY_CAP);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < BODY_CAP) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;
    const room = BODY_CAP - size;
    const slice = value.byteLength > room ? value.slice(0, room) : value;
    chunks.push(slice);
    size += slice.byteLength;
    if (value.byteLength > room) break;
  }
  await reader.cancel().catch(() => undefined);
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

function hasPasswordField(html: string): boolean {
  return inputTags(html).some((input) => inputType(input) === "password");
}

function readLoginForm(html: string): (DsrLoginForm & { loginFields: string[] }) | null {
  const forms = html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi);
  for (const form of forms) {
    const inputs = inputTags(form[2]);
    if (!inputs.some((input) => inputType(input) === "password")) continue;
    const loginFields: string[] = [];
    let usernameField = "";
    let passwordField = "";
    for (const input of inputs) {
      const type = inputType(input);
      const name = input.get("name")?.trim() ?? "";
      const credential = type === "text" || type === "email" || type === "username" || type === "password";
      if (!credential) continue;
      if (name) loginFields.push(name);
      if (type === "password") {
        if (!passwordField && name) passwordField = name;
        continue;
      }
      if (!usernameField && name) usernameField = name;
    }
    return {
      action: formAttrs(form[1]).get("action")?.trim() ?? "",
      usernameField,
      passwordField,
      loginFields,
    };
  }
  return null;
}

function readTables(html: string): DsrTableSummary[] {
  const tables: DsrTableSummary[] = [];
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const headers: string[] = [];
    let rows = 0;
    let headerTaken = false;
    for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = row[1];
      const labels = [...cells.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((cell) => visibleText(cell[1]));
      const hasValueCell = /<td\b/i.test(cells);
      if (!headerTaken && labels.length > 0 && !hasValueCell) {
        headers.push(...labels.filter((label) => label !== ""));
        headerTaken = true;
      }
      if (hasValueCell) rows += 1;
    }
    tables.push({ headers, rows });
  }
  return tables;
}

function inputTags(html: string): Array<Map<string, string>> {
  return [...html.matchAll(/<input\b([^>]*)>/gi)].map((match) => formAttrs(match[1]));
}

function inputType(attrs: Map<string, string>): string {
  return (attrs.get("type") || "text").trim().toLowerCase();
}

function formAttrs(raw: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const pattern = /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of raw.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (attrs.has(name)) continue;
    attrs.set(name, decode(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return attrs;
}

function pageTitle(html: string): string {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? visibleText(match[1]) : "";
}

function visibleText(value: string): string {
  return decode(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function decode(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => character(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => character(Number.parseInt(hex, 16)));
}

function character(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
}
