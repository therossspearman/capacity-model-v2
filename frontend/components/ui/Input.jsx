import React from 'react';
import { COMPONENT_STYLES } from '../../design-system';

/**
 * Input component with error state support (inline styles only).
 * @param {Object} props
 * @param {boolean} [props.error] - Show error styling
 * @param {Object} [props.style] - Inline style overrides
 */
export const Input = ({ error, className = '', style, ...props }) => {
    const mergedStyle = {
        ...COMPONENT_STYLES.input.base,
        ...(error ? COMPONENT_STYLES.input.error : COMPONENT_STYLES.input.default),
        ...style,
    };
    return <input style={mergedStyle} {...props} />;
};

export default Input;
