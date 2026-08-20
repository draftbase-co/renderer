import * as runtime from "react/jsx-runtime";
import type { MDXComponents } from "mdx/types";
import type { ComponentType } from "react";
import { compileMDXCore, type FailedMDX } from "./core.js";
import {
  buildReactNativeComponents,
  type ReactNativePrimitives,
  type ReactNativeStyleOptions,
} from "./reactNativeComponents.js";

export interface CompiledMDX {
  ok: true;
  Content: ComponentType<{ components?: MDXComponents }>;
}

export type { FailedMDX };

/**
 * Wires up a React Native `compileMDX` with default Text/View/Image mappings for every standard markdown element
 * (and `EntryLink`), so a project sets up its RN primitives once instead of mapping every tag on every call.
 */
export function createReactNativeRenderer(
  primitives: ReactNativePrimitives,
  styleOptions?: ReactNativeStyleOptions,
) {
  const defaultComponents = buildReactNativeComponents(primitives, styleOptions);

  async function compileMDX(source: string): Promise<CompiledMDX | FailedMDX> {
    return compileMDXCore<ComponentType<{ components?: MDXComponents }>>(
      source,
      runtime,
      defaultComponents,
    );
  }

  return { compileMDX };
}
