/**
 * SlotSnapshotPanel - Compare slot availability over time
 * Uses localStorage for snapshot persistence (no Airtable dependency)
 */
import React, { useState, useMemo } from 'react';
import { useTheme } from '../../design-system';

const SNAPSHOT_KEY = 'slotSnapshots';
const MAX_SNAPSHOTS = 10;

// Load snapshots from localStorage
const loadSnapshots = () => {
    try {
        const stored = localStorage.getItem(SNAPSHOT_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

// Save snapshots to localStorage
const saveSnapshots = (snapshots) => {
    try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots.slice(0, MAX_SNAPSHOTS)));
    } catch (e) {
        console.warn('[SlotSnapshot] Failed to save:', e);
    }
};

// Calculate delta between two slot maps
const calculateDelta = (current, previous) => {
    const deltas = {};
    const allSquads = new Set([...Object.keys(current || {}), ...Object.keys(previous || {})]);

    allSquads.forEach(squad => {
        const currSquad = current?.[squad] || {};
        const prevSquad = previous?.[squad] || {};
        const allWeeks = new Set([...Object.keys(currSquad), ...Object.keys(prevSquad)]);

        deltas[squad] = {};
        allWeeks.forEach(week => {
            const currSlots = currSquad[week]?.availableSlots || 0;
            const prevSlots = prevSquad[week]?.availableSlots || 0;
            const delta = currSlots - prevSlots;
            if (Math.abs(delta) > 0.1) {
                deltas[squad][week] = { current: currSlots, previous: prevSlots, delta };
            }
        });
    });

    return deltas;
};

// Summary stats for a slotMap
const calculateSummary = (slotMap) => {
    let open = 0, partial = 0, full = 0, totalSlots = 0;
    Object.values(slotMap || {}).forEach(squad => {
        Object.values(squad).forEach(cell => {
            totalSlots++;
            if (cell.state === 'OPEN') open++;
            else if (cell.state === 'PARTIAL') partial++;
            else full++;
        });
    });
    return { open, partial, full, total: totalSlots };
};

export const SlotSnapshotPanel = ({ slotMap, enabledSquads = [] }) => {
    const { isDark } = useTheme();
    const [snapshots, setSnapshots] = useState(() => loadSnapshots());
    const [selectedIdx, setSelectedIdx] = useState(null);
    const [snapshotName, setSnapshotName] = useState('');

    // Current summary
    const currentSummary = useMemo(() => calculateSummary(slotMap), [slotMap]);

    // Compare with selected snapshot
    const comparison = useMemo(() => {
        if (selectedIdx === null || !snapshots[selectedIdx]) return null;
        const previous = snapshots[selectedIdx].slotMap;
        return {
            deltas: calculateDelta(slotMap, previous),
            prevSummary: calculateSummary(previous),
            snapshot: snapshots[selectedIdx]
        };
    }, [slotMap, snapshots, selectedIdx]);

    // Save current state as snapshot
    const handleSaveSnapshot = () => {
        const name = snapshotName.trim() || new Date().toLocaleString();
        const newSnapshot = {
            id: Date.now(),
            name,
            timestamp: new Date().toISOString(),
            slotMap: JSON.parse(JSON.stringify(slotMap)), // Deep clone
            summary: currentSummary
        };
        const updated = [newSnapshot, ...snapshots].slice(0, MAX_SNAPSHOTS);
        setSnapshots(updated);
        saveSnapshots(updated);
        setSnapshotName('');
    };

    // Delete a snapshot
    const handleDeleteSnapshot = (idx) => {
        const updated = snapshots.filter((_, i) => i !== idx);
        setSnapshots(updated);
        saveSnapshots(updated);
        if (selectedIdx === idx) setSelectedIdx(null);
    };

    // Styles
    const cardStyle = {
        backgroundColor: isDark ? '#1e293b' : 'white',
        borderRadius: '12px',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        padding: '16px'
    };

    const buttonStyle = (variant = 'secondary') => ({
        padding: '8px 16px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: variant === 'primary' ? '#4794FF' : (isDark ? '#334155' : '#f1f5f9'),
        color: variant === 'primary' ? 'white' : (isDark ? '#f1f5f9' : '#334155')
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            {/* Header */}
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                        📸 Slot Snapshots
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                        Save and compare slot availability over time
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Snapshot name (optional)"
                        value={snapshotName}
                        onChange={(e) => setSnapshotName(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                            backgroundColor: isDark ? '#0f172a' : 'white',
                            color: isDark ? '#f1f5f9' : '#1e293b',
                            fontSize: '12px',
                            width: '180px'
                        }}
                    />
                    <button onClick={handleSaveSnapshot} style={buttonStyle('primary')}>
                        💾 Save Snapshot
                    </button>
                </div>
            </div>

            {/* Current Stats */}
            <div style={{ ...cardStyle }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Current State
                </div>
                <div style={{ display: 'flex', gap: '24px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#00BD00' }}>{currentSummary.open}</div>
                        <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>Open</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#FE9922' }}>{currentSummary.partial}</div>
                        <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>Partial</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626' }}>{currentSummary.full}</div>
                        <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>Full</div>
                    </div>
                </div>
            </div>

            {/* Snapshots List */}
            {snapshots.length > 0 && (
                <div style={{ ...cardStyle }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>
                        Saved Snapshots ({snapshots.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {snapshots.map((snap, idx) => (
                            <div
                                key={snap.id}
                                onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: selectedIdx === idx
                                        ? (isDark ? 'rgba(71, 148, 255, 0.2)' : '#dbeafe')
                                        : (isDark ? '#0f172a' : '#f8fafc'),
                                    border: selectedIdx === idx
                                        ? '2px solid #4794FF'
                                        : `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    cursor: 'pointer'
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                        {snap.name}
                                    </div>
                                    <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                        {new Date(snap.timestamp).toLocaleString()} • Open: {snap.summary?.open || 0} | Partial: {snap.summary?.partial || 0} | Full: {snap.summary?.full || 0}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteSnapshot(idx); }}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        color: isDark ? '#f87171' : '#dc2626',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Comparison View */}
            {comparison && (
                <div style={{ ...cardStyle }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>
                        Comparison: Now vs "{comparison.snapshot.name}"
                    </div>

                    {/* Summary Comparison */}
                    <div style={{ display: 'flex', gap: '32px', marginBottom: '16px' }}>
                        <div>
                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '4px' }}>Open Slots</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                    {currentSummary.open}
                                </span>
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: currentSummary.open > comparison.prevSummary.open ? '#00BD00' : '#dc2626'
                                }}>
                                    {currentSummary.open > comparison.prevSummary.open ? '↑' : '↓'} {Math.abs(currentSummary.open - comparison.prevSummary.open)}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '4px' }}>Partial Slots</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                    {currentSummary.partial}
                                </span>
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: currentSummary.partial === comparison.prevSummary.partial
                                        ? (isDark ? '#94a3b8' : '#64748b')
                                        : '#FE9922'
                                }}>
                                    {currentSummary.partial > comparison.prevSummary.partial ? '↑' : currentSummary.partial < comparison.prevSummary.partial ? '↓' : '='} {Math.abs(currentSummary.partial - comparison.prevSummary.partial)}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginBottom: '4px' }}>Full Slots</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                    {currentSummary.full}
                                </span>
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: currentSummary.full < comparison.prevSummary.full ? '#00BD00' : '#dc2626'
                                }}>
                                    {currentSummary.full > comparison.prevSummary.full ? '↑' : '↓'} {Math.abs(currentSummary.full - comparison.prevSummary.full)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Per-Squad Changes */}
                    <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
                        Significant Changes by Squad
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                        {Object.entries(comparison.deltas).map(([squad, weeks]) => {
                            const changes = Object.entries(weeks);
                            if (changes.length === 0) return null;
                            return (
                                <div key={squad} style={{ padding: '8px', backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderRadius: '6px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b', marginBottom: '4px' }}>{squad}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {changes.slice(0, 8).map(([week, { delta }]) => (
                                            <span
                                                key={week}
                                                style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    backgroundColor: delta > 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                                                    color: delta > 0 ? '#00BD00' : '#dc2626'
                                                }}
                                            >
                                                {new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                                            </span>
                                        ))}
                                        {changes.length > 8 && (
                                            <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>
                                                +{changes.length - 8} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {snapshots.length === 0 && (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '32px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                    <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>
                        No snapshots saved yet. Save your first snapshot to track changes over time.
                    </div>
                </div>
            )}
        </div>
    );
};

export default SlotSnapshotPanel;
