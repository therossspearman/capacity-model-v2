/**
 * ResourcingTab - Zero-Based Resourcing View
 * Lists projects with expandable TeamManager-style resourcing.
 * Assumes a "start from 0" approach: all allocations cleared, but respects
 * ramp-up profiles, utilisation targets, and leave dates.
 * Supports virtual squad merging for cross-squad resource pools.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { BRAND } from '../../design-system';
import { getCategoryForFunction, formatNumber, getStatusColor } from '../../utils';

/* ─── tiny SVG icons ─── */
const ChevronIcon = ({ open }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
        <polyline points="9 18 15 12 9 6" />
    </svg>
);
const MergeIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
);
const CalendarIcon = ({ color = '#cbd5e1', size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);
const AlertIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round">
        <path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
);

/* ─── helpers ─── */
const formatDateForInput = (d) => {
    if (!d) return '';
    try { const dt = new Date(d); return isNaN(dt) ? '' : dt.toISOString().split('T')[0]; } catch { return ''; }
};
const formatDateShort = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' }); } catch { return '—'; }
};
const roleColors = { pm: '#BD65FF', sc: '#3b82f6', pd: '#ec4899' };
const roleLabels = { pm: 'Project Manager', sc: 'Solution Consultant', pd: 'Platform Developer' };

/* ─── inline resource row used inside expander ─── */
const ResourceChip = ({ member, allResources, onUnassign, onUpdateAllocation, teamLength }) => {
    const full = allResources?.find(r => r.id === member.id);
    const headshot = member.isPlaceholder ? null : (full?.headshot || member.headshot);
    const initials = member.isPlaceholder ? '?' : (member.name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const [localPct, setLocalPct] = useState(member.allocationPct ?? '');

    useEffect(() => { setLocalPct(member.allocationPct ?? ''); }, [member.allocationPct]);

    const commitPct = () => {
        let v = parseInt(localPct, 10);
        if (isNaN(v)) v = 0;
        v = Math.max(0, Math.min(100, v));
        if (v !== member.allocationPct) onUpdateAllocation(member.id, v);
    };

    // Constraint badges
    const isRamping = full?.rampProfile;
    const targetUtil = full?.targetUtilization ?? 0.8;
    const targetPct = Math.round(targetUtil * 100);
    const leaveDate = full?.leaveDate;
    const hasLeaveDate = leaveDate && new Date(leaveDate) > new Date();

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
            backgroundColor: member.isPlaceholder ? '#faf5ff' : BRAND.bgAlt,
            border: member.isPlaceholder ? '1px dashed #c084fc' : `1px solid ${BRAND.border}`,
            borderRadius: '10px', fontSize: '12px'
        }}>
            {headshot ? (
                <img src={headshot} alt={member.name} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }} />
            ) : (
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: member.isPlaceholder ? '#e9d5ff' : '#f1f5f9', color: member.isPlaceholder ? '#7637E3' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', flexShrink: 0 }}>{initials}</div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
                <span title={member.name} style={{ fontWeight: '600', color: member.isPlaceholder ? '#7637E3' : BRAND.dark, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px', cursor: 'help' }}>{member.name}</span>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '1px' }}>
                    {full?.squads?.[0] && <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '500' }}>{full.squads[0]}</span>}
                    {/* Constraint indicators */}
                    {isRamping && <span title={`Ramping: ${full.rampProfile}`} style={{ fontSize: '8px', fontWeight: '600', color: '#f59e0b', backgroundColor: '#fefce8', padding: '1px 4px', borderRadius: '3px', border: '1px solid #fde68a' }}>⚡ Ramp</span>}
                    {targetPct < 100 && <span title={`Target utilisation: ${targetPct}%`} style={{ fontSize: '8px', fontWeight: '600', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '1px 4px', borderRadius: '3px', border: '1px solid #bfdbfe' }}>🎯 {targetPct}%</span>}
                    {hasLeaveDate && <span title={`Leaving: ${formatDateShort(leaveDate)}`} style={{ fontSize: '8px', fontWeight: '600', color: '#ef4444', backgroundColor: '#fef2f2', padding: '1px 4px', borderRadius: '3px', border: '1px solid #fecaca' }}>🚪 {formatDateShort(leaveDate)}</span>}
                </div>
            </div>
            {/* Allocation Percentage */}
            {teamLength > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: '4px' }}>
                    <input type="number" min="0" max="100" value={localPct} placeholder="—"
                        onChange={e => setLocalPct(e.target.value)} onBlur={commitPct} onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                        onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                        style={{ width: '38px', padding: '3px 4px', fontSize: '11px', fontWeight: '600', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: localPct ? '#f0fdf4' : 'white', color: localPct ? '#00BD00' : '#64748b', outline: 'none' }}
                    />
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>%</span>
                </div>
            )}
            <button onClick={e => { e.stopPropagation(); onUnassign(member.id); }} style={{ color: '#cbd5e1', cursor: 'pointer', border: 'none', background: 'none', padding: '2px', fontSize: '14px' }}>✕</button>
        </div>
    );
};

/* ─── Resource Picker Dropdown (inline) ─── */
const ResourcePicker = ({ role, availableResources, projectSquad, roleMapping, onAssign, onClose, isDark }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const targetCategory = role === 'pm' ? 'PM' : role === 'sc' ? 'SC' : 'PD';
    const hasRoleMapping = roleMapping && Object.keys(roleMapping).length > 0 &&
        Object.values(roleMapping).some(v => v && (Array.isArray(v) ? v.length > 0 : true));

    // Group resources by squad
    const groups = useMemo(() => {
        const mapped = availableResources.map(r => {
            const cat = getCategoryForFunction(r.adJobTitle || r.role, roleMapping);
            const matchesRole = hasRoleMapping && cat && cat.toUpperCase() === targetCategory;
            return { ...r, matchesRole };
        });
        const recommended = mapped.filter(r => r.matchesRole);
        const others = mapped.filter(r => !r.matchesRole);
        const groups = {};
        if (recommended.length > 0) groups['★ Recommended (' + targetCategory + ')'] = recommended.sort((a, b) => a.name.localeCompare(b.name));
        others.forEach(r => {
            const sq = r.squads?.[0] || 'Unassigned';
            if (!groups[sq]) groups[sq] = [];
            groups[sq].push(r);
        });
        Object.values(groups).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
        const keys = Object.keys(groups).sort((a, b) => {
            if (a.startsWith('★')) return -1; if (b.startsWith('★')) return 1;
            if (a === projectSquad) return -1; if (b === projectSquad) return 1;
            return a.localeCompare(b);
        });
        return keys.map(k => ({ squad: k, resources: groups[k], isRecommended: k.startsWith('★'), isProjectSquad: k === projectSquad }));
    }, [availableResources, targetCategory, projectSquad]);

    return (
        <div style={{ position: 'relative', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
            <input ref={inputRef} type="text" placeholder="Search resources…" value={query} onChange={e => setQuery(e.target.value)}
                onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onBlur={() => setTimeout(onClose, 200)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '11px', border: '2px solid #7637E3', borderRadius: '8px 8px 0 0', backgroundColor: 'white', outline: 'none' }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '2px solid #7637E3', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '200px', overflowY: 'auto', zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {/* Placeholder option */}
                <div onClick={e => { e.stopPropagation(); onAssign(`PLACEHOLDER_${Date.now()}`, role, { isPlaceholder: true, name: `TBD ${roleLabels[role] || role}` }); onClose(); }}
                    onMouseDown={e => e.stopPropagation()}
                    style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#7637E3', backgroundColor: '#faf5ff', borderBottom: '2px solid #e2e8f0' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3e8ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#faf5ff'}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#e9d5ff', color: '#7637E3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>?</div>
                    <span>➕ Add Placeholder (TBD)</span>
                </div>
                {groups.filter(g => g.resources.some(r => r.name.toLowerCase().includes(query.toLowerCase()))).map(g => (
                    <div key={g.squad}>
                        <div style={{ padding: '6px 10px', fontSize: '9px', fontWeight: '700', color: g.isRecommended ? '#7637E3' : '#64748b', backgroundColor: g.isRecommended ? '#F7F3ED' : '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid #e2e8f0' }}>{g.squad}</div>
                        {g.resources.filter(r => r.name.toLowerCase().includes(query.toLowerCase())).map(r => {
                            const hs = r.headshot?.[0]?.url || r.headshot?.[0]?.thumbnails?.small?.url;
                            const ini = (r.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2);
                            const targetPct = Math.round((r.targetUtilization ?? 0.8) * 100);
                            const isLeaving = r.leaveDate && new Date(r.leaveDate) > new Date();
                            return (
                                <div key={r.id} onClick={e => { e.stopPropagation(); onAssign(r.id, role); onClose(); }} onMouseDown={e => e.stopPropagation()}
                                    style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: '#334155', backgroundColor: 'white', transition: 'background 0.1s' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                                    {hs ? <img src={hs} alt={r.name} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} /> :
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700' }}>{ini}</div>}
                                    <span style={{ fontWeight: '500', flex: 1 }}>{r.name}</span>
                                    {/* Constraint badges in picker */}
                                    {r.rampProfile && <span style={{ fontSize: '8px', fontWeight: '600', color: '#f59e0b', backgroundColor: '#fefce8', padding: '1px 4px', borderRadius: '3px' }}>⚡ Ramp</span>}
                                    {targetPct < 100 && <span style={{ fontSize: '8px', fontWeight: '600', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '1px 4px', borderRadius: '3px' }}>🎯{targetPct}%</span>}
                                    {isLeaving && <span style={{ fontSize: '8px', fontWeight: '600', color: '#ef4444', backgroundColor: '#fef2f2', padding: '1px 4px', borderRadius: '3px' }}>🚪</span>}
                                    {r.matchesRole && <span style={{ fontSize: '8px', fontWeight: '600', color: '#7637E3', backgroundColor: '#F7F3ED', padding: '2px 4px', borderRadius: '3px' }}>{targetCategory}</span>}
                                </div>
                            );
                        })}
                    </div>
                ))}
                {groups.filter(g => g.resources.some(r => r.name.toLowerCase().includes(query.toLowerCase()))).length === 0 && (
                    <div style={{ padding: '12px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>No resources found</div>
                )}
            </div>
        </div>
    );
};

/* ──────────────────────────────────────── */
/* ─── Project Row w/ Expander ─── */
/* ──────────────────────────────────────── */
const ProjectResourceRow = ({ project, assignments, availableResources, roleMapping, onAssign, onUnassign, onUpdateAllocation, isDark }) => {
    const [expanded, setExpanded] = useState(false);
    const [addingRole, setAddingRole] = useState(null); // 'pm' | 'sc' | 'pd' | null

    const statusColor = getStatusColor(project.status);
    const squad = project.squad || 'Unassigned';
    const roles = ['pm', 'sc', 'pd'];

    // Filter available resources: exclude those already assigned to THIS project
    const projectTeam = assignments || {};
    const assignedIds = new Set([...(projectTeam.pm || []), ...(projectTeam.sc || []), ...(projectTeam.pd || [])].map(m => m.id));
    const filteredResources = (availableResources || []).filter(r => !assignedIds.has(r.id) && r.squads?.length && !r.squads.every(s => !s || s === 'Unassigned'));

    // Count assignments across roles
    const totalAssigned = roles.reduce((s, r) => s + (projectTeam[r]?.length || 0), 0);

    return (
        <div style={{ backgroundColor: isDark ? '#1e293b' : 'white', borderRadius: expanded ? '16px' : '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, overflow: 'hidden', transition: 'all 0.2s' }}>
            {/* Header Row — clickable */}
            <div onClick={() => setExpanded(!expanded)} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', cursor: 'pointer',
                backgroundColor: expanded ? (isDark ? '#0f172a' : '#f8fafc') : 'transparent',
                transition: 'background 0.15s', userSelect: 'none'
            }}
                onMouseEnter={e => { if (!expanded) e.currentTarget.style.backgroundColor = isDark ? '#1a2744' : '#fafafa'; }}
                onMouseLeave={e => { if (!expanded) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                {/* Chevron */}
                <span style={{ color: isDark ? '#64748b' : '#94a3b8', flexShrink: 0 }}><ChevronIcon open={expanded} /></span>
                {/* Rank */}
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', minWidth: '28px', textAlign: 'center' }}>#{project._rank || '—'}</span>
                {/* Status dot */}
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColor, flexShrink: 0 }} title={project.status} />
                {/* Project name + customer */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '1px' }}>
                        <span>{project.customer || 'No customer'}</span>
                        <span>•</span>
                        <span>{squad}</span>
                        {project.arr > 0 && <><span>•</span><span style={{ color: '#00BD00', fontWeight: '600' }}>£{formatNumber(Math.round(project.arr))}</span></>}
                    </div>
                </div>
                {/* Dates */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>
                    <CalendarIcon size={11} />
                    <span>{formatDateShort(project.kickOff || project.start)} → {formatDateShort(project.launch || project.end)}</span>
                </div>
                {/* Assignment summary */}
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {roles.map(r => {
                        const c = (projectTeam[r] || []).length;
                        return (
                            <span key={r} title={`${roleLabels[r]}: ${c}`} style={{
                                fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                                backgroundColor: c > 0 ? (isDark ? 'rgba(0,189,0,0.15)' : '#f0fdf4') : (isDark ? '#0f172a' : '#f8fafc'),
                                color: c > 0 ? '#00BD00' : '#cbd5e1', border: `1px solid ${c > 0 ? '#bbf7d0' : (isDark ? '#334155' : '#e2e8f0')}`
                            }}>{r.toUpperCase()} {c}</span>
                        );
                    })}
                </div>
            </div>

            {/* Expanded Content — Role-based assignment */}
            {expanded && (
                <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    {roles.map(role => {
                        const team = projectTeam[role] || [];
                        const color = roleColors[role];
                        return (
                            <div key={role} style={{ backgroundColor: isDark ? '#0f172a' : 'white', border: `1px solid ${isDark ? '#334155' : BRAND.border}`, borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column' }}>
                                {/* Role Header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', paddingBottom: '6px', borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}` }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>{roleLabels[role]}</span>
                                </div>
                                {/* Current team members */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px', flex: 1 }}>
                                    {team.map(m => (
                                        <ResourceChip key={m.id} member={m} allResources={availableResources} teamLength={team.length}
                                            onUnassign={id => onUnassign(project.id, role, id)}
                                            onUpdateAllocation={(id, pct) => onUpdateAllocation(project.id, role, id, pct)} />
                                    ))}
                                    {team.length === 0 && <div style={{ fontSize: '10px', color: '#cbd5e1', fontStyle: 'italic', padding: '4px 0' }}>Unassigned</div>}
                                </div>
                                {/* Add button / picker */}
                                {addingRole === role ? (
                                    <ResourcePicker role={role} availableResources={filteredResources} projectSquad={squad}
                                        roleMapping={roleMapping} onAssign={(rId, rl, opts) => onAssign(project.id, rl, rId, opts)} onClose={() => setAddingRole(null)} isDark={isDark} />
                                ) : (
                                    <button onClick={e => { e.stopPropagation(); setAddingRole(role); }}
                                        style={{ marginTop: 'auto', width: '100%', padding: '6px', fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                        <span>+</span> Add
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/* ══════════════════════════════════════════════════════ */
/* ═══ MAIN: ResourcingTab ═══ */
/* ══════════════════════════════════════════════════════ */
const ResourcingTab = ({
    projects = [],
    resources = [],
    enabledSquads = [],
    roleMapping,
    isDark,
    onCreateDraft
}) => {
    // Local assignments state (zero-based — start empty)
    const [assignments, setAssignments] = useState({}); // { projectId: { pm: [member], sc: [member], pd: [member] } }
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSquad, setFilterSquad] = useState('');
    const [mergedSquads, setMergedSquads] = useState(new Set(enabledSquads || []));
    const [showMergePanel, setShowMergePanel] = useState(false);
    const [isCreatingDraft, setIsCreatingDraft] = useState(false);

    // All squads from resources
    const allSquads = useMemo(() => {
        const set = new Set();
        resources.forEach(r => (r.squads || []).forEach(s => { if (s && s !== 'Unassigned') set.add(s); }));
        return [...set].sort();
    }, [resources]);

    // Merged resource pool — respects leave dates but ignores current allocations
    const resourcePool = useMemo(() => {
        return resources.filter(r => {
            // Must belong to a merged squad
            const rSquads = r.squads || [];
            if (rSquads.length === 0 || rSquads.every(s => !s || s === 'Unassigned')) return false;
            const inScope = rSquads.some(s => mergedSquads.has(s));
            if (!inScope) return false;
            // Exclude if left already (leave date in the past)
            if (r.leaveDate && new Date(r.leaveDate) < new Date()) return false;
            return true;
        });
    }, [resources, mergedSquads]);

    // Filtered projects (by search, squad)
    const filteredProjects = useMemo(() => {
        let list = projects;
        if (filterSquad) list = list.filter(p => p.squad === filterSquad);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(p =>
                p.name?.toLowerCase().includes(q) ||
                p.customer?.toLowerCase().includes(q) ||
                p.squad?.toLowerCase().includes(q)
            );
        }
        // Sort by priority / cARR desc
        return list.sort((a, b) => (b.arr || 0) - (a.arr || 0)).map((p, i) => ({ ...p, _rank: i + 1 }));
    }, [projects, filterSquad, searchQuery]);

    // Assignment handlers
    const handleAssign = (projectId, role, resourceId, opts) => {
        setAssignments(prev => {
            const projAssign = { ...(prev[projectId] || { pm: [], sc: [], pd: [] }) };
            const existing = [...(projAssign[role] || [])];
            if (opts?.isPlaceholder) {
                existing.push({ id: resourceId, name: opts.name, isPlaceholder: true, allocationPct: 0 });
            } else {
                const res = resources.find(r => r.id === resourceId);
                if (res) {
                    existing.push({ id: res.id, name: res.name, headshot: res.headshot, allocationPct: 0 });
                }
            }
            projAssign[role] = existing;
            return { ...prev, [projectId]: projAssign };
        });
    };

    const handleUnassign = (projectId, role, memberId) => {
        setAssignments(prev => {
            const projAssign = { ...(prev[projectId] || { pm: [], sc: [], pd: [] }) };
            projAssign[role] = (projAssign[role] || []).filter(m => m.id !== memberId);
            return { ...prev, [projectId]: projAssign };
        });
    };

    const handleUpdateAllocation = (projectId, role, memberId, pct) => {
        setAssignments(prev => {
            const projAssign = { ...(prev[projectId] || { pm: [], sc: [], pd: [] }) };
            projAssign[role] = (projAssign[role] || []).map(m => m.id === memberId ? { ...m, allocationPct: pct } : m);
            return { ...prev, [projectId]: projAssign };
        });
    };

    // Toggle squad in merge set
    const toggleMergeSquad = (squad) => {
        setMergedSquads(prev => {
            const next = new Set(prev);
            if (next.has(squad)) next.delete(squad);
            else next.add(squad);
            return next;
        });
    };

    // Create draft from assignments
    const handleCreateDraft = async () => {
        if (!onCreateDraft) return;
        setIsCreatingDraft(true);
        try {
            const changes = [];
            Object.entries(assignments).forEach(([projectId, roleMap]) => {
                ['pm', 'sc', 'pd'].forEach(role => {
                    (roleMap[role] || []).forEach(member => {
                        if (member.isPlaceholder) return; // Skip placeholders
                        changes.push({
                            projectId,
                            resourceId: member.id,
                            resourceName: member.name,
                            role,
                            allocationPct: member.allocationPct || 0,
                            type: 'staffing',
                            aiGenerated: false
                        });
                    });
                });
            });
            if (changes.length) await onCreateDraft(changes);
        } finally {
            setIsCreatingDraft(false);
        }
    };

    // Stats
    const totalProjects = filteredProjects.length;
    const projectsWithAssignments = Object.keys(assignments).filter(pid => {
        const a = assignments[pid];
        return ['pm', 'sc', 'pd'].some(r => (a[r]?.length || 0) > 0);
    }).length;
    const totalAssignments = Object.values(assignments).reduce((s, a) => s + ['pm', 'sc', 'pd'].reduce((ss, r) => ss + (a[r]?.length || 0), 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* ─── Top Bar ─── */}
            <div style={{ padding: '12px 0', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input type="text" placeholder="Search projects…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px 8px 32px', fontSize: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '8px', backgroundColor: isDark ? '#0f172a' : 'white', color: isDark ? '#f1f5f9' : '#1e293b', outline: 'none' }} />
                </div>
                {/* Squad filter */}
                <select value={filterSquad} onChange={e => setFilterSquad(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '8px', backgroundColor: isDark ? '#0f172a' : 'white', color: isDark ? '#f1f5f9' : '#1e293b', cursor: 'pointer', outline: 'none' }}>
                    <option value="">All Squads</option>
                    {allSquads.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {/* Merge Squads toggle */}
                <button onClick={() => setShowMergePanel(!showMergePanel)}
                    style={{
                        padding: '8px 14px', fontSize: '11px', fontWeight: '600', borderRadius: '8px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px', border: 'none',
                        backgroundColor: showMergePanel ? '#7637E3' : (isDark ? '#334155' : '#f1f5f9'),
                        color: showMergePanel ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                        boxShadow: showMergePanel ? '0 2px 4px rgba(118,55,227,0.3)' : 'none'
                    }}>
                    <MergeIcon /> Merge Squads ({mergedSquads.size})
                </button>
                {/* Stats */}
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>
                    <span><strong style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{totalProjects}</strong> projects</span>
                    <span><strong style={{ color: '#00BD00' }}>{projectsWithAssignments}</strong> with assignments</span>
                    <span><strong style={{ color: '#7637E3' }}>{totalAssignments}</strong> resources assigned</span>
                    <span><strong style={{ color: '#3b82f6' }}>{resourcePool.length}</strong> in pool</span>
                </div>
            </div>

            {/* ─── Squad Merge Panel ─── */}
            {showMergePanel && (
                <div style={{
                    padding: '14px 18px', marginBottom: '12px', borderRadius: '12px',
                    backgroundColor: isDark ? '#0f172a' : '#faf5ff',
                    border: `1px solid ${isDark ? '#4c1d95' : '#e9d5ff'}`,
                    display: 'flex', flexDirection: 'column', gap: '10px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#7637E3' }}>Virtual Squad Merge</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => setMergedSquads(new Set(allSquads))} style={{ padding: '4px 10px', fontSize: '10px', fontWeight: '600', border: '1px solid #7637E3', borderRadius: '6px', backgroundColor: 'white', color: '#7637E3', cursor: 'pointer' }}>Select All</button>
                            <button onClick={() => setMergedSquads(new Set(enabledSquads || []))} style={{ padding: '4px 10px', fontSize: '10px', fontWeight: '600', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: 'white', color: '#64748b', cursor: 'pointer' }}>Reset</button>
                        </div>
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: '1.4' }}>
                        Toggle squads to create a merged resource pool. People from all selected squads will be available for assignment across all projects regardless of their home squad.
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {allSquads.map(s => {
                            const active = mergedSquads.has(s);
                            const membersInSquad = resources.filter(r => r.squads?.includes(s)).length;
                            return (
                                <button key={s} onClick={() => toggleMergeSquad(s)}
                                    style={{
                                        padding: '6px 12px', fontSize: '11px', fontWeight: '600', borderRadius: '20px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        border: active ? '2px solid #7637E3' : '1px solid #e2e8f0',
                                        backgroundColor: active ? '#f3e8ff' : 'white',
                                        color: active ? '#7637E3' : '#64748b',
                                        transition: 'all 0.15s'
                                    }}>
                                    {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7637E3" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                                    {s} <span style={{ fontSize: '9px', fontWeight: '400', color: active ? '#a78bfa' : '#cbd5e1' }}>({membersInSquad})</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── Zero-Based Callout ─── */}
            <div style={{
                padding: '10px 16px', marginBottom: '12px', borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff',
                border: `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`,
                display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: isDark ? '#93c5fd' : '#1e40af'
            }}>
                <AlertIcon />
                <span><strong>Zero-Based Resourcing</strong> — All projects start unassigned. Assign the best people from scratch. Ramp-up, utilisation targets, and leave dates are shown per resource.</span>
            </div>

            {/* ─── Project List ─── */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredProjects.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No Projects Found</h3>
                        <p style={{ fontSize: '13px' }}>Adjust your search or squad filter to see projects.</p>
                    </div>
                ) : (
                    filteredProjects.map(project => (
                        <ProjectResourceRow
                            key={project.id}
                            project={project}
                            assignments={assignments[project.id] || { pm: [], sc: [], pd: [] }}
                            availableResources={resourcePool}
                            roleMapping={roleMapping}
                            onAssign={handleAssign}
                            onUnassign={handleUnassign}
                            onUpdateAllocation={handleUpdateAllocation}
                            isDark={isDark}
                        />
                    ))
                )}
            </div>

            {/* ─── Footer ─── */}
            {totalAssignments > 0 && (
                <div style={{
                    padding: '14px 0 4px', marginTop: '12px', borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                        <strong style={{ color: '#7637E3' }}>{totalAssignments}</strong> assignments across <strong>{projectsWithAssignments}</strong> projects
                    </div>
                    <button onClick={handleCreateDraft} disabled={isCreatingDraft || totalAssignments === 0}
                        style={{
                            padding: '10px 24px', fontSize: '13px', fontWeight: '700', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(135deg, #7637E3 0%, #BD65FF 100%)', color: 'white',
                            opacity: isCreatingDraft ? 0.6 : 1, boxShadow: '0 4px 12px rgba(118,55,227,0.3)',
                            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                        }}>
                        {isCreatingDraft ? (
                            <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M4 12a8 8 0 018-8v8H4z" strokeOpacity="0.75" /></svg> Creating…</>
                        ) : (
                            <>Create Draft ({totalAssignments} assignments)</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

ResourcingTab.propTypes = {
    projects: PropTypes.array,
    resources: PropTypes.array,
    enabledSquads: PropTypes.array,
    roleMapping: PropTypes.object,
    isDark: PropTypes.bool,
    onCreateDraft: PropTypes.func
};

export default ResourcingTab;
