import * as runtime from "react/jsx-runtime";
import type { MDXComponents } from "mdx/types";
import type { ComponentType, ElementType, ReactNode } from "react";
import { compileMDXCore, makeDefaultEntryLink, type FailedMDX } from "./core.js";
import { wrapperClassName } from "./wrapperClassName.js";
import { MDXErrorBoundary } from "./MDXErrorBoundary.js";

export interface CompiledMDX {
  ok: true;
  Content: ComponentType<{ components?: MDXComponents }>;
}

export type { FailedMDX };

const defaultComponents = { EntryLink: makeDefaultEntryLink(runtime) };

/**
 * Compiles raw MDX/markdown into a renderable React component — no DOM assumptions, safe for client effects or RSC.
 * Standard markdown elements render via real DOM tags with zero setup; only a JSX component with no built-in default needs `components`.
 */
export async function compileMDX(source: string): Promise<CompiledMDX | FailedMDX> {
  return compileMDXCore<ComponentType<{ components?: MDXComponents }>>(
    source,
    runtime,
    defaultComponents,
  );
}

export interface MDXContentProps {
  /** Raw MDX/markdown string, e.g. an entry's rich text field. */
  source: string;
  /** Custom components available by name inside the MDX source, and/or overrides for standard markdown elements —
   * required on non-DOM renderers such as React Native, which have no intrinsic `div`/`p`/`a` tags. */
  components?: MDXComponents;
  /** Skip the default `db-content` styling class. */
  unstyled?: boolean;
  /** Extra class name(s) merged onto the wrapper element. */
  className?: string;
  /** Wrapper element/component. Defaults to `"div"`; pass React Native's `View` if it accepts
   * `className` (e.g. NativeWind), otherwise drop `className`/`unstyled` and style via `components`. */
  wrapperTag?: ElementType;
  /** Element/component used to render the fallback plain-text output when `source` fails to
   * compile as MDX. Defaults to `"p"`; pass React Native's `Text`. */
  errorTag?: ElementType;
}

/**
 * Next.js Server Component wrapper around {@link compileMDX}. For non-RSC React, call `compileMDX` directly instead —
 * `await` inside a component body only works as an RSC.
 */
export async function MDXContent({
  source,
  components,
  unstyled,
  className,
  wrapperTag = "div",
  errorTag = "p",
}: MDXContentProps): Promise<ReactNode> {
  const Wrapper = wrapperTag;
  const ErrorTag = errorTag;
  const wrapperClass = wrapperClassName(unstyled, className);
  const compiled = await compileMDX(source);

  if (!compiled.ok) {
    // Source isn't valid MDX/JSX (e.g. stray `<`/`{` in prose) — fail soft instead
    // of crashing the page; render it as plain text so the copy still shows.
    console.error("MDX compile failed, rendering as plain text", compiled.error);
    return (
      <Wrapper className={wrapperClass}>
        <ErrorTag>{source}</ErrorTag>
      </Wrapper>
    );
  }

  const { Content } = compiled;
  return (
    <Wrapper className={wrapperClass}>
      <MDXErrorBoundary fallback={<ErrorTag>{source}</ErrorTag>}>
        <Content components={components} />
      </MDXErrorBoundary>
    </Wrapper>
  );
}
