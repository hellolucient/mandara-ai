import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDailyDsr } from "./dsr-daily";

describe("daily DSR parser", () => {
  it("reads total revenue, the day's forecast, and treatment guests", () => {
    const parsed = parseDailyDsr(dailyHtml(), "2026-11-12");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.extract.currency, "USD");
    assert.deepEqual(
      parsed.extract.rows.map((row) => [row.location, row.netSales, row.budget, row.treatments]),
      [
        ["Cinnamon Velifushi", 1242.23, 1338.87, 11],
        ["Chavanaspa Dhonveli", 2204.76, 1065.5, 19],
      ],
    );
  });

  it("refuses a page that does not line up", () => {
    const parsed = parseDailyDsr(`<a href="javascript:statdsr_spaid('MDV16', 'rev')">MDV16, One</a> (USD)`, "2026-11-12");
    assert.equal(parsed.ok, false);
  });
});

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
