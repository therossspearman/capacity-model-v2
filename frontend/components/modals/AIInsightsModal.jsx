/**
 * AIInsightsModal - Displays AI Strategic Insights
 */
import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../design-system';

export const AIInsightsModal = ({
    isOpen,
    onClose,
    isLoading,
    insightData
}) => {
    const { isDark, colors } = useTheme();

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)'
        }}>
            <div style={{
                backgroundColor: isDark ? '#1e293b' : 'white',
                borderRadius: '16px',
                width: '800px',
                maxWidth: '90vw',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px',
                    borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            padding: '10px',
                            backgroundColor: isDark ? '#172554' : '#eff6ff',
                            borderRadius: '12px',
                            color: '#3b82f6'
                        }}>
                            <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h2 style={{
                                fontSize: '20px',
                                fontWeight: '700',
                                color: isDark ? '#f8fafc' : '#0f172a',
                                margin: 0
                            }}>
                                AI Strategic Insights
                            </h2>
                            {insightData?.snapshotTime && (
                                <p style={{
                                    fontSize: '12px',
                                    color: isDark ? '#94a3b8' : '#64748b',
                                    margin: '4px 0 0 0'
                                }}>
                                    Generated {new Date(insightData.snapshotTime).toLocaleString()}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px',
                            borderRadius: '8px',
                            color: isDark ? '#64748b' : '#94a3b8',
                            hover: { backgroundColor: isDark ? '#334155' : '#f1f5f9' },
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    padding: '32px',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    {isLoading ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '48px',
                            gap: '16px',
                            color: isDark ? '#94a3b8' : '#64748b'
                        }}>
                            <div className="spinner" style={{
                                width: '40px',
                                height: '40px',
                                border: '3px solid #e2e8f0',
                                borderTopColor: '#3b82f6',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            <p>Analyzing capacity data...</p>
                            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {insightData?.analysis && (
                                <div>
                                    <h3 style={{
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        color: isDark ? '#94a3b8' : '#64748b',
                                        marginBottom: '16px'
                                    }}>
                                        Capacity Analysis
                                    </h3>
                                    <div style={{
                                        fontSize: '15px',
                                        lineHeight: '1.6',
                                        color: isDark ? '#e2e8f0' : '#334155',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {insightData.analysis}
                                    </div>
                                </div>
                            )}

                            {insightData?.recommendations && (
                                <div>
                                    <h3 style={{
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        color: isDark ? '#94a3b8' : '#64748b',
                                        marginBottom: '16px'
                                    }}>
                                        Strategic Recommendations
                                    </h3>
                                    <div style={{
                                        padding: '24px',
                                        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                        borderRadius: '12px',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                                    }}>
                                        <div style={{
                                            fontSize: '15px',
                                            lineHeight: '1.6',
                                            color: isDark ? '#e2e8f0' : '#334155',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {insightData.recommendations}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px 24px',
                    borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: isDark ? '#334155' : 'white',
                            border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                            borderRadius: '8px',
                            color: isDark ? '#f8fafc' : '#475569',
                            fontWeight: '600',
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                    {!isLoading && (
                        <button
                            onClick={() => {
                                // If we want to add an action here later like "Export to PDF"
                            }}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#3b82f6',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '14px',
                                opacity: 0.5,
                                cursor: 'not-allowed'
                            }}
                            disabled
                        >
                            Export Report
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

AIInsightsModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    isLoading: PropTypes.bool,
    insightData: PropTypes.shape({
        snapshotTime: PropTypes.string,
        analysis: PropTypes.string,
        recommendations: PropTypes.string
    })
};

export default AIInsightsModal;
