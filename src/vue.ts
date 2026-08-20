import type { Component } from "vue";
import { compileMDXCore, makeDefaultEntryLink, type FailedMDX } from "./core.js";
import { vueJsxRuntime } from "./vueRuntime.js";

export interface CompiledMDX {
  ok: true;
  Content: Component;
}

export type { FailedMDX };

const defaultComponents = { EntryLink: makeDefaultEntryLink(vueJsxRuntime) };

/**
 * Compiles raw MDX/markdown into a renderable Vue component. Vue has no RSC-style async component, so call this
 * from `setup()`/a composable and render the result yourself: `h(Content, props)`.
 */
export async function compileMDX(source: string): Promise<CompiledMDX | FailedMDX> {
  return compileMDXCore<Component>(source, vueJsxRuntime, defaultComponents);
}
