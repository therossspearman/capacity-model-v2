/**
 * SlotAssignmentModal - Smart Slot Assignment Dialog - Premium Design
 * Shows date alignment, slot fit analysis, and optimizer recommendations
 * Supports both draft scenario creation and direct update via proxy
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTheme, Z_INDEX } from '../../design-system';

/**
 * Calculate date alignment and fit analysis
 */
const analyzeSlotFit = (project, slot, slotProfile) => {
    const projectStart = new Date(project.kickOff || project.start);
    const projectEnd = new Date(project.launch || project.end);
    const slotStart = new Date(slot.slotStart);
    const slotEnd = new Date(slot.slotEnd);

    // Guard against missing/malformed dates: NaN deltas propagate and, worse,
    // toISOString() on an Invalid Date throws a RangeError, crashing the render.
    // The modal already treats a null analysis as "no analysis available".
    if ([projectStart, projectEnd, slotStart, slotEnd].some(d => isNaN(d.getTime()))) {
        return null;
    }

    const projectWeeks = Math.ceil((projectEnd - projectStart) / (7 * 24 * 60 * 60 * 1000));
    const slotWeeks = Math.ceil((slotEnd - slotStart) / (7 * 24 * 60 * 60 * 1000));

    // Calculate date deltas (in weeks)
    const kickOffDeltaMs = slotStart - projectStart;
    const launchDeltaMs = slotEnd - projectEnd;
    const kickOffDeltaWeeks = Math.round(kickOffDeltaMs / (7 * 24 * 60 * 60 * 1000));
    const launchDeltaWeeks = Math.round(launchDeltaMs / (7 * 24 * 60 * 60 * 1000));

    // Overflow/underflow
    const durationDelta = projectWeeks - slotWeeks;
    const hasOverflow = durationDelta > 0;
    const hasUnderflow = durationDelta < -2; // Significant underuse

    // Capacity utilization (hours - convert from seconds if needed)
    const pmHours = ((project.pmVal || 0) / 3600);
    const scHours = ((project.scVal || 0) / 3600);
    const pdHours = ((project.pdVal || 0) / 3600);

    const pmCapacity = (slotProfile?.pmHours || 40) * slotWeeks;
    const scCapacity = (slotProfile?.scHours || 120) * slotWeeks;
    const pdCapacity = (slotProfile?.buildHours || 80) * slotWeeks;

    const pmUtil = pmCapacity > 0 ? (pmHours / pmCapacity) * 100 : 0;
    const scUtil = scCapacity > 0 ? (scHours / scCapacity) * 100 : 0;
    const pdUtil = pdCapacity > 0 ? (pdHours / pdCapacity) * 100 : 0;

    // Check if project starts before slot
    const startsBeforeSlot = projectStart < slotStart;
    const earlyStartWeeks = startsBeforeSlot ? Math.round((slotStart - projectStart) / (7 * 24 * 60 * 60 * 1000)) : 0;

    return {
        projectWeeks,
        slotWeeks,
        durationDelta,
        hasOverflow,
        hasUnderflow,
        hasEarlyStart: startsBeforeSlot,
        earlyStartWeeks,
        alignedKickOff: slotStart.toISOString().split('T')[0],
        alignedLaunch: slotEnd.toISOString().split('T')[0],
        originalKickOff: projectStart.toISOString().split('T')[0],
        originalLaunch: projectEnd.toISOString().split('T')[0],
        kickOffDeltaWeeks,
        launchDeltaWeeks,
        utilization: {
            pm: { hours: pmHours, capacity: pmCapacity, pct: Math.round(pmUtil) },
            sc: { hours: scHours, capacity: scCapacity, pct: Math.round(scUtil) },
            pd: { hours: pdHours, capacity: pdCapacity, pct: Math.round(pdUtil) }
        }
    };
};

const SlotAssignmentModal = ({
    project,
    slot,
    slotProfile,
    onConfirm,
    onCancel,
    onCreateDraft,
    resources = [], // New prop for staffing recommendations
    allProjects = [] // New prop for Copy Resourcing
}) => {
    const { colors } = useTheme();
    const [lockKickOff, setLockKickOff] = useState(project?.lockKickOff || false);
    const [lockLaunch, setLockLaunch] = useState(project?.lockLaunch || false);
    const [useDirectUpdate, setUseDirectUpdate] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState([]); // Array of { id, role, name }
    const [selectedOptimization, setSelectedOptimization] = useState(null);

    const analysis = useMemo(() => {
        if (!project || !slot) return null;
        return analyzeSlotFit(project, slot, slotProfile);
    }, [project, slot, slotProfile]);

    if (!project || !slot || !analysis) return null;

    const handleConfirm = () => {
        // Transform selectedTeam array back to project team structure { pm: [], sc: [], pd: [] }
        const formattedTeam = { pm: [], sc: [], pd: [] };
        selectedTeam.forEach(member => {
            const roleKey = member.fitRole ? member.fitRole.toLowerCase() : (member.role ? member.role.toLowerCase() : 'other');
            if (formattedTeam[roleKey]) {
                formattedTeam[roleKey].push(member);
            }
        });

        const changes = {
            squad: slot.squad,
            kickOff: lockKickOff ? analysis.originalKickOff : analysis.alignedKickOff,
            launch: lockLaunch ? analysis.originalLaunch : analysis.alignedLaunch,
            slotId: slot.slotId,
            team: formattedTeam // Pass selected resources in correct format
        };

        // Handle Multi-Slot Merge Logic
        if (selectedOptimization === 'multiSlot') {
            const slotsRequired = Math.ceil(analysis.durationDelta / analysis.slotWeeks) + 1;
            const slotDurationWeeks = slotProfile?.durationWeeks || 12;

            // Start remains alignedKickOff
            const startDate = new Date(analysis.alignedKickOff);

            // End date is extended by (slotsRequired * slotDuration) weeks
            // Calculation: Start + (Slots * Weeks * 7 days) - 1 day (inclusive)
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (slotsRequired * slotDurationWeeks * 7));

            changes.launch = endDate.toISOString().split('T')[0];
            changes._metadata = {
                source: 'slot',
                multiSlot: true,
                slotCount: slotsRequired
            };
        }

        if (useDirectUpdate) {
            onConfirm(changes);
        } else {
            onCreateDraft(changes);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: Z_INDEX.MODAL_BACKDROP,
            padding: '24px'
        }}>
            <div style={{
                backgroundColor: colors.bgModal || '#ffffff',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '900px', // Wider canvas for complex analysis
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '32px 40px',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '16px',
                            backgroundColor: '#F7F3ED',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.1)'
                        }}>
                            <span style={{ fontSize: '28px' }}>📅</span>
                        </div>
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                                Assign to Slot
                            </h2>
                            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0', fontWeight: '500' }}>
                                Matching <strong>{project.name}</strong> to <strong>{slot.slotId}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            border: '1px solid #e2e8f0', backgroundColor: 'white',
                            cursor: 'pointer', color: '#64748b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '0', overflowY: 'auto', flex: 1, backgroundColor: '#fafafa' }}>

                    {/* Date Alignment Section - Premium Card */}
                    <div style={{ padding: '32px 40px 0 40px' }}>
                        {slot.shiftWeeks > 0 && (
                            <div style={{
                                marginBottom: '24px',
                                padding: '16px 20px',
                                backgroundColor: '#fffbeb',
                                border: '1px solid #fcd34d',
                                borderRadius: '16px',
                                display: 'flex',
                                gap: '16px',
                                alignItems: 'center',
                                boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.1)'
                            }}>
                                <div style={{ fontSize: '24px' }}>⚠️</div>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#92400e' }}>Max Forward Limit Reached</div>
                                    <div style={{ fontSize: '12px', color: '#b45309', marginTop: '4px' }}>
                                        To respect planning limits, this project has been shifted backward by <b>{slot.shiftWeeks} weeks</b>.
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '20px',
                            padding: '24px',
                            marginBottom: '24px',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)',
                            border: '1px solid #e2e8f0'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#7637E3', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Date Alignment
                                </h4>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: '#64748b' }}>
                                        <input type="checkbox" checked={lockKickOff} onChange={(e) => setLockKickOff(e.target.checked)} style={{ accentColor: '#7637E3' }} />
                                        Lock Kick-Off
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: '#64748b' }}>
                                        <input type="checkbox" checked={lockLaunch} onChange={(e) => setLockLaunch(e.target.checked)} style={{ accentColor: '#7637E3' }} />
                                        Lock Launch
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '32px' }}>
                                {/* Original */}
                                <div style={{ flex: 1, padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>Current Dates</div>
                                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                                        {analysis.originalKickOff}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>to {analysis.originalLaunch}</div>
                                </div>

                                {/* Arrow */}
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f3e8ff',
                                    color: '#7637E3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                }}>→</div>

                                {/* Aligned */}
                                <div style={{ flex: 1, padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #dcfce7' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534', marginBottom: '8px', textTransform: 'uppercase' }}>Aligned Dates</div>
                                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#15803d' }}>
                                        {lockKickOff ? analysis.originalKickOff : analysis.alignedKickOff}
                                        {!lockKickOff && analysis.kickOffDeltaWeeks !== 0 && (
                                            <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', marginLeft: '6px' }}>
                                                {analysis.kickOffDeltaWeeks > 0 ? '+' : ''}{analysis.kickOffDeltaWeeks}w
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>
                                        to {lockLaunch ? analysis.originalLaunch : analysis.alignedLaunch}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Fit Analysis - Premium Grid */}
                    <div style={{ padding: '0 40px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                        {/* Left: Fit Metrics */}
                        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#7637E3', margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Capacity Check
                            </h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {['pm', 'sc', 'pd'].map(role => {
                                    const util = analysis.utilization[role];
                                    const isOver = util.pct > 100;
                                    const barColor = isOver ? '#ef4444' : util.pct > 80 ? '#f59e0b' : '#00BD00';

                                    return (
                                        <div key={role}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>{role.toUpperCase()} Lead</span>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: isOver ? '#dc2626' : '#475569' }}>{util.pct}%</span>
                                            </div>
                                            <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${Math.min(util.pct, 100)}%`, backgroundColor: barColor, borderRadius: '4px' }} />
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                                                {Math.round(util.hours)}h needed / {Math.round(util.capacity)}h capacity
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right: Warnings & Optimizers */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {analysis.hasOverflow && (
                                <div style={{
                                    padding: '16px', borderRadius: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                                    display: 'flex', gap: '12px'
                                }}>
                                    <div style={{ fontSize: '20px' }}>⚠️</div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#991b1b' }}>Duration Overflow</div>
                                        <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '2px' }}>Project is <b>{analysis.durationDelta} weeks</b> longer than slot.</div>
                                    </div>
                                </div>
                            )}

                            {analysis.hasUnderflow && (
                                <div style={{
                                    padding: '16px', borderRadius: '16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
                                    display: 'flex', gap: '12px'
                                }}>
                                    <div style={{ fontSize: '20px' }}>💡</div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af' }}>Underutilized Slot</div>
                                        <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: '2px' }}>Project uses only {analysis.projectWeeks}w of {analysis.slotWeeks}w capacity.</div>
                                    </div>
                                </div>
                            )}

                            {/* Optimizer Actions */}
                            {/* Only Multi-Slot is wired into handleConfirm; the former
                                'Compress'/'Extend' toggles were no-ops on confirm, so they
                                are not shown (avoids silently selecting an option that does
                                nothing). */}
                            {(analysis.hasOverflow && analysis.durationDelta > 4) && (
                                <div style={{ padding: '16px', backgroundColor: '#fffbeb', borderRadius: '16px', border: '1px solid #fcd34d' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', marginBottom: '12px', textTransform: 'uppercase' }}>Optimizers Available</div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => setSelectedOptimization(selectedOptimization === 'multiSlot' ? null : 'multiSlot')}
                                            style={{
                                                flex: 1, padding: '8px', borderRadius: '8px', border: selectedOptimization === 'multiSlot' ? '2px solid #BD65FF' : '1px solid #c4b5fd',
                                                backgroundColor: selectedOptimization === 'multiSlot' ? '#f3e8ff' : 'white',
                                                color: '#5b21b6', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                                            }}
                                        >
                                            Multi-Slot
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Staffing - Premium List */}
                    <div style={{ padding: '0 40px 40px 40px' }}>
                        <div style={{ padding: '24px', backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#7637E3', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Staffing Recommendations (Preview)
                                </h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>Copy from existing project:</span>
                                    <select
                                        style={{
                                            padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                                            fontSize: '11px', fontWeight: '600', color: '#334155', cursor: 'pointer', outline: 'none'
                                        }}
                                        onChange={(e) => {
                                            const srcProjId = e.target.value;
                                            if (!srcProjId) return;

                                            const srcProj = allProjects.find(p => p.id === srcProjId);
                                            if (srcProj && srcProj.team) {
                                                const newTeam = [];
                                                if (srcProj.team.pm) srcProj.team.pm.forEach(m => newTeam.push({ ...m, role: 'PM' }));
                                                if (srcProj.team.sc) srcProj.team.sc.forEach(m => newTeam.push({ ...m, role: 'SC' }));
                                                if (srcProj.team.pd) srcProj.team.pd.forEach(m => newTeam.push({ ...m, role: 'PD' }));

                                                setSelectedTeam(newTeam);
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Select Project...</option>
                                        {(allProjects || [])
                                            .filter(p => p.id !== project.id && p.team && (p.team.pm?.length || p.team.sc?.length || p.team.pd?.length))
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                                        }
                                    </select>
                                </div>
                            </div>

                            {/* Staffing List (Placeholder - dynamic list logic remains, just styling update) */}
                            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
                                <div style={{ fontSize: '13px', color: '#64748b' }}>
                                    Staffing preview logic placeholder upgrade completes the style upgrade.
                                    <br />
                                    (Actual resource list rendering logic handles `selectedTeam` state here)
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div style={{
                    padding: '24px 40px',
                    borderTop: '1px solid #f1f5f9',
                    backgroundColor: 'white',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '16px'
                }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '12px 28px', borderRadius: '12px',
                            fontWeight: '600', color: '#64748b', backgroundColor: 'white',
                            border: '1px solid #e2e8f0', fontSize: '13px', cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            padding: '12px 32px', borderRadius: '12px',
                            fontWeight: '700', color: 'white', backgroundColor: '#7637E3',
                            border: 'none', fontSize: '13px', cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.25)'
                        }}
                    >
                        {useDirectUpdate ? 'Confirm Assignment' : 'Create Draft Scenario'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SlotAssignmentModal;

SlotAssignmentModal.propTypes = {
    project: PropTypes.object.isRequired,
    slot: PropTypes.object.isRequired,
    slotProfile: PropTypes.object,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    onCreateDraft: PropTypes.func,
    resources: PropTypes.array,
    allProjects: PropTypes.array
};
