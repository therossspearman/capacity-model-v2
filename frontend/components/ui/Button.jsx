import React, { useState } from 'react';
import { COMPONENT_STYLES } from '../../design-system';

/**
 * Button component with multiple variants (inline styles only — Tailwind does not
 * work in the Airtable iframe).
 * @param {Object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'|'success'|'lime'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.disabled]
 * @param {React.ReactNode} props.children
 * @param {Object} [props.style] - Inline style overrides (win over defaults)
 */
export const Button = ({ variant = 'primary', size = 'md', disabled, children, className = '', style, ...props }) => {
    const [hover, setHover] = useState(false);

    const mergedStyle = {
        ...COMPONENT_STYLES.button.base,
        ...(COMPONENT_STYLES.button.sizes[size] || COMPONENT_STYLES.button.sizes.md),
        ...(COMPONENT_STYLES.button[variant] || COMPONENT_STYLES.button.primary),
        ...(hover && !disabled ? { boxShadow: '0 4px 6px rgba(0,0,0,0.12)' } : null),
        ...(disabled ? COMPONENT_STYLES.button.disabled : null),
        ...style,
    };

    return (
        <button
            style={mergedStyle}
            disabled={disabled}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
