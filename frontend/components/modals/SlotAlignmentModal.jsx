/**
 * SlotAlignmentModal - Slot fit check with alignment options
 * Shows when a project is being assigned to a slot with date misalignment
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTheme, Z_INDEX } from '../../design-system';
import { Button } from '../ui';

/**
 * Calculate misalignment metrics
 */
const calculateAlignment = (slotStart, slotEnd, projectStart, projectEnd, durationWeeks) => {
    const slotStartMs = new Date(slotStart).getTime();
    const slotEndMs = new Date(slotEnd).getTime();
    const projStartMs = new Date(projectStart).getTime();
    const projEndMs = new Date(projectEnd).getTime();

    const weekMs = 7 * 24 * 60 * 60 * 1000;

    // Calculate slot end if not provided (start + durationWeeks)
    const effectiveSlotEnd = slotEndMs || (slotStartMs + durationWeeks * weekMs);

    // Idle at start: if project starts AFTER slot starts
    const idleStartMs = Math.max(0, projStartMs - slotStartMs);
    const idleStartWeeks = Math.round(idleStartMs / weekMs);

    // Overhang at end: if project ends AFTER slot ends
    const overhangMs = Math.max(0, projEndMs - effectiveSlotEnd);
    const overhangWeeks = Math.round(overhangMs / weekMs);

    // Idle at end: if project ends BEFORE slot ends
    const idleEndMs = Math.max(0, effectiveSlotEnd - projEndMs);
    const idleEndWeeks = Math.round(idleEndMs / weekMs);

    // Project duration in weeks
    const projectDurationWeeks = Math.round((projEndMs - projStartMs) / weekMs);

    // Compression needed: if project is longer than slot
    const compressionNeeded = Math.max(0, projectDurationWeeks - durationWeeks);

    // Is perfect fit?
    const isPerfectFit = idleStartWeeks === 0 && overhangWeeks === 0 && idleEndWeeks <= 1;

    return {
        slotStart,
        slotEnd: new Date(effectiveSlotEnd).toISOString().split('T')[0],
        projectStart,
        projectEnd,
        idleStartWeeks,
        idleEndWeeks,
        overhangWeeks,
        compressionNeeded,
        projectDurationWeeks,
        isPerfectFit,
        totalWasteWeeks: idleStartWeeks + idleEndWeeks
    };
};

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const SlotAlignmentModal = ({
    isOpen,
    onClose,
    slot,              // { taxonomyId, startDateKey, squad }
    project,           // { id, name, start, end, kickOff, launch }
    durationWeeks = 12,
    onConfirm          // (option: 'align' | 'accept' | 'cancel', adjustedDates?: { start, end }) => void
}) => {
    const { isDark, colors } = useTheme();
    const [selectedOption, setSelectedOption] = useState('align');

    const alignment = useMemo(() => {
        if (!slot || !project) return null;
        const slotStart = slot.startDateKey;
        const slotEndMs = new Date(slotStart).getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000;
        const slotEnd = new Date(slotEndMs).toISOString().split('T')[0];

        const projectStart = project.kickOff || project.start;
        const projectEnd = project.launch || project.end;

        return calculateAlignment(slotStart, slotEnd, projectStart, projectEnd, durationWeeks);
    }, [slot, project, durationWeeks]);

    if (!isOpen || !alignment) return null;

    const handleConfirm = () => {
        if (selectedOption === 'align') {
            // Align project to slot dates
            onConfirm('align', {
                start: alignment.slotStart,
                end: alignment.slotEnd
            });
        } else if (selectedOption === 'accept') {
            // Keep project dates, accept waste
            onConfirm('accept', null);
        } else {
            onClose();
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: Z_INDEX.MODAL_BACKDROP,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                width: '90%',
                maxWidth: '560px',
                backgroundColor: isDark ? '#1e293b' : 'white',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    background: alignment.isPerfectFit
                        ? (isDark ? 'linear-gradient(135deg, #1e3a3a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)')
                        : (isDark ? 'linear-gradient(135deg, #3b2a1e 0%, #1e293b 100%)' : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)')
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: alignment.isPerfectFit
                                ? 'linear-gradient(135deg, #00BD00 0%, #00BD00 100%)'
                                : 'linear-gradient(135deg, #FE9922 0%, #d97706 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {alignment.isPerfectFit ? (
                                <svg style={{ width: '22px', height: '22px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg style={{ width: '22px', height: '22px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '16px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b', margin: 0 }}>
                                {alignment.isPerfectFit ? 'Slot Alignment Check ✓' : '⚠️ Slot Alignment Check'}
                            </h2>
                            <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: 0 }}>
                                Assigning <strong>{project.name}</strong> to <strong>{slot.taxonomyId}</strong>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px' }}>
                    {/* Slot vs Project Dates */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        marginBottom: '20px'
                    }}>
                        {/* Slot Window */}
                        <div style={{
                            padding: '12px',
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            borderRadius: '8px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}>
                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Slot Window
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#00BD00', marginBottom: '4px' }}>
                                {slot.taxonomyId}
                            </div>
                            <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                                {formatDate(alignment.slotStart)} → {formatDate(alignment.slotEnd)}
                            </div>
                            <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>
                                {durationWeeks} weeks
                            </div>
                        </div>

                        {/* Project Dates */}
                        <div style={{
                            padding: '12px',
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            borderRadius: '8px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}>
                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Project Dates
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#FF8EFB', marginBottom: '4px' }}>
                                {project.name}
                            </div>
                            <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                                {formatDate(alignment.projectStart)} → {formatDate(alignment.projectEnd)}
                            </div>
                            <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>
                                {alignment.projectDurationWeeks} weeks
                            </div>
                        </div>
                    </div>

                    {/* Alignment Issues */}
                    {!alignment.isPerfectFit && (
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fef3c7',
                            borderRadius: '8px',
                            border: '1px solid #FE9922',
                            marginBottom: '20px'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
                                ⚡ Misalignment Detected
                            </div>
                            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: '#92400e' }}>
                                {alignment.idleStartWeeks > 0 && (
                                    <li><strong>{alignment.idleStartWeeks}w idle</strong> at start (slot starts before project)</li>
                                )}
                                {alignment.idleEndWeeks > 0 && (
                                    <li><strong>{alignment.idleEndWeeks}w idle</strong> at end (project ends before slot)</li>
                                )}
                                {alignment.overhangWeeks > 0 && (
                                    <li><strong>{alignment.overhangWeeks}w overhang</strong> (project extends past slot)</li>
                                )}
                                {alignment.compressionNeeded > 0 && (
                                    <li>Project needs <strong>{alignment.compressionNeeded}w compression</strong> to fit</li>
                                )}
                            </ul>
                        </div>
                    )}

                    {/* Options */}
                    {!alignment.isPerfectFit && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Option 1: Align to Slot */}
                            <label
                                onClick={() => setSelectedOption('align')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px',
                                    padding: '12px 14px',
                                    backgroundColor: selectedOption === 'align'
                                        ? (isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4')
                                        : (isDark ? '#0f172a' : 'white'),
                                    borderRadius: '8px',
                                    border: `2px solid ${selectedOption === 'align' ? '#00BD00' : (isDark ? '#334155' : '#e2e8f0')}`,
                                    cursor: 'pointer'
                                }}
                            >
                                <input
                                    type="radio"
                                    checked={selectedOption === 'align'}
                                    onChange={() => setSelectedOption('align')}
                                    style={{ marginTop: '2px', accentColor: '#00BD00' }}
                                />
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textPrimary }}>
                                        Align to Slot (Recommended)
                                    </div>
                                    <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>
                                        Move KO to {formatDate(alignment.slotStart)}, Launch to {formatDate(alignment.slotEnd)}
                                    </div>
                                </div>
                            </label>

                            {/* Option 2: Accept Waste */}
                            <label
                                onClick={() => setSelectedOption('accept')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px',
                                    padding: '12px 14px',
                                    backgroundColor: selectedOption === 'accept'
                                        ? (isDark ? 'rgba(245, 158, 11, 0.1)' : '#fefce8')
                                        : (isDark ? '#0f172a' : 'white'),
                                    borderRadius: '8px',
                                    border: `2px solid ${selectedOption === 'accept' ? '#FE9922' : (isDark ? '#334155' : '#e2e8f0')}`,
                                    cursor: 'pointer'
                                }}
                            >
                                <input
                                    type="radio"
                                    checked={selectedOption === 'accept'}
                                    onChange={() => setSelectedOption('accept')}
                                    style={{ marginTop: '2px', accentColor: '#FE9922' }}
                                />
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textPrimary }}>
                                        Keep Project Dates (Accept Waste)
                                    </div>
                                    <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>
                                        {alignment.totalWasteWeeks}w of slot capacity will be idle
                                    </div>
                                </div>
                            </label>
                        </div>
                    )}

                    {/* Perfect Fit Message */}
                    {alignment.isPerfectFit && (
                        <div style={{
                            padding: '16px',
                            backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4',
                            borderRadius: '8px',
                            border: '1px solid #00BD00',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#00BD00' }}>
                                ✓ Perfect Fit!
                            </div>
                            <div style={{ fontSize: '11px', color: '#166534', marginTop: '4px' }}>
                                Project aligns well with slot window. No capacity waste.
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc'
                }}>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        style={{
                            backgroundColor: alignment.isPerfectFit ? '#00BD00' : (selectedOption === 'align' ? '#00BD00' : '#FE9922')
                        }}
                    >
                        {alignment.isPerfectFit ? 'Confirm Assignment' : (selectedOption === 'align' ? 'Align & Assign' : 'Assign (Accept Waste)')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default SlotAlignmentModal;

SlotAlignmentModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    slot: PropTypes.object,
    project: PropTypes.object,
    durationWeeks: PropTypes.number,
    onConfirm: PropTypes.func.isRequired
};
