"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface MDXErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: unknown, errorInfo: ErrorInfo) => void;
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

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("MDX content failed to render", error, errorInfo.componentStack);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
