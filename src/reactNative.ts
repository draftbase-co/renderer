import * as runtime from "react/jsx-runtime";
import type { MDXComponents } from "mdx/types";
import type { ComponentType, ReactElement } from "react";
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
    const result = await compileMDXCore<(props: { components?: MDXComponents }) => ReactElement>(
      source,
      runtime,
      defaultComponents,
    );
    if (!result.ok) return result;
    // MDX bakes the source's literal inter-block whitespace into the compiled output as bare
    // "\n" string children of the root Fragment (e.g. between a heading and the paragraph after
    // it). React Native throws on a bare string child that isn't inside a <Text>, so those need
    // stripping here — element-mapped tags already handle it themselves (see reactNativeComponents.ts).
    const Content = result.Content;
    // withDefaultComponents (core.ts) wraps the compiled MDX component in one props-forwarding
    // layer, so unwrap exactly that to reach the actual root element (a Fragment for a multi-block
    // document, or a single mapped element like Text/View otherwise) before stripping whitespace.
    // Calling any further would start invoking the RN primitives (Text/View/Image) themselves.
    const RootWithoutWhitespace = (props: { components?: MDXComponents }) => {
      const wrapped = Content(props);
      const rootElement =
        typeof wrapped.type === "function"
          ? (wrapped.type as (p: unknown) => ReactElement)(wrapped.props)
          : wrapped;
      return stripWhitespaceRootChildren(rootElement);
    };
    return {
      ok: true,
      Content: RootWithoutWhitespace as unknown as ComponentType<{
        components?: MDXComponents;
      }>,
    };
  }

  return { compileMDX };
}

function stripWhitespaceRootChildren(element: ReactElement): ReactElement {
  const children = (element.props as { children?: unknown } | null)?.children;
  if (!Array.isArray(children)) return element;
  const filtered = children.filter((child) => typeof child !== "string" || child.trim() !== "");
  if (filtered.length === children.length) return element;
  return runtime.jsxs(
    element.type as never,
    { ...(element.props as object), children: filtered } as never,
    element.key ?? undefined,
  ) as ReactElement;
}
