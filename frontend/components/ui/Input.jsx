import React from 'react';
import { COMPONENT_STYLES } from '../../design-system';

/**
 * Input component with error state support
 * @param {Object} props
 * @param {boolean} [props.error] - Show error styling
 * @param {string} [props.className]
 */
export const Input = ({ error, className = '', ...props }) => {
    const inputClass = `${COMPONENT_STYLES.input.base} ${error ? COMPONENT_STYLES.input.error : COMPONENT_STYLES.input.default} ${className}`;
    return <input className={inputClass} {...props} />;
};

export default Input;
