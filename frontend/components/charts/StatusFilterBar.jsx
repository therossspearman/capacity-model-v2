import React from 'react';
import { getStatusColor } from '../../utils';

/**
 * Status filter bar for chart legend interaction
 * V1-style colored dots with rounded pill buttons
 */
export const StatusFilterBar = ({ statuses, hiddenLines, onToggle, onHover, onLeave }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: '16px', paddingLeft: '16px', paddingRight: '16px', minWidth: 'max-content' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Filter Status</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-start' }}>
            {statuses.map((status, index) => {
                const color = getStatusColor(status, index);
                const isHidden = (hiddenLines || []).includes(status);
                return (
                    <button
                        key={status}
                        onClick={() => onToggle(status)}
                        onMouseEnter={() => onHover(status)}
                        onMouseLeave={onLeave}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '10px',
                            fontWeight: '500',
                            border: '1px solid',
                            borderColor: isHidden ? '#e2e8f0' : '#e2e8f0',
                            backgroundColor: isHidden ? '#f8fafc' : 'white',
                            color: isHidden ? '#94a3b8' : '#334155',
                            boxShadow: isHidden ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            userSelect: 'none',
                            filter: isHidden ? 'grayscale(1)' : 'none',
                            opacity: isHidden ? 0.6 : 1,
                            outline: 'none'
                        }}
                    >
                        {/* Colored dot */}
                        <span
                            style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: isHidden ? '#cbd5e1' : color,
                                flexShrink: 0
                            }}
                        />
                        <span>{status}</span>
                    </button>
                );
            })}
        </div>
    </div>
);

export default StatusFilterBar;

