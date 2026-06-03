/**
 * Documentation Modal - Comprehensive How-To Guide
 * Searchable knowledge base for maximizing the Capacity Model
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Z_INDEX, BRAND, useTheme } from '../../design-system';
import { ICONS } from '../../constants';
import { APP_VERSION } from '../../constants/settings';

// Comprehensive guide data organized by category
const GUIDE_DATA = [
    {
        category: 'getting-started',
        icon: '🚀',
        title: 'Getting Started',
        description: 'Essential first steps to master the Capacity Model',
        articles: [
            {
                id: 'gs-1',
                title: 'Understanding the Grid',
                summary: 'Learn how the capacity grid displays your resource allocation',
                content: [
                    { type: 'text', value: 'The capacity grid is your main workspace, showing resources on the left and time periods across the top.' },
                    {
                        type: 'step', title: 'Reading a Cell', steps: [
                            'Green cells indicate available capacity',
                            'Blue cells show allocated hours within capacity',
                            'Red top border means over-allocated (exceeds target utilization)',
                            'Gray diagonal stripes = resource not yet started or has left',
                            'Yellow diagonal stripes = resource on temporary leave'
                        ]
                    },
                    { type: 'tip', value: 'Click any cell to see detailed project breakdown for that resource/period.' }
                ]
            },
            {
                id: 'gs-2',
                title: 'Navigating Time Periods',
                summary: 'Move through dates and find the time range you need',
                content: [
                    { type: 'text', value: 'Use the time navigation controls to move through your planning horizon.' },
                    {
                        type: 'step', title: 'Navigation Methods', steps: [
                            'Click "Today" button to jump to current date',
                            'Use ← → arrow keys for time travel',
                            'Scroll horizontally on the grid header',
                            'Toggle between Fiscal Year and Calendar Year views'
                        ]
                    },
                    { type: 'shortcut', key: '← / →', action: 'Move backward/forward in time' },
                    { type: 'shortcut', key: 'Space', action: 'Pause/Resume auto-scrolling' }
                ]
            },
            {
                id: 'gs-3',
                title: 'Switching View Modes',
                summary: 'Toggle between different ways to visualize capacity',
                content: [
                    { type: 'text', value: 'The app supports multiple view modes to suit different analysis needs.' },
                    {
                        type: 'step', title: 'Available Views', steps: [
                            'Hours Mode: Shows actual hours allocated',
                            '% Capacity Mode: Shows percentage of target utilization',
                            'Projects Mode: View projects instead of resources',
                            'Compact/Comfy: Adjust row density for overview or detail'
                        ]
                    },
                    { type: 'tip', value: 'Use Compact mode for high-level overview of large teams.' }
                ]
            }
        ]
    },
    {
        category: 'filtering',
        icon: '🔍',
        title: 'Filtering & Search',
        description: 'Find exactly the resources and projects you need',
        articles: [
            {
                id: 'filter-1',
                title: 'Search for Resources',
                summary: 'Quickly find specific people by name or role',
                content: [
                    { type: 'text', value: 'The search bar supports instant filtering with smart matching.' },
                    {
                        type: 'step', title: 'How to Search', steps: [
                            'Press "/" to focus the search bar instantly',
                            'Type a name, role, or squad to filter',
                            'Results update in real-time as you type',
                            'Press Esc to clear search and show all'
                        ]
                    },
                    { type: 'shortcut', key: '/', action: 'Focus search bar' },
                    { type: 'shortcut', key: 'Esc', action: 'Clear search/filters' }
                ]
            },
            {
                id: 'filter-2',
                title: 'Filter by Squad',
                summary: 'View only specific teams or departments',
                content: [
                    { type: 'text', value: 'Squad filtering lets you focus on specific teams without distraction.' },
                    {
                        type: 'step', title: 'Using Squad Filter', steps: [
                            'Click the Squad dropdown in the toolbar',
                            'Select one or more squads to display',
                            'Uncheck squads to hide their resources',
                            'The chart automatically updates to show only filtered data'
                        ]
                    },
                    { type: 'tip', value: 'Hold Ctrl/Cmd while clicking to select multiple squads.' }
                ]
            },
            {
                id: 'filter-3',
                title: 'Filter by Entity/Origin',
                summary: 'Focus on resources from specific companies or origins',
                content: [
                    { type: 'text', value: 'Entity filtering is useful for merged organizations or multi-company setups.' },
                    {
                        type: 'step', title: 'Entity Filtering', steps: [
                            'Open Settings (gear icon)',
                            'Find the Entity/Origin filter section',
                            'Select the entities you want to include',
                            'The grid will show only matching resources'
                        ]
                    },
                    { type: 'tip', value: 'Combine Entity and Squad filters for precise team views.' }
                ]
            },
            {
                id: 'filter-4',
                title: 'Status Legend Filtering',
                summary: 'Use project statuses to focus your view',
                content: [
                    { type: 'text', value: 'The status legend at the bottom doubles as a powerful filter.' },
                    {
                        type: 'step', title: 'Status Filter Tips', steps: [
                            'Click a status color to toggle its visibility',
                            'Hold Alt/Option + click to isolate a single status',
                            'Multiple statuses can be active simultaneously',
                            'Great for focusing on "In Flight" or "Onboarding" projects only'
                        ]
                    },
                    { type: 'tip', value: 'Alt+Click on "In Flight" to quickly see only active projects.' }
                ]
            }
        ]
    },
    {
        category: 'resource-management',
        icon: '👥',
        title: 'Resource Management',
        description: 'Manage your team members and their allocations',
        articles: [
            {
                id: 'res-1',
                title: 'Pin Important Resources',
                summary: 'Keep key people visible at the top of your grid',
                content: [
                    { type: 'text', value: 'Pinning ensures critical resources are always visible regardless of filters.' },
                    {
                        type: 'step', title: 'How to Pin', steps: [
                            'Hover over a resource row',
                            'Click the ★ star icon on the left',
                            'Pinned resources appear at the top with a gold star',
                            'Click again to unpin'
                        ]
                    },
                    { type: 'tip', value: 'Pin your direct reports or project leads for quick access.' }
                ]
            },
            {
                id: 'res-2',
                title: 'View Resource Details',
                summary: 'See complete profile with hours, utilization, and dates',
                content: [
                    { type: 'text', value: 'Access detailed information about any resource quickly.' },
                    {
                        type: 'step', title: 'Accessing Details', steps: [
                            'Click on a resource name (not a cell)',
                            'View profile: Country, Job Title, Weekly Hours',
                            'See target utilization and start/leave dates',
                            'Configure ramp-up profile if applicable'
                        ]
                    },
                    { type: 'tip', value: 'Resources on ramp-up show a 🚀 indicator and yellow underline on cells.' }
                ]
            },
            {
                id: 'res-3',
                title: 'Understanding Ramp-Up Profiles',
                summary: 'Configure gradual capacity increase for new joiners',
                content: [
                    { type: 'text', value: 'Ramp-up profiles automatically reduce capacity for new team members.' },
                    {
                        type: 'step', title: 'Setting Up Ramp-Up', steps: [
                            'Click on a resource name to open their profile',
                            'Find the "Ramp Up Configuration" section',
                            'Select a profile: 4-week, 8-week, or 12-week',
                            'Set the ramp start date (defaults to start date)',
                            'Capacity automatically scales up each week'
                        ]
                    },
                    { type: 'example', title: 'Example', value: 'An 8-week ramp at 40h/week:\nWeek 1-2: 10h (25%), Week 3-4: 20h (50%),\nWeek 5-6: 30h (75%), Week 7-8+: 40h (100%)' }
                ]
            },
            {
                id: 'res-4',
                title: 'Leave Period Management',
                summary: 'Mark temporary absences for accurate capacity planning',
                content: [
                    { type: 'text', value: 'Leave periods show as yellow diagonal stripes and reduce available capacity.' },
                    {
                        type: 'step', title: 'Managing Leave', steps: [
                            'Leave dates are pulled from your Airtable resource table',
                            'Set "Leave Start Date" and "Leave End Date" fields',
                            'Capacity automatically becomes 0 during leave',
                            'Yellow diagonal stripes indicate leave periods',
                            'Gray stripes indicate permanent departure (left company)'
                        ]
                    },
                    { type: 'tip', value: 'Leave periods don\'t affect the capacity line - it shows target capacity.' }
                ]
            }
        ]
    },
    {
        category: 'project-management',
        icon: '📁',
        title: 'Project Management',
        description: 'Manage projects, team assignments, and timelines',
        articles: [
            {
                id: 'proj-1',
                title: 'View Project Details',
                summary: 'See comprehensive project info including team and budget',
                content: [
                    { type: 'text', value: 'Click on any colored cell to drill into project details.' },
                    {
                        type: 'step', title: 'Project Detail Modal', steps: [
                            'Click a cell with hours allocated',
                            'View the project card with status, squad, wave',
                            'See budget performance: Planned vs Actuals vs EAC',
                            'View and manage PM/SC/PD team assignments',
                            'Click "Edit" to modify dates, status, or squad'
                        ]
                    },
                    { type: 'tip', value: 'The sparkline shows budget health at a glance - green line is budget, blue bar is actuals.' }
                ]
            },
            {
                id: 'proj-2',
                title: 'Assign Team Members',
                summary: 'Add or remove PM, SC, and PD allocations',
                content: [
                    { type: 'text', value: 'Team assignment directly impacts demand calculation.' },
                    {
                        type: 'step', title: 'Assigning Members', steps: [
                            'Open a project detail modal (click a cell)',
                            'Find the "Project Team" section at the bottom',
                            'Click "+ Add" under PM, SC, or PD',
                            'Select a resource from the dropdown',
                            'Resources are grouped by squad for easy selection'
                        ]
                    },
                    { type: 'tip', value: 'The project\'s own squad members appear first in the dropdown.' }
                ]
            },
            {
                id: 'proj-3',
                title: 'Edit Project Dates',
                summary: 'Adjust kick-off and launch dates',
                content: [
                    { type: 'text', value: 'Project date changes immediately recalculate capacity distribution.' },
                    {
                        type: 'step', title: 'Editing Dates', steps: [
                            'Open project detail modal',
                            'Click the "Edit" button next to the project name',
                            'Modify Kick-Off or Launch dates',
                            'Click "Save Changes" to apply',
                            'Changes save to Airtable via proxy fields'
                        ]
                    },
                    { type: 'tip', value: 'In Draft Mode, date changes are saved to your scenario for later commit.' }
                ]
            },
            {
                id: 'proj-4',
                title: 'Change Project Status',
                summary: 'Update status to reflect project lifecycle',
                content: [
                    { type: 'text', value: 'Status affects how projects appear and can be filtered.' },
                    {
                        type: 'step', title: 'Status Options', steps: [
                            'Draft, Pipeline-Best, Pipeline-Commit: Planning stages',
                            'Contracted, Onboarding: Pre-execution',
                            'In Flight: Active projects',
                            'In Hypercare: Post-launch support',
                            'Closed, Cancelled, On Hold: Completed/Paused'
                        ]
                    },
                    { type: 'tip', value: 'Use status legend to quickly filter by project stage.' }
                ]
            }
        ]
    },
    {
        category: 'draft-scenarios',
        icon: '📝',
        title: 'Draft Scenarios',
        description: 'Plan changes without affecting live data',
        articles: [
            {
                id: 'draft-1',
                title: 'Create a What-If Scenario',
                summary: 'Test changes safely before committing to live data',
                content: [
                    { type: 'text', value: 'Draft scenarios let you model changes without affecting the real database.' },
                    {
                        type: 'step', title: 'Creating a Scenario', steps: [
                            'Click "New Scenario" in the scenario selector',
                            'Give it a descriptive name (e.g., "Q2 Hiring Plan")',
                            'You\'re now in Draft Mode (purple banner appears)',
                            'Make any changes - they\'re saved to the scenario only',
                            'Switch back to "Live" anytime to see real data'
                        ]
                    },
                    { type: 'tip', value: 'Create scenarios for different hiring plans, project mixes, or timeline options.' }
                ]
            },
            {
                id: 'draft-2',
                title: 'Compare Scenarios',
                summary: 'View multiple scenarios side-by-side',
                content: [
                    { type: 'text', value: 'Compare capacity impact across different planning scenarios.' },
                    {
                        type: 'step', title: 'Comparison View', steps: [
                            'Click the compare icon in the scenario selector',
                            'Select scenarios to compare',
                            'View capacity charts overlaid for comparison',
                            'Identify which scenario best balances load'
                        ]
                    },
                    { type: 'tip', value: 'Export comparison charts for stakeholder presentations.' }
                ]
            },
            {
                id: 'draft-3',
                title: 'Commit Changes to Live',
                summary: 'Push your scenario changes to the actual database',
                content: [
                    { type: 'text', value: 'When ready, commit your scenario changes to update the real data.' },
                    {
                        type: 'step', title: 'Committing Changes', steps: [
                            'Review all changes in your scenario',
                            'Click "Commit Changes" in the draft banner',
                            'Confirm you want to update live data',
                            'Changes are written to Airtable via proxy fields',
                            'Scenario is marked as committed'
                        ]
                    },
                    { type: 'warning', value: 'Committed changes cannot be undone automatically. Review carefully!' }
                ]
            }
        ]
    },
    {
        category: 'charts-metrics',
        icon: '📊',
        title: 'Charts & Metrics',
        description: 'Understand the capacity chart and performance metrics',
        articles: [
            {
                id: 'chart-1',
                title: 'Reading the Capacity Chart',
                summary: 'Understand what each line and bar represents',
                content: [
                    { type: 'text', value: 'The capacity chart provides a visual overview of your team\'s workload.' },
                    {
                        type: 'step', title: 'Chart Elements', steps: [
                            'Green solid line: Total available capacity',
                            'Blue/Purple bars: Demand from different categories',
                            'Stacked bars show PM, SC, PD breakdown',
                            'X-axis: Time periods (weeks/months)',
                            'Y-axis: Hours'
                        ]
                    },
                    { type: 'tip', value: 'When bars exceed the green line, you\'re over-allocated.' }
                ]
            },
            {
                id: 'chart-2',
                title: 'Understanding EAC Forecasts',
                summary: 'Learn about Estimate at Completion calculations',
                content: [
                    { type: 'text', value: 'EAC predicts your final total hours based on current burn rate.' },
                    {
                        type: 'step', title: 'EAC Metrics', steps: [
                            'EAC = Actuals + (Remaining Work / Efficiency)',
                            'Positive variance = under budget (good!)',
                            'Negative variance = over budget risk',
                            'Toggle forecast mode in toolbar to see EAC impact'
                        ]
                    },
                    { type: 'example', title: 'Example', value: 'Project at 50% complete with 600h actuals vs 500h budget:\nEAC ~= 600h × 2 = 1200h (vs 1000h planned)' }
                ]
            },
            {
                id: 'chart-3',
                title: 'Forecast Modes',
                summary: 'Switch between different projection methods',
                content: [
                    { type: 'text', value: 'Different forecast modes help you understand potential outcomes.' },
                    {
                        type: 'step', title: 'Available Modes', steps: [
                            'Planned: Original budget allocation',
                            'EAC: Estimate at Completion (most likely outcome)',
                            'Impact: Forecast showing over/under burn impact',
                            'Toggle in toolbar to switch views'
                        ]
                    },
                    { type: 'tip', value: 'Use Impact mode to see where you might need to take action.' }
                ]
            }
        ]
    },
    {
        category: 'keyboard-shortcuts',
        icon: '⌨️',
        title: 'Keyboard Shortcuts',
        description: 'Speed up your workflow with keyboard navigation',
        articles: [
            {
                id: 'kb-1',
                title: 'All Keyboard Shortcuts',
                summary: 'Complete list of available shortcuts',
                content: [
                    { type: 'text', value: 'Master these shortcuts to navigate the app like a pro.' },
                    { type: 'shortcut', key: '/', action: 'Focus search bar' },
                    { type: 'shortcut', key: 'Esc', action: 'Clear filters / Close modal' },
                    { type: 'shortcut', key: '← / →', action: 'Time travel (move date range)' },
                    { type: 'shortcut', key: 'Space', action: 'Pause/Resume auto-scrolling' },
                    { type: 'shortcut', key: '?', action: 'Open this help guide' },
                    { type: 'shortcut', key: 'G then S', action: 'Open Settings' },
                    { type: 'shortcut', key: 'Cmd/Ctrl + K', action: 'Command palette (coming soon)' }
                ]
            }
        ]
    },
    {
        category: 'settings',
        icon: '⚙️',
        title: 'Settings & Configuration',
        description: 'Customize the app to match your workflow',
        articles: [
            {
                id: 'set-1',
                title: 'Field Mapping Setup',
                summary: 'Connect your Airtable fields to the capacity model',
                content: [
                    { type: 'text', value: 'Field mapping tells the app which Airtable fields contain your data.' },
                    {
                        type: 'step', title: 'Setting Up Mappings', steps: [
                            'Open Settings (gear icon)',
                            'Find the "Field Mappings" section',
                            'Map each required field to your Airtable column',
                            'Required: Resources table, Projects table, Scenarios table',
                            'Optional: Allocations table for detailed tracking'
                        ]
                    },
                    { type: 'warning', value: 'Incorrect field mappings will result in missing or wrong data.' }
                ]
            },
            {
                id: 'set-2',
                title: 'Role Mapping Configuration',
                summary: 'Define how job titles map to PM/SC/PD categories',
                content: [
                    { type: 'text', value: 'Role mapping categorizes resources for demand distribution.' },
                    {
                        type: 'step', title: 'Configuring Roles', steps: [
                            'Open Settings → Role Mapping section',
                            'Add job titles that should be categorized as PM',
                            'Add titles for SC (Solution Consultant)',
                            'Add titles for PD (Platform Delivery)',
                            'Resources matching these titles auto-categorize'
                        ]
                    },
                    { type: 'example', title: 'Example', value: 'PM: "Project Manager", "Delivery Lead"\nSC: "Solution Consultant", "Solutions Architect"\nPD: "Developer", "Integration Specialist"' }
                ]
            },
            {
                id: 'set-3',
                title: 'Active Squads Configuration',
                summary: 'Control which squads appear in the default view',
                content: [
                    { type: 'text', value: 'Limit the default view to only the squads you manage.' },
                    {
                        type: 'step', title: 'Setting Active Squads', steps: [
                            'Open Settings → Active Squads section',
                            'Check the squads you want visible by default',
                            'Unchecked squads are hidden but not deleted',
                            'Use toolbar filter to temporarily show others'
                        ]
                    },
                    { type: 'tip', value: 'Great for managers who only need to see their own teams.' }
                ]
            },
            {
                id: 'set-4',
                title: 'Ramp-Up Profiles',
                summary: 'Define custom onboarding ramp-up schedules',
                content: [
                    { type: 'text', value: 'Create profiles that match your organization\'s onboarding timeline.' },
                    {
                        type: 'step', title: 'Creating Ramp Profiles', steps: [
                            'Open Settings → Ramp Profiles section',
                            'Click "Add Profile" to create new',
                            'Set weekly percentage increases',
                            'Example: Week 1: 25%, Week 2: 50%, Week 3: 75%, Week 4+: 100%',
                            'Assign profiles to new resources'
                        ]
                    },
                    { type: 'tip', value: 'Create different profiles for different roles (PMs may ramp faster than developers).' }
                ]
            }
        ]
    },
    {
        category: 'advanced-features',
        icon: '🚀',
        title: 'Advanced Features',
        description: 'Master programs, slots, and AI optimization',
        articles: [
            {
                id: 'adv-1',
                title: 'Program Management',
                summary: 'Manage large initiatives and track program budgets',
                content: [
                    { type: 'text', value: 'Programs group related projects together for high-level tracking.' },
                    {
                        type: 'step', title: 'Managing Programs', steps: [
                            'Click the "Programs" button (puzzle icon) in the toolbar',
                            'Create new programs with budget caps',
                            'Assign projects to a program from the project detail modal',
                            'Track total spend vs budget across all projects',
                            'Visualize program timeline in the Gantt view'
                        ]
                    },
                    { type: 'tip', value: 'Program budgets automatically aggregate project hours. Use the Programs dashboard to see burn rate.' }
                ]
            },
            {
                id: 'adv-2',
                title: 'Slot Planning & Optimization',
                summary: 'Use the heatmap to optimize resource allocation',
                content: [
                    { type: 'text', value: 'The Slot Heatmap provides a granular view of daily availability.' },
                    {
                        type: 'step', title: 'Using Slot View', steps: [
                            'Switch the view mode to "Slots" in the toolbar',
                            'See precise availability (Green = Open, Red = Full)',
                            'Click "Optimize" to auto-resolve conflicts based on business priorities',
                            'Use "Merged View" to combine squad capacities'
                        ]
                    },
                    { type: 'example', title: 'Optimization Logic', value: 'The optimizer prioritizes:\n1. Locked projects (cannot move)\n2. Higher priority projects\n3. Minimizing schedule slip' }
                ]
            },
            {
                id: 'adv-3',
                title: 'AI Insights',
                summary: 'Leverage AI for staffing recommendations and risk detection',
                content: [
                    { type: 'text', value: 'AI Insights analyzes your entire plan to find hidden risks.' },
                    {
                        type: 'step', title: 'Generating Insights', steps: [
                            'Go to the Slots view',
                            'Click the "AI Insights" button',
                            'Wait for the analysis to complete',
                            'Review recommendations for unstaffed roles, bottleneck squads, and schedule risks',
                            'Accept recommendations to apply fixes automatically'
                        ]
                    },
                    { type: 'tip', value: 'AI analysis snapshot is saved to the database for historical tracking.' }
                ]
            }
        ]
    },
    {
        category: 'troubleshooting',
        icon: '🔧',
        title: 'Troubleshooting',
        description: 'Common issues and how to resolve them',
        articles: [
            {
                id: 'trouble-1',
                title: 'Data Not Loading',
                summary: 'What to do when the grid shows no data',
                content: [
                    { type: 'text', value: 'If you see an empty grid, check these common causes.' },
                    {
                        type: 'step', title: 'Troubleshooting Steps', steps: [
                            'Check you have permission to view the connected tables',
                            'Verify field mappings in Settings are correct',
                            'Ensure your filters aren\'t hiding all resources',
                            'Try pressing Esc to clear all filters',
                            'Refresh the page if data was recently added'
                        ]
                    },
                    { type: 'tip', value: 'Open browser console (F12) for detailed error messages.' }
                ]
            },
            {
                id: 'trouble-2',
                title: 'Changes Not Saving',
                summary: 'Troubleshoot write-back issues',
                content: [
                    { type: 'text', value: 'If edits don\'t persist, check your setup.' },
                    {
                        type: 'step', title: 'Write-Back Requirements', steps: [
                            'Proxy fields must be configured in field mappings',
                            'You need Editor permission on the tables',
                            'Check that proxy automation is active in Airtable',
                            'Draft mode changes only save when committed'
                        ]
                    },
                    { type: 'warning', value: 'Without proxy fields, the app is read-only.' }
                ]
            },
            {
                id: 'trouble-3',
                title: 'Capacity Numbers Seem Wrong',
                summary: 'Verify capacity calculation sources',
                content: [
                    { type: 'text', value: 'Capacity comes from resource settings and may differ from expectations.' },
                    {
                        type: 'step', title: 'Capacity Factors', steps: [
                            'Weekly Hours: Pulled from resource record',
                            'Target Utilization: % of hours available for projects',
                            'Ramp-Up: Reduces capacity for new resources',
                            'Leave Periods: Sets capacity to 0 during absence',
                            'Start/Leave Dates: Only includes active resources'
                        ]
                    },
                    { type: 'example', title: 'Example', value: '40h/week × 80% utilization = 32h effective capacity' }
                ]
            }
        ]
    }
];

const DocumentationModal = ({ onClose }) => {
    const { isDark, colors } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedArticle, setSelectedArticle] = useState(null);

    // Filter articles based on search
    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return GUIDE_DATA;

        const query = searchQuery.toLowerCase();
        return GUIDE_DATA.map(category => ({
            ...category,
            articles: category.articles.filter(article =>
                article.title.toLowerCase().includes(query) ||
                article.summary.toLowerCase().includes(query) ||
                article.content.some(c =>
                    (c.value && c.value.toLowerCase().includes(query)) ||
                    (c.steps && c.steps.some(s => s.toLowerCase().includes(query)))
                )
            )
        })).filter(category => category.articles.length > 0);
    }, [searchQuery]);

    // Flat list of all matching articles for search results
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return filteredData.flatMap(cat =>
            cat.articles.map(art => ({ ...art, categoryTitle: cat.title, categoryIcon: cat.icon }))
        );
    }, [searchQuery, filteredData]);

    const renderContent = (content) => {
        return content.map((item, idx) => {
            switch (item.type) {
                case 'text':
                    return <p key={idx} style={{ margin: '0 0 12px', color: '#475569', lineHeight: '1.6' }}>{item.value}</p>;
                case 'step':
                    return (
                        <div key={idx} style={{ marginBottom: '16px' }}>
                            <h5 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{item.title}</h5>
                            <ol style={{ margin: 0, paddingLeft: '20px' }}>
                                {item.steps.map((step, i) => (
                                    <li key={i} style={{ marginBottom: '6px', color: '#475569', fontSize: '13px', lineHeight: '1.5' }}>{step}</li>
                                ))}
                            </ol>
                        </div>
                    );
                case 'tip':
                    return (
                        <div key={idx} style={{ padding: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <svg style={{ width: '16px', height: '16px', flexShrink: 0, color: '#00BD00' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            <span style={{ color: '#166534', fontSize: '13px', lineHeight: '1.5' }}>{item.value}</span>
                        </div>
                    );
                case 'warning':
                    return (
                        <div key={idx} style={{ padding: '12px', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <svg style={{ width: '16px', height: '16px', flexShrink: 0, color: '#d97706' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <span style={{ color: '#92400e', fontSize: '13px', lineHeight: '1.5' }}>{item.value}</span>
                        </div>
                    );
                case 'shortcut':
                    return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                            <kbd style={{
                                padding: '4px 10px',
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '12px',
                                fontWeight: '600',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                minWidth: '60px',
                                textAlign: 'center'
                            }}>{item.key}</kbd>
                            <span style={{ color: '#475569', fontSize: '13px' }}>{item.action}</span>
                        </div>
                    );
                case 'example':
                    return (
                        <div key={idx} style={{ padding: '12px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '12px' }}>
                            <h5 style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{item.title}</h5>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px', color: '#334155', fontFamily: 'ui-monospace, monospace' }}>{item.value}</pre>
                        </div>
                    );
                default:
                    return null;
            }
        });
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                zIndex: Z_INDEX.MODAL_BACKDROP
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: colors.bgModal,
                    borderRadius: '20px',
                    boxShadow: colors.shadowXl,
                    border: `1px solid ${colors.border}`,
                    width: '100%',
                    maxWidth: '900px',
                    height: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header with Search */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    background: 'linear-gradient(135deg, #7637E3 0%, #7637E3 100%)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '28px' }}>📚</span> Capacity Model Guide
                            </h2>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>
                                Learn how to maximize your resource planning workflow
                            </p>
                        </div>
                        <button onClick={onClose} style={{
                            padding: '8px',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            color: 'white',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>{ICONS.CLOSE}</button>
                    </div>

                    {/* Search Bar */}
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Search guides... (e.g., 'filter', 'ramp-up', 'scenario')"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                // Clear any open article so the main pane never shows a
                                // stale selection that no longer matches the new query.
                                setSelectedArticle(null);
                            }}
                            style={{
                                width: '100%',
                                padding: '12px 16px 12px 44px',
                                fontSize: '15px',
                                border: 'none',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(255,255,255,0.95)',
                                color: '#1e293b',
                                outline: 'none',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}
                            autoFocus
                        />
                        <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Sidebar - Categories or Search Results */}
                    <div style={{
                        width: '280px',
                        borderRight: '1px solid #e2e8f0',
                        overflowY: 'auto',
                        backgroundColor: '#fafafa'
                    }}>
                        {searchQuery ? (
                            // Search Results
                            <div style={{ padding: '12px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', padding: '0 8px' }}>
                                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                                </div>
                                {searchResults.map((article, idx) => (
                                    <button
                                        key={article.id}
                                        onClick={() => setSelectedArticle(article)}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            padding: '12px',
                                            marginBottom: '4px',
                                            textAlign: 'left',
                                            backgroundColor: selectedArticle?.id === article.id ? '#E8E1D9' : 'white',
                                            border: selectedArticle?.id === article.id ? '1px solid #c4b5fd' : '1px solid #e2e8f0',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '14px' }}>{article.categoryIcon}</span>
                                            <span style={{ fontSize: '11px', color: '#64748b' }}>{article.categoryTitle}</span>
                                        </div>
                                        <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>{article.title}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{article.summary}</div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            // Category List
                            <div style={{ padding: '12px' }}>
                                {GUIDE_DATA.map((category) => (
                                    <button
                                        key={category.category}
                                        onClick={() => {
                                            setSelectedCategory(category);
                                            setSelectedArticle(null);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            width: '100%',
                                            padding: '14px 12px',
                                            marginBottom: '4px',
                                            textAlign: 'left',
                                            backgroundColor: selectedCategory?.category === category.category ? '#E8E1D9' : 'transparent',
                                            border: 'none',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        <span style={{ fontSize: '24px' }}>{category.icon}</span>
                                        <div>
                                            <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{category.title}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>{category.articles.length} articles</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Main Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                        {selectedArticle ? (
                            // Article View
                            <div>
                                <button
                                    onClick={() => setSelectedArticle(null)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        marginBottom: '16px',
                                        backgroundColor: '#f1f5f9',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        color: '#64748b',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ← Back
                                </button>
                                <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                                    {selectedArticle.title}
                                </h3>
                                <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px' }}>
                                    {selectedArticle.summary}
                                </p>
                                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                                    {renderContent(selectedArticle.content)}
                                </div>
                            </div>
                        ) : selectedCategory ? (
                            // Category Articles List
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                    <span style={{ fontSize: '32px' }}>{selectedCategory.icon}</span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#1e293b' }}>
                                            {selectedCategory.title}
                                        </h3>
                                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
                                            {selectedCategory.description}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {selectedCategory.articles.map(article => (
                                        <button
                                            key={article.id}
                                            onClick={() => setSelectedArticle(article)}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '16px',
                                                textAlign: 'left',
                                                backgroundColor: 'white',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                            }}
                                        >
                                            <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>
                                                {article.title}
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#64748b' }}>
                                                {article.summary}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            // Welcome Screen
                            <div style={{ textAlign: 'center', paddingTop: '40px' }}>
                                <span style={{ fontSize: '64px', display: 'block', marginBottom: '20px' }}>📖</span>
                                <h3 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
                                    Welcome to the Guide
                                </h3>
                                <p style={{ maxWidth: '400px', margin: '0 auto 32px', color: '#64748b', lineHeight: '1.6' }}>
                                    Select a category from the sidebar or search for specific topics to learn how to get the most out of the Capacity Model.
                                </p>

                                {/* Quick Links */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', maxWidth: '500px', margin: '0 auto' }}>
                                    {['Getting Started', 'Project Management', 'Draft Scenarios'].map(title => {
                                        const cat = GUIDE_DATA.find(c => c.title === title);
                                        return cat ? (
                                            <button
                                                key={cat.category}
                                                onClick={() => setSelectedCategory(cat)}
                                                style={{
                                                    padding: '16px',
                                                    backgroundColor: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>{cat.icon}</span>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>{cat.title}</span>
                                            </button>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 24px',
                    backgroundColor: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: '#64748b'
                }}>
                    <span>Press <kbd style={{ padding: '2px 6px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', fontFamily: 'monospace' }}>?</kbd> anytime to open this guide</span>
                    <span>Capacity Model v{APP_VERSION}</span>
                </div>
            </div>
        </div>
    );
};

export default DocumentationModal;

DocumentationModal.propTypes = {
    onClose: PropTypes.func.isRequired
};
