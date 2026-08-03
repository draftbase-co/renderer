# @draftbase/renderer

Framework-agnostic MDX renderer for a Draftbase entry's MDX/markdown field. Works with plain React, React Native, and Next.js App Router.

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
