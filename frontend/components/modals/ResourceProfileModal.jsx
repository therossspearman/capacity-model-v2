/**
 * Resource Profile Modal (A+ Polish Edition)
 * Premium resource profile with Inter typography and optimized field density
 */
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { BRAND, Z_INDEX, useTheme, TOKENS } from '../../design-system';

// Shared Inter font stack for consistency
const INTER = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const MONO = 'JetBrains Mono, SF Mono, Consolas, monospace';

const ResourceProfileModal = ({ resource, rampProfiles = [], onClose, onUpdate, addToast }) => {
    const { isDark, colors } = useTheme();
    const modalRef = useRef(null);

    const [editForm, setEditForm] = useState({
        rampProfile: resource.rampProfile || '',
        rampStartDate: resource.rampStartDate ? new Date(resource.rampStartDate).toISOString().split('T')[0] : '',
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setEditForm({
            rampProfile: resource.rampProfile || '',
            rampStartDate: resource.rampStartDate ? new Date(resource.rampStartDate).toISOString().split('T')[0] : '',
        });
    }, [resource.id]); // Only reset form when viewing a different resource

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) onClose();
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdate(resource.id, editForm);
            if (addToast) addToast({ type: 'success', message: 'Resource profile updated successfully!' });
            onClose();
        } catch (error) {
            console.error('Failed to update resource profile:', error);
            if (addToast) addToast({ type: 'error', message: 'Failed to update resource profile.' });
        } finally {
            setIsSaving(false);
        }
    };

    // Format display values
    const weeklyHours = resource.workingHours ? (resource.workingHours / 3600) : 40;
    const targetUtil = resource.targetUtilization ?? resource.targetUtil;

    // targetUtilization is always a decimal from Dashboard (0.8 = 80%, 0.01 = 1%)
    // Simply multiply by 100 to get percentage for display
    const normalizeUtil = (val) => {
        if (val === null || val === undefined) return null;
        return val * 100;
    };
    const formattedUtil = normalizeUtil(targetUtil);
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

    // SVG Icons for field cards (slightly smaller for density)
    const ICONS = {
        globe: <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        briefcase: <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
        clock: <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        chart: <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
        calendar: <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        logout: <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
    };

    // Premium field card component with improved density
    const FieldCard = ({ label, value, icon, accent = false }) => (
        <div style={{
            padding: '10px 12px',
            backgroundColor: isDark
                ? (accent ? colors.bgAlt : colors.bgModal)
                : (accent ? '#f8fafc' : 'white'),
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            transition: 'all 0.15s ease',
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.02)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {icon && <span style={{ color: colors.textMuted, display: 'flex', alignItems: 'center' }}>{icon}</span>}
                <span style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontFamily: INTER
                }}>{label}</span>
            </div>
            <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: value ? colors.text : colors.textMuted,
                fontFamily: typeof value === 'number' || (typeof value === 'string' && (value.includes('h') || value.includes('%')))
                    ? MONO
                    : INTER,
                letterSpacing: '-0.01em'
            }}>
                {value || '—'}
            </span>
        </div>
    );

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: Z_INDEX.MODAL_BACKDROP
        }}>
            <div
                ref={modalRef}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: colors.bgModal,
                    borderRadius: '16px',
                    boxShadow: colors.shadowXl,
                    border: `1px solid ${colors.border}`,
                    width: '100%',
                    maxWidth: '520px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: Z_INDEX.MODAL,
                    animation: 'modalSlideIn 0.2s ease-out'
                }}
            >
                {/* Premium Header - Compact with Inter typography */}
                <div style={{
                    padding: '16px 20px',
                    background: isDark ? colors.bgAlt : 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Avatar with Status Ring */}
                        <div style={{ position: 'relative' }}>
                            {resource.headshot ? (
                                <img
                                    src={resource.headshot}
                                    alt={resource.name}
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: `2px solid ${isDark ? colors.border : 'white'}`,
                                        boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)'
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: isDark ? colors.bgModal : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: `2px solid ${isDark ? colors.border : 'white'}`,
                                    boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)'
                                }}>
                                    <svg style={{ width: '22px', height: '22px', color: colors.textMuted }} fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                            {/* Online Status Indicator */}
                            <div style={{
                                position: 'absolute',
                                bottom: '1px',
                                right: '1px',
                                width: '11px',
                                height: '11px',
                                backgroundColor: BRAND.success,
                                borderRadius: '50%',
                                border: `2px solid ${isDark ? colors.bgAlt : 'white'}`
                            }} />
                        </div>
                        <div>
                            <h3 style={{
                                fontSize: '16px',
                                fontWeight: '700',
                                color: colors.text,
                                margin: 0,
                                letterSpacing: '-0.01em',
                                fontFamily: INTER
                            }}>{resource.name}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
                                <span style={{
                                    fontSize: '12px',
                                    color: colors.textSecondary,
                                    fontWeight: '500',
                                    fontFamily: INTER
                                }}>{resource.role || 'Unknown Role'}</span>
                                {resource.company && (
                                    <>
                                        <span style={{ color: colors.textMuted }}>•</span>
                                        <span style={{ fontSize: '11px', color: colors.textMuted, fontFamily: INTER }}>{resource.company}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        style={{
                            padding: '6px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: colors.textMuted,
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.target.style.backgroundColor = isDark ? colors.bgModal : '#f1f5f9'; e.target.style.color = colors.textSecondary; }}
                        onMouseLeave={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = colors.textMuted; }}
                    >
                        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content - Compact Field Grid */}
                <div style={{ padding: '16px 20px', backgroundColor: colors.bgAlt }}>
                    {/* Info Fields Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '8px',
                        marginBottom: '16px'
                    }}>
                        <FieldCard label="Country" value={resource.country} icon={ICONS.globe} />
                        <FieldCard label="AD Job Title" value={resource.adJobTitle} icon={ICONS.briefcase} />
                        <FieldCard label="Weekly Hours" value={weeklyHours ? `${weeklyHours.toFixed(1)}h` : null} icon={ICONS.clock} accent />
                        <FieldCard label="Target Utilization" value={formattedUtil !== null && formattedUtil !== undefined ? `${Math.round(formattedUtil)}%` : null} icon={ICONS.chart} accent />
                        {/* Annual Capacity (Presence Mode) — only shown when ANNUAL_UTILIZATION is mapped + populated */}
                        {resource.annualCapacity != null && (
                            <FieldCard
                                label="Annual Capacity"
                                value={`${Math.round(resource.annualCapacity).toLocaleString()}h${resource.annualUtilization != null ? ` (${Math.round(resource.annualUtilization * 100)}%)` : ''}`}
                                icon={ICONS.chart}
                                accent
                            />
                        )}
                        <FieldCard label="Start Date" value={formatDate(resource.startDate)} icon={ICONS.calendar} />
                        <FieldCard label="Leave Date" value={formatDate(resource.leaveDate)} icon={ICONS.logout} />
                        {/* Temporary leave range — surfaces whether the range fields are mapped + populated */}
                        <FieldCard label="Leave Start" value={formatDate(resource.leaveStartDate)} icon={ICONS.calendar} />
                        <FieldCard label="Leave End" value={formatDate(resource.leaveEndDate)} icon={ICONS.calendar} />
                    </div>

                    {/* Ramp Up Section - Compact Style */}
                    <div style={{
                        backgroundColor: isDark ? colors.bgModal : 'white',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '10px',
                        padding: '12px',
                        boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '10px',
                            paddingBottom: '10px',
                            borderBottom: `1px solid ${isDark ? colors.border : '#f1f5f9'}`
                        }}>
                            <span style={{ color: colors.textSecondary, display: 'flex', alignItems: 'center' }}>
                                <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </span>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: colors.textSecondary,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                fontFamily: INTER
                            }}>Ramp Up Configuration</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: colors.textMuted,
                                    marginBottom: '4px',
                                    fontFamily: INTER
                                }}>Profile</label>
                                <select
                                    value={editForm.rampProfile}
                                    onChange={e => setEditForm({ ...editForm, rampProfile: e.target.value })}
                                    onMouseDown={e => e.stopPropagation()}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '6px',
                                        backgroundColor: isDark ? colors.bgAlt : 'white',
                                        color: colors.text,
                                        cursor: 'pointer',
                                        outline: 'none',
                                        transition: 'border-color 0.15s ease',
                                        fontFamily: INTER
                                    }}
                                >
                                    <option value="">None</option>
                                    {rampProfiles.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {editForm.rampProfile && (
                                <div style={{ animation: 'fadeIn 0.2s ease' }}>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '10px',
                                        fontWeight: '600',
                                        color: colors.textMuted,
                                        marginBottom: '4px',
                                        fontFamily: INTER
                                    }}>Start Date</label>
                                    <input
                                        type="date"
                                        value={editForm.rampStartDate}
                                        onChange={e => setEditForm({ ...editForm, rampStartDate: e.target.value })}
                                        onMouseDown={e => e.stopPropagation()}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: '6px',
                                            backgroundColor: isDark ? colors.bgAlt : 'white',
                                            color: colors.text,
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            fontFamily: INTER
                                        }}
                                    />
                                    <p style={{
                                        fontSize: '10px',
                                        color: colors.textMuted,
                                        marginTop: '4px',
                                        lineHeight: '1.4',
                                        fontFamily: INTER
                                    }}>
                                        Defaults to resource start date if not set.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Compact Footer */}
                <div style={{
                    padding: '12px 20px',
                    borderTop: `1px solid ${colors.border}`,
                    backgroundColor: colors.bgModal,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: isDark ? colors.bgAlt : 'white',
                            border: `1px solid ${colors.border}`,
                            color: colors.textSecondary,
                            fontSize: '13px',
                            fontWeight: '600',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            fontFamily: INTER
                        }}
                        onMouseEnter={e => e.target.style.backgroundColor = isDark ? colors.bgModal : '#f8fafc'}
                        onMouseLeave={e => e.target.style.backgroundColor = isDark ? colors.bgAlt : 'white'}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            padding: '8px 18px',
                            background: `linear-gradient(135deg, ${BRAND.benifexPurple} 0%, ${BRAND.primary} 100%)`,
                            color: 'white',
                            fontSize: '13px',
                            fontWeight: '600',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            opacity: isSaving ? 0.7 : 1,
                            boxShadow: `0 2px 6px ${BRAND.benifexPurple}40`,
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontFamily: INTER
                        }}
                    >
                        {isSaving && (
                            <svg style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResourceProfileModal;

ResourceProfileModal.propTypes = {
    resource: PropTypes.object.isRequired,
    rampProfiles: PropTypes.array,
    onClose: PropTypes.func.isRequired,
    onUpdate: PropTypes.func,
    addToast: PropTypes.func
};
