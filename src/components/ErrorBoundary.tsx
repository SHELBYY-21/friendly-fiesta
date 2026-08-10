'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback card (e.g. "Stats Overview") */
  label?: string;
  /** Optional custom fallback node — overrides the default card */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console so developers can see the full stack
    console.error(`[ErrorBoundary] ${this.props.label ?? 'Component'} crashed:`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const label = this.props.label ?? 'Component';
    const message = this.state.error?.message ?? 'Unknown error';

    return (
      <div className="glass reveal flex flex-col items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span className="text-sm font-semibold text-rose-400">{label} failed to render</span>
        </div>
        <p className="max-w-prose text-xs text-[color:var(--muted)] opacity-80">
          {message}
        </p>
        <button
          onClick={this.handleRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
        >
          ↺ Retry
        </button>
      </div>
    );
  }
}
