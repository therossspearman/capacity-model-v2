/**
 * BAUProjectEditModal - Detail modal for virtual BAU projects.
 * Name / Country / Launch / Squad are derived from the source project and are
 * read-only here. The T-shirt size IS editable: the chips are driven by the
 * Settings BAU hours mapping and clicking one writes the new size back to the
 * source project (via onSave), which the worker then uses to recompute BAU demand.
 */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../design-system';
import { getBauSizeOptions, getBauHours } from '../../utils/bauSizing';

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
    project,
    onSave,
    bauHoursMapping
}) => {
    const { isDark, colors } = useTheme();

    // Size options + hours come from Settings (merged over defaults), never hardcoded.
    const sizeOptions = getBauSizeOptions(bauHoursMapping);
    const fallbackSize = sizeOptions.find(o => o.value === 'M')?.value || sizeOptions[0]?.value || 'M';

    // Local selection so the chip highlight + annual-hours update instantly on click;
    // the underlying virtual project is a worker-derived snapshot and won't mutate live.
    const [selectedSize, setSelectedSize] = useState(project?.bauTshirtSize || fallbackSize);
    const [saving, setSaving] = useState(false);

    // Re-sync when a different BAU project is opened.
    useEffect(() => {
        setSelectedSize(project?.bauTshirtSize || fallbackSize);
    }, [project?.id, project?.bauTshirtSize, fallbackSize]);

    if (!isOpen || !project) return null;

    const editable = typeof onSave === 'function';

    // BAU rows are virtual (id "bau-<realId>"); writes must target the SOURCE project.
    const sourceProjectId = project.sourceProjectId
        || (typeof project.id === 'string' ? project.id.replace(/^bau-/, '') : project.id);

    const handleSelectSize = async (sizeValue) => {
        if (!editable || saving || sizeValue === selectedSize) return;
        const prev = selectedSize;
        setSelectedSize(sizeValue); // optimistic
        setSaving(true);
        try {
            await onSave(sourceProjectId, {
                name: project.name,
                bauTshirtSize: sizeValue
            });
        } catch (e) {
            setSelectedSize(prev); // revert on failure (onSave surfaces its own error toast)
        } finally {
            setSaving(false);
        }
    };

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

    // Annual hours for the currently-selected size, from Settings.
    const currentHours = getBauHours(selectedSize, bauHoursMapping);

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
                    backgroundColor: isDark ? 'rgba(71, 148, 255, 0.1)' : '#eff6ff',
                    borderBottom: `1px solid ${isDark ? 'rgba(71, 148, 255, 0.2)' : '#dbeafe'}`,
                    fontSize: '12px',
                    color: isDark ? '#93c5fd' : '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>ℹ️</span>
                    <span>{editable
                        ? 'Virtual BAU project — name, country, launch and squad come from the source project. Click a T-Shirt size below to change it (saved to the source project).'
                        : 'This is a virtual BAU project. Details are derived from the source project and are read-only.'}</span>
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

                    {/* T-shirt Size - editable size picker (driven by Settings hours) */}
                    <div>
                        <label style={labelStyle}>T-Shirt Size{editable && <span style={{ fontWeight: 400, color: isDark ? '#64748b' : '#94a3b8' }}> — click to change</span>}</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {sizeOptions.map(opt => {
                                const isSelected = selectedSize === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        disabled={!editable || saving}
                                        onClick={() => handleSelectSize(opt.value)}
                                        title={`${opt.label} · ${opt.hours.toLocaleString()}h/yr`}
                                        style={{
                                            flex: 1,
                                            padding: '10px 0',
                                            borderRadius: '6px',
                                            textAlign: 'center',
                                            border: isSelected
                                                ? `2px solid ${opt.color}`
                                                : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                                            backgroundColor: isSelected ? `${opt.color}20` : 'transparent',
                                            color: isSelected ? opt.color : (isDark ? '#64748b' : '#94a3b8'),
                                            fontWeight: isSelected ? 700 : 500,
                                            fontSize: '13px',
                                            opacity: isSelected ? 1 : (editable ? 0.7 : 0.5),
                                            cursor: editable && !saving ? 'pointer' : 'default',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={e => { if (editable && !saving && !isSelected) e.currentTarget.style.opacity = '1'; }}
                                        onMouseLeave={e => { if (editable && !saving && !isSelected) e.currentTarget.style.opacity = '0.7'; }}
                                    >
                                        {opt.label}
                                        <div style={{ fontSize: '10px', fontWeight: 400, marginTop: '2px' }}>
                                            {opt.hours.toLocaleString()}h
                                        </div>
                                    </button>
                                );
                            })}
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
                            {currentHours.toLocaleString()}h
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
                            backgroundColor: '#4794FF',
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
        sourceProjectId: PropTypes.string,
        name: PropTypes.string,
        country: PropTypes.string,
        countryFlag: PropTypes.string,
        launch: PropTypes.string,
        end: PropTypes.string,
        squad: PropTypes.string,
        bauTshirtSize: PropTypes.string
    }),
    // When provided, the T-Shirt size becomes editable. Signature: (sourceProjectId, { name, bauTshirtSize }).
    onSave: PropTypes.func,
    // Size → annual-hours mapping from Settings (merged over defaults in utils/bauSizing).
    bauHoursMapping: PropTypes.object
};

export default BAUProjectEditModal;
