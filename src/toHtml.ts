import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";

/**
 * Renders raw MDX/markdown to a static HTML string — no React, no JSX component
 * evaluation. For contexts that need plain HTML (email, RSS, non-React embeds),
 * not a mounted React tree; use `compileMDX`/`MDXContent` for that instead.
 * JSX inside the source (e.g. `<Callout>`) is passed through as literal HTML tags.
 */
export async function toHtml(source: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(source);
  return String(file);
}
