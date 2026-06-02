/**
 * DemandCategoryToggle - BAU Feature
 * Segmented toggle for filtering demand type: All / Implementation / BAU
 */
import React from 'react';
import PropTypes from 'prop-types';
import { INLINE_STYLES, getPillButtonStyle } from '../../design-system/component-styles';

// SVG Icons for categories
const AllIcon = () => (
    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

const ImplementationIcon = () => (
    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);

const BAUIcon = () => (
    <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);

const DEMAND_CATEGORIES = [
    { value: 'implementation', label: 'Implementation', Icon: ImplementationIcon },
    { value: 'bau', label: 'BAU', Icon: BAUIcon },
    { value: 'all', label: 'All', Icon: AllIcon }
];

/**
 * Segmented toggle for switching between All, Implementation, and BAU views
 */
const DemandCategoryToggle = ({ value = 'all', onChange, disabled = false }) => {
    return (
        <div
            style={{
                ...INLINE_STYLES.pillGroup,
                opacity: disabled ? 0.5 : 1,
                pointerEvents: disabled ? 'none' : 'auto'
            }}
            title="Filter by demand category"
        >
            {DEMAND_CATEGORIES.map(cat => (
                <button
                    key={cat.value}
                    type="button"
                    onClick={() => onChange(cat.value)}
                    style={{
                        ...getPillButtonStyle(value === cat.value),
                        minWidth: cat.value === 'implementation' ? '120px' : '70px'
                    }}
                    aria-pressed={value === cat.value}
                    aria-label={`Show ${cat.label} demand`}
                >
                    <cat.Icon />
                    <span>{cat.label}</span>
                </button>
            ))}
        </div>
    );
};

DemandCategoryToggle.propTypes = {
    /** Current selected category: 'all' | 'implementation' | 'bau' */
    value: PropTypes.oneOf(['all', 'implementation', 'bau']),
    /** Callback when category changes */
    onChange: PropTypes.func.isRequired,
    /** Whether toggle is disabled */
    disabled: PropTypes.bool
};

export default DemandCategoryToggle;
