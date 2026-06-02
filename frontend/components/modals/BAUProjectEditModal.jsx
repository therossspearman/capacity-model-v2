/**
 * BAUProjectViewModal - Read-only modal for viewing BAU virtual projects
 * Shows project details (Name, Country, Launch Date, Squad, T-shirt Size) as read-only
 * These are derived from source projects and cannot be edited here
 */
import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../design-system';

// T-shirt size options for display
const TSHIRT_OPTIONS = [
    { value: 'XS', label: 'XS', color: '#94a3b8', hours: 40 },
    { value: 'S', label: 'S', color: '#00BD00', hours: 80 },
    { value: 'M', label: 'M', color: '#3b82f6', hours: 160 },
    { value: 'L', label: 'L', color: '#f59e0b', hours: 320 },
    { value: 'XL', label: 'XL', color: '#ef4444', hours: 640 }
];

// Format date for display
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return '—';
    }
};

const BAUProjectEditModal = ({
    isOpen,
    onClose,
    project
}) => {
    const { isDark, colors } = useTheme();

    if (!isOpen || !project) return null;

    const readOnlyStyle = {
        width: '100%',
        padding: '10px 12px',
        borderRadius: '6px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#1e293b',
        fontSize: '14px'
    };

    const labelStyle = {
        display: 'block',
        fontSize: '12px',
        fontWeight: 600,
        color: isDark ? '#94a3b8' : '#64748b',
        marginBottom: '6px'
    };

    // Find current t-shirt size
    const currentSize = TSHIRT_OPTIONS.find(opt => opt.value === project.bauTshirtSize) || TSHIRT_OPTIONS[2]; // Default M

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)'
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '400px',
                    maxWidth: '90vw',
                    backgroundColor: isDark ? '#1e293b' : '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 600,
                        color: isDark ? '#f1f5f9' : '#1e293b'
                    }}>
                        BAU Project Details
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            color: isDark ? '#94a3b8' : '#64748b',
                            padding: '4px'
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Read-only Info Banner */}
                <div style={{
                    padding: '12px 20px',
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                    borderBottom: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe'}`,
                    fontSize: '12px',
                    color: isDark ? '#93c5fd' : '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>ℹ️</span>
                    <span>This is a virtual BAU project. Details are derived from the source project and are read-only.</span>
                </div>

                {/* Form - Read Only */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Project Name */}
                    <div>
                        <label style={labelStyle}>Project Name</label>
                        <div style={readOnlyStyle}>{project.name || '—'}</div>
                    </div>

                    {/* Country */}
                    <div>
                        <label style={labelStyle}>Country</label>
                        <div style={{ ...readOnlyStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {project.countryFlag && (
                                <img
                                    src={project.countryFlag}
                                    alt=""
                                    style={{ width: '16px', height: '16px', borderRadius: '2px', objectFit: 'cover' }}
                                />
                            )}
                            {project.country || '—'}
                        </div>
                    </div>

                    {/* Launch Date */}
                    <div>
                        <label style={labelStyle}>Launch Date</label>
                        <div style={readOnlyStyle}>{formatDate(project.launch || project.end)}</div>
                    </div>

                    {/* Squad */}
                    <div>
                        <label style={labelStyle}>Squad</label>
                        <div style={readOnlyStyle}>{project.squad || 'Unassigned'}</div>
                    </div>

                    {/* T-shirt Size - Visual display */}
                    <div>
                        <label style={labelStyle}>T-Shirt Size</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {TSHIRT_OPTIONS.map(opt => (
                                <div
                                    key={opt.value}
                                    style={{
                                        flex: 1,
                                        padding: '10px 0',
                                        borderRadius: '6px',
                                        textAlign: 'center',
                                        border: project.bauTshirtSize === opt.value
                                            ? `2px solid ${opt.color}`
                                            : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                                        backgroundColor: project.bauTshirtSize === opt.value
                                            ? `${opt.color}20`
                                            : 'transparent',
                                        color: project.bauTshirtSize === opt.value
                                            ? opt.color
                                            : (isDark ? '#64748b' : '#94a3b8'),
                                        fontWeight: project.bauTshirtSize === opt.value ? 700 : 400,
                                        fontSize: '13px',
                                        opacity: project.bauTshirtSize === opt.value ? 1 : 0.5
                                    }}
                                >
                                    {opt.label}
                                    <div style={{ fontSize: '10px', fontWeight: 400, marginTop: '2px' }}>
                                        {opt.hours}h
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Estimated Annual Hours */}
                    <div style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4',
                        border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.2)' : '#bbf7d0'}`
                    }}>
                        <div style={{ fontSize: '11px', color: isDark ? '#86efac' : '#166534', marginBottom: '4px' }}>
                            Estimated Annual BAU Hours
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: isDark ? '#00BD00' : '#15803d' }}>
                            {currentSize.hours.toLocaleString()}h
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#3b82f6',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

BAUProjectEditModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    project: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string,
        country: PropTypes.string,
        countryFlag: PropTypes.string,
        launch: PropTypes.string,
        end: PropTypes.string,
        squad: PropTypes.string,
        bauTshirtSize: PropTypes.string
    }),
    squads: PropTypes.arrayOf(PropTypes.string),
    onSave: PropTypes.func
};

export default BAUProjectEditModal;
