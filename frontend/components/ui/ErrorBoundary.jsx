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
                <div className={`p-6 bg-red-50 border-2 border-red-200 rounded-xl`}>
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                            <svg style={{ width: '24px', height: '24px', color: '#dc2626' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-red-900 mb-1">
                                {componentName} Error
                            </h3>
                            <p className="text-xs text-red-700 mb-2">
                                Something went wrong. Please try refreshing the page.
                            </p>
                            {this.state.error && (
                                <details className="text-xs text-red-600 bg-white p-2 rounded border border-red-200">
                                    <summary className="cursor-pointer font-semibold">Error Details</summary>
                                    <pre className="mt-2 text-[10px] overflow-auto">
                                        {this.state.error.toString()}
                                        {this.state.errorInfo?.componentStack}
                                    </pre>
                                </details>
                            )}
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-3 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
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
