/**
 * ModalErrorBoundary - Catches errors in modal components to prevent app crashes
 */
import React from 'react';
import PropTypes from 'prop-types';

class ModalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Modal Error:', error, errorInfo);
    }

    handleClose = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onClose) {
            this.props.onClose();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '32px',
                        maxWidth: '400px',
                        textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            backgroundColor: '#fef2f2',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px'
                        }}>
                            <svg style={{ width: '24px', height: '24px', color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#1e293b',
                            marginBottom: '8px'
                        }}>
                            {this.props.title || 'Something went wrong'}
                        </h3>
                        <p style={{
                            fontSize: '14px',
                            color: '#64748b',
                            marginBottom: '24px',
                            lineHeight: '1.5'
                        }}>
                            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
                        </p>
                        <button
                            onClick={this.handleClose}
                            style={{
                                padding: '10px 24px',
                                backgroundColor: '#7637E3',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: '600',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

ModalErrorBoundary.propTypes = {
    children: PropTypes.node.isRequired,
    onClose: PropTypes.func,
    title: PropTypes.string
};

export default ModalErrorBoundary;
