/**
 * LoadingSpinner - Animated loading indicator
 * Use for async operations that take > 200ms
 */
import React from 'react';
import PropTypes from 'prop-types';

const LoadingSpinner = ({ size = 20, color = '#082F24', text = null, inline = false }) => {
    const spinnerStyle = {
        width: size,
        height: size,
        border: `2px solid ${color}20`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0
    };

    const containerStyle = inline
        ? { display: 'inline-flex', alignItems: 'center', gap: '8px' }
        : { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' };

    return (
        <>
            <style>
                {`@keyframes spin { to { transform: rotate(360deg); } }`}
            </style>
            <div style={containerStyle}>
                <div style={spinnerStyle} />
                {text && (
                    <span style={{
                        fontSize: inline ? '13px' : '14px',
                        color: '#64748b',
                        fontWeight: '500'
                    }}>
                        {text}
                    </span>
                )}
            </div>
        </>
    );
};

LoadingSpinner.propTypes = {
    size: PropTypes.number,
    color: PropTypes.string,
    text: PropTypes.string,
    inline: PropTypes.bool
};

/**
 * LoadingOverlay - Full container loading overlay
 */
export const LoadingOverlay = ({ message = 'Loading...', isDark = false }) => (
    <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(4px)',
        borderRadius: 'inherit',
        zIndex: 10
    }}>
        <LoadingSpinner size={32} color={isDark ? '#818cf8' : '#082F24'} />
        <p style={{
            marginTop: '16px',
            fontSize: '14px',
            fontWeight: '500',
            color: isDark ? '#94a3b8' : '#64748b'
        }}>
            {message}
        </p>
    </div>
);

LoadingOverlay.propTypes = {
    message: PropTypes.string,
    isDark: PropTypes.bool
};

/**
 * ButtonSpinner - For use inside buttons
 */
export const ButtonSpinner = ({ size = 16, color = 'white' }) => (
    <>
        <style>
            {`@keyframes spin { to { transform: rotate(360deg); } }`}
        </style>
        <div style={{
            width: size,
            height: size,
            border: `2px solid ${color}40`,
            borderTopColor: color,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
        }} />
    </>
);

ButtonSpinner.propTypes = {
    size: PropTypes.number,
    color: PropTypes.string
};

export default LoadingSpinner;
