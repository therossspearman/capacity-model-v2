/**
 * AuditLog - Event logging utility for tracking changes
 * Stores events in localStorage with timestamps and user context
 */

const AUDIT_STORAGE_KEY = 'capacity_model_audit_log';
const MAX_EVENTS = 500; // Keep last 500 events

/**
 * Event types
 */
export const AUDIT_EVENTS = {
    // Project changes
    PROJECT_ASSIGNED: 'PROJECT_ASSIGNED',
    PROJECT_MOVED: 'PROJECT_MOVED',
    PROJECT_DATES_CHANGED: 'PROJECT_DATES_CHANGED',
    PROJECT_LOCKED: 'PROJECT_LOCKED',
    PROJECT_UNLOCKED: 'PROJECT_UNLOCKED',

    // Resource changes
    RESOURCE_ASSIGNED: 'RESOURCE_ASSIGNED',
    RESOURCE_UNASSIGNED: 'RESOURCE_UNASSIGNED',
    ALLOCATION_UPDATED: 'ALLOCATION_UPDATED',

    // Scenario changes
    SCENARIO_CREATED: 'SCENARIO_CREATED',
    SCENARIO_ACTIVATED: 'SCENARIO_ACTIVATED',
    SCENARIO_COMMITTED: 'SCENARIO_COMMITTED',
    SCENARIO_REVERTED: 'SCENARIO_REVERTED',
    SCENARIO_DELETED: 'SCENARIO_DELETED',

    // Slot mode
    SLOT_ASSIGNMENT: 'SLOT_ASSIGNMENT',
    OPTIMIZATION_APPLIED: 'OPTIMIZATION_APPLIED',

    // Settings
    SETTINGS_CHANGED: 'SETTINGS_CHANGED'
};

/**
 * Get all audit events from storage
 */
export function getAuditLog() {
    try {
        const data = localStorage.getItem(AUDIT_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Failed to read audit log:', e);
        return [];
    }
}

/**
 * Log an audit event
 * @param {string} eventType - One of AUDIT_EVENTS
 * @param {object} details - Event-specific details
 * @param {string} [userId] - User identifier (optional)
 */
export function logAuditEvent(eventType, details, userId = 'unknown') {
    try {
        const events = getAuditLog();

        const event = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: eventType,
            timestamp: new Date().toISOString(),
            userId,
            details,
            // Add human-readable summary
            summary: generateSummary(eventType, details)
        };

        // Add to beginning (most recent first)
        events.unshift(event);

        // Trim to max events
        if (events.length > MAX_EVENTS) {
            events.splice(MAX_EVENTS);
        }

        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(events));

        return event;
    } catch (e) {
        console.error('Failed to log audit event:', e);
        return null;
    }
}

/**
 * Generate human-readable summary for an event
 */
function generateSummary(eventType, details) {
    switch (eventType) {
        case AUDIT_EVENTS.PROJECT_ASSIGNED:
            return `Assigned "${details.projectName}" to ${details.squad}`;
        case AUDIT_EVENTS.PROJECT_MOVED:
            return `Moved "${details.projectName}" from ${details.fromSquad} to ${details.toSquad}`;
        case AUDIT_EVENTS.PROJECT_DATES_CHANGED:
            return `Changed dates for "${details.projectName}"`;
        case AUDIT_EVENTS.PROJECT_LOCKED:
            return `Locked "${details.projectName}"`;
        case AUDIT_EVENTS.PROJECT_UNLOCKED:
            return `Unlocked "${details.projectName}"`;
        case AUDIT_EVENTS.RESOURCE_ASSIGNED:
            return `Assigned ${details.resourceName} to "${details.projectName}" as ${details.role}`;
        case AUDIT_EVENTS.RESOURCE_UNASSIGNED:
            return `Removed ${details.resourceName} from "${details.projectName}"`;
        case AUDIT_EVENTS.ALLOCATION_UPDATED:
            return `Updated ${details.resourceName}'s allocation on "${details.projectName}"`;
        case AUDIT_EVENTS.SCENARIO_CREATED:
            return `Created scenario "${details.scenarioName}"`;
        case AUDIT_EVENTS.SCENARIO_ACTIVATED:
            return `Activated scenario "${details.scenarioName}"`;
        case AUDIT_EVENTS.SCENARIO_COMMITTED:
            return `Committed scenario "${details.scenarioName}"`;
        case AUDIT_EVENTS.SCENARIO_REVERTED:
            return `Reverted scenario "${details.scenarioName}"`;
        case AUDIT_EVENTS.SCENARIO_DELETED:
            return `Deleted scenario "${details.scenarioName}"`;
        case AUDIT_EVENTS.SLOT_ASSIGNMENT:
            return `Assigned "${details.projectName}" to slot in ${details.squad}`;
        case AUDIT_EVENTS.OPTIMIZATION_APPLIED:
            return `Applied ${details.recommendationCount} optimization(s)`;
        case AUDIT_EVENTS.SETTINGS_CHANGED:
            return `Changed settings: ${details.settingName}`;
        default:
            return eventType;
    }
}

/**
 * Clear all audit events
 */
export function clearAuditLog() {
    localStorage.removeItem(AUDIT_STORAGE_KEY);
}

/**
 * Get events filtered by type
 */
export function getEventsByType(eventType) {
    return getAuditLog().filter(e => e.type === eventType);
}

/**
 * Get events for a specific project
 */
export function getEventsByProject(projectId) {
    return getAuditLog().filter(e => e.details?.projectId === projectId);
}

/**
 * Get events within a time range
 */
export function getEventsInRange(startDate, endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    return getAuditLog().filter(e => {
        const time = new Date(e.timestamp).getTime();
        return time >= start && time <= end;
    });
}

/**
 * Export audit log as JSON
 */
export function exportAuditLog() {
    const events = getAuditLog();
    return JSON.stringify(events, null, 2);
}

export default {
    AUDIT_EVENTS,
    getAuditLog,
    logAuditEvent,
    clearAuditLog,
    getEventsByType,
    getEventsByProject,
    getEventsInRange,
    exportAuditLog
};
