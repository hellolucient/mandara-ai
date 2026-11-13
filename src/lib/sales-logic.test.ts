import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerSales } from "./sales-answers";
import { parseSalesQuestion } from "./sales-questions";
import { buildSampleDays } from "./sample-data";
import { parseCsv, validateExtract } from "./sales-validate";
import { chunkText } from "./chunk";

const days = buildSampleDays();
const names = days[0].lines.map((line) => line.locationName);
const today = "2026-11-13";

describe("sales questions", () => {
  it("answers yesterday from stored figures and excludes a missing location", () => {
    const intent = parseSalesQuestion("What were total spa sales yesterday?", names);
    assert.equal(intent?.kind, "total");
    const text = answerSales(intent!, days, today);
    assert.match(text, /\$11,000/);
    assert.match(text, /Baa Atoll Spa/);
    assert.match(text, /sample figures/);
    assert.doesNotMatch(text, /\$13,100/);
  });

  it("does not mark a location below budget when no budget is stored", () => {
    const text = answerSales({ kind: "below-budget" }, days, today);
    assert.match(text, /North Malé Spa/);
    assert.match(text, /South Ari Spa/);
    assert.match(text, /Malé House Spa/);
    assert.match(text, /No budget is stored/);
    assert.doesNotMatch(text, /Malé House Spa \$/);
  });

  it("flags the sharp week-on-week drop and the missing figure", () => {
    const text = answerSales({ kind: "attention" }, days, today);
    assert.match(text, /North Malé Spa/);
    assert.match(text, /-41\.5%/);
    assert.match(text, /no sales figure/);
  });

  it("refuses a week percentage when the month does not contain both full windows", () => {
    const text = answerSales({ kind: "week" }, days, today);
    assert.match(text, /not compared/);
  });

  it("leaves an insurance question to the documents, not the sales tables", () => {
    assert.equal(parseSalesQuestion("What does our operating agreement say about insurance?", names), null);
  });

  it("rejects an extract that has no usable sales", () => {
    const result = validateExtract({
      businessDate: "2026-11-12",
      currency: "USD",
      rows: [{ location: "Cinnamon Velifushi", netSales: null, treatments: 1, budget: 100 }],
    });
    assert.equal(result.ok, false);
  });

  it("drops a negative figure instead of storing it", () => {
    const result = validateExtract({
      businessDate: "2026-11-12",
      currency: "USD",
      rows: [
        { location: "Cinnamon Velifushi", netSales: 10, treatments: 1, budget: 9 },
        { location: "South Ari Spa", netSales: -5, treatments: 1, budget: 9 },
      ],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.extract.rows[1].netSales, null);
      assert.equal(result.extract.complete, false);
    }
  });

  it("reads one date from a csv and keeps a blank budget blank", () => {
    const result = parseCsv("business_date,location,net_sales,treatments,budget\n2026-11-10,Cinnamon Velifushi,100,4,\n");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.extract.rows[0].budget, null);
  });

  it("chunks long text without dropping the ending", () => {
    const chunks = chunkText(`${"Alpha ".repeat(200)}\n\n${"Omega ".repeat(40)}`);
    assert.ok(chunks.length > 1);
    assert.match(chunks.at(-1) ?? "", /Omega/);
  });
});
