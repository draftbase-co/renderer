import * as runtime from "react/jsx-runtime";
import type { MDXComponents } from "mdx/types";
import type { ComponentType, ElementType, ReactNode } from "react";
import { compileMDXCore, type FailedMDX } from "./core.js";
import { wrapperClassName } from "./wrapperClassName.js";

export interface CompiledMDX {
  ok: true;
  Content: ComponentType<{ components?: MDXComponents }>;
}

export type { FailedMDX };

/**
 * Compiles raw MDX/markdown into a renderable React component — no DOM assumptions,
 * safe to call from a React Native loader, a client-side effect, or a Next.js Server
 * Component (the `MDXContent` component below does the latter).
 */
export async function compileMDX(source: string): Promise<CompiledMDX | FailedMDX> {
  return compileMDXCore<ComponentType<{ components?: MDXComponents }>>(source, runtime);
}

export interface MDXContentProps {
  /** Raw MDX/markdown string, e.g. an entry's rich text field. */
  source: string;
  /** Custom components available by name inside the MDX source (e.g. `<Callout>`), and/or
   * overrides for standard markdown elements (`p`, `h1`, `a`, `img`, ...) — required on
   * non-DOM renderers such as React Native, which have no intrinsic `div`/`p`/`a` tags. */
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
 * Next.js Server Component wrapper around {@link compileMDX}. For non-RSC React (client-side
 * web, React Native, Remix, ...), call `compileMDX` directly from your own data loader/effect
 * and render `Content` yourself — `await` inside a component body only works as an RSC.
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
      <Content components={components} />
    </Wrapper>
  );
}
