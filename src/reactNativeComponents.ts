import type { ComponentType, ReactNode } from "react";
import * as runtime from "react/jsx-runtime";
import { defaultReactNativeStyles } from "./reactNativeStyles.js";

export interface ReactNativePrimitives {
  Text: ComponentType<{ children?: ReactNode; style?: unknown }>;
  View: ComponentType<{ children?: ReactNode; style?: unknown }>;
  Image: ComponentType<{ source: { uri?: string }; accessibilityLabel?: string; style?: unknown }>;
}

export interface ReactNativeStyleOptions {
  /** Skip the built-in default styles (heading scale, link color, table borders, ...)
   * entirely — components render with no `style` unless `styles` supplies one. */
  unstyled?: boolean;
  /** Per-tag style overrides, merged on top of the defaults (or used as-is under
   * `unstyled`). Same tag keys as the components map, e.g. `{ h1: { fontSize: 32 } }`. */
  styles?: Partial<Record<string, Record<string, unknown>>>;
}

/**
 * Default MDX `components` map for React Native, built from its Text/View/Image primitives. RN has no intrinsic
 * host tags for `p`/`h1`/`a`/etc the way web React does, so every standard markdown element needs an explicit mapping.
 */
export function buildReactNativeComponents(
  { Text, View, Image }: ReactNativePrimitives,
  { unstyled, styles }: ReactNativeStyleOptions = {},
) {
  const styleFor = (tag: string) =>
    unstyled ? styles?.[tag] : { ...defaultReactNativeStyles[tag], ...styles?.[tag] };

  function styled<TProps extends { style?: unknown }>(Base: ComponentType<TProps>, tag: string) {
    const style = styleFor(tag);
    if (!style || Object.keys(style).length === 0) return Base;
    return (props: TProps) =>
      runtime.jsx(Base, { ...props, style: props.style ? [style, props.style] : style } as never);
  }

  // MDX bakes the source's literal formatting whitespace ("\n" between block elements) into the
  // compiled JSX as string children, even though structurally these tags never hold real text.
  // React Native's Text/View don't tolerate a bare string child of View, so container tags need it
  // stripped — Text-mapped tags (p, li, td, ...) keep it, since inline whitespace there is real content.
  function stripWhitespaceChildren(children: ReactNode): ReactNode {
    if (Array.isArray(children))
      return children.filter((child) => typeof child !== "string" || child.trim() !== "");
    return typeof children === "string" && children.trim() === "" ? undefined : children;
  }

  function container<TProps extends { children?: ReactNode; style?: unknown }>(
    Base: ComponentType<TProps>,
    tag: string,
  ) {
    const Styled = styled(Base, tag);
    return (props: TProps) =>
      runtime.jsx(Styled, { ...props, children: stripWhitespaceChildren(props.children) } as never);
  }

  const Img = ({ src, alt }: { src?: string; alt?: string }) =>
    runtime.jsx(Image, {
      source: { uri: src },
      accessibilityLabel: alt,
      style: styleFor("img"),
    } as never);
  const Link = styled(
    ({ children, style }: { children?: ReactNode; style?: unknown }) =>
      runtime.jsx(Text, { children, style } as never),
    "a",
  );

  return {
    p: styled(Text, "p"),
    h1: styled(Text, "h1"),
    h2: styled(Text, "h2"),
    h3: styled(Text, "h3"),
    h4: styled(Text, "h4"),
    h5: styled(Text, "h5"),
    h6: styled(Text, "h6"),
    strong: styled(Text, "strong"),
    em: styled(Text, "em"),
    del: styled(Text, "del"),
    code: styled(Text, "code"),
    pre: styled(Text, "pre"),
    li: styled(Text, "li"),
    th: styled(Text, "th"),
    td: styled(Text, "td"),
    ul: container(View, "ul"),
    ol: container(View, "ol"),
    blockquote: container(View, "blockquote"),
    hr: styled(View, "hr"),
    table: styled(View, "table"),
    thead: View,
    tbody: View,
    tr: styled(View, "tr"),
    a: Link,
    EntryLink: Link,
    img: Img,
  };
}
