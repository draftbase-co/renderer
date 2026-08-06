"use client";

import { Component, type ReactNode } from "react";

interface MDXErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface MDXErrorBoundaryState {
  hasError: boolean;
}

// Catches render-time errors from compiled MDX content — most commonly a JSX component
// referenced in the source (e.g. `<Callout>`, `<EntryLink>`) that wasn't supplied in
// `components`. Without this, that throws "Element type is invalid" and crashes the whole
// page instead of just the content block.
export class MDXErrorBoundary extends Component<MDXErrorBoundaryProps, MDXErrorBoundaryState> {
  state: MDXErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("MDX content failed to render", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
