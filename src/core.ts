import { evaluate } from "@mdx-js/mdx";
import type { EvaluateOptions } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

export type JsxRuntime = Pick<EvaluateOptions, "Fragment" | "jsx" | "jsxs" | "jsxDEV">;

export interface CompiledMDX<TComponent> {
  ok: true;
  Content: TComponent;
}

export interface FailedMDX {
  ok: false;
  error: unknown;
}

/**
 * Shared MDX-to-component evaluation. Parameterized by JSX runtime (React's
 * `react/jsx-runtime`, a Vue `h()`-based shim, ...) so each framework entry point
 * supplies its own without duplicating the remark/rehype pipeline.
 *
 * `defaultComponents`, when given, are merged underneath whatever the caller passes
 * as `Content`'s own `components` prop (caller always wins per-tag) — this is what
 * lets a framework entry point ship working defaults (e.g. a default `EntryLink`,
 * or React Native's Text/View mapping) without requiring a mapping up front.
 */
export async function compileMDXCore<TComponent>(
  source: string,
  jsxRuntime: JsxRuntime,
  defaultComponents?: Record<string, unknown>,
): Promise<CompiledMDX<TComponent> | FailedMDX> {
  try {
    const { default: Content } = await evaluate(source, {
      ...jsxRuntime,
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    });
    const OutputContent = defaultComponents
      ? withDefaultComponents(Content, defaultComponents, jsxRuntime)
      : Content;
    // evaluate()'s return type assumes React's JSX types regardless of the runtime
    // passed in; TComponent reflects the actual shape for the calling framework.
    return { ok: true, Content: OutputContent as unknown as TComponent };
  } catch (error) {
    return { ok: false, error };
  }
}

interface ContentProps {
  components?: Record<string, unknown>;
  [key: string]: unknown;
}

function withDefaultComponents(
  Content: unknown,
  defaults: Record<string, unknown>,
  jsxRuntime: JsxRuntime,
) {
  return function ContentWithDefaults(props: ContentProps) {
    return jsxRuntime.jsx!(
      Content as never,
      {
        ...props,
        components: { ...defaults, ...props?.components },
      } as never,
    );
  };
}

/** Default `EntryLink` for a given JSX runtime — renders `<a href="/entries/{id}">`.
 * Covers the common case (a plain link to the entry's default route); apps that
 * route entries differently still override it by passing `components.EntryLink`. */
export function makeDefaultEntryLink(jsxRuntime: JsxRuntime) {
  return function EntryLink({ id, children }: { id?: string; children?: unknown }) {
    return jsxRuntime.jsx!("a", { href: id ? `/entries/${id}` : undefined, children } as never);
  };
}
