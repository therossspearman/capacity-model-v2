import React, { useState, useEffect, useRef } from 'react';
import { Z_INDEX, BRAND } from '../../design-system';
import { ICONS } from '../../constants';
import { SearchInput } from './Select';

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
    const containerRef = useRef(null);
    const showSearch = options.length > 5;

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

    return (
        <div className="relative" style={{ zIndex: open ? Z_INDEX.DROPDOWN + 10 : Z_INDEX.DROPDOWN }} ref={containerRef}>
            <button onClick={toggle} className={`relative flex items-center justify-between gap-2 min-w-[100px] max-w-[160px] bg-white border hover:border-[${BRAND.primaryLight}] rounded-lg px-3 py-2 text-xs font-medium text-[${BRAND.dark}] shadow-sm transition-all ${open ? `ring-2 ring-[${BRAND.primary}]/20 border-[${BRAND.primary}]` : `border-[${BRAND.border}]`} ${selected.length > 0 ? `bg-[${BRAND.primary}]/5 text-[${BRAND.primary}] border-[${BRAND.primaryLight}]` : ''}`}>
                <span className="truncate">{triggerLabel}</span>
                <div className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>{ICONS.CHEVRON_DOWN}</div>
                {selected.length > 0 && (
                    <div onClick={(e) => { e.stopPropagation(); onChange([]); }} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-200 hover:bg-[#ef4444] hover:text-white rounded-full flex items-center justify-center text-[8px] transition-colors shadow-sm z-20">✕</div>
                )}
            </button>
            {open && (
                <div className={`dropdown-enter absolute top-full left-0 mt-1 min-w-[140px] bg-white border border-[${BRAND.border}] rounded-lg shadow-xl overflow-hidden`}>
                    {showSearch && <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search..." />}
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-3 text-center text-xs text-slate-400 italic">No results</div>
                        ) : (
                            filteredOptions.map(option => (
                                <div
                                    key={option}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleOption(option); }}
                                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-xs ${selected.includes(option) ? `bg-[${BRAND.primary}]/10 text-[${BRAND.primary}] font-semibold` : `text-slate-600 hover:bg-slate-50`}`}
                                >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selected.includes(option) ? `bg-[${BRAND.primary}] border-[${BRAND.primary}]` : 'border-slate-300'}`}>
                                        {selected.includes(option) && <svg style={{ width: '10px', height: '10px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    {option}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 flex justify-between items-center">
                        {selected.length > 0 ? (
                            <button onClick={() => onChange([])} className="text-[10px] text-slate-400 hover:text-[#ef4444] font-medium">Clear</button>
                        ) : (
                            <span className="text-[10px] text-slate-400">{options.length} options</span>
                        )}
                        {selected.length !== options.length && (
                            <button onClick={() => onChange(options)} className={`text-[10px] font-bold text-[${BRAND.primary}] hover:text-[${BRAND.dark}]`}>All</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelect;
