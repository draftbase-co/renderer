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
 */
export async function compileMDXCore<TComponent>(
  source: string,
  jsxRuntime: JsxRuntime,
): Promise<CompiledMDX<TComponent> | FailedMDX> {
  try {
    const { default: Content } = await evaluate(source, {
      ...jsxRuntime,
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    });
    // evaluate()'s return type assumes React's JSX types regardless of the runtime
    // passed in; TComponent reflects the actual shape for the calling framework.
    return { ok: true, Content: Content as unknown as TComponent };
  } catch (error) {
    return { ok: false, error };
  }
}
