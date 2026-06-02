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
 * Wraps children with dashboard context
 */
export const DashboardProvider = ({ value, children }) => {
    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
};

export default DashboardContext;
