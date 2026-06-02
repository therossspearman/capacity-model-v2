import React from 'react';
import { COMPONENT_STYLES, BRAND } from '../../design-system';

/**
 * Badge component for status, squad, and completion indicators (inline styles only).
 * @param {Object} props
 * @param {'status'|'squad'|'wave'|'complete'|'profile'} props.type - Badge type
 * @param {string|number} props.value - Display value
 * @param {string} [props.variant] - Variant for profile type
 * @param {React.ReactNode} [props.icon] - Optional icon
 * @param {Object} [props.style] - Inline style overrides
 */
export const Badge = ({ type, value, variant, icon, className = '', style }) => {
    // base + variant first, then caller `style` wins, then any special override wins last
    let badgeStyle = { ...COMPONENT_STYLES.badge.base };
    let displayValue = value;
    let specialOverride = null;

    if (type === 'status') {
        badgeStyle = { ...badgeStyle, ...COMPONENT_STYLES.badge.status };
        // Special handling for lime/green statuses
        const statusLower = (value || '').toLowerCase();
        if (statusLower.includes('onboarding') || statusLower.includes('contracted')) {
            specialOverride = { backgroundColor: '#1B5E20', color: BRAND.lime, borderColor: '#2D5016' };
        }
    } else if (type === 'squad') {
        badgeStyle = { ...badgeStyle, ...COMPONENT_STYLES.badge.squad };
    } else if (type === 'wave') {
        badgeStyle = { ...badgeStyle, ...COMPONENT_STYLES.badge.wave };
    } else if (type === 'complete') {
        const level = value >= 100 ? 'high' : value >= 50 ? 'medium' : 'low';
        badgeStyle = { ...badgeStyle, ...COMPONENT_STYLES.badge.complete[level] };
        displayValue = `${Math.round(value)}% Complete`;
    } else if (type === 'profile') {
        badgeStyle = { ...badgeStyle, ...(COMPONENT_STYLES.badge.profile[variant] || COMPONENT_STYLES.badge.profile.even) };
    }

    return (
        <span style={{ ...badgeStyle, ...(style || {}), ...(specialOverride || {}) }}>
            {icon}{displayValue}
        </span>
    );
};

export default Badge;
