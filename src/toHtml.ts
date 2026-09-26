import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { toHtml as hastToHtml } from "hast-util-to-html";
import { wrapperClassName } from "./wrapperClassName.js";
import { CSS_TEXT } from "./cssText.js";

interface HastElement {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastElement[];
  value?: string;
}

/** Renders a custom JSX tag to an HTML string. `props` values are always strings (HTML parsing,
 * not JSX). `childrenHtml` is the tag's contents, already rendered, nested tags resolved first. */
export type ToHtmlComponent = (props: Record<string, string>, childrenHtml: string) => string;

export interface ToHtmlOptions {
  /** Renders custom tags (e.g. `<Callout>`, `<EntryLink id>`) by tag name, case-insensitive.
   * `EntryLink` defaults to `<a href="/entries/{id}">` unless overridden. */
  components?: Record<string, ToHtmlComponent>;
  /** Adds `target`/`rel` to links whose `href` has a URL scheme (`https:`, `mailto:`, ...).
   * `true` uses `target="_blank" rel="noopener noreferrer"`; pass an object to override. */
  externalLinks?: boolean | { target?: string; rel?: string };
  /** Skip wrapping the output in a `db-content`-classed `<div>` and the inlined default
   * styles (see below). Same semantics as `MDXContent`'s `unstyled` prop. */
  unstyled?: boolean;
  /** Extra class name(s) merged onto the wrapper `<div>`. */
  className?: string;
  /** Called (in addition to `console.error`) when a custom component (from `components`) throws
   * while rendering. The tag is left as literal HTML instead of failing the whole render. */
  onError?: (error: unknown, tagName: string) => void;
}

const SCHEME_HREF = /^[a-z][a-z0-9+.-]*:/i;

// MDX attribute values are author-supplied — a literal `"` would break out of the attribute.
const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const defaultEntryLink: ToHtmlComponent = (props, childrenHtml) =>
  `<a href="/entries/${escapeAttr(props.id ?? "")}">${childrenHtml}</a>`;

// Authors embed video as `<Video src poster duration />` — markdown has no native video syntax.
const defaultVideo: ToHtmlComponent = (props) =>
  `<video controls preload="metadata" playsinline${
    props.src ? ` src="${escapeAttr(props.src)}"` : ""
  }${props.poster ? ` poster="${escapeAttr(props.poster)}"` : ""}></video>`;

function hastPropsToStrings(properties?: Record<string, unknown>): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (typeof value === "string") props[key] = value;
    else if (Array.isArray(value)) props[key] = value.join(" ");
  }
  return props;
}

type ComponentMap = Map<string, ToHtmlComponent>;

function buildComponentMap(components: Record<string, ToHtmlComponent>): ComponentMap {
  return new Map(
    Object.entries({ EntryLink: defaultEntryLink, Video: defaultVideo, ...components }).map(
      ([name, render]) => [name.toLowerCase(), render] as const,
    ),
  );
}

interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
}

const SELF_CLOSING_TAG =
  /<([A-Za-z][\w-]*)((?:\s+[^\s"'=<>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/>/g;

// HTML parsers (parse5 via rehype-raw) ignore `/>` on non-void elements, so `<Cta />` would
// swallow every following sibling as its children. Rewrite to paired form before parsing.
function remarkComponentTags(componentsByTag: ComponentMap) {
  return (tree: MdastNode) => {
    function transform(node: MdastNode): void {
      if (node.type === "html" && node.value) {
        node.value = node.value.replace(SELF_CLOSING_TAG, (tag, name: string, attrs: string) =>
          componentsByTag.has(name.toLowerCase()) ? `<${name}${attrs}></${name}>` : tag,
        );
      }
      for (const child of node.children ?? []) transform(child);
    }
    transform(tree);
  };
}

function rehypeDraftbase(options: ToHtmlOptions, componentsByTag?: ComponentMap) {
  // A paragraph holding only one component renders it as a flow node, like MDX does —
  // otherwise block output lands inside `<p>` and browsers split it.
  function unwrapLoneComponent(node: HastElement): HastElement {
    if (node.tagName !== "p") return node;
    const content = node.children?.filter((c) => c.type !== "text" || c.value?.trim());
    const only = content?.length === 1 ? content[0] : undefined;
    return only?.tagName && componentsByTag?.has(only.tagName) ? only : node;
  }

  return (tree: HastElement) => {
    function transform(node: HastElement): void {
      node.children = node.children?.map(unwrapLoneComponent);
      for (const child of node.children ?? []) transform(child);
      if (node.type !== "element" || !node.tagName) return;

      const tagName = node.tagName;
      const render = componentsByTag?.get(tagName);
      if (render) {
        try {
          const childrenHtml = hastToHtml(
            { type: "root", children: node.children ?? [] } as never,
            { allowDangerousHtml: true },
          );
          node.value = render(hastPropsToStrings(node.properties), childrenHtml);
          node.type = "raw";
          node.tagName = undefined;
          node.properties = undefined;
          node.children = undefined;
        } catch (error) {
          // Leave the tag as literal HTML instead of failing the whole render.
          console.error(`Draftbase component "${tagName}" failed to render`, error);
          options.onError?.(error, tagName);
        }
        return;
      }

      if (node.tagName === "img") {
        node.properties = { loading: "lazy", decoding: "async", ...node.properties };
        return;
      }

      if (node.tagName === "a" && options.externalLinks) {
        const href = node.properties?.href;
        if (typeof href !== "string" || !SCHEME_HREF.test(href)) return;
        const overrides = typeof options.externalLinks === "object" ? options.externalLinks : {};
        node.properties = {
          ...node.properties,
          target: overrides.target ?? "_blank",
          rel: overrides.rel ?? "noopener noreferrer",
        };
      }
    }
    transform(tree);
  };
}

/** Renders MDX/markdown to a static, self-contained HTML string: pre-wrapped in
 * `<div class="db-content">` with the default styles inlined as a `<style>` tag ahead of it —
 * no separate `styles.css` import needed. Calling `toHtml` more than once on the same page
 * repeats that `<style>` tag (harmless, just redundant bytes); pass `unstyled: true` and load
 * `@draftbase/renderer/styles.css` yourself once if that matters. No React, no mounted tree —
 * use `compileMDX`/`MDXContent` instead when you need a React tree. */
export async function toHtml(source: string, options: ToHtmlOptions = {}): Promise<string> {
  const componentsByTag = options.components && buildComponentMap(options.components);
  const processor = unified().use(remarkParse).use(remarkGfm);
  if (componentsByTag) processor.use(remarkComponentTags, componentsByTag);
  processor.use(remarkRehype, { allowDangerousHtml: true });
  if (componentsByTag) processor.use(rehypeRaw);
  processor
    .use(rehypeSlug)
    .use(rehypeDraftbase, options, componentsByTag)
    .use(rehypeStringify, { allowDangerousHtml: true });

  const file = await processor.process(source);
  const html = String(file);

  const wrapperClass = wrapperClassName(options.unstyled, options.className);
  if (!wrapperClass) return html;
  return options.unstyled
    ? `<div class="${wrapperClass}">${html}</div>`
    : `<style>${CSS_TEXT}</style><div class="${wrapperClass}">${html}</div>`;
}
