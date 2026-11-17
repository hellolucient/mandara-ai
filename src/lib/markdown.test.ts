import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMarkdown } from "./markdown.js";

describe("markdown parser", () => {
  it("parses paragraphs with inline formatting", () => {
    const blocks = parseMarkdown("This is **bold** and this is a [link](https://example.com).");
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, "paragraph");
    if (blocks[0].kind === "paragraph") {
      assert.equal(blocks[0].pieces.length, 5);
      assert.equal(blocks[0].pieces[0].kind, "text");
      assert.equal(blocks[0].pieces[1].kind, "strong");
      assert.equal(blocks[0].pieces[3].kind, "link");
    }
  });

  it("parses markdown tables", () => {
    const markdown = `| Metric | Amount |
| --- | --- |
| Revenue | $570 |
| Cost | $230 |`;
    
    const blocks = parseMarkdown(markdown);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, "table");
    if (blocks[0].kind === "table") {
      assert.deepEqual(blocks[0].headers, ["Metric", "Amount"]);
      assert.equal(blocks[0].rows.length, 2);
      assert.deepEqual(blocks[0].rows[0], ["Revenue", "$570"]);
      assert.deepEqual(blocks[0].rows[1], ["Cost", "$230"]);
    }
  });

  it("parses unordered lists", () => {
    const markdown = `- Item one
- Item **two**
- Item three`;
    
    const blocks = parseMarkdown(markdown);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, "list");
    if (blocks[0].kind === "list") {
      assert.equal(blocks[0].ordered, false);
      assert.equal(blocks[0].items.length, 3);
      // Check that bold formatting is parsed in list items
      assert.equal(blocks[0].items[1][1].kind, "strong");
    }
  });

  it("parses ordered lists", () => {
    const markdown = `1. First item
2. Second item
3. Third item`;
    
    const blocks = parseMarkdown(markdown);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, "list");
    if (blocks[0].kind === "list") {
      assert.equal(blocks[0].ordered, true);
      assert.equal(blocks[0].items.length, 3);
    }
  });

  it("parses code blocks", () => {
    const markdown = "```typescript\nconst x = 42;\n```";
    
    const blocks = parseMarkdown(markdown);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, "code");
    if (blocks[0].kind === "code") {
      assert.equal(blocks[0].language, "typescript");
      assert.equal(blocks[0].code, "const x = 42;");
    }
  });

  it("parses inline code", () => {
    const markdown = "Use the `console.log()` function to debug.";
    
    const blocks = parseMarkdown(markdown);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, "paragraph");
    if (blocks[0].kind === "paragraph") {
      assert.equal(blocks[0].pieces[1].kind, "code");
      if (blocks[0].pieces[1].kind === "code") {
        assert.equal(blocks[0].pieces[1].text, "console.log()");
      }
    }
  });

  it("parses multiple blocks", () => {
    const markdown = `This is a paragraph.

| Header | Value |
| --- | --- |
| A | 1 |

- List item
- Another item`;
    
    const blocks = parseMarkdown(markdown);
    assert.equal(blocks.length, 3);
    assert.equal(blocks[0].kind, "paragraph");
    assert.equal(blocks[1].kind, "table");
    assert.equal(blocks[2].kind, "list");
  });

  it("handles bare URLs", () => {
    const markdown = "Check out https://example.com for more info.";
    
    const blocks = parseMarkdown(markdown);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, "paragraph");
    if (blocks[0].kind === "paragraph") {
      assert.equal(blocks[0].pieces[1].kind, "link");
      if (blocks[0].pieces[1].kind === "link") {
        assert.equal(blocks[0].pieces[1].href, "https://example.com/");
      }
    }
  });

  it("sanitizes non-http URLs", () => {
    const markdown = "Dangerous link: [click](javascript:alert(1))";
    
    const blocks = parseMarkdown(markdown);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, "paragraph");
    if (blocks[0].kind === "paragraph") {
      // Should be treated as text, not a link (entire pattern becomes one text piece)
      const textContent = blocks[0].pieces.map(p => p.kind === "text" ? p.text : "").join("");
      assert.ok(textContent.includes("[click](javascript:alert(1))"));
    }
  });
});
