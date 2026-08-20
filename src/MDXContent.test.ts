import assert from "node:assert/strict";
import test from "node:test";
import { MDXContent } from "./MDXContent.js";

interface Element {
  type: unknown;
  props: Record<string, unknown>;
}

// MDXContent is an async Server Component; call it directly (as React's RSC runtime would) and inspect the returned element tree.
test("MDXContent wraps compiled MDX in the styled wrapper element", async () => {
  const element = (await MDXContent({ source: "# Hello" })) as unknown as Element;
  assert.equal(element.type, "div");
  assert.equal(element.props.className, "db-content");
});

test("unstyled drops the db-content class", async () => {
  const element = (await MDXContent({ source: "# Hello", unstyled: true })) as unknown as Element;
  assert.equal(element.props.className, undefined);
});

test("falls back to plain text when the source fails to compile as MDX", async () => {
  const element = (await MDXContent({ source: "<broken" })) as unknown as Element;
  const fallback = element.props.children as Element;
  assert.equal(fallback.type, "p");
  assert.equal(fallback.props.children, "<broken");
});
