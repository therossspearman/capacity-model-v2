import { BRAND } from '../design-system';

// High-Contrast Color Palette for Charts
export const MODERN_COLORS = [
    BRAND.indigo,          // #082F24 - Indigo (Dark base)
    BRAND.benifexGreen,    // #00BD00 - Benifex Green (Primary Action)
    BRAND.amber,           // #FE9922 - Amber (Warning)
    BRAND.lime,            // #8DF01F - Lime (Pop)
    BRAND.cyan,            // #00D9FF - Cyan (Pop)
    BRAND.benifexPurple,   // #082F24 - Benifex Purple (Secondary)
    BRAND.crimson,         // #DC2626 - Crimson (Pipeline)
    BRAND.financeBlue,     // #4794FF - Finance Blue
    BRAND.violet,          // #FF8EFB - Violet
    BRAND.crimsonLight     // #F87171 - Crimson Light
];

// Status Color Map - Harmonious palette with purple + crimson anchors
// NOTE: All keys MUST be lowercase. The sole consumer, getStatusColor() in
// utils/helpers.js, lowercases the status before looking it up here, so any
// mixed-case key would silently never match and fall back to a default color.
export const STATUS_COLOR_MAP = {
    // Completed States - Benifex Green (success)
    'done': BRAND.benifexGreen,
    'complete': BRAND.benifexGreen,
    'finished': BRAND.benifexGreen,
    'completed': BRAND.benifexGreen,

    // In Flight - Benifex Green (active, healthy work)
    'in flight': BRAND.benifexGreen,           // #00BD00 - Main brand green

    // Active States
    'in progress': BRAND.benifexPurple,
    'active': BRAND.cyan,

    // Pipeline States - Crimson spectrum (urgency, sales heat)
    'pipeline - best': BRAND.crimsonLight,     // #F87171 - Lighter red
    'pipeline - commit': BRAND.crimson,        // #DC2626 - Main crimson

    // Contracted - Indigo (flagship status, dark purple base)
    'contracted': BRAND.indigo,                // #082F24 - Dark purple

    // Onboarding - Lime (light green, early stage projects)
    'onboarding': BRAND.lime,                  // #8DF01F - Bright lime green

    // Support States - Cyan (calm, maintenance)
    'in hypercare': BRAND.cyan,                // #00D9FF - Cyan

    // Hold/Draft States - Warm neutrals
    'on hold': BRAND.amber,                    // #FE9922 - Amber (attention needed)
    'draft': BRAND.taupe,                      // Warm grey

    // Closed States - Cool greys
    'closed': '#757575',
    'cancelled': '#424242',

    // BAU / Virtual Demand - Distinct warm neutral
    'bau': BRAND.taupe,                        // #E8E1D9 - Warm taupe

    // Default
    'default': '#BDBDBD'
};

// Allowed Project Statuses
export const ALLOWED_STATUSES = [
    'Cancelled',
    'Closed',
    'Contracted',
    'Draft',
    'In Flight',
    'In Hypercare',
    'On hold',
    'Onboarding',
    'Pipeline - Best',
    'Pipeline - Commit'
];
