/**
 * DashboardContext - Centralized state management for Dashboard components
 * Eliminates prop drilling for extracted components like Toolbar, Sidebar, etc.
 */
import React, { createContext, useContext } from 'react';

// Create the context
const DashboardContext = createContext(null);

/**
 * Hook to access dashboard context
 * @returns {Object} Dashboard context values
 */
export const useDashboardContext = () => {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboardContext must be used within DashboardProvider');
    }
    return context;
};

/**
 * DashboardProvider component
 * Wraps children with dashboard context.
 *
 * IMPORTANT: `value` is passed straight through to Context.Provider, so it MUST
 * be a stable/memoized reference (e.g. built with useMemo in the caller). If a
 * fresh object literal is passed on every render, every context consumer will
 * re-render on every parent render. (Dashboard.jsx already memoizes it.)
 */
export const DashboardProvider = ({ value, children }) => {
    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
};

export default DashboardContext;
