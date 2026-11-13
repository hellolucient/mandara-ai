import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { probeDsr, summarizeDsrHtml, type DsrFetch } from "./dsr-probe";

const source = readFileSync(path.join(process.cwd(), "fixtures/dsr-sandbox/server.mjs"), "utf8");
const password = "sandbox-password";
const username = "spa-user";

function fixture(name: "login" | "report"): string {
  const match = source.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  assert.ok(match, `${name} fixture`);
  return match[1];
}

function htmlResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { "content-type": "text/html", ...headers } });
}

async function withDsr<T>(fn: () => Promise<T>): Promise<T> {
  const previous = {
    DSR_BASE_URL: process.env.DSR_BASE_URL,
    DSR_USERNAME: process.env.DSR_USERNAME,
    DSR_PASSWORD: process.env.DSR_PASSWORD,
  };
  process.env.DSR_BASE_URL = "https://dsr.example.test/";
  process.env.DSR_USERNAME = username;
  process.env.DSR_PASSWORD = password;
  try {
    return await fn();
  } finally {
    restore("DSR_BASE_URL", previous.DSR_BASE_URL);
    restore("DSR_USERNAME", previous.DSR_USERNAME);
    restore("DSR_PASSWORD", previous.DSR_PASSWORD);
  }
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("dsr probe", () => {
  it("finds the login form fields", () => {
    const summary = summarizeDsrHtml(fixture("login"));
    assert.deepEqual(summary.loginFields, ["username", "password"]);
    assert.equal(summary.passwordFieldPresent, true);
    assert.equal(summary.form?.action, "/login");
    assert.equal(summary.form?.usernameField, "username");
    assert.equal(summary.form?.passwordField, "password");
  });

  it("follows a cookie redirect and counts the report table without its figures", async () => {
    const login = fixture("login");
    const report = fixture("report");
    const calls: Array<{ pathname: string; method: string; body: string; cookie: string }> = [];
    const fetchImpl: DsrFetch = async (input, init) => {
      const url = new URL(String(input));
      const method = (init?.method ?? "GET").toUpperCase();
      const body = typeof init?.body === "string" ? init.body : "";
      const cookie = new Headers(init?.headers).get("cookie") ?? "";
      calls.push({ pathname: url.pathname, method, body, cookie });
      if (method === "GET" && url.pathname === "/") return htmlResponse(login);
      if (method === "POST" && url.pathname === "/login") {
        const params = new URLSearchParams(body);
        assert.equal(params.get("username"), username);
        assert.equal(params.get("password"), password);
        assert.equal(new Headers(init?.headers).get("content-type"), "application/x-www-form-urlencoded");
        return new Response(null, {
          status: 302,
          headers: { location: "/report", "set-cookie": "dsr=1; HttpOnly; Path=/" },
        });
      }
      if (method === "GET" && url.pathname === "/report") {
        assert.equal(cookie, "dsr=1");
        assert.equal(body, "");
        return htmlResponse(report);
      }
      return htmlResponse("missing", 404);
    };

    const result = await withDsr(() => probeDsr(fetchImpl));
    assert.deepEqual(
      calls.map((call) => call.method + " " + call.pathname),
      ["GET /", "POST /login", "GET /report"],
    );
    assert.equal(result.reachable, true);
    assert.equal(result.signedIn, true);
    assert.equal(result.passwordFieldPresent, false);
    assert.equal(result.host, "dsr.example.test");
    assert.equal(result.title, "DSR sandbox report");
    assert.deepEqual(result.loginFields, ["username", "password"]);
    assert.deepEqual(result.tables, [{ headers: ["Location", "Net", "Treatments", "Budget"], rows: 3 }]);
    assert.match(result.note, /No figures were stored/);
    const packed = JSON.stringify(result);
    for (const secret of [password, "dsr=1", "5100", "Cinnamon", "4500", "2026-11-12"]) {
      assert.equal(packed.includes(secret), false);
    }
  });

  it("does not treat a 401 page as signed in", async () => {
    const login = fixture("login");
    const fetchImpl: DsrFetch = async (input, init) => {
      const url = new URL(String(input));
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "POST" && url.pathname === "/login") {
        return htmlResponse("<p id='login-failed'>Sign-in failed.</p>", 401);
      }
      return htmlResponse(login);
    };
    const result = await withDsr(() => probeDsr(fetchImpl));
    assert.equal(result.signedIn, false);
    assert.equal(result.passwordFieldPresent, false);
    assert.match(result.note, /refused the sign-in/);
    assert.equal(JSON.stringify(result).includes(password), false);
  });

  it("does not send the password to an off-host form action", async () => {
    const login = fixture("login").replace('action="/login"', 'action="https://evil.example/steal"');
    assert.notEqual(login, fixture("login"));
    const calls: Array<{ url: string; method: string; body: string }> = [];
    const fetchImpl: DsrFetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: (init?.method ?? "GET").toUpperCase(),
        body: typeof init?.body === "string" ? init.body : "",
      });
      return htmlResponse(login);
    };
    const result = await withDsr(() => probeDsr(fetchImpl));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls.some((call) => call.url.includes("evil.example")), false);
    assert.equal(calls.some((call) => call.body.includes(password)), false);
    assert.equal(result.signedIn, false);
    assert.match(result.note, /password was not sent/);
    assert.equal(JSON.stringify(result).includes(password), false);
  });
});
