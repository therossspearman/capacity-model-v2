import React from 'react';
import { BRAND } from '../../design-system';
import { ICONS } from '../../constants';

/**
 * Loading screen with shimmer animation
 */
export const LoadingScreen = () => (
    <div className="w-full h-full p-4 space-y-4">
        <div className={`h-32 bg-[${BRAND.bgAlt}] rounded-lg animate-shimmer`}></div>
        <div className="flex gap-4">
            <div className={`w-1/4 h-80 bg-[${BRAND.bgAlt}] rounded-lg animate-shimmer`}></div>
            <div className={`w-3/4 h-80 bg-[${BRAND.bgAlt}] rounded-lg animate-shimmer`}></div>
        </div>
    </div>
);

/**
 * Empty state placeholder
 */
export const EmptyState = ({ message, subtext, icon }) => (
    <div className={`flex flex-col items-center justify-center h-64 text-center p-8 bg-[${BRAND.bgAlt}] rounded-lg border border-dashed border-[${BRAND.border}]`}>
        <div className="p-4 bg-white rounded-full shadow-sm mb-4 text-slate-400">{icon || ICONS.SEARCH}</div>
        <h3 className={`text-sm font-bold text-[${BRAND.dark}] mb-1`}>{message}</h3>
        <p className="text-xs text-slate-500 max-w-xs">{subtext}</p>
    </div>
);

/**
 * Stat card for KPIs
 */
export const StatCard = ({ label, value, subtext, icon, color, children }) => (
    <div className={`bg-white border border-[${BRAND.border}] rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200 min-w-[120px] h-[64px] group flex-shrink-0`}>
        <div className="flex justify-between items-start h-full">
            <div className="flex flex-col justify-center">
                <span className={`text-[9px] font-semibold text-slate-400 uppercase tracking-wide group-hover:text-[${BRAND.primary}] transition-colors`}>{label}</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                    <span className={`text-lg font-bold text-[${BRAND.dark}] tracking-tight`}>{value}</span>
                    {subtext && <span className="text-[9px] text-slate-400 font-medium">{subtext}</span>}
                </div>
            </div>
            {children ? (
                <div className="opacity-90 group-hover:opacity-100 transition-opacity ml-2 self-center">{children}</div>
            ) : (
                <div className={`p-1.5 rounded-lg ${color} bg-opacity-10 group-hover:scale-110 transition-transform duration-200 ml-2`}>
                    {React.cloneElement(icon, { className: "w-4 h-4" })}
                </div>
            )}
        </div>
    </div>
);

/**
 * Styled date picker wrapper
 */
export const StyledDatePicker = ({ value, onChange, placeholder }) => (
    <div className="relative group">
        <div className={`flex items-center gap-2 bg-white border border-[${BRAND.border}] group-hover:border-[${BRAND.primary}] rounded-lg px-3 py-2 text-xs font-medium text-[${BRAND.dark}] shadow-sm transition-all min-w-[110px]`}>
            <div className={`text-slate-400 group-hover:text-[${BRAND.primary}] transition-colors`}>{ICONS.CALENDAR}</div>
            <span className={!value ? 'text-slate-400' : `text-[${BRAND.dark}]`}>{value || placeholder}</span>
        </div>
        <input type="date" value={value} onChange={onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
    </div>
);
