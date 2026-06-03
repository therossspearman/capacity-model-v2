import React from 'react';
import { BRAND } from '../../design-system';

// Logger Utility
const DEBUG = false;
export const Logger = {
    debug: (...args) => DEBUG && console.log('[DEBUG]', ...args),
    info: (...args) => DEBUG && console.info('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args)
};

/**
 * Error Boundary Component for Production Stability
 */
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        Logger.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            const { fallback, componentName = 'Component' } = this.props;

            if (fallback) return fallback;

            return (
                <div style={{ padding: '24px', backgroundColor: '#fef2f2', border: '2px solid #fecaca', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flexShrink: 0 }}>
                            <svg style={{ width: '24px', height: '24px', color: '#dc2626' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#7f1d1d', marginBottom: '4px' }}>
                                {componentName} Error
                            </h3>
                            <p style={{ fontSize: '12px', color: '#b91c1c', marginBottom: '8px' }}>
                                Something went wrong. Please try refreshing the page.
                            </p>
                            {this.state.error && (
                                <details style={{ fontSize: '12px', color: '#dc2626', backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Error Details</summary>
                                    <pre style={{ marginTop: '8px', fontSize: '10px', overflow: 'auto' }}>
                                        {this.state.error.toString()}
                                        {this.state.errorInfo?.componentStack}
                                    </pre>
                                </details>
                            )}
                            <button
                                onClick={() => window.location.reload()}
                                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#b91c1c'; }}
                                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
                                style={{ marginTop: '12px', padding: '6px 12px', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '12px', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'background-color 0.15s' }}
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
