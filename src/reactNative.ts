import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import * as runtime from "react/jsx-runtime";
import type { MDXComponents } from "mdx/types";
import type { ComponentType, ReactElement, ReactNode } from "react";
import type { FailedMDX } from "./core.js";
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

// Loose structural shape covering every mdast + mdast-util-mdx-jsx node field the walker below
// reads. Deliberately not the full `mdast`/`mdast-util-mdx-jsx` type packages — those don't
// compose into one importable union without extra deps, and this renderer only ever touches a
// fixed, small set of fields.
interface MdastNode {
  type: string;
  children?: MdastNode[];
  value?: string;
  depth?: number;
  ordered?: boolean | null;
  url?: string;
  alt?: string | null;
  name?: string | null;
  identifier?: string;
  attributes?: Array<{ type: string; name?: string; value?: string | null | { type: string } }>;
  position?: { start: { offset: number }; end: { offset: number } };
}

type AnyComponent = ComponentType<Record<string, unknown>>;

interface RenderCtx {
  components: Record<string, AnyComponent>;
  // Resolved targets for `[text][ref]`/`![alt][ref]`-style references, keyed by identifier
  // (mdast normalizes casing/whitespace to match its `definition` nodes).
  definitions: Record<string, string>;
  // Original MDX string, sliced via a failing node's `position` to render its literal source as
  // an inline fallback instead of losing the rest of the document to one bad node.
  source: string;
}

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMdx);

/**
 * Wires up a React Native `compileMDX` with default Text/View/Image mappings for every standard markdown element
 * (and `EntryLink`), so a project sets up its RN primitives once instead of mapping every tag on every call.
 *
 * Parses MDX to an AST and walks it directly instead of compiling to JS and `evaluate()`-ing it — Hermes (React
 * Native's JS engine) has no `Function`/`eval` support, which `@mdx-js/mdx`'s `evaluate()` requires. This also
 * means only literal string JSX attributes are supported (e.g. `<EntryLink id="x">`) — `{expression}` attributes
 * and `{expression}` content would need the same eval this exists to avoid, and aren't used by lesson content.
 *
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
    let tree: MdastNode;
    try {
      tree = processor.parse(source) as unknown as MdastNode;
    } catch (error) {
      return {
        ok: false,
        error: new Error(`MDX parse failed (${source.length} chars): ${describeError(error)}`, {
          cause: error,
        }),
      };
    }

    // Reference-style links/images (`[text][ref]` + a `[ref]: url` definition anywhere in the
    // doc) resolve against whichever `definition` node shares their identifier — collect them
    // once per parse instead of re-scanning the tree for every reference.
    const definitions: Record<string, string> = {};
    for (const node of tree.children ?? []) {
      if (node.type === "definition" && node.identifier && node.url) {
        definitions[node.identifier] = node.url;
      }
    }

    function Root(props: { components?: MDXComponents }) {
      const components = { ...defaultComponents, ...props.components } as Record<
        string,
        AnyComponent
      >;
      return renderChildren(tree.children ?? [], { components, definitions, source });
    }

    const SafeContent = (props: { components?: MDXComponents }) =>
      runtime.jsx(MDXErrorBoundary, {
        fallback: runtime.jsx(primitives.Text, { children: source } as never),
        children: runtime.jsx(Root, props as never),
      } as never);

    return {
      ok: true,
      Content: SafeContent as unknown as ComponentType<{ components?: MDXComponents }>,
    };
  }

  return { compileMDX };
}

function renderChildren(nodes: MdastNode[], ctx: RenderCtx): ReactNode {
  const rendered = nodes.map((node, index) => renderNode(node, ctx, index)).filter(isRenderable);
  // Mirrors @mdx-js's compiled output: a single top-level node renders directly, only 2+
  // siblings need a Fragment wrapper.
  if (rendered.length === 1) return rendered[0] as ReactNode;
  return runtime.jsx(runtime.Fragment, { children: rendered } as never) as unknown as ReactNode;
}

function textChild(nodes: MdastNode[], ctx: RenderCtx) {
  const rendered = nodes.map((node, index) => renderNode(node, ctx, index)).filter(isRenderable);
  return rendered.length === 1 ? rendered[0] : rendered;
}

function isRenderable(node: unknown): boolean {
  return node !== null && node !== undefined;
}

// A single bad node (a typo'd/missing custom component, an mdast node type this walker doesn't
// know) shouldn't blank out an otherwise-good document — catch here, at the smallest node that
// failed, and swap in its literal source text instead of losing every sibling around it.
function renderNode(node: MdastNode, ctx: RenderCtx, key: number): unknown {
  try {
    return renderNodeUnsafe(node, ctx, key);
  } catch (error) {
    const label = node.name ? `<${node.name}>` : node.type;
    const wrapped = new Error(`MDX node "${label}" failed to render: ${describeError(error)}`, {
      cause: error,
    });
    console.error(wrapped.message, error);
    const raw = node.position
      ? ctx.source.slice(node.position.start.offset, node.position.end.offset)
      : `<${label}>`;
    try {
      return jsx(ctx.components.p, { children: raw }, key);
    } catch (fallbackError) {
      throw new Error(`MDX node "${label}" failed to render and had no fallback component`, {
        cause: fallbackError,
      });
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function renderNodeUnsafe(node: MdastNode, ctx: RenderCtx, key: number): unknown {
  const { components } = ctx;
  switch (node.type) {
    case "paragraph":
      return jsx(components.p, { children: textChild(node.children ?? [], ctx) }, key);
    case "heading":
      return jsx(
        components[`h${node.depth}`],
        { children: textChild(node.children ?? [], ctx) },
        key,
      );
    case "strong":
      return jsx(components.strong, { children: textChild(node.children ?? [], ctx) }, key);
    case "emphasis":
      return jsx(components.em, { children: textChild(node.children ?? [], ctx) }, key);
    case "delete":
      return jsx(components.del, { children: textChild(node.children ?? [], ctx) }, key);
    case "inlineCode":
      return jsx(components.code, { children: node.value }, key);
    case "code":
      return jsx(
        components.pre,
        { children: jsx(components.code, { children: node.value }, 0) },
        key,
      );
    case "list":
      return jsx(
        node.ordered ? components.ol : components.ul,
        { children: (node.children ?? []).map((item, i) => renderNode(item, ctx, i)) },
        key,
      );
    case "listItem":
      return jsx(components.li, { children: textChild(node.children ?? [], ctx) }, key);
    case "blockquote":
      return jsx(
        components.blockquote,
        { children: (node.children ?? []).map((child, i) => renderNode(child, ctx, i)) },
        key,
      );
    case "thematicBreak":
      return jsx(components.hr, {}, key);
    case "table":
      return renderTable(node, ctx, key);
    case "link":
      return jsx(
        components.a,
        { href: node.url, children: textChild(node.children ?? [], ctx) },
        key,
      );
    case "image":
      return jsx(components.img, { src: node.url, alt: node.alt ?? undefined }, key);
    case "linkReference":
      return jsx(
        components.a,
        {
          href: node.identifier ? ctx.definitions[node.identifier] : undefined,
          children: textChild(node.children ?? [], ctx),
        },
        key,
      );
    case "imageReference":
      return jsx(
        components.img,
        {
          src: node.identifier ? ctx.definitions[node.identifier] : undefined,
          alt: node.alt ?? undefined,
        },
        key,
      );
    case "definition":
      // Consumed up front into `ctx.definitions`; renders nothing on its own.
      return null;
    case "text":
      return node.value;
    case "break":
      return "\n";
    case "mdxJsxFlowElement":
    case "mdxJsxTextElement":
      return renderJsx(node, ctx, key);
    default:
      throw new Error(`Unsupported MDX content: "${node.type}" node`);
  }
}

function renderJsx(node: MdastNode, ctx: RenderCtx, key: number) {
  const Component = node.name ? ctx.components[node.name] : undefined;
  if (!Component) throw new Error(`Unknown MDX component: <${node.name ?? "?"}>`);
  const props: Record<string, unknown> = {};
  for (const attr of node.attributes ?? []) {
    if (
      attr.type === "mdxJsxAttribute" &&
      attr.name &&
      (attr.value === null || typeof attr.value === "string")
    ) {
      props[attr.name] = attr.value ?? true;
    }
  }
  return jsx(Component, { ...props, children: textChild(node.children ?? [], ctx) }, key);
}

function renderTable(node: MdastNode, ctx: RenderCtx, key: number) {
  const { components } = ctx;
  const [headerRow, ...bodyRows] = node.children ?? [];
  const cells = (row: MdastNode | undefined, CellTag: AnyComponent) =>
    (row?.children ?? []).map((cell, i) =>
      jsx(CellTag, { children: textChild(cell.children ?? [], ctx) }, i),
    );
  return jsx(
    components.table,
    {
      children: [
        jsx(
          components.thead,
          { children: jsx(components.tr, { children: cells(headerRow, components.th) }, 0) },
          0,
        ),
        jsx(
          components.tbody,
          {
            children: bodyRows.map((row, i) =>
              jsx(components.tr, { children: cells(row, components.td) }, i),
            ),
          },
          1,
        ),
      ],
    },
    key,
  );
}

function jsx(Component: AnyComponent, props: Record<string, unknown>, key: number) {
  return runtime.jsx(Component, props as never, key) as unknown as ReactElement;
}
