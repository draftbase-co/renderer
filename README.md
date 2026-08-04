# @draftbase/renderer

Framework-agnostic MDX renderer for a Draftbase entry's MDX/markdown field. `compileMDX` is a plain async function that returns a standard React component — it has no dependency on Next.js, a bundler, or a router, so it works anywhere React runs: Next.js App Router, plain client-side React, React Native, Remix, Astro (via `@astrojs/react` islands), Vite + React, and so on.

## Install

```bash
pnpm add @draftbase/renderer
```

## Next.js App Router

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

## Styling

`@draftbase/renderer/styles.css` wraps output in a `.db-content` class with slim, sensible defaults (typography, tables, code blocks). Web-only, opt-in:

- Skip it entirely: don't import the CSS.
- Disable per-render: `<MDXContent source={...} unstyled />`.
- Override: import your own CSS after it (or with higher specificity) targeting `.db-content`.
- Extra classes: `<MDXContent source={...} className="prose" />`.
- Custom wrapper/error element (e.g. React Native's `View`/`Text`): `<MDXContent source={...} wrapperTag={View} errorTag={Text} />`.
