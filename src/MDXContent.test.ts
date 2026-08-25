import assert from "node:assert/strict";
import test from "node:test";
import { MDXContent } from "./MDXContent.js";

interface Element {
  type: unknown;
  props: Record<string, unknown>;
}

// MDXContent is an async Server Component; call it directly (as React's RSC runtime would) and inspect
// the returned element tree. It returns a fragment: [inlined <style> | null, the wrapper element].
function wrapperOf(fragment: unknown): Element {
  const [, wrapper] = (fragment as Element).props.children as [unknown, Element];
  return wrapper;
}

test("MDXContent wraps compiled MDX in the styled wrapper element", async () => {
  const fragment = (await MDXContent({ source: "# Hello" })) as unknown as Element;
  const [styles] = fragment.props.children as [Element, Element];
  assert.equal(styles.type, "style");
  const element = wrapperOf(fragment);
  assert.equal(element.type, "div");
  assert.equal(element.props.className, "db-content");
});

test("unstyled drops the db-content class and the inlined styles", async () => {
  const fragment = (await MDXContent({
    source: "# Hello",
    unstyled: true,
  })) as unknown as Element;
  const [styles] = fragment.props.children as [unknown, Element];
  assert.equal(styles, null);
  const element = wrapperOf(fragment);
  assert.equal(element.props.className, undefined);
});

test("falls back to plain text when the source fails to compile as MDX", async () => {
  const fragment = (await MDXContent({ source: "<broken" })) as unknown as Element;
  const element = wrapperOf(fragment);
  const fallback = element.props.children as Element;
  assert.equal(fallback.type, "p");
  assert.equal(fallback.props.children, "<broken");
});
