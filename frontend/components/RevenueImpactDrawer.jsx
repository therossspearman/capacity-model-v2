import React, { useMemo } from 'react';

const RevenueImpactDrawer = ({ isOpen, onClose, liveRevenue, draftRevenue, periodLabel }) => {
    // 1. Calculate Per-Project Deltas
    const impactData = useMemo(() => {
        if (!liveRevenue || !draftRevenue) return [];

        const projectMap = new Map();

        // Add Live Projects
        (liveRevenue.projects || []).forEach(p => {
            projectMap.set(p.id, {
                id: p.id,
                name: p.name,
                live: p.total,
                liveDate: p.launchDate, // Capture Live Date
                draft: 0
            });
        });

        // Add/Update Draft Projects
        (draftRevenue.projects || []).forEach(p => {
            const existing = projectMap.get(p.id) || {
                id: p.id,
                name: p.name,
                live: 0,
                draft: 0
            };
            existing.draft = p.total;
            existing.draftDate = p.launchDate; // Capture Draft Date
            projectMap.set(p.id, existing);
        });

        // Calculate Deltas and list
        const results = [];
        projectMap.forEach(p => {
            const delta = p.draft - p.live;
            // Include if revenue changed OR date changed (sometimes revenue doesn't change but date does in same period)
            // But user specifically asked for "dates that are changing" in the context of revenue impact.
            // Let's stick to the filter > 1 for revenue, but show date if it changed.
            if (Math.abs(delta) > 1) {
                results.push({ ...p, delta });
            }
        });

        // Sort by Impact Magnitude (highest change first)
        return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    }, [liveRevenue, draftRevenue]);

    const totalDelta = (draftRevenue?.totals?.total || 0) - (liveRevenue?.totals?.total || 0);

    // Helper to format date
    const formatDate = (d) => {
        if (!d) return 'N/A';
        const date = new Date(d);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    return (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)',
                    zIndex: 9998, transition: 'opacity 0.3s',
                    opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none'
                }}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: '500px',
                    backgroundColor: 'white', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
                    zIndex: 9999, transition: 'transform 0.3s ease-in-out',
                    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                    display: 'flex', flexDirection: 'column'
                }}
            >
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>Revenue Impact Breakdown</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                            {periodLabel} • Net Impact:
                            <span style={{
                                fontWeight: '700', marginLeft: '6px',
                                color: totalDelta > 0 ? '#00BD00' : totalDelta < 0 ? '#dc2626' : '#64748b'
                            }}>
                                {totalDelta > 0 ? '+' : ''}£{Math.round(totalDelta).toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ padding: '8px', borderRadius: '6px', border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}
                    >
                        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                    {impactData.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                            No revenue changes found in this period.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '12px 24px', fontWeight: '600', color: '#475569' }}>Project</th>
                                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: '600', color: '#475569', width: '90px' }}>Live</th>
                                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: '600', color: '#475569', width: '90px' }}>Draft</th>
                                    <th style={{ textAlign: 'right', padding: '12px 24px', fontWeight: '600', color: '#475569', width: '100px' }}>Impact</th>
                                </tr>
                            </thead>
                            <tbody>
                                {impactData.map(item => {
                                    const hasDateChange = item.liveDate && item.draftDate && item.liveDate !== item.draftDate;
                                    return (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '12px 24px', color: '#1e293b', fontWeight: '500' }}>
                                                {item.name}
                                                {hasDateChange && (
                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ textDecoration: 'line-through' }}>{formatDate(item.liveDate)}</span>
                                                        <span>→</span>
                                                        <span style={{ color: '#0f172a', fontWeight: '600' }}>{formatDate(item.draftDate)}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>
                                                £{Math.round(item.live).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>
                                                £{Math.round(item.draft).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px',
                                                    color: item.delta > 0 ? '#00BD00' : '#dc2626',
                                                    fontWeight: '600'
                                                }}>
                                                    {item.delta > 0 ? '+' : ''}£{Math.round(item.delta).toLocaleString()}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    );
};

export default RevenueImpactDrawer;
