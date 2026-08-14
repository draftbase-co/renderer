import assert from "node:assert/strict";
import test from "node:test";
import { compileMDX as compileReactMDX } from "./MDXContent.js";
import { compileMDX as compileVueMDX } from "./vue.js";

const SOURCE = "# Hello\n\nWorld";

interface Element {
  type: unknown;
  props: Record<string, unknown>;
}

/** compileMDX's Content is wrapped to merge in default components (see core.ts) —
 * unwrap by directly invoking each function-typed element until reaching real output,
 * same "call it like a plain function" style as the rest of these tests (no renderer
 * mounted). */
function resolve(element: Element): Element {
  return typeof element.type === "function"
    ? resolve((element.type as (props: object) => Element)(element.props))
    : element;
}

test("react compileMDX evaluates MDX into a React element tree", async () => {
  const result = await compileReactMDX(SOURCE);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const element = resolve((result.Content as unknown as (props: object) => Element)({}));
  assert.equal(((element.props.children as Element[])[0] as Element).type, "h1");
});

test("vue compileMDX evaluates the same MDX source into a Vue vnode tree", async () => {
  const result = await compileVueMDX(SOURCE);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const vnode = resolve((result.Content as unknown as (props: object) => Element)({}));
  assert.equal(((vnode as unknown as { children: Element[] }).children[0] as Element).type, "h1");
});

test("react EntryLink renders as a link to /entries/{id} with no components map supplied", async () => {
  const result = await compileReactMDX('<EntryLink id="abc123">Read more</EntryLink>');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const link = resolve((result.Content as unknown as (props: object) => Element)({}));
  assert.equal(link.type, "a");
  assert.equal(link.props.href, "/entries/abc123");
});

test("vue EntryLink renders as a link to /entries/{id} with no components map supplied", async () => {
  const result = await compileVueMDX('<EntryLink id="abc123">Read more</EntryLink>');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const link = resolve((result.Content as unknown as (props: object) => Element)({}));
  assert.equal(link.type, "a");
  assert.equal(link.props.href, "/entries/abc123");
});

test("a supplied EntryLink override still wins over the default", async () => {
  const result = await compileReactMDX('<EntryLink id="abc123">Read more</EntryLink>');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const CustomEntryLink = () => ({ type: "custom-entry-link", props: {} });
  const link = resolve(
    (result.Content as unknown as (props: { components: object }) => Element)({
      components: { EntryLink: CustomEntryLink },
    }),
  );
  assert.equal(link.type, "custom-entry-link");
});
