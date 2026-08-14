import assert from "node:assert/strict";
import test from "node:test";
import { buildReactNativeComponents } from "./reactNativeComponents.js";

// Stand-ins for react-native's Text/View/Image — this package doesn't depend on
// react-native itself (it only resolves inside Metro, not plain Node), so the mapping
// logic is tested against fakes with the same shape.
const Text = () => null;
const View = () => null;
const Image = () => null;

interface Element {
  type: unknown;
  props: Record<string, unknown>;
}

test("maps standard markdown elements onto Text/View, with default styling applied", () => {
  const components = buildReactNativeComponents({ Text, View, Image });
  const h1 = (components.h1 as (props: object) => Element)({});
  assert.equal(h1.type, Text);
  assert.equal((h1.props.style as { fontSize: number }).fontSize, 28);

  const table = (components.table as (props: object) => Element)({});
  assert.equal(table.type, View);
  const tr = (components.tr as (props: object) => Element)({});
  assert.equal((tr.props.style as { flexDirection: string }).flexDirection, "row");
});

test("unstyled drops the defaults", () => {
  const components = buildReactNativeComponents({ Text, View, Image }, { unstyled: true });
  assert.equal(components.h1, Text); // no style to apply -> returns the primitive directly
});

test("styles option overrides a specific tag without needing unstyled", () => {
  const components = buildReactNativeComponents(
    { Text, View, Image },
    { styles: { h1: { fontSize: 40 } } },
  );
  const h1 = (components.h1 as (props: object) => Element)({});
  assert.equal((h1.props.style as { fontSize: number; fontWeight: string }).fontSize, 40);
  assert.equal((h1.props.style as { fontWeight: string }).fontWeight, "700"); // default still applied
});

test("img wrapper passes src through as Image's source.uri", () => {
  const components = buildReactNativeComponents({ Text, View, Image });
  const element = components.img({ src: "https://example.com/a.png", alt: "a" }) as Element;
  const props = element.props as { source: { uri: string }; accessibilityLabel: string };
  assert.equal(props.source.uri, "https://example.com/a.png");
  assert.equal(props.accessibilityLabel, "a");
});

test("a and EntryLink both render as styled Text", () => {
  const components = buildReactNativeComponents({ Text, View, Image });
  assert.equal(components.EntryLink, components.a);
  const element = (components.a as (props: object) => Element)({ children: "hi" });
  const inner = (element.type as (props: object) => Element)(element.props);
  assert.equal(inner.type, Text);
  assert.equal((inner.props.style as { color: string }).color, "#2563eb");
});
