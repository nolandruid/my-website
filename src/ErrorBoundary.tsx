import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** If true, show a compact fallback instead of full-page error (e.g. for badge area) */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.inline) {
        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              minHeight: 280,
              background: '#0a0a0a',
              color: '#94a3b8',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              fontFamily: 'system-ui, sans-serif',
              fontSize: 14,
            }}
          >
            <p style={{ marginBottom: 4 }}>3D badge failed to load</p>
            <pre style={{ fontSize: 11, color: '#f87171', overflow: 'auto', textAlign: 'center' }}>
              {this.state.error.message}
            </pre>
          </div>
        );
      }
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#000',
            color: '#e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginBottom: 8 }}>
            Something went wrong
          </h1>
          <pre
            style={{
              maxWidth: '100%',
              overflow: 'auto',
              padding: 16,
              background: '#1a1a1a',
              borderRadius: 8,
              fontSize: 12,
              color: '#f87171',
            }}
          >
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: 16, fontSize: 14, color: '#94a3b8' }}>
            Check the browser console for details.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
