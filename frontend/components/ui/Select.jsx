import React, { useState, useEffect, useRef } from 'react';
import { Z_INDEX, BRAND } from '../../design-system';
import { ICONS } from '../../constants';

/**
 * Dropdown item component
 */
export const DropdownItem = ({ label, isSelected, onClick, isMulti = false }) => (
    <div
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick(e);
        }}
        className={`flex items-center justify-between px-3 py-2 cursor-pointer text-xs transition-colors select-none ${isSelected ? `bg-[${BRAND.primary}]/10 text-[${BRAND.primary}] font-medium` : `text-[${BRAND.dark}] hover:bg-[${BRAND.bgAlt}]`}`}
    >
        <div className="flex items-center gap-2 overflow-hidden">
            <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? `bg-[${BRAND.primary}] border-[${BRAND.primary}] text-white` : `bg-white border-[${BRAND.border}]`} ${!isMulti && 'rounded-full'} `}>
                {isSelected && ICONS.CHECK}
            </div>
            <span className="truncate">{label}</span>
        </div>
    </div>
);

/**
 * Search input for dropdowns
 */
export const SearchInput = ({ value, onChange, placeholder }) => (
    <div className={`px-2 py-2 border-b border-[${BRAND.border}] sticky top-0 bg-white z-[${Z_INDEX.CONTROLS}]`}>
        <div className="relative">
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full pl-7 pr-2 py-1.5 bg-[${BRAND.bgAlt}] border border-[${BRAND.border}] rounded text-xs focus:ring-1 focus:ring-[${BRAND.primary}] focus:border-[${BRAND.primary}] outline-none transition-all placeholder-slate-400 text-[${BRAND.dark}]`}
                autoFocus
            />
            <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none text-slate-400">{ICONS.SEARCH}</div>
        </div>
    </div>
);

/**
 * Single select dropdown component
 */
export const Select = ({ options, value, onChange, label, icon, isOpen, onToggle }) => {
    const isControlled = isOpen !== undefined;
    const [localIsOpen, setLocalIsOpen] = useState(false);
    const open = isControlled ? isOpen : localIsOpen;

    const toggle = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (isControlled) onToggle(!open);
        else setLocalIsOpen(!open);
    };

    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                if (isControlled && open) onToggle(false);
                else if (!isControlled) setLocalIsOpen(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [isControlled, open, onToggle]);

    const selectedLabel = value === 'All' ? `All ${label}` : value;

    return (
        <div className="relative" style={{ zIndex: open ? Z_INDEX.DROPDOWN + 10 : Z_INDEX.DROPDOWN }} ref={containerRef}>
            <button onClick={toggle} className={`flex items-center justify-between gap-2 min-w-[140px] bg-white border hover:border-[${BRAND.primaryLight}] rounded-lg px-3 py-2 text-xs font-medium text-[${BRAND.dark}] shadow-sm transition-all ${open ? `ring-2 ring-[${BRAND.primary}]/20 border-[${BRAND.primary}]` : `border-[${BRAND.border}]`}`}>
                {icon && <span className="text-slate-400">{icon}</span>}
                <span className="truncate">{selectedLabel}</span>
                <div className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>{ICONS.CHEVRON_DOWN}</div>
            </button>
            {open && (
                <div className={`dropdown-enter absolute top-full left-0 mt-1 w-full min-w-[140px] bg-white border border-[${BRAND.border}] rounded-lg shadow-xl overflow-hidden`}>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
                        {options.map(option => (
                            <DropdownItem
                                key={option}
                                label={option === 'All' ? `All ${label}` : option}
                                isSelected={value === option}
                                onClick={() => { onChange(option); if (isControlled) onToggle(false); else setLocalIsOpen(false); }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Select;
