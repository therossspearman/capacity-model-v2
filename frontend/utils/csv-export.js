/**
 * CSV Export Utility for Capacity Data
 * Exports filtered resource data with per-week demand/capacity breakdown.
 *
 * @param {Array} filteredResources - Array of resource objects from useCapacityData
 * @param {Array} processedData - Array of weekly date-bucket objects (for date columns)
 * @param {Function} addToast - Toast notification function
 */
export const exportCapacityToCSV = (filteredResources, processedData, addToast) => {
    try {
        if (!filteredResources || filteredResources.length === 0) {
            addToast?.({ type: 'warning', title: 'No data', message: 'No resources to export' });
            return;
        }

        // Extract date keys from processedData for column headers
        const dateKeys = (processedData || []).map(d => d.dateKey || d.isoKey).filter(Boolean);

        // Build header row
        const headers = [
            'Name',
            'Squad',
            'Role',
            'Total Capacity (h)',
            'Total Demand (h)',
            'Utilization %',
            ...dateKeys.map(dk => `Demand ${dk}`),
            ...dateKeys.map(dk => `Capacity ${dk}`)
        ];

        // Build data rows from filteredResources 
        const rows = filteredResources.map(resource => {
            const totalCap = resource.totals?.cap || 0;
            const totalDem = resource.totals?.dem || 0;
            const utilPct = totalCap > 0 ? Math.round((totalDem / totalCap) * 100) : 0;

            const baseRow = [
                resource.name || '',
                (resource.squads || []).join('; '),
                resource.adJobTitle || resource.role || '',
                Math.round(totalCap),
                Math.round(totalDem),
                `${utilPct}%`
            ];

            // Per-week demand values
            const demandByWeek = dateKeys.map(dk => {
                const bucket = resource.buckets?.[dk];
                return bucket ? Math.round(bucket.dem || 0) : 0;
            });

            // Per-week capacity values
            const capByWeek = dateKeys.map(dk => {
                const bucket = resource.buckets?.[dk];
                return bucket ? Math.round(bucket.cap || 0) : 0;
            });

            return [...baseRow, ...demandByWeek, ...capByWeek];
        });

        // Encode a single cell: guard against CSV formula injection (values that
        // begin with =,+,-,@ are interpreted as formulas by Excel/Sheets) by
        // prefixing a single quote, then quote and escape embedded quotes.
        const encodeCell = (cell) => {
            let s = String(cell);
            if (/^[=+\-@]/.test(s)) {
                s = `'${s}`;
            }
            return `"${s.replace(/"/g, '""')}"`;
        };

        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(encodeCell).join(','))
        ].join('\n');

        // Download file — use window.open fallback for Airtable sandboxed iframes
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // Try standard link-click approach first
        const link = document.createElement('a');
        link.href = url;
        link.download = `capacity-export-${new Date().toISOString().split('T')[0]}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        // Clean up after a short delay
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 500);

        addToast?.({ type: 'success', title: 'Export complete', message: `Exported ${rows.length} resources to CSV` });
    } catch (error) {
        console.error('CSV Export failed:', error);
        addToast?.({ type: 'error', title: 'Export failed', message: error.message });
    }
};
