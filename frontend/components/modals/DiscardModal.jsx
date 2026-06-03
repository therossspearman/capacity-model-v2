/**
 * DiscardModal - Scenario discard confirmation modal
 * Extracted from Dashboard.jsx for maintainability
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Z_INDEX } from '../../design-system';

/**
 * @param {Object} props
 * @param {string} props.scenarioName - Name of the scenario to discard
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onDiscard - Discard handler
 */
export const DiscardModal = ({
    scenarioName,
    onClose,
    onDiscard
}) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(8, 47, 36, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: Z_INDEX.MODAL_BACKDROP
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                width: '100%',
                maxWidth: '400px',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '16px 24px',
                    background: 'linear-gradient(to right, #dc2626, #b91c1c)',
                    color: 'white'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Discard Scenario?</h3>
                </div>
                <div style={{ padding: '24px' }}>
                    <p style={{ fontSize: '14px', color: '#475569', margin: 0, lineHeight: 1.6 }}>
                        Are you sure you want to discard <strong>"{scenarioName}"</strong>?
                        This will return you to live data mode. Your scenario will still exist but you'll exit draft mode.
                    </p>
                </div>
                <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '10px 16px', backgroundColor: 'white',
                            border: '2px solid #e2e8f0', color: '#475569', fontWeight: '500',
                            fontSize: '14px', borderRadius: '8px', cursor: 'pointer'
                        }}
                    >Cancel</button>
                    <button
                        onClick={onDiscard}
                        style={{
                            flex: 1, padding: '10px 16px', backgroundColor: '#dc2626',
                            color: 'white', fontWeight: '600', fontSize: '14px',
                            border: 'none', borderRadius: '8px', cursor: 'pointer'
                        }}
                    >Discard & Exit</button>
                </div>
            </div>
        </div>
    );
};

DiscardModal.propTypes = {
    scenarioName: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    onDiscard: PropTypes.func.isRequired
};

export default DiscardModal;
