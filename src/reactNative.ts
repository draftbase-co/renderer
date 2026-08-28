import * as runtime from "react/jsx-runtime";
import type { MDXComponents } from "mdx/types";
import type { ComponentType, ReactElement } from "react";
import { compileMDXCore, type FailedMDX } from "./core.js";
import { MDXErrorBoundary } from "./MDXErrorBoundary.js";
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
 * A tag/component the source references but nothing maps (a typo'd custom component, a raw HTML tag RN has no
 * native view for) is caught at render — logged via `console.error` and replaced with the raw source as
 * plain text, instead of crashing the screen.
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
    // A JSX component referenced in `source` but missing from `components`, or a raw HTML tag RN has
    // no native view for, throws mid-render — RN has no DOM to silently fall back on the way web
    // does, so catch it here instead of taking down the whole screen, and log it loudly so the
    // content author (or whoever wired up `components`) notices and fixes it.
    const SafeContent = (props: { components?: MDXComponents }) =>
      runtime.jsx(MDXErrorBoundary, {
        fallback: runtime.jsx(primitives.Text, { children: source } as never),
        children: runtime.jsx(RootWithoutWhitespace, props as never),
      } as never);
    return {
      ok: true,
      Content: SafeContent as unknown as ComponentType<{
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
