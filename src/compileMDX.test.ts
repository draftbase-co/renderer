import assert from "node:assert/strict";
import test from "node:test";
import { compileMDX as compileReactMDX } from "./MDXContent.js";
import { compileMDX as compileVueMDX } from "./vue.js";

const SOURCE = "# Hello\n\nWorld";

test("react compileMDX evaluates MDX into a React element tree", async () => {
  const result = await compileReactMDX(SOURCE);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(typeof result.Content, "function");
  const render = result.Content as (props: object) => { props: { children: unknown[] } };
  const element = render({});
  assert.equal((element.props.children[0] as { type: string }).type, "h1");
});

test("vue compileMDX evaluates the same MDX source into a Vue vnode tree", async () => {
  const result = await compileVueMDX(SOURCE);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(typeof result.Content, "function");
  const vnode = (result.Content as (props: object) => { children: unknown[] })({});
  assert.equal((vnode.children[0] as { type: string }).type, "h1");
});
