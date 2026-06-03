/**
 * AuditDrawer - Timeline view of audit events
 * Slide-out drawer showing history of changes
 */

import React, { useState, useMemo } from 'react';
import { useTheme } from '../../design-system';
import { getAuditLog, clearAuditLog, AUDIT_EVENTS } from '../../utils/AuditLog';
import { ConfirmModal } from '../modals/ConfirmModal';

const AuditDrawer = ({ isOpen, onClose }) => {
    const { isDark } = useTheme();
    const [filter, setFilter] = useState('all'); // all, projects, resources, scenarios
    const [searchTerm, setSearchTerm] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const events = useMemo(() => getAuditLog(), [isOpen]);

    const filteredEvents = useMemo(() => {
        let result = events;

        // Filter by category
        if (filter !== 'all') {
            const categoryMap = {
                projects: [
                    AUDIT_EVENTS.PROJECT_ASSIGNED,
                    AUDIT_EVENTS.PROJECT_MOVED,
                    AUDIT_EVENTS.PROJECT_DATES_CHANGED,
                    AUDIT_EVENTS.PROJECT_LOCKED,
                    AUDIT_EVENTS.PROJECT_UNLOCKED,
                    AUDIT_EVENTS.SLOT_ASSIGNMENT
                ],
                resources: [
                    AUDIT_EVENTS.RESOURCE_ASSIGNED,
                    AUDIT_EVENTS.RESOURCE_UNASSIGNED,
                    AUDIT_EVENTS.ALLOCATION_UPDATED
                ],
                scenarios: [
                    AUDIT_EVENTS.SCENARIO_CREATED,
                    AUDIT_EVENTS.SCENARIO_ACTIVATED,
                    AUDIT_EVENTS.SCENARIO_COMMITTED,
                    AUDIT_EVENTS.SCENARIO_REVERTED,
                    AUDIT_EVENTS.SCENARIO_DELETED
                ],
                optimization: [AUDIT_EVENTS.OPTIMIZATION_APPLIED]
            };
            result = result.filter(e => categoryMap[filter]?.includes(e.type));
        }

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(e =>
                e.summary?.toLowerCase().includes(term) ||
                e.details?.projectName?.toLowerCase().includes(term) ||
                e.details?.resourceName?.toLowerCase().includes(term)
            );
        }

        return result;
    }, [events, filter, searchTerm]);

    // Group events by date. Returns an array of [dateLabel, dayEvents] sorted
    // most-recent-day first so rendering does not rely on object key insertion
    // order. The year is included in the label to avoid collapsing the same
    // day/month across different years into one group.
    const groupedEvents = useMemo(() => {
        const groups = {};
        filteredEvents.forEach(event => {
            const date = new Date(event.timestamp).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            if (!groups[date]) {
                groups[date] = { label: date, latest: event.timestamp, events: [] };
            }
            if (event.timestamp > groups[date].latest) {
                groups[date].latest = event.timestamp;
            }
            groups[date].events.push(event);
        });
        return Object.values(groups)
            .sort((a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime())
            .map(g => [g.label, g.events]);
    }, [filteredEvents]);

    const getEventIcon = (type) => {
        if (type.includes('PROJECT') || type === 'SLOT_ASSIGNMENT') return '📋';
        if (type.includes('RESOURCE') || type.includes('ALLOCATION')) return '👤';
        if (type.includes('SCENARIO')) return '📊';
        if (type.includes('OPTIMIZATION')) return '✨';
        if (type.includes('SETTINGS')) return '⚙️';
        return '📝';
    };

    const getEventColor = (type) => {
        if (type.includes('ASSIGNED') || type.includes('CREATED')) return '#00BD00';
        if (type.includes('MOVED') || type.includes('UPDATED') || type.includes('CHANGED')) return '#4794FF';
        if (type.includes('DELETED') || type.includes('UNASSIGNED')) return '#E5554F';
        if (type.includes('LOCKED')) return '#FE9922';
        if (type.includes('COMMITTED') || type.includes('ACTIVATED')) return '#FF8EFB';
        return '#64748b';
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'flex',
            justifyContent: 'flex-end'
        }}>
            {/* Backdrop */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.3)'
                }}
                onClick={onClose}
            />

            {/* Drawer */}
            <div style={{
                position: 'relative',
                width: '400px',
                maxWidth: '90vw',
                height: '100%',
                backgroundColor: isDark ? '#1e293b' : 'white',
                boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideIn 0.2s ease-out'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: isDark ? '#f1f5f9' : '#1e293b',
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            📜 Activity Log
                        </h2>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '24px',
                                color: isDark ? '#94a3b8' : '#64748b',
                                cursor: 'pointer',
                                lineHeight: 1
                            }}
                        >×</button>
                    </div>

                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            backgroundColor: isDark ? '#1e293b' : 'white',
                            color: isDark ? '#f1f5f9' : '#1e293b',
                            fontSize: '13px',
                            marginBottom: '12px'
                        }}
                    />

                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {['all', 'projects', 'resources', 'scenarios', 'optimization'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    backgroundColor: filter === f
                                        ? (isDark ? '#4794FF' : '#4794FF')
                                        : (isDark ? '#334155' : '#e2e8f0'),
                                    color: filter === f ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                                    textTransform: 'capitalize'
                                }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Events Timeline */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px'
                }}>
                    {groupedEvents.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px 20px',
                            color: isDark ? '#64748b' : '#94a3b8'
                        }}>
                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                            <div style={{ fontSize: '14px' }}>No activity recorded yet</div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                Changes will appear here as you work
                            </div>
                        </div>
                    ) : (
                        groupedEvents.map(([date, dayEvents]) => (
                            <div key={date} style={{ marginBottom: '20px' }}>
                                {/* Date Header */}
                                <div style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    color: isDark ? '#64748b' : '#94a3b8',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    marginBottom: '10px',
                                    paddingLeft: '12px'
                                }}>
                                    {date}
                                </div>

                                {/* Events */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {dayEvents.map(event => (
                                        <div
                                            key={event.id}
                                            style={{
                                                padding: '10px 12px',
                                                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                borderRadius: '8px',
                                                borderLeft: `3px solid ${getEventColor(event.type)}`
                                            }}
                                        >
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '8px'
                                            }}>
                                                <span style={{ fontSize: '14px' }}>
                                                    {getEventIcon(event.type)}
                                                </span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        fontWeight: '500',
                                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                                        lineHeight: 1.4
                                                    }}>
                                                        {event.summary}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '10px',
                                                        color: isDark ? '#64748b' : '#94a3b8',
                                                        marginTop: '4px'
                                                    }}>
                                                        {new Date(event.timestamp).toLocaleTimeString('en-GB', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {events.length > 0 && (
                    <div style={{
                        padding: '12px 20px',
                        borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{
                            fontSize: '11px',
                            color: isDark ? '#64748b' : '#94a3b8'
                        }}>
                            {events.length} event{events.length !== 1 ? 's' : ''} total
                        </span>
                        <button
                            onClick={() => setShowClearConfirm(true)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                border: 'none',
                                fontSize: '11px',
                                color: '#E5554F',
                                backgroundColor: isDark ? '#1e293b' : 'white',
                                cursor: 'pointer'
                            }}
                        >
                            Clear All
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
            <ConfirmModal
                isOpen={showClearConfirm}
                variant="danger"
                title="Clear Activity History"
                message="Clear all activity history? This cannot be undone."
                confirmText="Clear All"
                cancelText="Cancel"
                onConfirm={() => { clearAuditLog(); setShowClearConfirm(false); onClose(); }}
                onCancel={() => setShowClearConfirm(false)}
            />
        </div>
    );
};

export default AuditDrawer;
