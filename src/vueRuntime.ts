import { h, Fragment as VueFragment } from "vue";
import type { JsxRuntime } from "./core.js";

interface JsxProps {
  children?: unknown;
  [key: string]: unknown;
}

function toVNode(type: unknown, props: JsxProps | null | undefined) {
  const { children, ...rest } = props ?? {};
  // Vue's h() takes children as a separate argument; the automatic JSX runtime
  // embeds them in props instead — unwrap before handing off.
  return h(type as never, rest, children as never);
}

/** `evaluate()`-compatible JSX runtime backed by Vue's `h()`, used by `./vue.js`. */
export const vueJsxRuntime: JsxRuntime = {
  Fragment: VueFragment,
  jsx: toVNode,
  jsxs: toVNode,
};
