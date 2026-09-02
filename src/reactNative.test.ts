import assert from "node:assert/strict";
import test from "node:test";
import { createReactNativeRenderer } from "./reactNative.js";

interface Element {
  type: unknown;
  props: Record<string, unknown>;
}

// Fakes standing in for react-native's Text/View/Image — see reactNativeComponents.test.ts.
const Text = () => null;
const View = () => null;
const Image = () => null;
const LEAVES: unknown[] = [Text, View, Image];

/** Unwraps nested function-component elements down to the RN primitive actually used,
 * without calling into it (Text/View/Image are opaque leaves here, not JSX). Class components
 * (MDXErrorBoundary) can't be invoked directly like a function — unwrap via `children`,
 * matching its non-error render path. */
function resolve(element: Element): Element {
  if (typeof element.type !== "function" || LEAVES.includes(element.type)) return element;
  const type = element.type as { prototype?: { isReactComponent?: unknown } };
  return type.prototype?.isReactComponent
    ? resolve(element.props.children as Element)
    : resolve((element.type as (props: object) => Element)(element.props));
}

test("React Native smoke test: renders standard markdown through Text/View with zero setup beyond the three primitives", async () => {
  const { compileMDX } = createReactNativeRenderer({ Text, View, Image });
  const result = await compileMDX("# Hello\n\nWorld");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const element = resolve((result.Content as unknown as (props: object) => Element)({}));
  const heading = resolve((element.props.children as Element[])[0] as Element);
  assert.equal(heading.type, Text);
  assert.equal((heading.props.style as { fontSize: number }).fontSize, 28);
});

test("React Native swaps only the unknown tag for its raw source, logs to console, and keeps rendering its siblings", async () => {
  const { compileMDX } = createReactNativeRenderer({ Text, View, Image });
  const result = await compileMDX("# Heading\n\n<Callout>hi</Callout>\n\nMore text");
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const originalConsoleError = console.error;
  const logged: unknown[] = [];
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    // MDXErrorBoundary never triggers here — the failure is caught per-node inside compileMDX,
    // not left to bubble up and blank the whole document.
    const element = resolve((result.Content as unknown as (props: object) => Element)({}));
    const children = element.props.children as Element[];
    assert.equal(children.length, 3);
    assert.equal(resolve(children[0]).type, Text); // heading
    // <Callout>hi</Callout> parses as an inline JSX child of its own paragraph, so the fallback
    // (also Text-wrapped) sits one level inside that paragraph rather than replacing it outright.
    const paragraph = resolve(children[1]);
    assert.equal(paragraph.type, Text);
    const fallback = resolve(paragraph.props.children as Element);
    assert.equal(fallback.type, Text);
    assert.equal(fallback.props.children, "<Callout>hi</Callout>");
    assert.equal(resolve(children[2]).type, Text); // "More text" paragraph
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(logged.length, 1);
});

test("React Native EntryLink renders out of the box (no components map)", async () => {
  const { compileMDX } = createReactNativeRenderer({ Text, View, Image });
  const result = await compileMDX('<EntryLink id="abc123">Read more</EntryLink>');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const element = resolve((result.Content as unknown as (props: object) => Element)({}));
  assert.equal(element.type, Text);
});
