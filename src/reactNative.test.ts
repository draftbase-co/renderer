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

/** Unwraps nested function-component elements (the default-components wrapper, the
 * per-tag style wrapper, ...) down to the RN primitive actually used, without calling
 * into the primitive itself (Text/View/Image are opaque leaves here, not JSX). */
function resolve(element: Element): Element {
  return typeof element.type === "function" && !LEAVES.includes(element.type)
    ? resolve((element.type as (props: object) => Element)(element.props))
    : element;
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

test("React Native EntryLink renders out of the box (no components map)", async () => {
  const { compileMDX } = createReactNativeRenderer({ Text, View, Image });
  const result = await compileMDX('<EntryLink id="abc123">Read more</EntryLink>');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const element = resolve((result.Content as unknown as (props: object) => Element)({}));
  assert.equal(element.type, Text);
});
