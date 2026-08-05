import type { Component } from "vue";
import { compileMDXCore, type FailedMDX } from "./core.js";
import { vueJsxRuntime } from "./vueRuntime.js";

export interface CompiledMDX {
  ok: true;
  Content: Component;
}

export type { FailedMDX };

/**
 * Compiles raw MDX/markdown into a renderable Vue component. Vue has no RSC-style
 * async component, so call this from `setup()`/a composable and render the result
 * yourself: `h(Content, props)` or `<component :is="Content" />`.
 */
export async function compileMDX(source: string): Promise<CompiledMDX | FailedMDX> {
  return compileMDXCore<Component>(source, vueJsxRuntime);
}
