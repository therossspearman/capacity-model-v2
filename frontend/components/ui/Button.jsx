import React from 'react';
import { COMPONENT_STYLES } from '../../design-system';

const SIZE_CLASSES = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-xs',
    lg: 'px-4 py-2.5 text-sm'
};

/**
 * Button component with multiple variants
 * @param {Object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'|'success'|'lime'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.disabled]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export const Button = ({ variant = 'primary', size = 'md', disabled, children, className = '', ...props }) => {
    const buttonClass = `${COMPONENT_STYLES.button.base} ${COMPONENT_STYLES.button[variant]} ${SIZE_CLASSES[size]} ${disabled ? COMPONENT_STYLES.button.disabled : ''} ${className}`;

    return (
        <button className={buttonClass} disabled={disabled} {...props}>
            {children}
        </button>
    );
};

export default Button;
