/**
 * Export Modal
 * Date range picker + People/Projects/Programs tab selection for CSV export
 */
import React, { useState, useMemo } from 'react';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';

const ExportModal = ({
    isOpen,
    onClose,
    filteredResources,
    filteredProjects,
    processedData, // Array of weekly date-bucket objects with isoKey + dateKey
    addToast,
    programAssignments, // Array of program assignment objects from storedSettings
    programBudgets, // Object: customer → { workstreams, totalHours, start, end, ... }
    programWorkstreams, // Array of workstream definitions with name + allocationPct
    allResources, // Full resource list to resolve names from IDs
    activeFilters // { squads, entities, search, demandCategory, statuses }
}) => {
    const { isDark, colors } = useTheme();

    // Date range state — default to first/last dates in processedData
    const defaultDates = useMemo(() => {
        if (!processedData || processedData.length === 0) return { start: '', end: '' };
        const first = processedData[0];
        const last = processedData[processedData.length - 1];
        return {
            start: first.isoKey || '',
            end: last.isoKey || ''
        };
    }, [processedData]);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [exportPeople, setExportPeople] = useState(true);
    const [exportProjects, setExportProjects] = useState(true);
    const [exportPrograms, setExportPrograms] = useState(true);
    const [exportAllocations, setExportAllocations] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Use defaults if user hasn't set dates
    const effectiveStart = startDate || defaultDates.start;
    const effectiveEnd = endDate || defaultDates.end;

    // Filter processedData to the selected date range.
    // Comparison is lexicographic and relies on the YYYY-MM-DD contract: isoKey is a
    // zero-padded date string, and effectiveStart/effectiveEnd come from <input type=date>
    // (which always yields YYYY-MM-DD). Normalise to the first 10 chars so a stray time
    // component on isoKey (e.g. an ISO timestamp) can't break the range comparison.
    const filteredDates = useMemo(() => {
        if (!processedData) return [];
        const start = (effectiveStart || '').substring(0, 10);
        const end = (effectiveEnd || '').substring(0, 10);
        return processedData.filter(d => {
            const key = (d.isoKey || '').substring(0, 10);
            return key >= start && key <= end;
        });
    }, [processedData, effectiveStart, effectiveEnd]);

    const weekCount = filteredDates.length;

    // Count program assignments for summary
    const programAssignmentCount = (programAssignments || []).length;
    const hasProgramData = programAssignmentCount > 0;

    if (!isOpen) return null;

    // --- CSV Generation ---
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const generatePeopleCSV = () => {
        const dateKeys = filteredDates.map(d => d.isoKey);
        const dateLabels = filteredDates.map(d => d.dateKey || d.isoKey);

        const headers = [
            'Name', 'Squad', 'Role',
            'Total Capacity (h)', 'Total Demand (h)', 'Utilisation %',
            ...dateLabels.map(l => `Demand ${l}`),
            ...dateLabels.map(l => `Capacity ${l}`)
        ];

        const rows = (filteredResources || []).map(r => {
            // Calculate totals only for the selected date range
            let rangeCap = 0, rangeDem = 0;
            const demByWeek = dateKeys.map(dk => {
                const b = r.buckets?.[dk];
                const dem = b?.dem || 0;
                const cap = b?.cap || 0;
                rangeDem += dem;
                rangeCap += cap;
                return Math.round(dem);
            });
            const capByWeek = dateKeys.map(dk => {
                const b = r.buckets?.[dk];
                return Math.round(b?.cap || 0);
            });
            const util = rangeCap > 0 ? Math.round((rangeDem / rangeCap) * 100) : 0;

            return [
                r.name || '',
                (r.squads || []).join('; '),
                r.adJobTitle || r.role || '',
                Math.round(rangeCap),
                Math.round(rangeDem),
                `${util}%`,
                ...demByWeek,
                ...capByWeek
            ];
        });

        return [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
    };

    const generateProjectsCSV = () => {
        const dateKeys = filteredDates.map(d => d.isoKey);
        const dateLabels = filteredDates.map(d => d.dateKey || d.isoKey);

        // Helper: format team members for a role as "Name1 (50%), Name2 (50%)"
        const formatTeamRole = (team, role) => {
            if (!team || !team[role] || !Array.isArray(team[role])) return '';
            return team[role]
                .map(m => {
                    const name = m.name || 'Unknown';
                    const pct = m.allocationPct != null ? m.allocationPct : 100;
                    return `${name} (${pct}%)`;
                })
                .join('; ');
        };

        // Helper: calculate hypercare end date from effort profile
        const getHypercareEnd = (p) => {
            const prof = (p.effortProfile || '').toLowerCase();
            const endVal = p.end;
            if (!endVal) return '';
            try {
                const launchMs = new Date(endVal).getTime();
                if (isNaN(launchMs)) return '';
                if (prof.includes('domestic')) {
                    return new Date(launchMs + 13 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                }
                if (prof.includes('fps')) {
                    return new Date(launchMs + 6 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                }
            } catch (e) { /* ignore */ }
            return '';
        };

        // Helper: format date string to YYYY-MM-DD
        const fmtDate = (d) => {
            if (!d) return '';
            try { return new Date(d).toISOString().split('T')[0]; } catch (e) { return ''; }
        };

        const headers = [
            'Name', 'Status', 'Customer', 'Squad',
            'Kick Off', 'Launch', 'Hypercare End', 'Effort Profile',
            'Total Effort (h)', 'Actuals (h)', 'EAC (h)', '% Complete',
            'PM', 'SC', 'Build/PD',
            ...dateLabels.map(l => `Demand ${l}`)
        ];

        const rows = (filteredProjects || []).map(p => {
            const demByWeek = dateKeys.map(dk => {
                const b = p.buckets?.[dk];
                return Math.round(b?.dem || 0);
            });

            const totalEffort = (p.pmVal || 0) + (p.scVal || 0) + (p.pdVal || 0);

            return [
                p.name || '',
                p.status || '',
                p.customer || '',
                (p.squads || []).join('; '),
                fmtDate(p.start),
                fmtDate(p.end),
                getHypercareEnd(p),
                p.effortProfile || 'Flat',
                Math.round(totalEffort),
                Math.round(p.actuals || 0),
                Math.round(p.eac || p.totalPlanned || totalEffort),
                p.pctComplete != null ? `${Math.round(p.pctComplete > 1 ? p.pctComplete : p.pctComplete * 100)}%` : '',
                formatTeamRole(p.team, 'pm'),
                formatTeamRole(p.team, 'sc'),
                formatTeamRole(p.team, 'pd'),
                ...demByWeek
            ];
        });

        return [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
    };

    const generateProgramsCSV = () => {
        const fmtDate = (d) => {
            if (!d) return '';
            try { return new Date(d).toISOString().split('T')[0]; } catch (e) { return ''; }
        };

        const headers = [
            'Customer',
            'Workstream',
            'Resource',
            'Resource Role',
            'Allocation %',
            'Start Date',
            'End Date',
            'Workstream Total Hours',
            'Weekly Hours (est.)'
        ];

        const assignments = programAssignments || [];
        const resources = allResources || [];
        const budgets = programBudgets || {};
        const wsDefs = programWorkstreams || [];

        const rows = assignments.map(a => {
            // Resolve resource name
            const resource = resources.find(r => r.id === a.resourceId);
            const resourceName = resource?.name || a.resourceName || 'Unknown';
            const resourceRole = resource?.adJobTitle || resource?.role || '';

            // Resolve workstream hours from customer-specific budget
            const customerBudget = budgets[a.customer];
            let wsHours = 0;
            if (customerBudget?.workstreams) {
                const ws = customerBudget.workstreams.find(w => w.name === a.workstream);
                wsHours = ws?.hours || 0;
            } else {
                // Fallback: try to find from global workstream defs
                const wsDef = wsDefs.find(w => w.name === a.workstream);
                if (wsDef) wsHours = wsDef.hours || 0;
            }

            // Calculate duration in weeks for weekly hours estimate
            const allocationPct = a.allocationPct || 0;
            let durationWeeks = 0;
            const aStart = a.startDate ? new Date(a.startDate) : null;
            const aEnd = a.endDate ? new Date(a.endDate) : null;
            if (aStart && aEnd && aEnd > aStart) {
                durationWeeks = Math.max(1, (aEnd - aStart) / (7 * 24 * 60 * 60 * 1000));
            } else if (customerBudget?.start && customerBudget?.end) {
                // Fallback to program-level dates
                const pStart = new Date(customerBudget.start);
                const pEnd = new Date(customerBudget.end);
                if (pEnd > pStart) {
                    durationWeeks = Math.max(1, (pEnd - pStart) / (7 * 24 * 60 * 60 * 1000));
                }
            }

            const weeklyHours = durationWeeks > 0
                ? (wsHours * (allocationPct / 100)) / durationWeeks
                : 0;

            return [
                a.customer || '',
                a.workstream || '',
                resourceName,
                resourceRole,
                `${allocationPct}%`,
                fmtDate(a.startDate),
                fmtDate(a.endDate),
                Math.round(wsHours),
                weeklyHours > 0 ? weeklyHours.toFixed(1) : '—'
            ];
        });

        return [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
    };

    // Per-Resource per-Project per-Week allocation breakdown.
    // One row per (Resource, Project, Week) — sums hours across PM/SC/PD breakdown entries
    // for the same project in the same week. Source: resource.buckets[weekKey].projects[].
    const generateAllocationsCSV = () => {
        const dateKeys = filteredDates.map(d => d.isoKey);
        const dateKeySet = new Set(dateKeys);

        const headers = [
            'Resource Name', 'Squad', 'Role',
            'Week (Monday)', 'Project Name', 'Customer', 'Country',
            'Status', 'Planned Hours', 'EAC Hours', 'Impact Hours'
        ];

        const rows = [];
        (filteredResources || []).forEach(r => {
            const squad = (r.squads || []).join('; ');
            const role = r.adJobTitle || r.role || '';
            const buckets = r.buckets || {};
            for (const weekKey of Object.keys(buckets)) {
                if (!dateKeySet.has(weekKey)) continue;
                const projects = buckets[weekKey]?.projects || [];
                if (projects.length === 0) continue;

                // Aggregate hours by project (multiple PM/SC/PD entries collapse to one row per project)
                const byProject = new Map();
                projects.forEach(p => {
                    const key = p.projectId || p.id || p.name;
                    if (!key) return;
                    const existing = byProject.get(key);
                    if (existing) {
                        existing.hours += (p.hours || 0);
                        existing.hours_eac += (p.hours_eac || 0);
                        existing.hours_imp += (p.hours_imp || 0);
                    } else {
                        byProject.set(key, {
                            name: p.name || '',
                            customer: p.customer || '',
                            country: p.country || '',
                            status: p.status || '',
                            hours: p.hours || 0,
                            hours_eac: p.hours_eac || 0,
                            hours_imp: p.hours_imp || 0
                        });
                    }
                });

                for (const proj of byProject.values()) {
                    if ((proj.hours || 0) <= 0 && (proj.hours_eac || 0) <= 0 && (proj.hours_imp || 0) <= 0) continue;
                    rows.push([
                        r.name || '',
                        squad,
                        role,
                        weekKey,
                        proj.name,
                        proj.customer,
                        proj.country,
                        proj.status,
                        Math.round(proj.hours * 10) / 10,
                        Math.round(proj.hours_eac * 10) / 10,
                        Math.round(proj.hours_imp * 10) / 10
                    ]);
                }
            }
        });

        // Sort: Resource → Week → Project (predictable for diffing against timesheets)
        rows.sort((a, b) => {
            if (a[0] !== b[0]) return a[0].localeCompare(b[0]);
            if (a[3] !== b[3]) return a[3].localeCompare(b[3]);
            return a[4].localeCompare(b[4]);
        });

        const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
        return { csv, rowCount: rows.length };
    };

    const downloadCSV = (content, filename) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 500);
    };

    // Count how many export types are selected
    const selectedCount = [exportPeople, exportProjects, exportPrograms, exportAllocations].filter(Boolean).length;
    const nothingSelected = selectedCount === 0;

    const handleExport = async () => {
        if (nothingSelected) {
            addToast?.({ type: 'warning', title: 'Nothing selected', message: 'Select at least one export tab' });
            return;
        }
        if (weekCount === 0) {
            addToast?.({ type: 'error', title: 'Empty date range', message: 'Selected range covers no weeks of capacity data — adjust the dates and try again.' });
            return;
        }

        setIsExporting(true);
        const dateSuffix = `${effectiveStart}_to_${effectiveEnd}`;
        let exported = 0;
        let filesDownloaded = 0;

        try {
            if (exportPeople) {
                const csv = generatePeopleCSV();
                downloadCSV(csv, `capacity-people-${dateSuffix}.csv`);
                exported += (filteredResources || []).length;
                filesDownloaded++;
            }

            if (exportProjects) {
                if (filesDownloaded > 0) await new Promise(r => setTimeout(r, 600));
                const csv = generateProjectsCSV();
                downloadCSV(csv, `capacity-projects-${dateSuffix}.csv`);
                exported += (filteredProjects || []).length;
                filesDownloaded++;
            }

            if (exportPrograms && hasProgramData) {
                if (filesDownloaded > 0) await new Promise(r => setTimeout(r, 600));
                const csv = generateProgramsCSV();
                downloadCSV(csv, `capacity-programs-${dateSuffix}.csv`);
                exported += programAssignmentCount;
                filesDownloaded++;
            }

            if (exportAllocations) {
                if (filesDownloaded > 0) await new Promise(r => setTimeout(r, 600));
                const { csv, rowCount } = generateAllocationsCSV();
                downloadCSV(csv, `capacity-allocations-${dateSuffix}.csv`);
                // Exact row count (resource × project × week combinations). Taken from the
                // rows array length rather than csv.split('\n') so embedded newlines inside
                // quoted cell values can't inflate the count.
                exported += rowCount;
                filesDownloaded++;
            }

            addToast?.({
                type: 'success',
                title: 'Export complete',
                message: `Exported ${exported} rows across ${filesDownloaded} file${filesDownloaded !== 1 ? 's' : ''}`
            });
            onClose();
        } catch (err) {
            console.error('Export failed:', err);
            addToast?.({ type: 'error', title: 'Export failed', message: err.message });
        } finally {
            setIsExporting(false);
        }
    };

    // --- UI ---
    const checkboxStyle = (checked) => ({
        width: '18px', height: '18px', borderRadius: '5px',
        border: checked ? '2px solid #00BD00' : `2px solid ${colors.border}`,
        backgroundColor: checked ? '#00BD00' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s ease', flexShrink: 0
    });

    const checkIcon = (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
        </svg>
    );

    return (
        <div
            style={{
                position: 'fixed', inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: Z_INDEX.MODAL
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundColor: colors.bgCard,
                    borderRadius: '16px',
                    border: `1px solid ${colors.border}`,
                    width: '460px',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '24px 24px 16px',
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #00BD00, #059669)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: colors.text }}>Export Data</div>
                            <div style={{ fontSize: '11px', color: colors.textMuted }}>Download capacity data as CSV</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            border: 'none', background: 'none', cursor: 'pointer',
                            color: colors.textMuted, fontSize: '20px', padding: '4px',
                            lineHeight: 1
                        }}
                    >✕</button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px' }}>

                    {/* Date Range */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{
                            fontSize: '11px', fontWeight: '700', color: colors.textMuted,
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px'
                        }}>Date Range</div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '10px', color: colors.textMuted, marginBottom: '4px', display: 'block' }}>From</label>
                                <input
                                    type="date"
                                    value={effectiveStart}
                                    onChange={e => setStartDate(e.target.value)}
                                    style={{
                                        width: '100%', padding: '8px 10px', borderRadius: '8px',
                                        border: `1px solid ${colors.border}`, backgroundColor: colors.bgAlt || colors.bgCard,
                                        color: colors.text, fontSize: '13px', outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                            <span style={{ color: colors.textMuted, fontSize: '12px', marginTop: '16px' }}>→</span>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '10px', color: colors.textMuted, marginBottom: '4px', display: 'block' }}>To</label>
                                <input
                                    type="date"
                                    value={effectiveEnd}
                                    onChange={e => setEndDate(e.target.value)}
                                    style={{
                                        width: '100%', padding: '8px 10px', borderRadius: '8px',
                                        border: `1px solid ${colors.border}`, backgroundColor: colors.bgAlt || colors.bgCard,
                                        color: colors.text, fontSize: '13px', outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>
                        <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '6px' }}>
                            {weekCount} week{weekCount !== 1 ? 's' : ''} selected
                        </div>
                    </div>

                    {/* Active Filters */}
                    {(() => {
                        const chips = [];
                        const f = activeFilters || {};
                        if (f.squads?.length > 0) chips.push({ label: `Squad: ${f.squads.join(', ')}`, color: '#7637E3' });
                        if (f.entities?.length > 0) chips.push({ label: `Entity: ${f.entities.join(', ')}`, color: '#b45309' });
                        if (f.statuses?.length > 0) chips.push({ label: `Status: ${f.statuses.join(', ')}`, color: '#2563eb' });
                        if (f.search) chips.push({ label: `Search: "${f.search}"`, color: '#059669' });
                        if (f.demandCategory && f.demandCategory !== 'all') chips.push({ label: `Category: ${f.demandCategory}`, color: '#dc2626' });
                        if (chips.length === 0) return null;
                        return (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{
                                    fontSize: '11px', fontWeight: '700', color: colors.textMuted,
                                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px'
                                }}>Active Filters</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {chips.map((chip, i) => (
                                        <span key={i} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            padding: '3px 10px', borderRadius: '12px',
                                            fontSize: '11px', fontWeight: '600',
                                            color: chip.color,
                                            backgroundColor: `${chip.color}14`,
                                            border: `1px solid ${chip.color}30`
                                        }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: chip.color }} />
                                            {chip.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Tab Selection */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{
                            fontSize: '11px', fontWeight: '700', color: colors.textMuted,
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px'
                        }}>Include</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* People Tab */}
                            <div
                                onClick={() => setExportPeople(!exportPeople)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px 14px', borderRadius: '10px',
                                    border: `1px solid ${exportPeople ? '#00BD00' : colors.border}`,
                                    backgroundColor: exportPeople ? (isDark ? 'rgba(0,189,0,0.08)' : '#f0fdf4') : colors.bgCard,
                                    cursor: 'pointer', transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={checkboxStyle(exportPeople)}>
                                    {exportPeople && checkIcon}
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: '-2px' }}>
                                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                                        </svg>
                                        People
                                    </div>
                                    <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px' }}>
                                        {(filteredResources || []).length} resources — capacity, demand &amp; utilisation per week
                                    </div>
                                </div>
                            </div>
                            {/* Projects Tab */}
                            <div
                                onClick={() => setExportProjects(!exportProjects)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px 14px', borderRadius: '10px',
                                    border: `1px solid ${exportProjects ? '#00BD00' : colors.border}`,
                                    backgroundColor: exportProjects ? (isDark ? 'rgba(0,189,0,0.08)' : '#f0fdf4') : colors.bgCard,
                                    cursor: 'pointer', transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={checkboxStyle(exportProjects)}>
                                    {exportProjects && checkIcon}
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: '-2px' }}>
                                            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                        Projects
                                    </div>
                                    <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px' }}>
                                        {(filteredProjects || []).length} projects — status, dates, team, effort profile &amp; demand per week
                                    </div>
                                </div>
                            </div>
                            {/* Allocations (Person × Project × Week) Tab */}
                            <div
                                onClick={() => setExportAllocations(!exportAllocations)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px 14px', borderRadius: '10px',
                                    border: `1px solid ${exportAllocations ? '#7637E3' : colors.border}`,
                                    backgroundColor: exportAllocations ? (isDark ? 'rgba(118,55,227,0.08)' : '#faf5ff') : colors.bgCard,
                                    cursor: 'pointer', transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{
                                    ...checkboxStyle(exportAllocations),
                                    borderColor: exportAllocations ? '#7637E3' : colors.border,
                                    backgroundColor: exportAllocations ? '#7637E3' : 'transparent'
                                }}>
                                    {exportAllocations && checkIcon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7637E3" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: '-2px' }}>
                                            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                                        </svg>
                                        Allocations (Person × Project × Week)
                                    </div>
                                    <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px' }}>
                                        Long-format planned hours per resource, per project, per week — for timesheet comparison
                                    </div>
                                </div>
                            </div>
                            {/* Programs Tab */}
                            <div
                                onClick={() => hasProgramData && setExportPrograms(!exportPrograms)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px 14px', borderRadius: '10px',
                                    border: `1px solid ${exportPrograms && hasProgramData ? '#10b981' : colors.border}`,
                                    backgroundColor: exportPrograms && hasProgramData
                                        ? (isDark ? 'rgba(16,185,129,0.08)' : '#ecfdf5')
                                        : colors.bgCard,
                                    cursor: hasProgramData ? 'pointer' : 'default',
                                    transition: 'all 0.15s ease',
                                    opacity: hasProgramData ? 1 : 0.5
                                }}
                            >
                                <div style={{
                                    ...checkboxStyle(exportPrograms && hasProgramData),
                                    borderColor: exportPrograms && hasProgramData ? '#10b981' : (colors.border),
                                    backgroundColor: exportPrograms && hasProgramData ? '#10b981' : 'transparent'
                                }}>
                                    {exportPrograms && hasProgramData && checkIcon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hasProgramData ? '#10b981' : 'currentColor'} strokeWidth="2" style={{ marginRight: '6px', verticalAlign: '-2px' }}>
                                            <rect x="3" y="3" width="7" height="7" rx="1" />
                                            <rect x="14" y="3" width="7" height="7" rx="1" />
                                            <rect x="3" y="14" width="7" height="7" rx="1" />
                                            <rect x="14" y="14" width="7" height="7" rx="1" />
                                        </svg>
                                        Program Allocations
                                    </div>
                                    <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px' }}>
                                        {hasProgramData
                                            ? `${programAssignmentCount} assignment${programAssignmentCount !== 1 ? 's' : ''} — workstream, resource, allocation % & weekly hours`
                                            : 'No program assignments configured'
                                        }
                                    </div>
                                </div>
                                {hasProgramData && (
                                    <span style={{
                                        fontSize: '9px', fontWeight: '700',
                                        padding: '2px 6px', borderRadius: '4px',
                                        backgroundColor: '#ecfdf5',
                                        color: '#10b981',
                                        border: '1px solid #d1fae5'
                                    }}>📊</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div style={{
                        padding: '10px 14px', borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                        border: `1px solid ${colors.border}`,
                        fontSize: '11px', color: colors.textMuted,
                        display: 'flex', justifyContent: 'space-between'
                    }}>
                        <span>
                            {nothingSelected
                                ? 'Nothing selected'
                                : `${selectedCount} CSV file${selectedCount !== 1 ? 's' : ''}`
                            }
                        </span>
                        <span>{weekCount} week columns</span>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex', justifyContent: 'flex-end', gap: '10px'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 20px', borderRadius: '8px',
                            border: `1px solid ${colors.border}`,
                            backgroundColor: 'transparent', color: colors.text,
                            fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                        }}
                    >Cancel</button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting || nothingSelected}
                        style={{
                            padding: '8px 24px', borderRadius: '8px',
                            border: 'none',
                            background: nothingSelected ? '#94a3b8' : 'linear-gradient(135deg, #00BD00, #059669)',
                            color: 'white',
                            fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                            opacity: isExporting ? 0.7 : 1,
                            boxShadow: '0 2px 8px rgba(0,189,0,0.3)',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        {isExporting ? (
                            <>Exporting...</>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
