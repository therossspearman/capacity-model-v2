/**
 * Detail Modal Component (V1 Parity)
 * Shows project details, sparkline budget performance, and team manager
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';
import { ICONS } from '../../constants';
import { getStatusColor, formatNumber, getCategoryForFunction } from '../../utils';

// Allowed statuses for inline editing (must match Airtable exactly)
const ALLOWED_STATUSES = ['Draft', 'Pipeline - Best', 'Pipeline - Commit', 'Contracted', 'Onboarding', 'In Flight', 'In Hypercare', 'Closed', 'Cancelled', 'On hold'];

// Helper to format dates to yyyy-MM-dd for HTML date inputs
const formatDateForInput = (dateValue) => {
    if (!dateValue) return '';
    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return '';
        // Return ISO date string in yyyy-MM-dd format
        return date.toISOString().split('T')[0];
    } catch {
        return '';
    }
};

// SVG Calendar Icon component
const CalendarIcon = ({ color = '#cbd5e1', size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

// Buffered Input for Allocation Percentage to prevent optimistic update loop interruption
const BufferedAllocationInput = ({ value, effectivePct, onUpdate }) => {
    const [localValue, setLocalValue] = useState(value || '');

    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    const handleBlur = () => {
        if (localValue !== value) {
            onUpdate(localValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: '8px' }}>
            <input
                type="number"
                min="0"
                max="100"
                value={localValue}
                placeholder={effectivePct}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    width: '40px',
                    padding: '3px 4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textAlign: 'center',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    backgroundColor: value ? '#f0fdf4' : 'white',
                    color: value ? '#00BD00' : '#64748b',
                    outline: 'none'
                }}
            />
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>%</span>
        </div>
    );
};

// Team Manager component for assigning/unassigning resources by role
// Now with percentage allocation support
const TeamManager = ({ role, label, color, hours, currentTeam, allResources, onAssign, onUnassign, onUpdateAllocation, onCopyToOtherRoles, onCopyToAllRoles, roleMapping, projectSquad, projectDates, onUpdateMemberDates }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [showCopyMenu, setShowCopyMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDateMember, setExpandedDateMember] = useState(null); // Track which member has date picker open
    const searchInputRef = useRef(null);

    // Handler for updating member dates
    const handleMemberDateChange = (memberId, field, value) => {
        if (onUpdateMemberDates) {
            onUpdateMemberDates(role, memberId, field, value);
        }
    };

    // Check if roleMapping has any actual mappings configured
    const hasRoleMapping = roleMapping && Object.keys(roleMapping).length > 0 &&
        Object.values(roleMapping).some(v => v && (Array.isArray(v) ? v.length > 0 : true));

    // Calculate total allocation percentage
    const totalAllocation = (currentTeam || []).reduce((sum, m) => sum + (m.allocationPct || 0), 0);
    const membersWithAlloc = (currentTeam || []).filter(m => m.allocationPct > 0).length;
    const membersWithoutAlloc = (currentTeam || []).length - membersWithAlloc;
    const isOverAllocated = totalAllocation > 100;
    const remainingPct = 100 - totalAllocation;

    // Filter resources - show all but flag role matches for prioritization
    const targetCategory = role === 'pm' ? 'PM' : (role === 'sc' ? 'SC' : 'PD');

    let availableResources = (allResources || []).filter(r => {
        // Exclude already assigned
        const safeTeam = Array.isArray(currentTeam) ? currentTeam : [];
        if (safeTeam.some(m => m.id === r.id)) return false;

        // Exclude resources without a squad
        const rSquads = r.squads || [];
        if (rSquads.length === 0 || rSquads.every(s => !s || s === 'Unassigned')) return false;

        return true; // Show ALL resources, not filtered by role
    }).map(r => {
        // Mark whether this resource matches the target role for prioritization
        const cat = getCategoryForFunction(r.adJobTitle || r.role, roleMapping);
        const matchesRole = hasRoleMapping && cat && cat.toUpperCase() === targetCategory;
        return { ...r, matchesRole };
    });

    // Group resources by squad, with role-matching and project's squad prioritized
    const groupedResources = useMemo(() => {
        const groups = {};
        const projectSquadName = projectSquad || 'Unassigned';

        // Separate role-matching resources for "Recommended" group
        const recommended = availableResources.filter(r => r.matchesRole);
        const others = availableResources.filter(r => !r.matchesRole);

        // Add recommended group if there are matching resources
        if (recommended.length > 0) {
            groups['★ Recommended (' + targetCategory + ')'] = recommended.sort((a, b) => a.name.localeCompare(b.name));
        }

        // Group remaining by squad
        others.forEach(r => {
            const squadName = (r.squads && r.squads[0]) || 'Unassigned';
            if (!groups[squadName]) groups[squadName] = [];
            groups[squadName].push(r);
        });

        // Sort each group alphabetically
        Object.values(groups).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));

        // Order: Recommended first, then project squad, then others alphabetically
        const orderedKeys = Object.keys(groups).sort((a, b) => {
            if (a.startsWith('★ Recommended')) return -1;
            if (b.startsWith('★ Recommended')) return 1;
            if (a === projectSquadName) return -1;
            if (b === projectSquadName) return 1;
            return a.localeCompare(b);
        });

        return orderedKeys.map(key => ({ squad: key, resources: groups[key], isProjectSquad: key === projectSquadName, isRecommended: key.startsWith('★ Recommended') }));
    }, [availableResources, projectSquad, targetCategory]);

    const handleSelectClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
    };

    const handleAllocationChange = (memberId, value) => {
        // Parse and clamp value
        let pct = parseInt(value, 10);
        if (isNaN(pct)) pct = 0;
        pct = Math.max(0, Math.min(100, pct));
        if (onUpdateAllocation) {
            onUpdateAllocation(role, memberId, pct);
        }
    };

    const otherRoles = ['pm', 'sc', 'pd'].filter(r => r !== role);

    return (
        <div
            style={{
                backgroundColor: 'white',
                border: `1px solid ${isOverAllocated ? '#f87171' : BRAND.border}`,
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}
            onClick={e => e.stopPropagation()}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color === 'bg-purple-500' ? '#FF8EFB' : color === 'bg-blue-500' ? '#4794FF' : '#ec4899' }}></span>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>{label}</span>
                {hours !== undefined && hours > 0 && (
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: '10px',
                        fontWeight: '700',
                        color: '#082F24',
                        backgroundColor: '#F5EDE1',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid #bbf7d0'
                    }}>
                        {Math.round(hours)}h
                    </span>
                )}
                {/* Copy to other roles button */}
                {(currentTeam || []).length > 0 && onCopyToOtherRoles && (
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowCopyMenu(!showCopyMenu); }}
                            style={{
                                padding: '2px 6px',
                                fontSize: '9px',
                                fontWeight: '600',
                                color: '#64748b',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                            }}
                            title="Copy team to other roles"
                        >
                            <svg style={{ width: '10px', height: '10px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                        </button>
                        {showCopyMenu && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                zIndex: 100,
                                minWidth: '100px'
                            }}>
                                {/* Copy to All option */}
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        // Use atomic copy-to-all function for single Airtable write
                                        if (onCopyToAllRoles) {
                                            await onCopyToAllRoles(role);
                                        } else {
                                            // Fallback to serialized copies
                                            for (const targetRole of otherRoles) {
                                                await onCopyToOtherRoles(role, targetRole);
                                            }
                                        }
                                        setShowCopyMenu(false);
                                    }}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '8px 12px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        color: '#082F24',
                                        backgroundColor: '#F5EDE1',
                                        border: 'none',
                                        borderBottom: '1px solid #e2e8f0',
                                        textAlign: 'left',
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => e.target.style.backgroundColor = '#E8E1D9'}
                                    onMouseLeave={(e) => e.target.style.backgroundColor = '#F5EDE1'}
                                >
                                    Copy to All
                                </button>
                                {otherRoles.map(targetRole => (
                                    <button
                                        key={targetRole}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCopyToOtherRoles(role, targetRole);
                                            setShowCopyMenu(false);
                                        }}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            padding: '8px 12px',
                                            fontSize: '11px',
                                            fontWeight: '500',
                                            color: '#1e293b',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            textAlign: 'left',
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                    >
                                        Copy to {targetRole.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Allocation Summary */}
            {(currentTeam || []).length > 1 && (
                <div style={{
                    fontSize: '9px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: isOverAllocated ? '#fef2f2' : (totalAllocation > 0 ? '#f0fdf4' : '#f8fafc'),
                    color: isOverAllocated ? '#dc2626' : (totalAllocation > 0 ? '#00BD00' : '#64748b'),
                    display: 'flex',
                    justifyContent: 'space-between'
                }}>
                    <span>Total: {totalAllocation || 'Even split'}%</span>
                    {isOverAllocated && <span>⚠ Over 100%</span>}
                    {!isOverAllocated && remainingPct > 0 && membersWithoutAlloc > 0 && (
                        <span style={{ color: '#64748b' }}>{remainingPct}% unassigned → split to {membersWithoutAlloc}</span>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', flexGrow: 1 }}>
                {(currentTeam || []).map(member => {
                    // Look up full resource to get headshot
                    const fullResource = allResources?.find(r => r.id === member.id);
                    const headshot = member.isPlaceholder ? null : (fullResource?.headshot || member.headshot);
                    const initials = member.isPlaceholder ? '?' : (member.name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                    // Calculate effective percentage for display
                    const effectivePct = member.allocationPct ||
                        (membersWithAlloc === 0 ? Math.round(100 / (currentTeam || []).length) : Math.round(remainingPct / membersWithoutAlloc));

                    const hasCustomDates = member.startDate || member.endDate;
                    const isDateExpanded = expandedDateMember === member.id;

                    return (
                        <div key={member.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: member.isPlaceholder ? '#f0fdf4' : BRAND.bgAlt,
                                border: member.isPlaceholder ? '1px dashed #c084fc' : `1px solid ${BRAND.border}`,
                                padding: '6px 8px',
                                borderRadius: isDateExpanded ? '10px 10px 0 0' : '10px',
                                fontSize: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                    {/* Profile Image or Placeholder Icon */}
                                    {headshot ? (
                                        <img
                                            src={headshot}
                                            alt={member.name}
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                border: '1px solid #e2e8f0',
                                                flexShrink: 0
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            backgroundColor: member.isPlaceholder ? '#dcfce7' : (color === 'bg-purple-500' ? '#dcfce7' : color === 'bg-blue-500' ? '#dbeafe' : '#fce7f3'),
                                            color: member.isPlaceholder ? '#082F24' : (color === 'bg-purple-500' ? '#082F24' : color === 'bg-blue-500' ? '#2563eb' : '#db2777'),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: member.isPlaceholder ? '12px' : '9px',
                                            fontWeight: '700',
                                            flexShrink: 0
                                        }}>
                                            {initials}
                                        </div>
                                    )}
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <span
                                            title={member.name}
                                            style={{
                                                fontWeight: '600',
                                                color: member.isPlaceholder ? '#082F24' : BRAND.dark,
                                                maxWidth: '80px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                display: 'block',
                                                fontStyle: member.isPlaceholder ? 'italic' : 'normal',
                                                cursor: 'help'
                                            }}>{member.name}</span>
                                        {fullResource?.squads?.[0] && (
                                            <span style={{
                                                fontSize: '9px',
                                                color: '#94a3b8',
                                                fontWeight: '500',
                                                display: 'block',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: '80px',
                                                lineHeight: '1.2'
                                            }}>{fullResource.squads[0]}</span>
                                        )}
                                    </div>
                                </div>
                                {/* Allocation Percentage Input */}
                                {(currentTeam || []).length > 1 && (
                                    <BufferedAllocationInput
                                        value={member.allocationPct}
                                        effectivePct={effectivePct}
                                        onUpdate={(val) => handleAllocationChange(member.id, val)}
                                    />
                                )}
                                {/* Date Range Toggle Icon */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedDateMember(isDateExpanded ? null : member.id);
                                    }}
                                    title={hasCustomDates ? 'Edit date range' : 'Add date range'}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        fontSize: '12px',
                                        color: hasCustomDates ? '#082F24' : '#cbd5e1',
                                        transition: 'color 0.2s'
                                    }}
                                >
                                    <CalendarIcon color={hasCustomDates ? '#082F24' : '#cbd5e1'} size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onUnassign(member.id); }} style={{ color: '#cbd5e1', cursor: 'pointer', border: 'none', background: 'none', padding: '2px' }}>✕</button>
                            </div>
                            {/* Date Range Popup */}
                            {isDateExpanded && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '4px',
                                        padding: '12px',
                                        backgroundColor: 'white',
                                        borderRadius: '10px',
                                        border: `1px solid ${BRAND.border}`,
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                        zIndex: 1000,
                                        minWidth: '200px'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div style={{
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        marginBottom: '10px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span>Allocation Period</span>
                                        <button
                                            onClick={() => setExpandedDateMember(null)}
                                            style={{
                                                border: 'none',
                                                background: 'none',
                                                cursor: 'pointer',
                                                color: '#94a3b8',
                                                fontSize: '14px',
                                                padding: 0,
                                                lineHeight: 1
                                            }}
                                        >×</button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div>
                                            <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>From</label>
                                            <input
                                                type="date"
                                                value={formatDateForInput(member.startDate) || formatDateForInput(projectDates?.start) || ''}
                                                onChange={(e) => handleMemberDateChange(member.id, 'startDate', e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 10px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e2e8f0',
                                                    fontSize: '12px',
                                                    color: member.startDate ? '#1e293b' : '#94a3b8'
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>To</label>
                                            <input
                                                type="date"
                                                value={formatDateForInput(member.endDate) || formatDateForInput(projectDates?.end) || ''}
                                                onChange={(e) => handleMemberDateChange(member.id, 'endDate', e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 10px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e2e8f0',
                                                    fontSize: '12px',
                                                    color: member.endDate ? '#1e293b' : '#94a3b8'
                                                }}
                                            />
                                        </div>
                                    </div>
                                    {hasCustomDates && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleMemberDateChange(member.id, 'startDate', null);
                                                handleMemberDateChange(member.id, 'endDate', null);
                                                setExpandedDateMember(null);
                                            }}
                                            style={{
                                                marginTop: '10px',
                                                width: '100%',
                                                padding: '6px 10px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                backgroundColor: '#fee2e2',
                                                color: '#dc2626',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Reset to Project Dates
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {(currentTeam || []).length === 0 && <div style={{ fontSize: '10px', color: '#cbd5e1', fontStyle: 'italic', padding: '4px 0' }}>Unassigned</div>}
            </div>
            {
                isAdding ? (
                    <div style={{
                        position: 'relative',
                        marginTop: '4px'
                    }}>
                        {/* Search input */}
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search resources..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                fontSize: '11px',
                                border: '2px solid #082F24',
                                borderRadius: '8px 8px 0 0',
                                backgroundColor: 'white',
                                outline: 'none'
                            }}
                            onBlur={() => setTimeout(() => setIsAdding(false), 200)}
                        />
                        {/* Custom dropdown list */}
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'white',
                            border: '2px solid #082F24',
                            borderTop: 'none',
                            borderRadius: '0 0 8px 8px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 200,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}>
                            {/* Add Placeholder Option - always visible at top */}
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Generate unique placeholder ID
                                    const placeholderId = `PLACEHOLDER_${Date.now()}`;
                                    const placeholderName = `TBD ${label}`;
                                    // Call onAssign with isPlaceholder flag
                                    onAssign(placeholderId, role, { isPlaceholder: true, name: placeholderName });
                                    setIsAdding(false);
                                    setSearchQuery('');
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{
                                    padding: '10px 10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: '#082F24',
                                    backgroundColor: '#f0fdf4',
                                    borderBottom: '2px solid #e2e8f0',
                                    transition: 'background-color 0.1s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                            >
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    backgroundColor: '#dcfce7',
                                    color: '#082F24',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    fontWeight: '700'
                                }}>?</div>
                                <span>➕ Add Placeholder (TBD)</span>
                            </div>
                            {groupedResources.filter(g =>
                                g.resources.some(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            ).map(group => (
                                <div key={group.squad}>
                                    <div style={{
                                        padding: '6px 10px',
                                        fontSize: '9px',
                                        fontWeight: '700',
                                        color: group.isRecommended ? '#082F24' : '#64748b',
                                        backgroundColor: group.isRecommended ? '#F5EDE1' : '#f8fafc',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        borderTop: '1px solid #e2e8f0'
                                    }}>
                                        {group.squad}
                                    </div>
                                    {group.resources
                                        .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map(r => {
                                            const headshot = r.headshot?.[0]?.url || r.headshot?.[0]?.thumbnails?.small?.url;
                                            const initials = (r.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2);
                                            // Calculate/display utilization
                                            const util = r.avgUtilization ?? r.utilization ?? null;
                                            const utilPct = util !== null ? Math.round(util * 100) : null;
                                            const isOverloaded = utilPct !== null && utilPct > 100;
                                            const isAvailable = utilPct !== null && utilPct < 80;
                                            return (
                                                <div
                                                    key={r.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAssign(r.id, role);
                                                        setIsAdding(false);
                                                        setSearchQuery('');
                                                    }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    style={{
                                                        padding: '8px 10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        cursor: 'pointer',
                                                        fontSize: '11px',
                                                        color: '#334155',
                                                        backgroundColor: 'white',
                                                        transition: 'background-color 0.1s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                                >
                                                    {headshot ? (
                                                        <img
                                                            src={headshot}
                                                            alt={r.name}
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '50%',
                                                                objectFit: 'cover',
                                                                border: '1px solid #e2e8f0'
                                                            }}
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#f1f5f9',
                                                            color: '#64748b',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '8px',
                                                            fontWeight: '700'
                                                        }}>
                                                            {initials}
                                                        </div>
                                                    )}
                                                    <span style={{ fontWeight: '500', flex: 1 }}>{r.name}</span>
                                                    {/* Utilization Indicator */}
                                                    {utilPct !== null && (
                                                        <span
                                                            title={`${utilPct}% utilized`}
                                                            style={{
                                                                fontSize: '9px',
                                                                fontWeight: '600',
                                                                padding: '2px 5px',
                                                                borderRadius: '4px',
                                                                backgroundColor: isOverloaded ? '#fef2f2' : isAvailable ? '#f0fdf4' : '#fefce8',
                                                                color: isOverloaded ? '#dc2626' : isAvailable ? '#00BD00' : '#ca8a04',
                                                                border: `1px solid ${isOverloaded ? '#fecaca' : isAvailable ? '#bbf7d0' : '#fde68a'}`
                                                            }}
                                                        >
                                                            {utilPct}%
                                                        </span>
                                                    )}
                                                    {r.matchesRole && (
                                                        <span style={{
                                                            fontSize: '8px',
                                                            fontWeight: '600',
                                                            color: '#082F24',
                                                            backgroundColor: '#F5EDE1',
                                                            padding: '2px 4px',
                                                            borderRadius: '3px'
                                                        }}>
                                                            {targetCategory}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            ))}
                            {groupedResources.filter(g =>
                                g.resources.some(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            ).length === 0 && (
                                    <div style={{ padding: '12px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                                        No resources found
                                    </div>
                                )}
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsAdding(true)}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                            marginTop: 'auto',
                            width: '100%',
                            padding: '6px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: '#94a3b8',
                            border: '1px dashed #cbd5e1',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                        }}
                    >
                        <span>+</span> Add
                    </button>
                )
            }
        </div >
    );
};

// Custom debounce hook
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
};

const DetailModal = ({ data, allResources, allProjects, allSquadsFlat, programAssignments = [], programWorkstreams = [], programBudgets = {}, programDates = {}, onAssign, onUnassign, onUpdateAllocation, onCopyToOtherRoles, onCopyToAllRoles, onUpdateProject, onUpdateResource, rampProfiles, onClose, roleMapping, addToast, onNavigate, onClone, onManageProgram, modelParams = {} }) => {
    // Guard before any hooks so the Rules of Hooks aren't violated when `data`
    // is absent (all hooks must run on every render that reaches them).
    if (!data) return null;
    const { isDark, colors } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);
    const modalRef = useRef(null);
    const [resourceName, dateKeyRaw] = (data.dateKey && data.dateKey.includes(' - ')) ? data.dateKey.split(' - ') : [data.dateKey || '', ''];
    const isUnassignedRow = resourceName && resourceName.toLowerCase().includes("unassigned");
    const showTeamManager = isUnassignedRow || !!onAssign;

    // Filters State
    const [filterCustomer, setFilterCustomer] = useState('');
    const [filterWave, setFilterWave] = useState('');
    const [filterSquad, setFilterSquad] = useState('');
    const [filterRole, setFilterRole] = useState('');

    // Write-Back State
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Keyboard Navigation Handler
    useEffect(() => {
        if (!onNavigate) return;

        const handleKeyDown = (event) => {
            // Don't navigate if user is typing in an input
            const activeEl = document.activeElement;
            if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) return;

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                onNavigate('prev');
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                onNavigate('next');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onNavigate]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Ignore clicks on select elements, option dropdowns, and any interactive form elements
            const tagName = event.target.tagName.toUpperCase();
            if (['SELECT', 'OPTION', 'OPTGROUP', 'INPUT', 'BUTTON', 'LABEL'].includes(tagName)) return;

            // Also check for parent elements that might be part of the form
            if (event.target.closest('select, input, button, [role="listbox"]')) return;

            // Ignore clicks inside modal
            if (modalRef.current && !modalRef.current.contains(event.target)) onClose();
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const handleEditClick = (item) => {
        setEditingId(item.projectId || item.id);
        const sDate = item.startDate ? new Date(item.startDate) : null;
        const eDate = item.endDate ? new Date(item.endDate) : null;
        setEditForm({
            status: item.status || 'Active',
            start: sDate ? sDate.toISOString().split('T')[0] : '',
            end: eDate ? eDate.toISOString().split('T')[0] : '',
            squad: (item.squads && item.squads.length > 0) ? item.squads[0] : '',
            effortProfile: item.effortProfile || '',
            resourcingOverride: item.resourcingOverride ?? '', // Use ?? to preserve 0 values
            transactionalBenefits: item.transactionalBenefits ?? '',
            nonTransactionalBenefits: item.nonTransactionalBenefits ?? '',
            contentOnlyBenefits: item.contentOnlyBenefits ?? '',
            lockLaunch: item.lockLaunch || false,
            lockSquad: item.lockSquad || false,
            lockResources: item.lockResources || false,
            resourcedWithinProgram: item.resourcedWithinProgram || false,
            wave: item.wave || '',
            resourcingNotes: item.resourcingNotes || '',
            resourced: item.resourced || false
        });
    };

    const handleSaveEdit = async () => {
        if (!onUpdateProject || !editingId) return;
        await onUpdateProject(editingId, editForm);
        setEditingId(null);
    };

    // Derive Unique Options
    const allItems = data.details || [];
    const uniqueCustomers = [...new Set(allItems.map(i => i.customer).filter(Boolean))].sort();
    const uniqueWaves = [...new Set(allItems.map(i => i.wave).filter(Boolean))].sort();
    const uniqueSquads = [...new Set(allItems.flatMap(i => i.squads || [i.squad]).filter(Boolean))].sort();

    let rawDetails = allItems.filter(item => {
        // Search
        if (debouncedSearch) {
            const lower = debouncedSearch.toLowerCase();
            const matches = (item.name && item.name.toLowerCase().includes(lower)) ||
                (item.status && item.status.toLowerCase().includes(lower));
            if (!matches) return false;
        }

        // Filters
        if (filterCustomer && item.customer !== filterCustomer) return false;
        if (filterWave && item.wave !== filterWave) return false;
        if (filterSquad) {
            const rawSquads = item.squads || [item.squad];
            const itemSquads = Array.isArray(rawSquads) ? rawSquads : [rawSquads];
            if (!(itemSquads || []).some(s => s === filterSquad)) return false;
        }
        if (filterRole) {
            // 'breakdownCategory' (pm/sc/pd) is supplied by the worker on per-role
            // demand/unassigned rows. When present, only keep rows for the selected
            // role. Rows without a breakdownCategory (e.g. assigned-project rows that
            // carry no role split) are left untouched so the filter never hides them.
            if (item.breakdownCategory && item.breakdownCategory.toUpperCase() !== filterRole) {
                return false;
            }
        }

        return true;
    });


    const aggregated = rawDetails.reduce((acc, item) => {
        const name = item.name || 'Unknown Project';
        // Group by the UNIQUE project id, NOT the display name. Multiple distinct
        // projects can share the same name (e.g. several "Anthropic TBC" records);
        // keying by name collapses them into one entry and surfaces the wrong
        // project's dates/budget. Fall back to name only for items with no id
        // (programs, ad-hoc rows).
        const key = item.projectId || item.id || name;
        if (!acc[key]) acc[key] = { ...item, name: name, hours: 0, totalNeeded: 0, assigned: 0, coverageStatus: item.coverageStatus || 'unassigned', roleBreakdown: {}, projectId: item.projectId || item.id, team: item.team || { pm: [], sc: [], pd: [] } };
        const h = Number(item.hours) || 0;
        acc[key].hours += h;
        if (item.totalNeeded) acc[key].totalNeeded += item.totalNeeded;
        if (item.assigned) acc[key].assigned += item.assigned;
        if (item.pctComplete !== undefined) acc[key].pctComplete = item.pctComplete;
        if (item.wave) acc[key].wave = item.wave;
        if (item.effortProfile) acc[key].effortProfile = item.effortProfile;
        if (item.coverageStatus === 'partial') acc[key].coverageStatus = 'partial';
        if (item.breakdownCategory) {
            const role = item.breakdownCategory.toUpperCase();
            acc[key].roleBreakdown[role] = (acc[key].roleBreakdown[role] || 0) + h;
        }
        return acc;
    }, {});

    // Enrich aggregated data with latest project info from allProjects (supports optimistic updates)
    const enrichedAggregated = Object.entries(aggregated).reduce((acc, [key, item]) => {
        // Resolve the live project by its UNIQUE id. Only fall back to a name match
        // when the item has no id — never OR the two together, because find() would
        // then return the first record whose *name* matches (and many projects share
        // the name "… TBC"), pulling in the wrong project's dates/budget.
        const latestProject = item.projectId
            ? allProjects?.find(p => p.id === item.projectId)
            : allProjects?.find(p => p.name === item.name);
        if (latestProject) {
            // Merge latest project data, prioritizing allProjects for dates/status/squad
            acc[key] = {
                ...item,
                status: latestProject.status || item.status,
                squads: latestProject.squads || item.squads,
                startDate: latestProject.kickOff || latestProject.start || item.startDate,
                endDate: latestProject.launch || latestProject.end || item.endDate,
                effortProfile: latestProject.effortProfile || item.effortProfile,
                resourcingOverride: latestProject.resourcingOverride ?? item.resourcingOverride,
                transactionalBenefits: latestProject.transactionalBenefits ?? item.transactionalBenefits,
                nonTransactionalBenefits: latestProject.nonTransactionalBenefits ?? item.nonTransactionalBenefits,
                contentOnlyBenefits: latestProject.contentOnlyBenefits ?? item.contentOnlyBenefits,
                team: latestProject.team || item.team,
                lockLaunch: latestProject.lockLaunch !== undefined ? latestProject.lockLaunch : item.lockLaunch,
                lockSquad: latestProject.lockSquad !== undefined ? latestProject.lockSquad : item.lockSquad,
                lockResources: latestProject.lockResources !== undefined ? latestProject.lockResources : item.lockResources,
                platform: latestProject.platform || item.platform,
                resourcingNotes: latestProject.resourcingNotes || item.resourcingNotes || '',
                resourced: latestProject.resourced !== undefined ? latestProject.resourced : (item.resourced || false)
            };
        } else {
            acc[key] = item;
        }
        return acc;
    }, {});

    const relevantDetails = Object.values(enrichedAggregated).sort((a, b) => b.hours - a.hours);
    const totalWeekHours = relevantDetails.filter(item => !item.isProgram).reduce((sum, item) => sum + item.hours, 0);
    const isSingleProject = relevantDetails.length === 1;
    const singleProject = isSingleProject ? relevantDetails[0] : null;

    // Find program workstream assignments for this resource
    const resourceProgramAssignments = useMemo(() => {
        if (!resourceName || isUnassignedRow) return [];
        // Find resource by name
        const resource = allResources?.find(r => r.name === resourceName);
        if (!resource) return [];
        // Filter assignments for this resource
        return (programAssignments || []).filter(a => a.resourceId === resource.id);
    }, [resourceName, isUnassignedRow, allResources, programAssignments]);

    // Calculate program workstream hours for header total (same logic as render display)
    const programWorkstreamHoursForTotal = useMemo(() => {
        if (!resourceProgramAssignments.length) return 0;

        // Group by customer and sum
        const assignmentsByCustomer = resourceProgramAssignments.reduce((acc, a) => {
            const customer = a.customer || 'Global Program';
            if (!acc[customer]) acc[customer] = [];
            acc[customer].push(a);
            return acc;
        }, {});

        let totalProgramHours = 0;

        Object.entries(assignmentsByCustomer).forEach(([customer, assignments]) => {
            const customerProgram = programBudgets?.[customer];
            const customerWorkstreams = customerProgram?.workstreams || programWorkstreams || [];

            // Get customer-specific duration
            let customerDurationWeeks = 52;
            if (customerProgram?.start && customerProgram?.end) {
                const start = new Date(customerProgram.start);
                const end = new Date(customerProgram.end);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                    customerDurationWeeks = Math.max(1, Math.abs(end - start) / (1000 * 60 * 60 * 24 * 7));
                }
            } else if (programDates?.start && programDates?.end) {
                const start = new Date(programDates.start);
                const end = new Date(programDates.end);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                    customerDurationWeeks = Math.max(1, Math.abs(end - start) / (1000 * 60 * 60 * 24 * 7));
                }
            }

            // Sum weekly hours for each assignment
            const customerWeeklyHours = assignments.reduce((sum, assignment) => {
                const ws = customerWorkstreams?.find(w => w.name === assignment.workstream);
                const wsHours = ws?.hours || 0;
                const assignmentPct = assignment.allocationPct || 100;

                // Check if assignment is active for selected date
                const assignmentStart = assignment.startDate ? new Date(assignment.startDate) : null;
                const assignmentEnd = assignment.endDate ? new Date(assignment.endDate) : null;

                const selectedDatePart = dateKeyRaw ? dateKeyRaw.trim() : '';
                let selectedDate = new Date();
                if (selectedDatePart) {
                    const yearGuess = new Date().getFullYear();
                    const parsed = new Date(`${selectedDatePart} ${yearGuess}`);
                    if (!isNaN(parsed.getTime())) selectedDate = parsed;
                }

                const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                const weekStart = new Date(selectedDate);
                const weekEnd = new Date(selectedDate.getTime() + oneWeekMs);

                let isActive = true;
                if (assignmentStart && assignmentEnd) {
                    isActive = weekEnd >= assignmentStart && weekStart <= assignmentEnd;
                } else if (assignmentStart) {
                    isActive = weekEnd >= assignmentStart;
                } else if (assignmentEnd) {
                    isActive = weekStart <= assignmentEnd;
                }

                if (!isActive) return sum;

                let assignmentDurationWeeks = customerDurationWeeks;
                if (assignmentStart && assignmentEnd && assignmentEnd > assignmentStart) {
                    assignmentDurationWeeks = Math.max(1, (assignmentEnd - assignmentStart) / (1000 * 60 * 60 * 24 * 7));
                }

                const weekly = wsHours > 0 ? (wsHours * (assignmentPct / 100)) / assignmentDurationWeeks : 0;
                return sum + weekly;
            }, 0);

            totalProgramHours += customerWeeklyHours;
        });

        return totalProgramHours;
    }, [resourceProgramAssignments, programBudgets, programWorkstreams, programDates, dateKeyRaw]);

    // Combine project hours + program workstream hours for header total
    const combinedTotalWeekHours = totalWeekHours + programWorkstreamHoursForTotal;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(8, 47, 36, 0.4)', // Indigo tinted backdrop
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: Z_INDEX.MODAL_BACKDROP
        }}>
            <div ref={modalRef} onMouseDown={(e) => e.stopPropagation()} style={{
                backgroundColor: colors.bgModal,
                borderRadius: '20px', // Large Block Rule
                boxShadow: colors.shadowXl,
                width: '100%',
                maxWidth: '800px',
                height: '95vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: Z_INDEX.MODAL,
                border: `1px solid ${colors.border}`
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '24px 32px',
                    borderBottom: `1px solid ${BRAND.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    backgroundColor: BRAND.oat // Warm Brand Background
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {(() => {
                                // Single project: show country flag
                                if (isSingleProject && singleProject?.countryFlag) {
                                    return <img src={singleProject.countryFlag} alt={singleProject.country || 'Country'} title={singleProject.country} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />;
                                }
                                const foundRes = allResources.find(r => r.name === resourceName);
                                if (isUnassignedRow) return <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${BRAND.border}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}><svg style={{ width: '24px', height: '24px', color: '#FE9922' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>;
                                if (foundRes && foundRes.headshot) return <img src={foundRes.headshot} alt={resourceName} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />;
                                return <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${BRAND.border}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}><svg style={{ width: '24px', height: '24px', color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>;
                            })()}

                            <div>
                                <h3 style={{ fontSize: '24px', fontWeight: '800', color: BRAND.indigo, margin: 0, letterSpacing: '-0.02em' }}>{resourceName}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: BRAND.neutral }}>
                                    <span>{dateKeyRaw}</span>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: BRAND.border }}></span>
                                    <span style={{ fontWeight: '700', color: BRAND.benifexPurple }}>{formatNumber(combinedTotalWeekHours)}h Total Load</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} style={{
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'white',
                            border: `1px solid ${BRAND.border}`,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            color: BRAND.neutral,
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>{ICONS.CLOSE}</button>
                    </div>

                    {/* V1 Parity: Advanced Filters - Hidden for Single Project */}
                    {!isSingleProject && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Search */}
                            <div style={{ position: 'relative', flexGrow: 1, maxWidth: '240px' }}>
                                <input
                                    type="text"
                                    placeholder="Search projects..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '6px 10px 6px 28px',
                                        fontSize: '11px',
                                        border: `1px solid ${BRAND.border}`,
                                        borderRadius: '10px', // Small Block Rule
                                        backgroundColor: 'white',
                                        color: BRAND.indigo
                                    }}
                                />
                                <svg style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>

                            {/* Customer Filter */}
                            <select
                                value={filterCustomer}
                                onChange={(e) => setFilterCustomer(e.target.value)}
                                style={{ padding: '6px', fontSize: '11px', border: `1px solid ${BRAND.border}`, borderRadius: '6px', backgroundColor: 'white', maxWidth: '120px' }}
                            >
                                <option value="">All Customers</option>
                                {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            {/* Wave Filter */}
                            <select
                                value={filterWave}
                                onChange={(e) => setFilterWave(e.target.value)}
                                style={{ padding: '6px', fontSize: '11px', border: `1px solid ${BRAND.border}`, borderRadius: '6px', backgroundColor: 'white', maxWidth: '100px' }}
                            >
                                <option value="">All Waves</option>
                                {uniqueWaves.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>

                            {/* Squad Filter */}
                            <select
                                value={filterSquad}
                                onChange={(e) => setFilterSquad(e.target.value)}
                                style={{ padding: '6px', fontSize: '11px', border: `1px solid ${BRAND.border}`, borderRadius: '6px', backgroundColor: 'white', maxWidth: '120px' }}
                            >
                                <option value="">All Squads</option>
                                {uniqueSquads.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            {/* Role (Breakdown) Filter */}
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                style={{ padding: '6px', fontSize: '11px', border: `1px solid ${BRAND.border}`, borderRadius: '6px', backgroundColor: 'white', maxWidth: '100px' }}
                            >
                                <option value="">All Types</option>
                                <option value="PM">PM Hours</option>
                                <option value="SC">SC Hours</option>
                                <option value="PD">PD Hours</option>
                            </select>

                            {(filterCustomer || filterWave || filterSquad || filterRole || searchTerm) && (
                                <button
                                    onClick={() => {
                                        setFilterCustomer('');
                                        setFilterWave('');
                                        setFilterSquad('');
                                        setFilterRole('');
                                        setSearchTerm('');
                                    }}
                                    style={{ padding: '6px 8px', fontSize: '10px', color: '#E5554F', border: '1px solid #fecaca', borderRadius: '6px', backgroundColor: '#fef2f2', cursor: 'pointer' }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Content - Project list */}
                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    backgroundColor: '#fafafa',
                    flex: '1 1 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    {/* Program Workstream Cards */}
                    {resourceProgramAssignments.length > 0 && (() => {
                        // Group assignments by customer for proper display
                        const assignmentsByCustomer = resourceProgramAssignments.reduce((acc, a) => {
                            const customer = a.customer || 'Global Program';
                            if (!acc[customer]) acc[customer] = [];
                            acc[customer].push(a);
                            return acc;
                        }, {});

                        return Object.entries(assignmentsByCustomer).map(([customer, assignments]) => {
                            // Calculate duration (Program duration)
                            let durationWeeks = 52;
                            if (programDates?.start && programDates?.end) {
                                const start = new Date(programDates.start);
                                const end = new Date(programDates.end);
                                if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                                    const diffTime = Math.abs(end - start);
                                    durationWeeks = Math.max(1, diffTime / (1000 * 60 * 60 * 24 * 7));
                                }
                            }

                            // Calculate total weekly hours for this customer/program
                            // Use per-customer workstream hours from programBudgets instead of global
                            const customerProgram = programBudgets?.[customer];
                            const customerWorkstreams = customerProgram?.workstreams || programWorkstreams || [];

                            // Get per-customer program duration
                            let customerDurationWeeks = 52;
                            if (customerProgram?.start && customerProgram?.end) {
                                const start = new Date(customerProgram.start);
                                const end = new Date(customerProgram.end);
                                if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                                    const diffTime = Math.abs(end - start);
                                    customerDurationWeeks = Math.max(1, diffTime / (1000 * 60 * 60 * 24 * 7));
                                }
                            } else if (programDates?.start && programDates?.end) {
                                const start = new Date(programDates.start);
                                const end = new Date(programDates.end);
                                if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                                    const diffTime = Math.abs(end - start);
                                    customerDurationWeeks = Math.max(1, diffTime / (1000 * 60 * 60 * 24 * 7));
                                }
                            }

                            const totalWeeklyHours = assignments.reduce((sum, assignment) => {
                                const ws = customerWorkstreams?.find(w => w.name === assignment.workstream);
                                const wsHours = ws?.hours || 0;
                                const assignmentPct = assignment.allocationPct || 100;

                                // Check if assignment is active for the selected date (from data.dateKey)
                                const assignmentStart = assignment.startDate ? new Date(assignment.startDate) : null;
                                const assignmentEnd = assignment.endDate ? new Date(assignment.endDate) : null;

                                // Get selected week from dateKey (format: "Name - Apr 12")
                                const selectedDatePart = dateKeyRaw ? dateKeyRaw.trim() : '';
                                let selectedDate = null;
                                if (selectedDatePart) {
                                    // Try to parse the date label
                                    const now = new Date();
                                    const yearGuess = now.getFullYear();
                                    selectedDate = new Date(`${selectedDatePart} ${yearGuess}`);
                                    if (isNaN(selectedDate.getTime())) selectedDate = now;
                                } else {
                                    selectedDate = new Date();
                                }

                                // Check if assignment is active during selected week
                                const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                                const weekStart = new Date(selectedDate);
                                const weekEnd = new Date(selectedDate.getTime() + oneWeekMs);

                                let isActive = true;
                                if (assignmentStart && assignmentEnd) {
                                    // Assignment has explicit dates - check overlap
                                    isActive = weekEnd >= assignmentStart && weekStart <= assignmentEnd;
                                } else if (assignmentStart) {
                                    isActive = weekEnd >= assignmentStart;
                                } else if (assignmentEnd) {
                                    isActive = weekStart <= assignmentEnd;
                                }

                                if (!isActive) return sum; // Assignment not active this week

                                // Calculate based on assignment's own duration (not entire program)
                                let assignmentDurationWeeks = customerDurationWeeks;
                                if (assignmentStart && assignmentEnd && assignmentEnd > assignmentStart) {
                                    assignmentDurationWeeks = Math.max(1, (assignmentEnd - assignmentStart) / (1000 * 60 * 60 * 24 * 7));
                                }

                                const weekly = wsHours > 0 ? (wsHours * (assignmentPct / 100)) / assignmentDurationWeeks : 0;
                                return sum + weekly;
                            }, 0);

                            const displayTotal = formatNumber(Math.round(totalWeeklyHours * 10) / 10);

                            return (
                                <div key={customer} style={{
                                    backgroundColor: 'white',
                                    borderRadius: '20px',
                                    border: `1px solid ${BRAND.border}`,
                                    borderTop: '4px solid #00BD00',
                                    padding: '20px',
                                    marginBottom: '8px',
                                    boxShadow: '0 4px 6px -1px rgba(8, 47, 36, 0.05)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '8px',
                                                backgroundColor: '#d1fae5',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00BD00" strokeWidth="2">
                                                    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                </svg>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{customer}</span>
                                                <span style={{
                                                    marginLeft: '8px',
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: '#d1fae5',
                                                    color: '#047857',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {assignments.length} Workstream{assignments.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Big Weekly Hours (Project Card Style) */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                                            <span style={{
                                                fontSize: '24px',
                                                fontWeight: '700',
                                                color: '#00BD00', // Green for program
                                                letterSpacing: '-0.03em',
                                                lineHeight: '1'
                                            }}>
                                                {displayTotal}h
                                            </span>
                                            <span style={{
                                                fontSize: '9px',
                                                fontWeight: '800', // Extra bold for label
                                                color: '#94a3b8',
                                                letterSpacing: '0.05em',
                                                marginTop: '4px',
                                                textTransform: 'uppercase'
                                            }}>
                                                WEEKLY LOAD
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {assignments.map((assignment, i) => {
                                            // Use per-customer workstream hours
                                            const customerProgram = programBudgets?.[customer];
                                            const customerWorkstreams = customerProgram?.workstreams || programWorkstreams || [];
                                            const ws = customerWorkstreams?.find(w => w.name === assignment.workstream);
                                            const wsHours = ws?.hours || 0;
                                            const assignmentPct = assignment.allocationPct || 100;

                                            // Attempt to find the worker-calculated item in relevantDetails for consistency
                                            // Worker ID format: `program_${customer}_${workstream}`
                                            const workerItem = relevantDetails.find(d =>
                                                d.isProgram && d.customer === customer && d.workstream === assignment.workstream
                                            );

                                            let weeklyHours = null;
                                            if (workerItem && workerItem.hours > 0) {
                                                weeklyHours = Math.round(workerItem.hours * 10) / 10;
                                            } else {
                                                const calcHours = wsHours > 0 ? (wsHours * (assignmentPct / 100)) / customerDurationWeeks : 0;
                                                weeklyHours = Math.round(calcHours * 10) / 10;
                                            }

                                            return (
                                                <div key={assignment.id || i} style={{
                                                    padding: '10px 14px',
                                                    borderRadius: '10px',
                                                    backgroundColor: '#f0fdf4',
                                                    border: '1px solid #bbf7d0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    minWidth: '180px'
                                                }}>
                                                    <div style={{
                                                        width: '8px', height: '8px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#00BD00'
                                                    }} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#065f46' }}>
                                                            {assignment.workstream}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#047857' }}>
                                                            {assignmentPct}% allocation
                                                        </div>
                                                    </div>
                                                    {weeklyHours !== null && weeklyHours > 0 && (
                                                        <div style={{
                                                            fontSize: '12px',
                                                            fontWeight: '700',
                                                            color: '#059669',
                                                            padding: '2px 6px',
                                                            backgroundColor: '#d1fae5',
                                                            borderRadius: '4px'
                                                        }}>
                                                            ~{weeklyHours}h/wk
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                    {relevantDetails.filter(item => !item.isProgram).map((item, idx) => {
                        const start = new Date(item.startDate);
                        const end = new Date(item.endDate);
                        const now = new Date();
                        let progress = 0;
                        let isOngoing = false;
                        if (start && end && end > start) {
                            isOngoing = true;
                            if (now > start && end > start) {
                                progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
                            } else if (now > end) {
                                progress = 100;
                            }
                        }
                        const isEditing = editingId === (item.projectId || item.id);

                        const statusColor = getStatusColor(item.status || 'Active', idx) || '#00BD00';

                        return (
                            <div key={idx} style={{
                                backgroundColor: 'white',
                                borderRadius: '20px', // Large Block Rule
                                border: `1px solid ${BRAND.border}`,
                                borderTop: `4px solid ${statusColor}`,
                                padding: '20px',
                                marginBottom: '16px',
                                boxShadow: '0 4px 6px -1px rgba(8, 47, 36, 0.05)',
                                transition: 'transform 0.2s',
                            }}>
                                {/* Name + Hours row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                        {/* Country Flag */}
                                        {item.countryFlag && (
                                            <img
                                                src={item.countryFlag}
                                                alt={item.country || 'Country'}
                                                title={item.country || 'Country'}
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    objectFit: 'cover',
                                                    border: '2px solid #e2e8f0',
                                                    flexShrink: 0
                                                }}
                                            />
                                        )}
                                        <span style={{
                                            fontSize: '15px',
                                            fontWeight: '700',
                                            color: '#1e293b',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {item.name || 'Unnamed'}
                                        </span>
                                        {/* Edit button - inline with title - HIDDEN for Program Workstreams */}
                                        {!editingId && (
                                            <button
                                                onClick={() => handleEditClick(item)}
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    color: '#082F24',
                                                    backgroundColor: 'transparent',
                                                    border: '1px solid #bbf7d0',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    marginLeft: '8px',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <svg style={{ width: '10px', height: '10px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                Edit
                                            </button>
                                        )}
                                        {/* Clone button */}
                                        {!editingId && onClone && (
                                            <button
                                                onClick={() => onClone({
                                                    name: `${item.name} (Copy)`,
                                                    status: 'Draft',
                                                    squads: item.squads,
                                                    effortProfile: item.effortProfile,
                                                    team: item.team,
                                                    pmEffort: item.pmEffort || 0,
                                                    scEffort: item.scEffort || 0,
                                                    pdEffort: item.pdEffort || 0
                                                })}
                                                title="Clone this project"
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    color: '#00BD00',
                                                    backgroundColor: 'transparent',
                                                    border: '1px solid #86efac',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    marginLeft: '4px',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <svg style={{ width: '10px', height: '10px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                Clone
                                            </button>
                                        )}
                                    </div>
                                    {/* Hours + % Complete section - V1 Style with LOAD label */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {/* Hours - V1 Style: larger, bolder */}
                                            {/* Program Discount: Show original → discounted when resourcedWithinProgram */}
                                            {(() => {
                                                // Calculate total project hours for program discount display
                                                // totalPlanned or planned contains the discounted hours, we need to back-calculate original
                                                // Use Weekly Hours (item.hours) for display to match standard projects
                                                const discountedHours = item.hours || 0;

                                                // Back-calculate original: discounted = original * (1 - discount), so original = discounted / (1 - discount)
                                                // Default discount is 15% = 0.15, so factor is 0.85
                                                const discountFactor = 0.85; // 15% discount = multiply by 0.85
                                                const originalHours = item.resourcedWithinProgram ? Math.round(discountedHours / discountFactor) : discountedHours;

                                                if (item.resourcedWithinProgram && originalHours > discountedHours) {
                                                    return (
                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                            <span style={{
                                                                fontSize: '14px',
                                                                fontWeight: '600',
                                                                color: '#94a3b8',
                                                                textDecoration: 'line-through'
                                                            }}>
                                                                {formatNumber(originalHours)}h
                                                            </span>
                                                            <span style={{ color: '#00BD00', fontSize: '12px' }}>→</span>
                                                            <span style={{
                                                                fontSize: '24px',
                                                                fontWeight: '700',
                                                                color: '#00BD00',
                                                                letterSpacing: '-0.03em'
                                                            }}>
                                                                {formatNumber(discountedHours)}h
                                                            </span>
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <span style={{
                                                            fontSize: '24px',
                                                            fontWeight: '700',
                                                            color: BRAND.indigo,
                                                            letterSpacing: '-0.03em'
                                                        }}>
                                                            {formatNumber(item.hours || 0)}h
                                                        </span>
                                                    );
                                                }
                                            })()}
                                            {/* Program Badge with Manage Button */}
                                            {item.resourcedWithinProgram && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{
                                                        fontSize: '9px',
                                                        fontWeight: '700',
                                                        color: 'white',
                                                        padding: '3px 8px',
                                                        backgroundColor: '#00BD00',
                                                        borderRadius: '4px 0 0 4px',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.03em'
                                                    }} title="Effort transferred to Program budget">
                                                        Program
                                                    </span>
                                                    {onManageProgram && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onManageProgram(item.customer);
                                                            }}
                                                            style={{
                                                                fontSize: '9px',
                                                                fontWeight: '700',
                                                                color: '#00BD00',
                                                                padding: '3px 8px',
                                                                backgroundColor: '#ecfdf5',
                                                                border: '1px solid #00BD00',
                                                                borderRadius: '0 4px 4px 0',
                                                                cursor: 'pointer',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.03em',
                                                                transition: 'all 0.15s'
                                                            }}
                                                            onMouseOver={(e) => { e.target.style.backgroundColor = '#d1fae5'; }}
                                                            onMouseOut={(e) => { e.target.style.backgroundColor = '#ecfdf5'; }}
                                                            title="Manage program workstream assignments"
                                                        >
                                                            Manage
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {/* % Complete badge - V1 Style: green background */}
                                            {item.pctComplete > 0 && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    color: 'white',
                                                    padding: '4px 10px',
                                                    backgroundColor: '#00BD00',
                                                    borderRadius: '6px',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {Math.round(item.pctComplete * 100)}% Complete
                                                </span>
                                            )}
                                        </div>
                                        {/* LOAD label - V1 Style */}
                                        <span style={{
                                            fontSize: '9px',
                                            fontWeight: '700',
                                            color: '#94a3b8',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginTop: '2px'
                                        }}>
                                            Load{item.resourcedWithinProgram ? ' (Program Discounted)' : ''}
                                        </span>
                                    </div>
                                </div>

                                {/* EDIT FORM - positioned directly below title */}
                                {editingId === (item.projectId || item.id) && (
                                    <div style={{
                                        marginTop: '12px',
                                        marginBottom: '12px',
                                        padding: '16px',
                                        background: 'linear-gradient(135deg, #F5EDE1 0%, #f0fdf4 100%)',
                                        borderRadius: '10px',
                                        border: '2px solid #bbf7d0'
                                    }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                                            {/* Status */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', marginBottom: '4px' }}>Status</label>
                                                <select
                                                    value={editForm.status || ''}
                                                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '500', border: '2px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}
                                                >
                                                    {ALLOWED_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            {/* Squad */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', marginBottom: '4px' }}>Squad</label>
                                                <select
                                                    value={editForm.squad || ''}
                                                    onChange={e => setEditForm({ ...editForm, squad: e.target.value })}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '500', border: '2px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}
                                                >
                                                    <option value="">Unassigned</option>
                                                    {(allSquadsFlat || []).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            {/* Effort Profile */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', marginBottom: '4px' }}>Effort Profile</label>
                                                <select
                                                    value={editForm.effortProfile || ''}
                                                    onChange={e => setEditForm({ ...editForm, effortProfile: e.target.value })}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '500', border: '2px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}
                                                >
                                                    <option value="">None</option>
                                                    <option value="Straight Line">Straight Line</option>
                                                    <option value="Front Loaded">Front Loaded</option>
                                                    <option value="Back Loaded">Back Loaded</option>
                                                    <option value="FPS">FPS (3-stage)</option>
                                                    <option value="Bell Curve">Bell Curve</option>
                                                    <option value="Benifex - Role Specific">Benifex - Role Specific</option>
                                                    <option value="Benifex Domestic UK">Benifex Domestic UK</option>
                                                </select>
                                            </div>
                                        </div>
                                        {/* Role-Specific Weekly Effort Breakdown - Full width, only show when Benifex profile is selected */}
                                        {(editForm.effortProfile || '').toLowerCase().includes('benifex') && (() => {
                                            // Get full project from allProjects to access scVal/pdVal/pmVal
                                            const projectId = item.projectId || item.id;
                                            const fullProject = allProjects?.find(p => p.id === projectId) || item;

                                            // Calculate weekly effort distribution
                                            const start = editForm.start ? new Date(editForm.start) : (fullProject.start ? new Date(fullProject.start) : null);
                                            const end = editForm.end ? new Date(editForm.end) : (fullProject.end ? new Date(fullProject.end) : null);
                                            if (!start || !end || end <= start) return null;

                                            // Get role hours from full project
                                            const scHours = fullProject.scVal || 0;
                                            const pdHours = fullProject.pdVal || 0;
                                            const pmHours = fullProject.pmVal || 0;

                                            // If no hours found, use totalPlanned split evenly as fallback
                                            const totalHours = scHours + pdHours + pmHours;
                                            const useDefaultSplit = totalHours < 1;
                                            const fallbackHours = (fullProject.totalPlanned || fullProject.planned || 100) / 3;

                                            const finalSc = useDefaultSplit ? fallbackHours : scHours;
                                            const finalPd = useDefaultSplit ? fallbackHours : pdHours;
                                            const finalPm = useDefaultSplit ? fallbackHours : pmHours;

                                            // Calculate the actual number of project weeks from Kickoff → Launch.
                                            // No upper cap — bars flex to fill available width so a 26-week project shows 26 bars.
                                            const msPerWeek = 7 * 24 * 60 * 60 * 1000;
                                            const numWeeks = Math.max(1, Math.ceil((end - start) / msPerWeek));

                                            // Generate weekly effort based on curve type (matches worker's role-specific curves at spread=2)
                                            const getCurveMultiplier = (weekIdx, curve, totalWeeks) => {
                                                const progress = totalWeeks > 1 ? weekIdx / (totalWeeks - 1) : 0.5;
                                                if (curve === 'front') return 2 * (1 - progress);
                                                if (curve === 'back') return 2 * progress;
                                                if (curve === 'bell') return 2 * 4 * progress * (1 - progress);
                                                return 1; // flat
                                            };

                                            const effortProfile = (editForm.effortProfile || fullProject.effortProfile || '').toLowerCase();
                                            const isDomesticProfile = effortProfile.includes('domestic');
                                            // Match worker's detection: "role" or "benifex" in the name, but NOT "domestic" (already caught above)
                                            const isRoleSpecificProfile = !isDomesticProfile && (effortProfile.includes('role') || effortProfile.includes('benifex'));

                                            // Pull stored hypercare settings (same source/derivation as the worker)
                                            const domesticSettings = modelParams.domesticProfile || {};
                                            const roleSettings = modelParams.roleSpecificProfile || {};
                                            const projectTotalHours = (fullProject.pmVal || 0) + (fullProject.scVal || 0) + (fullProject.pdVal || 0);
                                            const deriveHcHrs = (settings) => {
                                                const mode = settings.hypercareMode || 'fixed';
                                                if (mode === 'percent') {
                                                    return projectTotalHours * ((settings.hypercarePercentPerWeek ?? 1.25) / 100);
                                                }
                                                return settings.hypercareHoursPerWeek ?? 3;
                                            };
                                            const activeHc = isDomesticProfile
                                                ? { weeks: domesticSettings.hypercareWeeks ?? 13, hoursPerWeek: deriveHcHrs(domesticSettings) }
                                                : isRoleSpecificProfile
                                                    ? { weeks: roleSettings.hypercareWeeks ?? 13, hoursPerWeek: deriveHcHrs(roleSettings) }
                                                    : null;

                                            // For domestic / role-specific: project phase + hypercare tail using saved settings.
                                            // Bar count reflects real durations (project weeks + hypercare weeks) — no cap.
                                            let weeks;
                                            if (activeHc && activeHc.weeks > 0 && activeHc.hoursPerWeek > 0) {
                                                const projectWeeks = numWeeks;
                                                const hcWeeks = activeHc.weeks;
                                                const displayWeeks = projectWeeks + hcWeeks;
                                                const hcHoursPerRole = activeHc.hoursPerWeek / 3;

                                                weeks = Array.from({ length: displayWeeks }, (_, i) => {
                                                    if (i < projectWeeks) {
                                                        // Project phase — domestic uses flat, role-specific uses the per-role curves
                                                        if (isDomesticProfile) {
                                                            const scWeekly = finalSc / projectWeeks;
                                                            const pdWeekly = finalPd / projectWeeks;
                                                            const pmWeekly = finalPm / projectWeeks;
                                                            return { sc: scWeekly, pd: pdWeekly, pm: pmWeekly, total: scWeekly + pdWeekly + pmWeekly, isHypercare: false };
                                                        }
                                                        // Role-specific: apply saved curves (fallback: sc=front, pd=back, pm=flat)
                                                        const scCurve = roleSettings.scProfile || 'front';
                                                        const pdCurve = roleSettings.pdProfile || 'back';
                                                        const pmCurve = roleSettings.pmProfile || 'flat';
                                                        const scMult = getCurveMultiplier(i, scCurve, projectWeeks);
                                                        const pdMult = getCurveMultiplier(i, pdCurve, projectWeeks);
                                                        const pmMult = getCurveMultiplier(i, pmCurve, projectWeeks);
                                                        const scWeekly = (finalSc / projectWeeks) * scMult;
                                                        const pdWeekly = (finalPd / projectWeeks) * pdMult;
                                                        const pmWeekly = (finalPm / projectWeeks) * pmMult;
                                                        return { sc: scWeekly, pd: pdWeekly, pm: pmWeekly, total: scWeekly + pdWeekly + pmWeekly, isHypercare: false };
                                                    }
                                                    // Hypercare tail — flat per-role hours/week from settings
                                                    return { sc: hcHoursPerRole, pd: hcHoursPerRole, pm: hcHoursPerRole, total: activeHc.hoursPerWeek, isHypercare: true };
                                                });
                                            } else {
                                                // No hypercare (non-benifex profile, or hypercare disabled)
                                                weeks = Array.from({ length: numWeeks }, (_, i) => {
                                                    const scMult = getCurveMultiplier(i, 'front', numWeeks);
                                                    const pdMult = getCurveMultiplier(i, 'back', numWeeks);
                                                    const pmMult = getCurveMultiplier(i, 'flat', numWeeks);

                                                    const scWeekly = (finalSc / numWeeks) * scMult;
                                                    const pdWeekly = (finalPd / numWeeks) * pdMult;
                                                    const pmWeekly = (finalPm / numWeeks) * pmMult;

                                                    return { sc: scWeekly, pd: pdWeekly, pm: pmWeekly, total: scWeekly + pdWeekly + pmWeekly, isHypercare: false };
                                                });
                                            }

                                            // Find max for scaling
                                            const maxTotal = Math.max(...weeks.map(w => w.total), 1);

                                            return (
                                                <div style={{
                                                    marginTop: '12px',
                                                    padding: '12px',
                                                    backgroundColor: '#f8fafc',
                                                    borderRadius: '8px',
                                                    border: '1px solid #e2e8f0'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            Weekly Effort by Role
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px', fontSize: '8px' }}>
                                                            <span style={{ color: '#00BD00' }}>● SC</span>
                                                            <span style={{ color: '#082F24' }}>● Build</span>
                                                            <span style={{ color: '#FF8EFB' }}>● PM</span>
                                                            {(isDomesticProfile || isRoleSpecificProfile) && activeHc && <span style={{ color: '#FE9922' }}>● Hypercare</span>}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '50px' }}>
                                                        {(() => {
                                                            // Per-phase scaling: HC values are inherently small (~3h) compared to project peaks (~40h+).
                                                            // If we share one scale, HC bars collapse to dashes. Instead each phase scales to its own
                                                            // max — but HC's max bar height is capped at half the project max to preserve visual hierarchy
                                                            // (so HC reads as "supplementary tail", not equal-magnitude work).
                                                            const projectWeeks = weeks.filter(w => !w.isHypercare);
                                                            const hcWeeksOnly = weeks.filter(w => w.isHypercare);
                                                            const projectMax = Math.max(...projectWeeks.map(w => w.total), 1);
                                                            const hcMax = Math.max(...hcWeeksOnly.map(w => w.total), 1);
                                                            const PROJECT_BAR_MAX_PX = 44;
                                                            const HC_BAR_MAX_PX = 22;

                                                            // Show every week label by default. Only thin them out for very long
                                                            // projects (>52 bars) where they would visibly overlap.
                                                            const totalWeeks = weeks.length;
                                                            const labelEvery = totalWeeks <= 52 ? 1 : Math.ceil(totalWeeks / 26);

                                                            let projectIdx = 0; let hcIdx = 0;
                                                            return weeks.map((week, idx) => {
                                                                const phaseMax = week.isHypercare ? hcMax : projectMax;
                                                                const barMaxPx = week.isHypercare ? HC_BAR_MAX_PX : PROJECT_BAR_MAX_PX;
                                                                const barHeight = Math.max((week.total / phaseMax) * barMaxPx, 6);
                                                                const scPct = week.total > 0 ? (week.sc / week.total) * 100 : 33;
                                                                const pdPct = week.total > 0 ? (week.pd / week.total) * 100 : 33;
                                                                const pmPct = week.total > 0 ? (week.pm / week.total) * 100 : 34;

                                                                const barColors = week.isHypercare
                                                                    ? { sc: '#fbbf24', pd: '#FE9922', pm: '#d97706' }
                                                                    : { sc: '#00BD00', pd: '#082F24', pm: '#FF8EFB' };

                                                                // Phase-local numbering (W1..W16 then HC1..HC13)
                                                                const phaseIdx = week.isHypercare ? ++hcIdx : ++projectIdx;
                                                                const isLastProjectWeek = !week.isHypercare && idx + 1 < weeks.length && weeks[idx + 1].isHypercare;
                                                                const isRegularLabel = (phaseIdx - 1) % labelEvery === 0;
                                                                const showLabel = idx === 0 || idx === weeks.length - 1 || isLastProjectWeek || isRegularLabel;
                                                                const labelText = week.isHypercare ? `HC${phaseIdx}` : `W${phaseIdx}`;

                                                                return (
                                                                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '4px' }} title={`${labelText} — ${Math.round(week.total * 10) / 10}h total`}>
                                                                        <div style={{
                                                                            width: '100%',
                                                                            height: `${barHeight}px`,
                                                                            borderRadius: '3px',
                                                                            overflow: 'hidden',
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            opacity: week.isHypercare ? 0.85 : 1
                                                                        }}>
                                                                            <div style={{ flex: scPct, backgroundColor: barColors.sc, minHeight: '2px' }} />
                                                                            <div style={{ flex: pdPct, backgroundColor: barColors.pd, minHeight: '2px' }} />
                                                                            <div style={{ flex: pmPct, backgroundColor: barColors.pm, minHeight: '2px' }} />
                                                                        </div>
                                                                        <div style={{ fontSize: '7px', color: week.isHypercare ? '#FE9922' : '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                                                            {showLabel ? labelText : ''}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {/* Resourcing Override Row */}
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', marginBottom: '4px' }}>Resourcing Override</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                placeholder="Enter hours"
                                                value={editForm.resourcingOverride || ''}
                                                onChange={e => setEditForm({ ...editForm, resourcingOverride: e.target.value ? parseInt(e.target.value, 10) : '' })}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '500', border: '2px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', marginBottom: 0 }}>Override total effort value (in hours)</p>
                                        </div>
                                        {/* Benefits Counts (Transactional / Non-Transactional / Content Only) */}
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', marginBottom: '4px' }}>Benefits Counts</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                                                <div>
                                                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#00BD00', marginBottom: '3px' }}>Transactional</div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        placeholder="0"
                                                        value={editForm.transactionalBenefits === '' || editForm.transactionalBenefits == null ? '' : editForm.transactionalBenefits}
                                                        onChange={e => setEditForm({ ...editForm, transactionalBenefits: e.target.value === '' ? '' : Number(e.target.value) })}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '500', border: '2px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white', outline: 'none', boxSizing: 'border-box' }}
                                                    />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#082F24', marginBottom: '3px' }}>Non-Transactional</div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        placeholder="0"
                                                        value={editForm.nonTransactionalBenefits === '' || editForm.nonTransactionalBenefits == null ? '' : editForm.nonTransactionalBenefits}
                                                        onChange={e => setEditForm({ ...editForm, nonTransactionalBenefits: e.target.value === '' ? '' : Number(e.target.value) })}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '500', border: '2px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white', outline: 'none', boxSizing: 'border-box' }}
                                                    />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#d97706', marginBottom: '3px' }}>Content Only</div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        placeholder="0"
                                                        value={editForm.contentOnlyBenefits === '' || editForm.contentOnlyBenefits == null ? '' : editForm.contentOnlyBenefits}
                                                        onChange={e => setEditForm({ ...editForm, contentOnlyBenefits: e.target.value === '' ? '' : Number(e.target.value) })}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '500', border: '2px solid #fde68a', borderRadius: '6px', backgroundColor: 'white', outline: 'none', boxSizing: 'border-box' }}
                                                    />
                                                </div>
                                            </div>
                                            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', marginBottom: 0 }}>Number of benefits counted toward this project</p>
                                        </div>
                                        {/* Wave Field */}
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', marginBottom: '4px' }}>Wave</label>
                                            <select
                                                value={editForm.wave || ''}
                                                onChange={e => setEditForm({ ...editForm, wave: e.target.value })}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '500', border: '2px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}
                                            >
                                                <option value="">Unassigned</option>
                                                <option value="Wave 1">Wave 1</option>
                                                <option value="Wave 2">Wave 2</option>
                                                <option value="Wave 3">Wave 3</option>
                                                <option value="Wave 4">Wave 4</option>
                                                <option value="Wave 5">Wave 5</option>
                                                <option value="Wave 6">Wave 6</option>
                                                <option value="Wave 7">Wave 7</option>
                                                <option value="Wave 8">Wave 8</option>
                                                <option value="Wave 9">Wave 9</option>
                                                <option value="Wave 10">Wave 10</option>
                                            </select>
                                        </div>
                                        {/* Lock Constraints Row - Slot Optimization */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                            {/* Launch Lock Toggle */}
                                            <div style={{
                                                padding: '10px',
                                                backgroundColor: editForm.lockLaunch ? '#fef3c7' : '#f8fafc',
                                                borderRadius: '8px',
                                                border: editForm.lockLaunch ? '2px solid #FE9922' : '1px solid #e2e8f0',
                                                transition: 'all 0.2s'
                                            }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={editForm.lockLaunch || false}
                                                        onChange={e => setEditForm({ ...editForm, lockLaunch: e.target.checked })}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        style={{ width: '16px', height: '16px', accentColor: '#FE9922' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontSize: '11px', fontWeight: '700', color: editForm.lockLaunch ? '#92400e' : '#64748b' }}>
                                                            🔒 Lock Launch Date
                                                        </div>
                                                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                                                            Optimizer cannot move dates
                                                        </div>
                                                    </div>
                                                </label>
                                            </div>
                                            {/* Squad Lock Toggle */}
                                            <div style={{
                                                padding: '10px',
                                                backgroundColor: editForm.lockSquad ? '#dbeafe' : '#f8fafc',
                                                borderRadius: '8px',
                                                border: editForm.lockSquad ? '2px solid #4794FF' : '1px solid #e2e8f0',
                                                transition: 'all 0.2s'
                                            }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={editForm.lockSquad || false}
                                                        onChange={e => setEditForm({ ...editForm, lockSquad: e.target.checked })}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        style={{ width: '16px', height: '16px', accentColor: '#4794FF' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontSize: '11px', fontWeight: '700', color: editForm.lockSquad ? '#1e40af' : '#64748b' }}>
                                                            🔒 Lock Squad
                                                        </div>
                                                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                                                            Cannot reassign team
                                                        </div>
                                                    </div>
                                                </label>
                                            </div>
                                            {/* Resource Lock Toggle */}
                                            <div style={{
                                                padding: '10px',
                                                backgroundColor: editForm.lockResources ? '#fce7f3' : '#f8fafc',
                                                borderRadius: '8px',
                                                border: editForm.lockResources ? '2px solid #ec4899' : '1px solid #e2e8f0',
                                                transition: 'all 0.2s',
                                                gridColumn: '1 / -1' // Span full width if needed, or adjust grid layout
                                            }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={editForm.lockResources || false}
                                                        onChange={e => setEditForm({ ...editForm, lockResources: e.target.checked })}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        style={{ width: '16px', height: '16px', accentColor: '#ec4899' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontSize: '11px', fontWeight: '700', color: editForm.lockResources ? '#be185d' : '#64748b' }}>
                                                            🔒 Lock Resources
                                                        </div>
                                                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                                                            Prevent resource swaps
                                                        </div>
                                                    </div>
                                                </label>
                                            </div>
                                            {/* Program Team Toggle */}
                                            <div style={{
                                                padding: '10px',
                                                backgroundColor: editForm.resourcedWithinProgram ? '#ecfdf5' : '#f8fafc',
                                                borderRadius: '8px',
                                                border: editForm.resourcedWithinProgram ? '2px solid #00BD00' : '1px solid #e2e8f0',
                                                transition: 'all 0.2s',
                                                gridColumn: '1 / -1'
                                            }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={editForm.resourcedWithinProgram || false}
                                                        onChange={e => setEditForm({ ...editForm, resourcedWithinProgram: e.target.checked })}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        style={{ width: '16px', height: '16px', accentColor: '#00BD00' }}
                                                    />
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', color: editForm.resourcedWithinProgram ? '#047857' : '#64748b' }}>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                            </svg>
                                                            Program Team
                                                        </div>
                                                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                                                            Resource via program budget
                                                        </div>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                            {/* Resourced Toggle */}
                                            <div style={{
                                                padding: '10px',
                                                backgroundColor: editForm.resourced ? '#ecfdf5' : '#f8fafc',
                                                borderRadius: '8px',
                                                border: editForm.resourced ? '2px solid #00BD00' : '1px solid #e2e8f0',
                                                transition: 'all 0.2s',
                                                marginBottom: '12px'
                                            }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={editForm.resourced || false}
                                                        onChange={e => setEditForm({ ...editForm, resourced: e.target.checked })}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        style={{ width: '16px', height: '16px', accentColor: '#00BD00' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontSize: '11px', fontWeight: '700', color: editForm.resourced ? '#047857' : '#64748b' }}>
                                                            ✅ Resourced
                                                        </div>
                                                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                                                            Mark project as fully resourced
                                                        </div>
                                                    </div>
                                                </label>
                                            </div>
                                            {/* Resourcing Notes */}
                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', marginBottom: '4px' }}>Resourcing Notes</label>
                                                <textarea
                                                    value={editForm.resourcingNotes || ''}
                                                    onChange={e => setEditForm({ ...editForm, resourcingNotes: e.target.value })}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    placeholder="Add resourcing notes..."
                                                    rows={3}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px',
                                                        fontSize: '12px',
                                                        border: '2px solid #bbf7d0',
                                                        borderRadius: '6px',
                                                        backgroundColor: 'white',
                                                        outline: 'none',
                                                        resize: 'vertical',
                                                        fontFamily: 'inherit',
                                                        lineHeight: '1.4'
                                                    }}
                                                />
                                            </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                            {/* Kick-off Date */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', marginBottom: '4px' }}>Kick Off</label>
                                                <input
                                                    type="date"
                                                    value={editForm.start || ''}
                                                    onChange={e => setEditForm({ ...editForm, start: e.target.value })}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    style={{ width: '100%', padding: '8px', fontSize: '12px', fontFamily: 'monospace', border: '2px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}
                                                />
                                            </div>
                                            {/* Launch Date */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#082F24', textTransform: 'uppercase', marginBottom: '4px' }}>Launch</label>
                                                <input
                                                    type="date"
                                                    value={editForm.end || ''}
                                                    onChange={e => setEditForm({ ...editForm, end: e.target.value })}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    style={{ width: '100%', padding: '8px', fontSize: '12px', fontFamily: 'monospace', border: '2px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                        {/* Save / Cancel Buttons */}
                                        <div style={{ display: 'flex', gap: '12px', paddingTop: '12px', borderTop: '1px solid #bbf7d0' }}>
                                            <button
                                                onClick={handleSaveEdit}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                disabled={!onUpdateProject}
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 16px',
                                                    background: onUpdateProject ? 'linear-gradient(135deg, #082F24 0%, #082F24 100%)' : '#cbd5e1',
                                                    color: 'white',
                                                    fontSize: '13px',
                                                    fontWeight: '700',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    cursor: onUpdateProject ? 'pointer' : 'not-allowed',
                                                    boxShadow: onUpdateProject ? '0 2px 8px rgba(8, 47, 36, 0.3)' : 'none'
                                                }}
                                            >
                                                {onUpdateProject ? '✓ Save Changes' : '⚠ Backend Not Connected'}
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 16px',
                                                    backgroundColor: 'white',
                                                    color: '#64748b',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    border: '2px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Status + Squad + Wave + Profile badges - V1 Style */}
                                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                    {/* Status badge - V1 Style: colored background, uppercase */}
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '4px 12px',
                                        borderRadius: '6px',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.02em',
                                        backgroundColor: statusColor,
                                        color: 'white'
                                    }}>
                                        {item.status || 'Active'}
                                    </span>
                                    {/* Squad badge - V1 Style: purple */}
                                    {item.squads && item.squads.length > 0 && (
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.02em',
                                            backgroundColor: '#f3f4f6',
                                            color: '#374151',
                                            border: '1px solid #e5e7eb'
                                        }}>
                                            {item.squads[0]}
                                        </span>
                                    )}
                                    {/* Wave badge - V1 Style */}
                                    {item.wave && (
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.02em',
                                            backgroundColor: '#f3f4f6',
                                            color: '#374151',
                                            border: '1px solid #e5e7eb'
                                        }}>
                                            {item.wave}
                                        </span>
                                    )}
                                    {/* Effort Profile badge - V1 Style with dash icon */}
                                    {item.effortProfile && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.02em',
                                            backgroundColor: '#f3f4f6',
                                            color: '#374151',
                                            border: '1px solid #e5e7eb'
                                        }}>
                                            <span style={{ color: '#64748b' }}>—</span>
                                            {item.effortProfile.replace('Loaded', '').trim() || item.effortProfile}
                                        </span>
                                    )}
                                    {/* Lock Badges - Slot Optimization */}
                                    {item.lockLaunch && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '9px',
                                            fontWeight: '700',
                                            backgroundColor: '#fef3c7',
                                            color: '#92400e',
                                            border: '1px solid #fcd34d'
                                        }}>
                                            🔒 Launch Locked
                                        </span>
                                    )}
                                    {item.lockSquad && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '9px',
                                            fontWeight: '700',
                                            backgroundColor: '#dbeafe',
                                            color: '#1e40af',
                                            border: '1px solid #93c5fd'
                                        }}>
                                            🔒 Squad Locked
                                        </span>
                                    )}
                                </div>

                                {/* Timeline progress bar with Today marker - V1 Style */}
                                {isOngoing && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '10px',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: '10px',
                                            color: '#64748b',
                                            fontWeight: '600',
                                            marginBottom: '8px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.02em'
                                        }}>
                                            <span>Kick-off: {start.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                            <span>Launch: {end.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                        </div>
                                        {/* Progress bar container with Today marker */}
                                        <div style={{ position: 'relative', height: '20px' }}>
                                            {/* Track */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '8px',
                                                left: 0,
                                                right: 0,
                                                height: '4px',
                                                backgroundColor: '#e2e8f0',
                                                borderRadius: '2px',
                                                overflow: 'hidden'
                                            }}>
                                                {/* Progress fill */}
                                                <div style={{
                                                    height: '100%',
                                                    width: `${Math.min(progress, 100)}%`,
                                                    background: 'linear-gradient(90deg, #0ea5e9 0%, #082F24 100%)',
                                                    borderRadius: '2px'
                                                }}></div>
                                            </div>
                                            {/* Today marker */}
                                            {progress > 0 && progress < 100 && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: `${Math.min(progress, 100)}%`,
                                                    top: 0,
                                                    transform: 'translateX(-50%)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center'
                                                }}>
                                                    <span style={{
                                                        fontSize: '9px',
                                                        fontWeight: '700',
                                                        color: '#475569',
                                                        backgroundColor: 'white',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #e2e8f0',
                                                        whiteSpace: 'nowrap',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                    }}>
                                                        Today ({Math.round(progress)}%)
                                                    </span>
                                                    <div style={{
                                                        width: 0,
                                                        height: 0,
                                                        borderLeft: '4px solid transparent',
                                                        borderRight: '4px solid transparent',
                                                        borderTop: '4px solid #475569'
                                                    }}></div>
                                                </div>
                                            )}
                                            {/* Not Started state */}
                                            {progress <= 0 && (
                                                <span style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    color: '#64748b',
                                                    backgroundColor: '#f1f5f9',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #e2e8f0'
                                                }}>
                                                    🚀 Not Started
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Project Scope Section */}
                                {(item.customer || item.company || item.transactionalBenefits > 0 || item.nonTransactionalBenefits > 0 || item.contentOnlyBenefits > 0 || item.languages || item.country || item.platform) && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        backgroundColor: BRAND.oat, // Match Header
                                        borderRadius: '10px', // Small Block
                                        border: `1px solid ${BRAND.border}`
                                    }}>
                                        <div style={{
                                            fontSize: '9px',
                                            fontWeight: '700',
                                            color: '#082F24',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <svg style={{ width: '14px', height: '14px', color: '#FF8EFB' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            Project Scope
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {(item.customer || item.company) && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e2e8f0',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                                }}>
                                                    <svg style={{ width: '14px', height: '14px', color: '#082F24', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                    <span style={{ fontSize: '11px', fontWeight: '500', color: '#334155' }}>{item.customer || item.company}</span>
                                                </div>
                                            )}
                                            {item.country && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e2e8f0',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                                }}>
                                                    {item.countryFlag && (
                                                        <img src={item.countryFlag} alt="" style={{ width: '14px', height: '14px', borderRadius: '2px', objectFit: 'cover' }} />
                                                    )}
                                                    <span style={{ fontSize: '11px', fontWeight: '500', color: '#64748b' }}>{item.country}</span>
                                                </div>
                                            )}
                                            {item.platform && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '6px',
                                                    border: '1px solid #bbf7d0',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                                }}>
                                                    <svg style={{ width: '14px', height: '14px', color: '#082F24', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                    <span style={{ fontSize: '11px', fontWeight: '500', color: '#64748b' }}>{item.platform}</span>
                                                </div>
                                            )}
                                            {item.transactionalBenefits > 0 && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '6px',
                                                    border: '1px solid #bbf7d0',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                                }} title="Transactional Benefits">
                                                    <svg style={{ width: '14px', height: '14px', color: '#00BD00', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span style={{ fontSize: '9px', color: '#64748b' }}>Trans:</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#00BD00' }}>{formatNumber(item.transactionalBenefits)}</span>
                                                </div>
                                            )}
                                            {item.nonTransactionalBenefits > 0 && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '6px',
                                                    border: '1px solid #bbf7d0',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                                }} title="Non-Transactional Benefits">
                                                    <svg style={{ width: '14px', height: '14px', color: '#082F24', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span style={{ fontSize: '9px', color: '#64748b' }}>Non-Trans:</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#082F24' }}>{formatNumber(item.nonTransactionalBenefits)}</span>
                                                </div>
                                            )}
                                            {item.contentOnlyBenefits > 0 && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '6px',
                                                    border: '1px solid #fde68a',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                                }} title="Content Only Benefits">
                                                    <svg style={{ width: '14px', height: '14px', color: '#d97706', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    <span style={{ fontSize: '9px', color: '#64748b' }}>Content:</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#d97706' }}>{formatNumber(item.contentOnlyBenefits)}</span>
                                                </div>
                                            )}
                                            {item.languages && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '6px',
                                                    border: '1px solid #bae6fd',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                                }}>
                                                    <svg style={{ width: '14px', height: '14px', color: '#0284c7', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span style={{ fontSize: '9px', color: '#64748b' }}>Languages:</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '500', color: '#0284c7' }}>{item.languages}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Budget Performance Section - V1 Style */}
                                {((item.totalPlanned || item.planned) > 0 || item.eac > 0 || item.actuals > 0) && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        backgroundColor: 'white',
                                        borderRadius: '10px', // Standard 10px
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            marginBottom: '10px'
                                        }}>
                                            {/* Left: Title + % Complete */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{
                                                    fontSize: '9px',
                                                    fontWeight: '700',
                                                    color: '#64748b',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em'
                                                }}>Budget Performance</span>
                                                <span style={{ color: '#cbd5e1' }}>{'>'}</span>
                                                {item.pctComplete > 0 && (
                                                    <span style={{
                                                        fontSize: '10px',
                                                        fontWeight: '600',
                                                        color: '#64748b'
                                                    }}>{Math.round(item.pctComplete * 100)}% Complete</span>
                                                )}
                                            </div>
                                            {/* Right: Projected Saving/Overburn */}
                                            {(item.totalPlanned || item.planned) > 0 && item.eac > 0 && (() => {
                                                const planned = item.totalPlanned || item.planned || 0;
                                                const variance = planned - item.eac;
                                                const isUnder = variance >= 0;
                                                return (
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            color: isUnder ? '#00BD00' : '#E5554F'
                                                        }}>
                                                            {isUnder ? 'Projected Saving: ' : 'Projected Overburn: '}{formatNumber(Math.abs(variance))}h
                                                        </div>
                                                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                                            {formatNumber(item.eac || 0)}h Total EAC
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            {/* Planned */}
                                            <div style={{ flex: '1 1 80px', minWidth: '80px' }}>
                                                <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '4px' }}>Planned</div>
                                                <div style={{ fontSize: '16px', fontWeight: '700', color: '#64748b' }}>{formatNumber(item.totalPlanned || item.planned || 0)}h</div>
                                            </div>
                                            {/* Actuals */}
                                            <div style={{ flex: '1 1 80px', minWidth: '80px' }}>
                                                <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '4px' }}>Actuals</div>
                                                <div style={{ fontSize: '16px', fontWeight: '700', color: '#0284c7' }}>{formatNumber(item.actuals || 0)}h</div>
                                            </div>
                                            {/* EAC */}
                                            <div style={{ flex: '1 1 80px', minWidth: '80px' }}>
                                                <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '4px' }}>EAC</div>
                                                <div style={{
                                                    fontSize: '16px',
                                                    fontWeight: '700',
                                                    color: item.eac > (item.totalPlanned || item.planned || 0) ? '#E5554F' : '#00BD00'
                                                }}>
                                                    {formatNumber(item.eac || 0)}h
                                                </div>
                                            </div>
                                            {/* Variance */}
                                            {item.totalPlanned > 0 && item.eac > 0 && (
                                                <div style={{ flex: '1 1 80px', minWidth: '80px' }}>
                                                    <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '4px' }}>Variance</div>
                                                    <div style={{
                                                        fontSize: '16px',
                                                        fontWeight: '700',
                                                        color: (item.eac - item.totalPlanned) > 0 ? '#E5554F' : '#00BD00'
                                                    }}>
                                                        {(item.eac - item.totalPlanned) > 0 ? '+' : ''}{formatNumber(item.eac - item.totalPlanned)}h
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {/* Progress bar showing actuals vs planned */}
                                        {item.totalPlanned > 0 && (
                                            <div style={{ marginTop: '10px' }}>
                                                <div style={{
                                                    height: '6px',
                                                    backgroundColor: '#e2e8f0',
                                                    borderRadius: '3px',
                                                    overflow: 'hidden',
                                                    position: 'relative'
                                                }}>
                                                    {/* Actuals fill */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        height: '100%',
                                                        width: `${Math.min((item.actuals || 0) / item.totalPlanned * 100, 100)}%`,
                                                        backgroundColor: '#0284c7',
                                                        borderRadius: '3px'
                                                    }}></div>
                                                </div>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    fontSize: '9px',
                                                    color: '#94a3b8',
                                                    marginTop: '4px'
                                                }}>
                                                    <span>{Math.round((item.actuals || 0) / item.totalPlanned * 100)}% spent</span>
                                                    <span>{formatNumber(item.totalPlanned - (item.actuals || 0))}h remaining</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}



                                {/* Team Manager Section (V1 Parity) - HIDDEN for Program Workstreams only, not projects in programs */}
                                {showTeamManager && (item.projectId || item.id) && !item.isProgram && (
                                    <div style={{
                                        marginTop: '16px',
                                        padding: '16px',
                                        backgroundColor: BRAND.bgAlt, // Light backing
                                        borderRadius: '10px',
                                        borderTop: `1px solid ${BRAND.border}`
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project Team</span>
                                            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                                            {['pm', 'sc', 'pd'].map(role => {
                                                // Get LIVE team from allProjects to support optimistic updates
                                                const projectId = item.projectId || item.id;
                                                const liveProject = allProjects?.find(p => p.id === projectId);
                                                const liveTeam = liveProject?.team?.[role] || item.team?.[role] || [];



                                                return (
                                                    <TeamManager
                                                        key={role}
                                                        role={role}
                                                        label={role === 'pm' ? 'PM' : role === 'sc' ? 'SC' : 'PD'}
                                                        color={role === 'pm' ? 'bg-purple-500' : role === 'sc' ? 'bg-blue-500' : 'bg-pink-500'}
                                                        hours={role === 'pm' ? (item.pmVal || 0) / 3600 : role === 'sc' ? (item.scVal || 0) / 3600 : (item.pdVal || 0) / 3600}
                                                        currentTeam={liveTeam}
                                                        allResources={allResources}
                                                        onAssign={onAssign ? (userId, r, options) => onAssign(item.projectId || item.id, userId, r, options) : () => { }}
                                                        onUnassign={onUnassign ? (userId) => onUnassign(item.projectId || item.id, userId, role) : () => { }}
                                                        onUpdateAllocation={onUpdateAllocation ? (r, userId, pct) => onUpdateAllocation(item.projectId || item.id, r, userId, pct) : null}
                                                        onCopyToOtherRoles={onCopyToOtherRoles ? (fromRole, toRole) => onCopyToOtherRoles(item.projectId || item.id, fromRole, toRole) : null}
                                                        onCopyToAllRoles={onCopyToAllRoles ? (fromRole) => onCopyToAllRoles(item.projectId || item.id, fromRole) : null}
                                                        roleMapping={roleMapping}
                                                        projectSquad={item.squad || (item.squads && item.squads[0]) || null}
                                                        projectDates={{ start: item.startDate, end: item.endDate }}
                                                        onUpdateMemberDates={onUpdateAllocation ? (r, userId, field, value) => onUpdateAllocation(item.projectId || item.id, r, userId, null, { [field]: value }) : null}
                                                    />
                                                );
                                            })}
                                        </div>
                                        {!onAssign && (
                                            <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fef3c7', borderRadius: '6px', fontSize: '10px', color: '#b45309', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                Team assignment backend not connected
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div >
        </div >
    );
};

export default DetailModal;

// PropTypes for runtime type validation
DetailModal.propTypes = {
    /** Data object containing project details for this cell */
    data: PropTypes.shape({
        dateKey: PropTypes.string,
        details: PropTypes.array
    }).isRequired,
    /** All resources in the system */
    allResources: PropTypes.array,
    /** All projects in the system */
    allProjects: PropTypes.array,
    /** Flattened squads list */
    allSquadsFlat: PropTypes.array,
    /** Program assignment records */
    programAssignments: PropTypes.array,
    /** Program workstreams with hours */
    programWorkstreams: PropTypes.array,
    /** Per-customer program budgets for accurate workstream hours */
    programBudgets: PropTypes.object,
    /** Program date range */
    programDates: PropTypes.shape({
        start: PropTypes.string,
        end: PropTypes.string
    }),
    /** Handler for assigning team members */
    onAssign: PropTypes.func,
    /** Handler for unassigning team members */
    onUnassign: PropTypes.func,
    /** Handler for updating allocation percentages */
    onUpdateAllocation: PropTypes.func,
    /** Handler for copying team to other roles */
    onCopyToOtherRoles: PropTypes.func,
    /** Handler for copying team to all roles */
    onCopyToAllRoles: PropTypes.func,
    /** Handler for updating project fields */
    onUpdateProject: PropTypes.func,
    /** Handler for updating resource fields */
    onUpdateResource: PropTypes.func,
    /** Array of ramp profiles */
    rampProfiles: PropTypes.array,
    /** Close modal handler */
    onClose: PropTypes.func.isRequired,
    /** Role mapping configuration */
    roleMapping: PropTypes.object,
    /** Toast notification handler */
    addToast: PropTypes.func,
    /** Arrow key navigation handler */
    onNavigate: PropTypes.func,
    /** Clone project handler */
    onClone: PropTypes.func,
    /** Manage program handler */
    onManageProgram: PropTypes.func
};
