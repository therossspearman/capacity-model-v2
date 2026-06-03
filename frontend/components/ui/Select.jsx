import React, { useState, useEffect, useRef } from 'react';
import { Z_INDEX, BRAND } from '../../design-system';
import { ICONS } from '../../constants';

// Inline styles only — Tailwind JIT (incl. arbitrary `bg-[${...}]` values) does not
// compile inside the Airtable iframe, so these components previously rendered unstyled.
const PRIMARY = BRAND.primary;          // #180126
const PRIMARY_LIGHT = BRAND.primaryLight; // #7637E3
const BORDER = BRAND.border;
const BG_ALT = BRAND.bgAlt;
const TEXT = BRAND.indigo;              // dark text (BRAND.dark did not exist)
const MUTED = '#94a3b8';
const PRIMARY_TINT = 'rgba(24, 1, 38, 0.1)'; // primary @ 10%

/**
 * Dropdown item component
 */
export const DropdownItem = ({ label, isSelected, onClick, isMulti = false }) => {
    const [hover, setHover] = useState(false);
    return (
        <div
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick(e);
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                userSelect: 'none',
                transition: 'background-color 0.15s, color 0.15s',
                backgroundColor: isSelected ? PRIMARY_TINT : (hover ? BG_ALT : 'transparent'),
                color: isSelected ? PRIMARY : TEXT,
                fontWeight: isSelected ? 500 : 400,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <div
                    style={{
                        flexShrink: 0,
                        width: '16px',
                        height: '16px',
                        borderRadius: isMulti ? '4px' : '9999px',
                        border: '1px solid',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                        backgroundColor: isSelected ? PRIMARY : '#ffffff',
                        borderColor: isSelected ? PRIMARY : BORDER,
                        color: '#ffffff',
                    }}
                >
                    {isSelected && ICONS.CHECK}
                </div>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            </div>
        </div>
    );
};

/**
 * Search input for dropdowns
 */
export const SearchInput = ({ value, onChange, placeholder }) => (
    <div
        style={{
            padding: '8px',
            borderBottom: `1px solid ${BORDER}`,
            position: 'sticky',
            top: 0,
            backgroundColor: '#ffffff',
            zIndex: Z_INDEX.CONTROLS,
        }}
    >
        <div style={{ position: 'relative' }}>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    paddingLeft: '28px',
                    paddingRight: '8px',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                    backgroundColor: BG_ALT,
                    border: `1px solid ${BORDER}`,
                    borderRadius: '4px',
                    fontSize: '12px',
                    outline: 'none',
                    transition: 'all 0.15s',
                    color: TEXT,
                }}
                autoFocus
            />
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    color: MUTED,
                }}
            >
                {ICONS.SEARCH}
            </div>
        </div>
    </div>
);

/**
 * Single select dropdown component
 */
export const Select = ({ options, value, onChange, label, icon, isOpen, onToggle }) => {
    const isControlled = isOpen !== undefined;
    const [localIsOpen, setLocalIsOpen] = useState(false);
    const [hover, setHover] = useState(false);
    const open = isControlled ? isOpen : localIsOpen;

    const toggle = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (isControlled) onToggle?.(!open);
        else setLocalIsOpen(!open);
    };

    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                if (isControlled && open) onToggle?.(false);
                else if (!isControlled) setLocalIsOpen(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [isControlled, open, onToggle]);

    const selectedLabel = value === 'All' ? `All ${label}` : value;

    return (
        <div
            style={{ position: 'relative', zIndex: open ? Z_INDEX.DROPDOWN + 10 : Z_INDEX.DROPDOWN }}
            ref={containerRef}
        >
            <button
                onClick={toggle}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    minWidth: '140px',
                    backgroundColor: '#ffffff',
                    border: '1px solid',
                    borderColor: open ? PRIMARY : (hover ? PRIMARY_LIGHT : BORDER),
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: TEXT,
                    boxShadow: open ? '0 0 0 2px rgba(24, 1, 38, 0.2)' : '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                }}
            >
                {icon && <span style={{ color: MUTED }}>{icon}</span>}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedLabel}</span>
                <div
                    style={{
                        color: MUTED,
                        transition: 'transform 0.2s',
                        transform: open ? 'rotate(180deg)' : 'none',
                    }}
                >
                    {ICONS.CHEVRON_DOWN}
                </div>
            </button>
            {open && (
                <div
                    className="dropdown-enter"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        width: '100%',
                        minWidth: '140px',
                        backgroundColor: '#ffffff',
                        border: `1px solid ${BORDER}`,
                        borderRadius: '8px',
                        boxShadow: '0 20px 25px rgba(0,0,0,0.15)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        className="custom-scrollbar"
                        style={{ maxHeight: '240px', overflowY: 'auto', paddingTop: '4px', paddingBottom: '4px' }}
                    >
                        {options.map(option => (
                            <DropdownItem
                                key={option}
                                label={option === 'All' ? `All ${label}` : option}
                                isSelected={value === option}
                                onClick={() => { onChange(option); if (isControlled) onToggle?.(false); else setLocalIsOpen(false); }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Select;
