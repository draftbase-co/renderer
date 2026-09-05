import { evaluate } from "@mdx-js/mdx";
import type { EvaluateOptions } from "@mdx-js/mdx";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
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
 * Shared MDX-to-component evaluation, parameterized by JSX runtime so each framework entry point avoids duplicating
 * the remark/rehype pipeline. `defaultComponents`, when given, are merged underneath the caller's own `components` (caller always wins per-tag).
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
      ? withDefaultComponents(Content, defaultComponents, jsxRuntime, collectJsxTagNames(source))
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
  jsxTagNames: Set<string>,
) {
  return function ContentWithDefaults(props: ContentProps) {
    return jsxRuntime.jsx!(
      Content as never,
      {
        ...props,
        components: withMissingComponentFallback(
          { ...defaults, ...props?.components },
          jsxRuntime,
          jsxTagNames,
        ),
      } as never,
    );
  };
}

// Compiled MDX throws "Expected component `X` to be defined" the moment it renders a JSX tag with
// no matching (truthy) entry in `components` — one stale/typo'd/template-mismatched tag otherwise
// crashes the whole page (and, in a static export, the whole build). Only intercept lookups for
// tag names the source actually uses as JSX (from `jsxTagNames`) — `components` is also probed by
// mdx-js itself for unrelated keys (the optional `wrapper` layout, every intrinsic markdown
// element's default-tag fallback) that must pass through untouched.
function withMissingComponentFallback(
  components: Record<string, unknown>,
  jsxRuntime: JsxRuntime,
  jsxTagNames: Set<string>,
): Record<string, unknown> {
  if (jsxTagNames.size === 0) return components;
  return new Proxy(components, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (value || typeof prop !== "string" || !jsxTagNames.has(prop)) return value;
      console.error(
        `MDX component "${prop}" isn't registered for this render — omitting it instead of failing the page. Register it in \`components\` to fix.`,
      );
      return function MissingComponentFallback() {
        return null;
      };
    },
  });
}

// Custom JSX tag names (e.g. `LocalSpotlightSection` in `<LocalSpotlightSection />`) referenced in
// the raw source — used to scope the missing-component fallback to only real component lookups.
function collectJsxTagNames(source: string): Set<string> {
  const names = new Set<string>();
  try {
    const tree = unified().use(remarkParse).use(remarkMdx).parse(source);
    walk(tree as MdastJsxNode);
  } catch {
    // Source that fails this throwaway parse also fails `evaluate()` above, which already
    // reports the error — nothing to collect either way.
  }
  return names;

  function walk(node: MdastJsxNode): void {
    if ((node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name) {
      names.add(node.name);
    }
    for (const child of node.children ?? []) walk(child);
  }
}

interface MdastJsxNode {
  type: string;
  name?: string | null;
  children?: MdastJsxNode[];
}

/** The linked entry's own resolved data — the same shape the delivery API's `getEntry`/`getEntries`
 * attach at `entry.entryLinks[id]` when called with `include` set (optionally widened with
 * `entryLinkFields`). Mirrors the SDK's `EntryLinkView` minus `id`, kept local so the
 * framework-agnostic renderer doesn't depend on `@draftbase/sdk`. */
export interface LinkedEntryData {
  templateId: string;
  title: string;
  status: string;
  fields?: Record<string, unknown>;
}

/** Props passed to `EntryLink` — the id of the linked entry, authored via the entry picker in
 * the MDX editor, plus that entry's own resolved data when the caller passed `entryLinks` to
 * `MDXContent`/`compileMDX` (avoids an extra per-link fetch at render time). Apps overriding
 * `components.EntryLink` should type their component against this. */
export interface EntryLinkProps extends Partial<LinkedEntryData> {
  id?: string;
  children?: unknown;
}

/** Default `EntryLink` for a given JSX runtime — renders `<a href="/entries/{id}">`; apps that
 * route entries differently override it by passing `components.EntryLink`. */
export function makeDefaultEntryLink(jsxRuntime: JsxRuntime) {
  return function EntryLink({ id, children }: EntryLinkProps) {
    return jsxRuntime.jsx!("a", { href: id ? `/entries/${id}` : undefined, children } as never);
  };
}

/** Wraps `EntryLink` (custom or default) so every instance also receives its resolved
 * `LinkedEntryData` from `entryLinks[id]` — the caller's already-fetched `getEntry`/`getEntries`
 * result — instead of each link having to re-fetch its own target. */
export function withEntryLinkData(
  EntryLink: unknown,
  entryLinks: Record<string, LinkedEntryData> | undefined,
  jsxRuntime: JsxRuntime,
): unknown {
  if (!entryLinks) return EntryLink;
  return function EntryLinkWithData(props: EntryLinkProps) {
    const linked = props.id ? entryLinks[props.id] : undefined;
    return jsxRuntime.jsx!(EntryLink as never, { ...props, ...linked } as never);
  };
}

/** Default `img` for a given JSX runtime — defers offscreen image loads instead of the browser's
 * eager default. Apps that want `next/image` (or another optimizer) override it via `components.img`;
 * an explicit `loading`/`decoding` on the element itself (rare, but author-settable) still wins. */
export function makeDefaultImage(jsxRuntime: JsxRuntime) {
  return function Img(props: Record<string, unknown>) {
    return jsxRuntime.jsx!("img", { loading: "lazy", decoding: "async", ...props } as never);
  };
}
