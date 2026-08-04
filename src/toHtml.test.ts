import assert from "node:assert/strict";
import { test } from "node:test";
import { toHtml } from "./toHtml.js";

test("renders markdown to html", async () => {
  const html = await toHtml("# Title\n\nSome **bold** text.");
  assert.match(html, /<h1 id="title">Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
});

test("supports gfm tables", async () => {
  const html = await toHtml("| a | b |\n| - | - |\n| 1 | 2 |");
  assert.match(html, /<table>/);
});
