"use client";

import { Component, type ReactNode } from "react";

interface MDXErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: unknown) => void;
}

interface MDXErrorBoundaryState {
  hasError: boolean;
}

// Catches render-time errors from compiled MDX content — most commonly a JSX component referenced in the
// source but missing from `components`, which otherwise throws and crashes the whole page.
export class MDXErrorBoundary extends Component<MDXErrorBoundaryProps, MDXErrorBoundaryState> {
  state: MDXErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("MDX content failed to render", error);
    this.props.onError?.(error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
