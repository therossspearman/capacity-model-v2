import React, { useState, useEffect, useRef } from 'react';
import { Z_INDEX, BRAND } from '../../design-system';
import { ICONS } from '../../constants';
import { SearchInput } from './Select';

// Inline styles only — Tailwind JIT does not run inside the Airtable iframe.
const PRIMARY = BRAND.primary;            // #082F24
const PRIMARY_LIGHT = BRAND.primaryLight; // #082F24
const BORDER = BRAND.border;
const TEXT = BRAND.indigo;
const MUTED = '#94a3b8';
const DANGER = '#E5554F';
const PRIMARY_TINT_05 = 'rgba(8, 47, 36, 0.05)';
const PRIMARY_TINT_10 = 'rgba(8, 47, 36, 0.1)';

/**
 * Multi-select dropdown component
 */
export const MultiSelect = ({ options = [], selected = [], onChange, label, isOpen, onToggle }) => {
    const isControlled = isOpen !== undefined;
    const [localIsOpen, setLocalIsOpen] = useState(false);
    const open = isControlled ? isOpen : localIsOpen;

    const toggle = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (isControlled) onToggle(!open);
        else setLocalIsOpen(!open);
    };

    const [searchTerm, setSearchTerm] = useState("");
    const [hoveredOption, setHoveredOption] = useState(null);
    const [btnHover, setBtnHover] = useState(false);
    const [badgeHover, setBadgeHover] = useState(false);
    const containerRef = useRef(null);
    const showSearch = options.length > 5;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                if (isControlled && open) onToggle(false);
                else if (!isControlled) setLocalIsOpen(false);
            }
        };
        // Use 'mousedown' (fires before 'click'): the listener already gates on
        // containerRef.contains(target), so clicks inside the trigger/options are
        // treated as "inside" and do not close the dropdown.
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isControlled, open, onToggle]);

    const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

    const toggleOption = (option) => {
        const newSelected = selected.includes(option)
            ? selected.filter(item => item !== option)
            : [...selected, option];
        onChange(newSelected);
    };

    let triggerLabel = `All ${label}`;
    if (selected.length > 0) {
        triggerLabel = selected.length === 1 ? selected[0] : `${selected.length} ${label}`;
    }
    const hasSelection = selected.length > 0;

    return (
        <div style={{ position: 'relative', zIndex: open ? Z_INDEX.DROPDOWN + 10 : Z_INDEX.DROPDOWN }} ref={containerRef}>
            <button
                onClick={toggle}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    minWidth: '100px',
                    maxWidth: '160px',
                    backgroundColor: hasSelection ? PRIMARY_TINT_05 : '#ffffff',
                    border: '1px solid',
                    borderColor: open ? PRIMARY : (hasSelection || btnHover ? PRIMARY_LIGHT : BORDER),
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: hasSelection ? PRIMARY : TEXT,
                    boxShadow: open ? '0 0 0 2px rgba(8, 47, 36, 0.2)' : '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                }}
            >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{triggerLabel}</span>
                <div style={{ color: MUTED, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>{ICONS.CHEVRON_DOWN}</div>
                {hasSelection && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onChange([]); }}
                        onMouseEnter={() => setBadgeHover(true)}
                        onMouseLeave={() => setBadgeHover(false)}
                        style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            width: '16px',
                            height: '16px',
                            backgroundColor: badgeHover ? DANGER : '#e5e7eb',
                            color: badgeHover ? '#ffffff' : 'inherit',
                            borderRadius: '9999px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '8px',
                            transition: 'background-color 0.15s, color 0.15s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            zIndex: 20,
                        }}
                    >
                        ✕
                    </div>
                )}
            </button>
            {open && (
                <div
                    className="dropdown-enter"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        minWidth: '140px',
                        backgroundColor: '#ffffff',
                        border: `1px solid ${BORDER}`,
                        borderRadius: '8px',
                        boxShadow: '0 20px 25px rgba(0,0,0,0.15)',
                        overflow: 'hidden',
                    }}
                >
                    {showSearch && <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search..." />}
                    <div className="custom-scrollbar" style={{ maxHeight: '192px', overflowY: 'auto' }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: MUTED, fontStyle: 'italic' }}>No results</div>
                        ) : (
                            filteredOptions.map(option => {
                                const isSel = selected.includes(option);
                                return (
                                    <div
                                        key={option}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleOption(option); }}
                                        onMouseEnter={() => setHoveredOption(option)}
                                        onMouseLeave={() => setHoveredOption(null)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s',
                                            fontSize: '12px',
                                            backgroundColor: isSel ? PRIMARY_TINT_10 : (hoveredOption === option ? '#f8fafc' : 'transparent'),
                                            color: isSel ? PRIMARY : '#475569',
                                            fontWeight: isSel ? 600 : 400,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '4px',
                                                border: '2px solid',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'background-color 0.15s, border-color 0.15s',
                                                backgroundColor: isSel ? PRIMARY : 'transparent',
                                                borderColor: isSel ? PRIMARY : '#cbd5e1',
                                            }}
                                        >
                                            {isSel && <svg style={{ width: '10px', height: '10px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        {option}
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <div
                        style={{
                            backgroundColor: '#f8fafc',
                            padding: '8px 12px',
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        {hasSelection ? (
                            <button
                                onClick={() => onChange([])}
                                style={{ fontSize: '10px', color: MUTED, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                Clear
                            </button>
                        ) : (
                            <span style={{ fontSize: '10px', color: MUTED }}>{options.length} options</span>
                        )}
                        {selected.length !== options.length && (
                            <button
                                onClick={() => onChange(options)}
                                style={{ fontSize: '10px', fontWeight: 700, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                All
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelect;
