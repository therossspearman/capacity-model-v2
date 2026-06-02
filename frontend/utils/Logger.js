/**
 * Logger - Production-safe logging utility
 * 
 * Only logs when DEBUG mode is enabled via localStorage.
 * Set localStorage.setItem('capacityModelDebug', 'true') to enable.
 */

const isDebugEnabled = () => {
    try {
        return localStorage.getItem('capacityModelDebug') === 'true';
    } catch {
        return false;
    }
};

export const Logger = {
    /**
     * Debug level - detailed debugging info (only in debug mode)
     */
    debug: (...args) => {
        if (isDebugEnabled()) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Info level - general operational messages (only in debug mode)
     */
    info: (...args) => {
        if (isDebugEnabled()) {
            console.log('[INFO]', ...args);
        }
    },

    /**
     * Warn level - always log warnings
     */
    warn: (...args) => {
        console.warn('[WARN]', ...args);
    },

    /**
     * Error level - always log errors
     */
    error: (...args) => {
        console.error('[ERROR]', ...args);
    },

    /**
     * Enable debug mode
     */
    enableDebug: () => {
        try {
            localStorage.setItem('capacityModelDebug', 'true');
            console.log('Debug mode enabled - refresh to see all logs');
        } catch (e) {
            console.warn('Could not enable debug mode:', e);
        }
    },

    /**
     * Disable debug mode
     */
    disableDebug: () => {
        try {
            localStorage.removeItem('capacityModelDebug');
            console.log('Debug mode disabled');
        } catch (e) {
            console.warn('Could not disable debug mode:', e);
        }
    }
};

// Expose to window for easy debugging
if (typeof window !== 'undefined') {
    window.CapacityLogger = Logger;
}

export default Logger;
