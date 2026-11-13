import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SCHEMA_MIGRATIONS, splitSql } from "./schema-source";
import { ensureSeed } from "./seed";
import { searchKnowledge } from "./knowledge";
import { loadDays } from "./sales-store";
import { answerSales } from "./sales-answers";
import { runSalesAgent } from "./agent";

describe("stored records", () => {
  it("keeps the published schema identical to the migration file", () => {
    const disk = readFileSync("migrations/001_init.sql", "utf8").trim();
    assert.equal(SCHEMA_MIGRATIONS[0]?.sql.trim(), disk);
    assert.ok(splitSql(disk).length >= 10);
  });

  it("seeds sample sales and keeps restricted documents away from staff", async () => {
    await ensureSeed("test");
    const days = await loadDays("test");
    const yesterday = days.find((day) => day.businessDate === "2026-11-12");
    assert.ok(yesterday);
    assert.match(answerSales({ kind: "total" }, days, "2026-11-13"), /\$11,000/);
    const staff = await searchKnowledge("test", "What does the insurance note say about certificates?", "staff");
    assert.equal(staff.hits.length, 0);
    assert.equal(staff.restrictedHidden, true);
    const admin = await searchKnowledge("test", "What does the insurance note say about certificates?", "admin");
    assert.ok(admin.hits.some((hit) => /14 days/.test(hit.excerpt)));
    const room = await searchKnowledge("test", "treatment room opening linen", "staff");
    assert.ok(room.hits.some((hit) => hit.title.includes("treatment room")));
  });

  it("records a report run without claiming it read DSR", async () => {
    const previous = {
      DSR_BASE_URL: process.env.DSR_BASE_URL,
      DSR_USERNAME: process.env.DSR_USERNAME,
      DSR_PASSWORD: process.env.DSR_PASSWORD,
    };
    delete process.env.DSR_BASE_URL;
    delete process.env.DSR_USERNAME;
    delete process.env.DSR_PASSWORD;
    try {
      await ensureSeed("test");
      const run = await runSalesAgent({ stage: "test", trigger: "manual", actor: "test", today: "2026-11-13" });
      assert.equal(run.status, "attention");
      assert.match(run.report, /12 Nov 2026/);
      assert.match(run.log, /not available to this server/);
      assert.match(run.report, /sample figures/);
    } finally {
      restoreEnv(previous);
    }
  });

  it("stores a Maldives daily DSR and drops the sample days", async () => {
    const previous = {
      DSR_BASE_URL: process.env.DSR_BASE_URL,
      DSR_USERNAME: process.env.DSR_USERNAME,
      DSR_PASSWORD: process.env.DSR_PASSWORD,
    };
    process.env.DSR_BASE_URL = "https://dsr.example.test/";
    process.env.DSR_USERNAME = "spa-user";
    process.env.DSR_PASSWORD = "sandbox-password";
    try {
      await ensureSeed("dsr-live");
      const run = await runSalesAgent({
        stage: "dsr-live",
        trigger: "manual",
        actor: "test",
        today: "2026-11-13",
        fetchImpl: mockDailyFetch(),
      });
      assert.equal(run.status, "completed");
      assert.match(run.report, /Cinnamon Velifushi/);
      assert.match(run.report, /Chavanaspa Dhonveli/);
      assert.match(run.report, /Maldives daily DSR/);
      assert.equal(run.report.includes("sample figures"), false);
      assert.equal(run.report.includes("sandbox-password"), false);
      const days = await loadDays("dsr-live");
      assert.deepEqual(days.map((day) => day.businessDate), ["2026-11-12"]);
      assert.equal(days[0]?.source, "dsr");
    } finally {
      restoreEnv(previous);
    }
  });
});

function restoreEnv(previous: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function mockDailyFetch() {
  const login = `<html><head><title>Mandaraspa System</title></head><body><form>
    <input name="userid" type="text"><input name="pin" type="password">
    <input name="php_session" type="hidden" value="sess-value"></form></body></html>`;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET") return new Response(login, { status: 200, headers: { "content-type": "text/html" } });
    if (url.pathname.endsWith("s_login_post.php")) {
      return new Response("TASKSTATUS|ACK\nG_USERNAME|Test User\nG_USERID|spa-user\nSESSIONID|secret-session\n", { status: 200 });
    }
    if (url.pathname.endsWith("r_statdsr_e.php")) return new Response(dailyHtml(), { status: 200 });
    return new Response("missing", { status: 404 });
  };
}

function dailyHtml(): string {
  const revenue = (actual: string, forecast: string) => {
    const cells = Array.from({ length: 25 }, () => "0.00");
    cells[18] = actual;
    cells[19] = forecast;
    return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
  };
  const guests = (count: string) => {
    const cells = Array.from({ length: 19 }, () => "0");
    cells[2] = count;
    return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
  };
  return `<a href="javascript:statdsr_spaid('MDV16', 'rev')">MDV16, Cinnamon Velifushi</a>
    <a href="javascript:statdsr_spaid('MDV05', 'rev')">MDV05, Chavanaspa Dhonveli</a>
    ${revenue("1,242.23", "1,338.87")}
    ${revenue("2,204.76", "1,065.50")}
    ${revenue("9,000.00", "8,000.00")}
    <td class="left-menu">Statistical</td>
    ${guests("11")}
    ${guests("19")}
    <td>Total Check (USD)</td>`;
}
