import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { BRAND, Z_INDEX, useTheme } from '../../design-system';
import { ALLOWED_STATUSES, ICONS } from '../../constants';

/**
 * Batch Update Modal - Premium Design
 * Bulk update multiple projects with glassmorphism and refined tabs
 */
const BatchUpdateModal = ({
    isOpen,
    onClose,
    selectedProjects,  // Set of project IDs
    allProjects,       // Array of all project objects
    allResources,      // Array of all resource objects
    allSquads,         // Array of squad names
    onApply,           // Callback: (projectIds, updates) => void
    isLoading
}) => {
    const { isDark, colors } = useTheme();
    const [activeTab, setActiveTab] = useState('dates');
    const [dateMode, setDateMode] = useState('absolute'); // 'absolute' or 'shift'
    const [kickOffDate, setKickOffDate] = useState('');
    const [launchDate, setLaunchDate] = useState('');
    const [shiftAmount, setShiftAmount] = useState(0);
    const [shiftUnit, setShiftUnit] = useState('weeks'); // 'days', 'weeks', 'months'
    const [selectedSquad, setSelectedSquad] = useState('');
    const [teamRole, setTeamRole] = useState('pm');
    const [teamAction, setTeamAction] = useState('add');
    const [selectedPerson, setSelectedPerson] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    // Lock controls
    const [lockLaunch, setLockLaunch] = useState(''); // '', 'Fixed', 'Flexible'
    const [lockSquad, setLockSquad] = useState('');
    const [lockResources, setLockResources] = useState('');
    // Program Team toggle
    const [programTeam, setProgramTeam] = useState(''); // '', 'Enable', 'Disable'
    const [selectedWave, setSelectedWave] = useState(''); // Batch Wave Assignment
    const [selectedEffortProfile, setSelectedEffortProfile] = useState(''); // Batch Effort Profile

    if (!isOpen) return null;

    const selectedProjectsList = allProjects.filter(p => selectedProjects.has(p.id));
    const count = selectedProjectsList.length;

    const handleApply = () => {
        const updates = {};

        if (activeTab === 'dates') {
            if (dateMode === 'absolute' && (kickOffDate || launchDate)) {
                updates.type = 'dates';
                updates.kickOffDate = kickOffDate;
                updates.launchDate = launchDate;
            } else if (dateMode === 'shift' && shiftAmount !== 0) {
                updates.type = 'dateShift';
                updates.shiftAmount = shiftAmount;
                updates.shiftUnit = shiftUnit;
            }
        } else if (activeTab === 'squad' && selectedSquad !== '') {
            updates.type = 'squad';
            updates.squad = selectedSquad === '__UNASSIGN__' ? null : selectedSquad;
        } else if (activeTab === 'team' && selectedPerson) {
            updates.type = 'team';
            updates.role = teamRole;
            updates.action = teamAction;
            updates.personId = selectedPerson;
        } else if (activeTab === 'status' && selectedStatus) {
            updates.type = 'status';
            updates.status = selectedStatus;
        } else if (activeTab === 'locks' && (lockLaunch || lockSquad || lockResources)) {
            updates.type = 'locks';
            if (lockLaunch) updates.lockLaunch = lockLaunch;
            if (lockSquad) updates.lockSquad = lockSquad;
            if (lockResources) updates.lockResources = lockResources;
        } else if (activeTab === 'program' && programTeam) {
            updates.type = 'program';
            updates.resourcedWithinProgram = programTeam === 'Enable';
        } else if (activeTab === 'wave' && selectedWave) {
            updates.type = 'wave';
            updates.wave = selectedWave === '__CLEAR__' ? null : selectedWave;
        } else if (activeTab === 'effort' && selectedEffortProfile) {
            updates.type = 'effortProfile';
            updates.effortProfile = selectedEffortProfile === '__CLEAR__' ? null : selectedEffortProfile;
        }

        if (updates.type) {
            onApply(Array.from(selectedProjects), updates);
        }
    };

    const tabs = [
        { key: 'dates', label: 'Dates', icon: ICONS.CALENDAR },
        { key: 'squad', label: 'Squad', icon: ICONS.USERS },
        { key: 'team', label: 'Team', icon: ICONS.USER },
        { key: 'status', label: 'Status', icon: ICONS.REFRESH },
        { key: 'locks', label: 'Locks', icon: ICONS.LOCK },
        { key: 'program', label: 'Program', icon: ICONS.DIAMOND },
        { key: 'wave', label: 'Wave', icon: ICONS.WAVE },
        { key: 'effort', label: 'Effort', icon: ICONS.CHART }
    ];

    const inputStyle = {
        width: '100%',
        padding: '12px 14px',
        fontSize: '14px',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        outline: 'none',
        backgroundColor: '#f8fafc',
        color: '#1e293b',
        transition: 'all 0.15s ease'
    };

    const labelStyle = {
        display: 'block',
        fontSize: '11px',
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: '8px',
        letterSpacing: '0.05em'
    };

    const isApplyDisabled = isLoading ||
        (activeTab === 'dates' && dateMode === 'absolute' && !kickOffDate && !launchDate) ||
        (activeTab === 'dates' && dateMode === 'shift' && shiftAmount === 0) ||
        (activeTab === 'squad' && selectedSquad === '') ||
        (activeTab === 'team' && !selectedPerson) ||
        (activeTab === 'status' && !selectedStatus) ||
        (activeTab === 'locks' && !lockLaunch && !lockSquad && !lockResources) ||
        (activeTab === 'program' && !programTeam) ||
        (activeTab === 'wave' && !selectedWave) ||
        (activeTab === 'effort' && !selectedEffortProfile);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            zIndex: Z_INDEX.MODAL_BACKDROP,
            animation: 'fadeIn 0.2s ease-out'
        }}
            onClick={onClose}>
            <div style={{
                backgroundColor: colors.bgModal || 'white',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                width: '100%',
                maxWidth: '800px',
                height: '80vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: Z_INDEX.MODAL,
                animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '32px 40px',
                    backgroundColor: 'white',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                }}>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '16px',
                            backgroundColor: '#F7F3ED', color: '#7637E3',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '28px',
                            boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.1)'
                        }}>
                            {ICONS.MAGIC_WAND}
                        </div>
                        <div>
                            <h3 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: '#1e293b', letterSpacing: '-0.02em' }}>
                                Batch Update
                            </h3>
                            <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0', fontWeight: '500' }}>
                                Updating <span style={{ color: '#7637E3', fontWeight: '700' }}>{count}</span> project{count !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            backgroundColor: 'white', border: '1px solid #e2e8f0',
                            color: '#64748b', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.transform = 'rotate(0)'; }}
                    >
                        {ICONS.CLOSE}
                    </button>
                </div>

                {/* Main Content Area - Split View */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Sidebar Tabs */}
                    <div style={{
                        width: '240px',
                        backgroundColor: '#f8fafc',
                        borderRight: '1px solid #f1f5f9',
                        padding: '24px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    backgroundColor: activeTab === tab.key ? 'white' : 'transparent',
                                    color: activeTab === tab.key ? '#7637E3' : '#64748b',
                                    fontWeight: activeTab === tab.key ? '700' : '600',
                                    fontSize: '14px',
                                    boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ fontSize: '16px' }}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Panel */}
                    <div style={{ flex: 1, padding: '40px', overflowY: 'auto', backgroundColor: 'white' }}>
                        {activeTab === 'dates' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '480px' }}>
                                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                                    {['absolute', 'shift'].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setDateMode(mode)}
                                            style={{
                                                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                                                backgroundColor: dateMode === mode ? 'white' : 'transparent',
                                                color: dateMode === mode ? '#1e293b' : '#64748b',
                                                fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                                                boxShadow: dateMode === mode ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                            }}
                                        >
                                            {mode === 'absolute' ? 'Set Specific Dates' : 'Shift Dates'}
                                        </button>
                                    ))}
                                </div>

                                {dateMode === 'absolute' ? (
                                    <div style={{ display: 'grid', gap: '24px' }}>
                                        <div>
                                            <label style={labelStyle}>Kick-off Date</label>
                                            <input type="date" value={kickOffDate} onChange={(e) => setKickOffDate(e.target.value)} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Launch Date</label>
                                            <input type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} style={inputStyle} />
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '24px' }}>
                                        <div style={{ backgroundColor: '#eff6ff', padding: '16px', borderRadius: '12px', border: '1px solid #dbeafe', color: '#1e40af', fontSize: '13px' }}>
                                            Shift kick-off and launch dates forward or backward by the same amount.
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>Amount</label>
                                                <input type="number" value={shiftAmount} onChange={(e) => setShiftAmount(parseInt(e.target.value) || 0)} style={inputStyle} placeholder="0" />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Unit</label>
                                                <select value={shiftUnit} onChange={(e) => setShiftUnit(e.target.value)} style={inputStyle}>
                                                    <option value="days">Days</option>
                                                    <option value="weeks">Weeks</option>
                                                    <option value="months">Months</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'squad' && (
                            <div style={{ maxWidth: '480px' }}>
                                <label style={labelStyle}>Assign Squad</label>
                                <select value={selectedSquad} onChange={(e) => setSelectedSquad(e.target.value)} style={inputStyle}>
                                    <option value="">Select squad...</option>
                                    <option value="__UNASSIGN__" style={{ color: '#ef4444' }}>— Unassign Squad</option>
                                    {allSquads.map(squad => <option key={squad} value={squad}>{squad}</option>)}
                                </select>
                            </div>
                        )}

                        {activeTab === 'team' && (
                            <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div><label style={labelStyle}>Role</label><select value={teamRole} onChange={(e) => setTeamRole(e.target.value)} style={inputStyle}><option value="pm">PM</option><option value="sc">SC</option><option value="pd">PD</option></select></div>
                                    <div><label style={labelStyle}>Action</label><select value={teamAction} onChange={(e) => setTeamAction(e.target.value)} style={inputStyle}><option value="add">Add Person</option><option value="remove">Remove Person</option></select></div>
                                </div>
                                <div><label style={labelStyle}>Person</label><select value={selectedPerson} onChange={(e) => setSelectedPerson(e.target.value)} style={inputStyle}><option value="">Select person...</option>{getTeamOptions(teamAction, teamRole, selectedProjectsList, allResources).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                            </div>
                        )}

                        {activeTab === 'status' && (
                            <div style={{ maxWidth: '480px' }}>
                                <label style={labelStyle}>New Status</label>
                                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={inputStyle}>
                                    <option value="">Select status...</option>
                                    {ALLOWED_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}

                        {activeTab === 'locks' && (
                            <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {['Launch Date', 'Squad Assignment', 'Resource Assignments'].map((label, i) => {
                                    const state = [lockLaunch, lockSquad, lockResources][i];
                                    const setter = [setLockLaunch, setLockSquad, setLockResources][i];
                                    return (
                                        <div key={label}>
                                            <label style={labelStyle}>Lock {label}</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {['', 'Fixed', 'Flexible'].map(opt => (
                                                    <button key={opt} onClick={() => setter(opt)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: state === opt ? `2px solid ${BRAND.primary}` : '1px solid #e2e8f0', backgroundColor: state === opt ? '#F7F3ED' : 'white', color: state === opt ? '#7637E3' : '#64748b', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>{opt === '' ? 'No Change' : opt}</button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {activeTab === 'program' && (
                            <div style={{ maxWidth: '480px' }}>
                                <label style={labelStyle}>Program Team</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {['', 'Enable', 'Disable'].map(opt => (
                                        <button key={opt} onClick={() => setProgramTeam(opt)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: programTeam === opt ? '2px solid #00BD00' : '1px solid #e2e8f0', backgroundColor: programTeam === opt ? '#ecfdf5' : 'white', color: programTeam === opt ? '#059669' : '#64748b', fontWeight: '700', cursor: 'pointer' }}>{opt === '' ? 'No Change' : opt}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'wave' && (
                            <div style={{ maxWidth: '480px' }}>
                                <label style={labelStyle}>Wave Assignment</label>
                                <select
                                    value={selectedWave}
                                    onChange={(e) => setSelectedWave(e.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="">No Change</option>
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
                                    <option value="__CLEAR__">— Clear Wave —</option>
                                </select>
                            </div>
                        )}

                        {activeTab === 'effort' && (
                            <div style={{ maxWidth: '480px' }}>
                                <label style={labelStyle}>Effort Profile</label>
                                <select
                                    value={selectedEffortProfile}
                                    onChange={(e) => setSelectedEffortProfile(e.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="">No Change</option>
                                    <option value="Straight Line">Straight Line</option>
                                    <option value="Front Loaded">Front Loaded</option>
                                    <option value="Back Loaded">Back Loaded</option>
                                    <option value="FPS">FPS (3-stage)</option>
                                    <option value="Bell Curve">Bell Curve</option>
                                    <option value="Benifex - Role Specific">Benifex - Role Specific</option>
                                    <option value="Benifex Domestic UK">Benifex Domestic UK</option>
                                    <option value="__CLEAR__">— Clear Profile —</option>
                                </select>
                                <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                                    Effort profiles control how demand is distributed over the project timeline.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '24px 40px',
                    borderTop: '1px solid #f1f5f9',
                    backgroundColor: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                        {/* Summary of changes could go here */}
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '12px 24px', borderRadius: '12px',
                                backgroundColor: 'white', border: '1px solid #e2e8f0',
                                color: '#64748b', fontWeight: '600', fontSize: '14px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={isApplyDisabled}
                            style={{
                                padding: '12px 32px', borderRadius: '12px',
                                backgroundColor: isApplyDisabled ? '#e2e8f0' : '#7637E3',
                                color: isApplyDisabled ? '#94a3b8' : 'white',
                                border: 'none', fontWeight: '700', fontSize: '14px',
                                cursor: isApplyDisabled ? 'not-allowed' : 'pointer',
                                boxShadow: isApplyDisabled ? 'none' : '0 4px 6px -1px rgba(124, 58, 237, 0.4)'
                            }}
                        >
                            {isLoading ? 'Applying...' : 'Apply Changes'}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes scaleUp {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

// Helper: Get team options based on action type
const getTeamOptions = (action, role, selectedProjectsList, allResources) => {
    const roleFieldMap = { pm: 'pmAllocation', sc: 'scAllocation', pd: 'pdAllocation' };
    const fieldKey = roleFieldMap[role];

    if (action === 'remove') {
        const assignedPeople = new Map();
        selectedProjectsList.forEach(project => {
            const team = project[fieldKey] || [];
            team.forEach(person => {
                if (person && person.id) {
                    assignedPeople.set(person.id, {
                        id: person.id,
                        name: person.name || allResources.find(r => r.id === person.id)?.name || 'Unknown',
                    });
                }
            });
        });
        return Array.from(assignedPeople.values());
    } else {
        return allResources.map(resource => ({ id: resource.id, name: resource.name }));
    }
};

export default BatchUpdateModal;

// PropTypes for runtime type validation
BatchUpdateModal.propTypes = {
    /** Whether the modal is open */
    isOpen: PropTypes.bool.isRequired,
    /** Close handler */
    onClose: PropTypes.func.isRequired,
    /** Set of selected project IDs */
    selectedProjects: PropTypes.instanceOf(Set).isRequired,
    /** Array of all project objects */
    allProjects: PropTypes.array.isRequired,
    /** Array of all resource objects */
    allResources: PropTypes.array,
    /** Array of squad names */
    allSquads: PropTypes.array,
    /** Apply changes handler */
    onApply: PropTypes.func.isRequired,
    /** Loading state */
    isLoading: PropTypes.bool
};
