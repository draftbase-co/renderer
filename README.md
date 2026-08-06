<div align="center">

# @draftbase/renderer

**Framework-agnostic MDX renderer for [Draftbase](https://draftbase.co)** — the MDX-based headless CMS for React developers.

[![npm](https://img.shields.io/npm/v/@draftbase/renderer)](https://www.npmjs.com/package/@draftbase/renderer)
[![GitHub](https://img.shields.io/badge/GitHub-renderer-181717?logo=github)](https://github.com/draftbase-co/renderer)

</div>

Takes an entry's MDX/markdown field and renders it into a real component tree (React or Vue) or a plain HTML string — no vendor lock-in to one frontend framework. `compileMDX` is a plain async function with no dependency on Next.js, a bundler, or a router.

## 📦 Install

```bash
pnpm add @draftbase/renderer
```

## 🧭 Pick your entry point

Every framework entry point exposes the **same API shape** — `compileMDX(source)` resolving to `{ ok: true, Content }` or `{ ok: false, error }` — so switching frameworks (or supporting several in one monorepo) means changing the import path, not the calling code:

| Framework                                        | Import                                    | `Content` is a...                           |
| ------------------------------------------------ | ----------------------------------------- | ------------------------------------------- |
| React, Next.js, React Native, Remix, Astro, Vite | `@draftbase/renderer`                     | React component                             |
| Vue                                              | `@draftbase/renderer/vue`                 | Vue component                               |
| Anything else (Svelte, plain HTML, email, RSS)   | `toHtml` (below), from either entry point | — (returns an HTML string, not a component) |

Only import the entry point for the framework you use — each pulls in just that framework's peer dependency (React or Vue), never both, so an app using one never bundles code for the other.

## ⚛️ Next.js App Router

```tsx
import { MDXContent } from "@draftbase/renderer";
import "@draftbase/renderer/styles.css"; // optional slim default styling

export default async function Page() {
  const entry = await draftbase.getEntry<{ body: string }>("<entry id>");

  return <MDXContent source={entry.fields.body} />;
}
```

`MDXContent` is an `async` Server Component — it only works where React can await inside a component body (Next.js RSC).

## Other React (client-side web, React Native, Remix, ...)

Call `compileMDX` yourself from a loader/effect and render the result — no RSC required:

```tsx
import { useEffect, useState } from "react";
import { compileMDX } from "@draftbase/renderer";
import { View, Text } from "react-native";

function Entry({ source }: { source: string }) {
  const [compiled, setCompiled] = useState<Awaited<ReturnType<typeof compileMDX>>>();

  useEffect(() => {
    compileMDX(source).then(setCompiled);
  }, [source]);

  if (!compiled) return null;
  if (!compiled.ok) return <Text>{source}</Text>;

  const { Content } = compiled;
  return (
    <View>
      <Content components={{ p: Text, h1: Text /* ... */ }} />
    </View>
  );
}
```

`compiled.ok` only catches MDX _syntax_ errors. If the source references a JSX component you didn't pass in `components` (e.g. `<Callout>` without a `Callout` implementation), React throws while rendering `<Content>` — wrap it in the exported `MDXErrorBoundary` (React only, not React Native's non-DOM tree unless you supply an `errorTag`-equivalent fallback) to log it to the console and fail soft instead of crashing the page. `MDXContent` (the Next.js RSC helper above) already does this for you automatically.

```tsx
import { MDXErrorBoundary } from "@draftbase/renderer";

<MDXErrorBoundary fallback={<Text>{source}</Text>}>
  <Content components={{ p: Text, h1: Text /* ... */ }} />
</MDXErrorBoundary>;
```

Extended markdown (tables, strikethrough, task lists, autolinks) is supported out of the box via `remark-gfm`.

## Astro

Astro components aren't React, so render through a React island. Compile server-side in the `.astro` frontmatter (Astro's runtime does allow `await` there), then hand the compiled `Content` to a small client React wrapper component:

```astro
---
import { compileMDX } from "@draftbase/renderer";
import MDXIsland from "../components/MDXIsland"; // the client wrapper below

const compiled = await compileMDX(entry.fields.body);
---

<MDXIsland client:load compiled={compiled} />
```

```tsx
// src/components/MDXIsland.tsx
import type { CompiledMDX, FailedMDX } from "@draftbase/renderer";

export default function MDXIsland({ compiled }: { compiled: CompiledMDX | FailedMDX }) {
  if (!compiled.ok) return <p>{/* fallback text */}</p>;
  const { Content } = compiled;
  return <Content />;
}
```

## Vite + React

No RSC in a Vite SPA — use the `compileMDX`-in-`useEffect` pattern from the section above.

## Vue

`compileMDX` from the `/vue` entry point returns a Vue component instead of a React one — same `{ ok, Content }` / `{ ok, error }` shape. Vue has no RSC-style async component, so call it from `setup()`/a composable and render the result yourself, the same pattern as client-side React above:

```vue
<script setup>
import { ref, onMounted } from "vue";
import { compileMDX } from "@draftbase/renderer/vue";

const props = defineProps<{ source: string }>();
const compiled = ref();

onMounted(async () => {
  compiled.value = await compileMDX(props.source);
});
</script>

<template>
  <component :is="compiled.Content" v-if="compiled?.ok" />
  <p v-else-if="compiled">{{ props.source }}</p>
</template>
```

Custom components and markdown-element overrides pass through the same way, as a `components` prop on `Content`.

## Nuxt

Nuxt is Vue, so use the `/vue` entry point — same composable pattern as plain Vue above, from a Nuxt page/component:

```vue
<script setup>
import { compileMDX } from "@draftbase/renderer/vue";

const { data: entry } = await useAsyncData("entry", () => $fetch(`/api/blog/${route.params.slug}`));
const compiled = ref();
onMounted(async () => {
  compiled.value = await compileMDX(entry.value.fields.body);
});
</script>

<template>
  <component :is="compiled.Content" v-if="compiled?.ok" />
</template>
```

## SvelteKit, Angular, Solid, and other non-React/Vue frameworks

This package ships React and Vue component output only. For any other framework, use `toHtml` (below) to get a plain HTML string and render it with each framework's raw-HTML primitive (Svelte's `{@html ...}`, Angular's `[innerHTML]`, Solid's `innerHTML` prop) — same as the Static HTML section:

```ts
// SvelteKit +page.server.ts
import { toHtml } from "@draftbase/renderer";
export async function load({ params }) {
  const entry = await draftbase.getEntry(params.slug);
  return { html: await toHtml(entry.fields.body) };
}
```

```svelte
<!-- +page.svelte -->
<script>export let data;</script>
{@html data.html}
```

`rehype-slug` still adds heading `id`s for anchor links even in the HTML-string path — sanitize/escape user-controlled content upstream as you would with any `{@html}`/`innerHTML` usage.

## Static HTML

For contexts that need a plain HTML string instead of a mounted React tree (email, RSS, non-React embeds), use `toHtml` — headings get `id` slugs (via `rehype-slug`) for anchor links:

```ts
import { toHtml } from "@draftbase/renderer";

const html = await toHtml(entry.fields.body);
```

## Custom components

Content can invoke JSX components by name inside the MDX source (e.g. `<Callout type="warning">...</Callout>`). Pass the implementations:

```tsx
import { Callout, ImageBlock } from "@/components/content";

<MDXContent source={entry.fields.body} components={{ Callout, ImageBlock }} />;
```

Any standard markdown element (`h1`, `table`, `a`, ...) can also be overridden the same way, by key — **required** on non-DOM renderers like React Native, which have no intrinsic `div`/`p`/`a`/`img` tags.

### Entry links

The Draftbase editor can insert `<EntryLink id="...">Link text</EntryLink>` into rich text to link to another entry. It's a plain JSX component like any other — no special renderer support for the tag itself — so you must supply an `EntryLink` implementation the same way as `Callout`/`ImageBlock`. If `EntryLink` isn't supplied and the source contains one, rendering throws (same as any missing custom component).

To route `id` correctly per content type, fetch the entry with `include=1` (via `@draftbase/sdk`) — the response includes an `entryLinks` map keyed by every `EntryLink` id found in that entry's richText fields, each with its `templateId`:

```tsx
const entry = await client.entries.get(entryId, undefined, 1);
// entry.entryLinks = { "64f1a2b3c4d5e6f7a8b9c0d1": { id, templateId, title, status } }

const ROUTE_BY_TEMPLATE: Record<string, string> = { blogPost: "/blog", product: "/products" };

function EntryLink({ id, children }: { id: string; children: React.ReactNode }) {
  const link = entry.entryLinks?.[id];
  const base = ROUTE_BY_TEMPLATE[link?.templateId ?? ""] ?? "/entries";
  return <a href={`${base}/${id}`}>{children}</a>;
}

<MDXContent source={entry.fields.body} components={{ EntryLink }} />;
```

## Styling

`@draftbase/renderer/styles.css` wraps output in a `.db-content` class with slim, sensible defaults (typography, tables, code blocks). Web-only, opt-in:

- Skip it entirely: don't import the CSS.
- Disable per-render: `<MDXContent source={...} unstyled />`.
- Override: import your own CSS after it (or with higher specificity) targeting `.db-content`.
- Extra classes: `<MDXContent source={...} className="prose" />`.
- Custom wrapper/error element (e.g. React Native's `View`/`Text`): `<MDXContent source={...} wrapperTag={View} errorTag={Text} />`.

## Using with Claude Code / AI coding agents

If you're an agent wiring this into a project, follow this checklist:

1. **Install**: `pnpm add @draftbase/renderer` (or `npm`/`yarn` — detect the project's package manager first).
2. **Pick the right entry point first** — check the target framework in the table at the top of this file, then import only that one (`@draftbase/renderer` vs `@draftbase/renderer/vue`). Importing the wrong one pulls in a peer dependency (React or Vue) the project may not have installed, and will fail to resolve.
3. **Detect RSC support before choosing a pattern**: Next.js App Router (or another RSC framework) → use `<MDXContent source={...} />` directly, it's an async Server Component. Everything else (client-side React, React Native, Remix, Vite SPA, Vue) → use the `compileMDX(source)` + state/ref pattern shown above; do not try to `await` it inside a plain client component render.
4. **Every `compileMDX`/`MDXContent` result is a discriminated union** — always branch on `.ok` before touching `.Content`; treat `!ok` as a real render path (show `.error` or fallback text), don't just assume success.
5. **Non-DOM renderers (React Native, custom email/RSS pipelines) have no intrinsic HTML tags** — you must pass a `components` map covering every markdown element actually used in the source (`p`, `h1`-`h6`, `a`, `img`, `table`, ...), or those elements will fail to render. For plain HTML output (email, RSS, non-React embeds) use `toHtml` instead of a component tree.
6. **Don't hand-roll styling** — import `@draftbase/renderer/styles.css` for sensible defaults, or pass `unstyled`/`className` on `MDXContent`, rather than writing new prose/typography CSS from scratch.
7. **This package ships zero bundled React/Vue** — both are optional peer dependencies. If the target project doesn't already have the matching framework installed, install it too or the build will fail.

## FAQ

**What is Draftbase?**
Draftbase is a lightweight, MDX-based headless CMS built for React and Next.js developers. Content is authored as MDX/markdown with typed fields, fetched via [`@draftbase/sdk`](https://www.npmjs.com/package/@draftbase/sdk), and rendered into real components with this package.

**Why MDX instead of plain markdown or a block-based rich-text editor?**
MDX lets authors drop live, typed React/Vue components (callouts, embeds, product cards) directly inside prose, while still compiling down to plain HTML for frameworks that don't run JSX. Plain markdown can't embed components; block editors trade that flexibility for a rigid, CMS-specific JSON schema.

**Does this work with static site generators (SSG) as well as SSR?**
Yes — `compileMDX`/`MDXContent` are plain async functions with no request-scoped state, so they run identically at build time (Next.js `generateStaticParams`, Astro static output, Nuxt `nitro` prerender) or at request time (SSR/RSC).

**Is the compiled output safe for SEO?**
Yes — `compileMDX`/`toHtml` produce standard semantic HTML (headings, lists, tables, links) server-side, so it's fully crawlable and indexable with no client-side rendering required; `rehype-slug` also adds heading `id`s for deep-linkable anchor URLs.

**Which frontend frameworks are supported?**
React (Next.js App Router/RSC, plain client React, React Native, Remix, Astro islands, Vite) and Vue (including Nuxt) get first-class component output. Any other framework (Svelte, Angular, Solid, plain HTML/email/RSS) can use `toHtml` to get a plain HTML string instead.

## Links

- [npm](https://www.npmjs.com/package/@draftbase/renderer)
- [Source](https://github.com/draftbase-co/renderer)
- [Issues](https://github.com/draftbase-co/renderer/issues)
- [`@draftbase/sdk`](https://www.npmjs.com/package/@draftbase/sdk) — fetches the content this package renders
- [draftbase.co](https://draftbase.co) — product site
- [Framework support](https://draftbase.co/frameworks) — per-framework rendering guide this README is based on
- [API reference](https://draftbase.co/docs/api-reference)
- [Docs](https://draftbase.co/docs)
- [Pricing](https://draftbase.co/pricing)
