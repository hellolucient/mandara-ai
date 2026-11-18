import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { MarkdownMessage } from "../components/markdown.tsx";

function html(text: string): string {
  return renderToStaticMarkup(createElement(MarkdownMessage, { text }));
}

describe("markdown renderer", () => {
  it("renders headings instead of leaving hash marks in the text", () => {
    const out = html("# The Surin Phuket\n\n## The Essentials");
    assert.match(out, /<h1[^>]*>The Surin Phuket<\/h1>/);
    assert.match(out, /<h2[^>]*>The Essentials<\/h2>/);
    assert.doesNotMatch(out, /# The Surin|# The Essentials|## The Essentials/);
  });

  it("renders bold and italic, including inside table cells", () => {
    const out = html(`| **Dates** | Details |
| --- | --- |
| *1–5 Dec* | **Arrive** in Phuket |`);
    assert.match(out, /<th[^>]*>[\s\S]*<strong[^>]*>Dates<\/strong>/);
    assert.match(out, /<td[^>]*>[\s\S]*<em[^>]*>1–5 Dec<\/em>/);
    assert.match(out, /<td[^>]*>[\s\S]*<strong[^>]*>Arrive<\/strong>/);
    assert.doesNotMatch(out, /\*\*Dates\*\*|\*1–5 Dec\*/);
  });

  it("renders unordered and ordered lists", () => {
    const out = html(`- Item **one**\n- Item two\n\n1. First\n2. Second`);
    assert.match(out, /<ul[^>]*>/);
    assert.match(out, /<ol[^>]*>/);
    assert.match(out, /<strong[^>]*>one<\/strong>/);
    assert.match(out, /<li[^>]*>[\s\S]*First/);
  });

  it("renders links and inline code", () => {
    const out = html("See [the site](https://example.com) and use `console.log()`.");
    assert.match(out, /<a[^>]*href="https:\/\/example.com\/?"[^>]*>the site<\/a>/);
    assert.match(out, /target="_blank"/);
    assert.match(out, /rel="noreferrer noopener"/);
    assert.match(out, /<code[^>]*>console\.log\(\)<\/code>/);
  });

  it("renders fenced code blocks", () => {
    const out = html("```typescript\nconst x = 42;\n```");
    assert.match(out, /<pre[^>]*>[\s\S]*<code[^>]*>[\s\S]*const x = 42;/);
  });

  it("does not render raw HTML", () => {
    const out = html('Hello <script>alert(1)</script> and <img src=x onerror="alert(1)">');
    assert.doesNotMatch(out, /<script/i);
    assert.doesNotMatch(out, /onerror/i);
    assert.doesNotMatch(out, /<img/i);
  });

  it("drops javascript and other unsafe URLs", () => {
    const out = html("Dangerous: [click](javascript:alert(1)) and [ok](https://example.com).");
    assert.doesNotMatch(out, /javascript:/i);
    assert.match(out, /<a[^>]*href="https:\/\/example.com\/?"/);
  });

  it("wraps tables so they can scroll horizontally", () => {
    const out = html(`| Metric | Amount |
| --- | --- |
| Revenue | $570 |`);
    assert.match(out, /overflow-x-auto/);
    assert.match(out, /<table/);
    assert.match(out, /Revenue/);
  });
});
