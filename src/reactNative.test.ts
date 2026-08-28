import assert from "node:assert/strict";
import test from "node:test";
import { createReactNativeRenderer } from "./reactNative.js";
import { MDXErrorBoundary } from "./MDXErrorBoundary.js";

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

test("React Native falls back to the raw source and logs to console instead of crashing on an unknown tag", async () => {
  const { compileMDX } = createReactNativeRenderer({ Text, View, Image });
  const result = await compileMDX("<Callout>hi</Callout>");
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const originalConsoleError = console.error;
  const logged: unknown[] = [];
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    // No react-dom/test-renderer in this package — drive the real MDXErrorBoundary class by
    // hand the way React would: render children, and on throw, catch + re-render the fallback.
    const boundaryElement = (result.Content as unknown as (props: object) => Element)({});
    assert.equal(boundaryElement.type, MDXErrorBoundary);
    const boundary = new MDXErrorBoundary(boundaryElement.props as never);
    try {
      resolve(boundaryElement.props.children as Element);
      assert.fail("expected the missing <Callout> component to throw");
    } catch (error) {
      boundary.componentDidCatch(error);
      Object.assign(boundary.state, MDXErrorBoundary.getDerivedStateFromError());
    }
    const fallback = resolve(boundary.render() as unknown as Element);
    assert.equal(fallback.type, Text);
    assert.equal(fallback.props.children, "<Callout>hi</Callout>");
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
