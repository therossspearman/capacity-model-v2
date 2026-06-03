/**
 * Chart PNG Export
 *
 * Grabs the Recharts-rendered SVG in the capacity chart, serialises it to a
 * data URL, rasterises at 2× for board-grade output, and appends a date-axis
 * strip along the bottom. Zero dependencies — uses only browser-native APIs
 * (XMLSerializer, Image, canvas.toBlob, Canvas 2D text rendering).
 *
 * Why SVG-not-html2canvas for the chart: Recharts uses a single <svg> with
 * inline presentation attributes rather than classed CSS. Serialising and
 * drawing the SVG to canvas reproduces the chart faithfully without pulling
 * in a DOM-to-image library.
 *
 * Why composite the date strip separately: the chart's XAxis has tick={false}
 * (grid density — bar charts get cluttered with tick labels), so dates live
 * only in the DateHeaderRow component in the grid, not the SVG. We read the
 * date labels + x-positions from that DOM element (tagged with
 * data-capacity-date-header) and draw them onto the canvas using Canvas 2D's
 * text API, rotated -90° to match the on-screen style. The chart and grid
 * share absolute x-positions (chart's YAxis width = SIDEBAR_WIDTH, grid's
 * colLeftOffset = SIDEBAR_WIDTH + same columnWidth), so date labels land
 * directly under the corresponding bars.
 */

// Height of the date strip below the chart in the exported PNG (CSS px, scaled
// at render time). Tuned so rotated "Apr 7" / "Oct 28" style labels don't clip.
const DATE_STRIP_HEIGHT = 60;
const DATE_STRIP_FONT_SIZE = 10;
const DATE_STRIP_FONT = '500 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const DATE_STRIP_COLOR = '#64748b';
const DATE_STRIP_MONTH_DIVIDER_COLOR = '#e2e8f0';
const DATE_STRIP_BG = '#ffffff';

/**
 * @param {object} opts
 * @param {string} [opts.filename]  Download filename (default capacity-chart-YYYY-MM-DD.png).
 * @param {number} [opts.scale]     Rasterisation scale multiplier (default 2 for retina).
 * @param {string} [opts.bg]        Background fill hex (default white; charts are transparent otherwise).
 * @param {Function} [opts.addToast]  Optional toast callback for feedback.
 * @param {Array<{dateKey: string}>} [opts.dates]  Full dates array — if provided, used
 *        to compute label positions so virtualised (off-screen) grid columns still
 *        land in the PNG. Without this, only DOM-rendered date labels appear.
 * @param {number} [opts.columnWidth]  Per-column width in CSS px. Required alongside
 *        `dates` to compute positions. Should match the grid/chart columnWidth.
 * @returns {Promise<Blob>} Resolves with the PNG blob after download fires.
 */
export async function exportChartAsPng({
    filename,
    scale = 2,
    bg = '#ffffff',
    addToast,
    dates,
    columnWidth
} = {}) {
    try {
        // Prefer the Recharts ResponsiveContainer — there's one per chart.
        // If multiple are present (unlikely), pick the first visible one.
        const containers = document.querySelectorAll('.recharts-responsive-container, .recharts-wrapper');
        let svg = null;
        for (const c of containers) {
            const s = c.querySelector('svg');
            if (s && s.getBoundingClientRect().width > 0) {
                svg = s;
                break;
            }
        }
        if (!svg) {
            addToast?.({ type: 'error', title: 'Chart not found', message: 'No chart visible on the page. Scroll so the capacity chart is rendered, then try again.' });
            return null;
        }

        // Clone and set explicit dimensions so the standalone SVG renders at the
        // right size (ResponsiveContainer sets 100% width which doesn't serialise well).
        const svgRect = svg.getBoundingClientRect();
        const width = Math.max(1, Math.round(svgRect.width));
        const chartHeight = Math.max(1, Math.round(svgRect.height));
        const clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', width);
        clone.setAttribute('height', chartHeight);
        if (!clone.getAttribute('viewBox')) {
            clone.setAttribute('viewBox', `0 0 ${width} ${chartHeight}`);
        }
        clone.setAttribute('font-family', clone.getAttribute('font-family') || 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif');

        const svgString = new XMLSerializer().serializeToString(clone);
        const svgBlob = new Blob(['<?xml version="1.0" standalone="no"?>\r\n', svgString], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        // Rasterise chart via Image → canvas
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (e) => reject(e);
            img.src = svgUrl;
        });

        // ═══ Date strip — compute positions from the full dates array ═══
        // Preferred path: caller passed `dates` + `columnWidth`. We compute each
        // label's x-position from its index, so even grid columns that were
        // virtualised out of the DOM get drawn. This matches the chart's layout:
        //   chartWidth = leftOffset + dates.length × columnWidth
        // where leftOffset is the Y-axis gutter (SIDEBAR_WIDTH in the chart).
        // We derive leftOffset from `svgWidth - dates.length × columnWidth` so we
        // don't need to import the constant.
        //
        // Fallback: if `dates` wasn't passed (older callers), scrape visible
        // columns out of the grid's DateHeaderRow via data attributes.
        const dateEntries = [];
        const hasDatesProp = Array.isArray(dates) && dates.length > 0 && Number.isFinite(columnWidth) && columnWidth > 0;

        if (hasDatesProp) {
            const leftOffset = width - dates.length * columnWidth;
            // leftOffset is the Y-axis gutter, back-solved from the rendered width.
            // A negative value means the width/columnWidth assumption broke (e.g. the
            // chart gained right padding or a legend) — labels would misalign. Warn
            // loudly rather than fail silently; the per-label centreX guard below still
            // drops anything that lands off-canvas.
            if (leftOffset < 0) {
                console.warn('exportChartAsPng: negative Y-axis gutter (' + leftOffset + 'px) — date labels may misalign. Chart width/columnWidth assumption may have drifted.');
            }
            for (let i = 0; i < dates.length; i++) {
                const d = dates[i];
                const dateKey = (d && (d.dateKey || d.date_key)) || '';
                if (!dateKey) continue;
                const centreX = leftOffset + i * columnWidth + columnWidth / 2;
                if (centreX < 0 || centreX > width) continue; // defensive — shouldn't happen
                // Match the DateHeaderRow's label derivation:
                //   dateLabel = dateKey.includes('20') ? dateKey.split(' 20')[0] : dateKey
                const label = dateKey.includes('20') ? dateKey.split(' 20')[0] : dateKey;
                const isMonthStart = dateKey.includes(' 1');
                dateEntries.push({ centreX, label, isMonthStart });
            }
        } else {
            // Fallback: scrape DOM (only gives visible columns — grid may virtualise)
            const dateHeader = document.querySelector('[data-capacity-date-header="true"]');
            if (dateHeader) {
                const cols = dateHeader.querySelectorAll('[data-date-label]');
                for (const col of cols) {
                    const rect = col.getBoundingClientRect();
                    if (rect.width <= 0) continue;
                    const centreX = (rect.left + rect.width / 2) - svgRect.left;
                    if (centreX < 0 || centreX > width) continue;
                    const dateKey = col.getAttribute('data-date-key') || '';
                    const dateLabel = col.getAttribute('data-date-label') || '';
                    const isMonthStart = dateKey.includes(' 1');
                    dateEntries.push({ centreX, label: dateLabel, isMonthStart });
                }
            }
        }

        const hasDates = dateEntries.length > 0;
        const outputHeight = chartHeight + (hasDates ? DATE_STRIP_HEIGHT : 0);

        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = outputHeight * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);

        // 1) Chart first (top)
        ctx.drawImage(img, 0, 0, width, chartHeight);
        URL.revokeObjectURL(svgUrl);

        // 2) Date strip below — white background, faint month dividers, rotated labels
        if (hasDates) {
            const stripTop = chartHeight;
            ctx.fillStyle = DATE_STRIP_BG;
            ctx.fillRect(0, stripTop, width, DATE_STRIP_HEIGHT);

            // Month-start dividers matching the on-screen border-left style. The
            // on-screen border sits on the LEFT edge of the column — centreX is the
            // middle, so backtrack by half a column width to get the edge.
            const halfCol = hasDatesProp
                ? columnWidth / 2
                : (dateEntries.length > 1 ? (dateEntries[1].centreX - dateEntries[0].centreX) / 2 : 0);
            ctx.strokeStyle = DATE_STRIP_MONTH_DIVIDER_COLOR;
            ctx.lineWidth = 1;
            for (const d of dateEntries) {
                if (!d.isMonthStart) continue;
                const leftX = d.centreX - halfCol;
                ctx.beginPath();
                ctx.moveTo(Math.round(leftX) + 0.5, stripTop);
                ctx.lineTo(Math.round(leftX) + 0.5, stripTop + DATE_STRIP_HEIGHT);
                ctx.stroke();
            }

            // Labels — rotated -90° (reads bottom-to-top), centred on the column
            ctx.fillStyle = DATE_STRIP_COLOR;
            ctx.font = DATE_STRIP_FONT;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            for (const d of dateEntries) {
                ctx.save();
                // Position the baseline anchor at the bottom of the strip, centred in the
                // column; rotate -90° so text reads upward. Offset a few px off the bottom
                // edge so descenders don't kiss the edge.
                ctx.translate(d.centreX, stripTop + DATE_STRIP_HEIGHT - 4);
                ctx.rotate(-Math.PI / 2);
                // After rotation: +x goes up the page, y=0 is the column's centre line.
                // Draw at x=0,y=0 so the text starts just above the bottom edge.
                ctx.fillText(d.label, 0, DATE_STRIP_FONT_SIZE / 2 - 4);
                ctx.restore();
            }
        }

        const name = filename || `capacity-chart-${new Date().toISOString().split('T')[0]}.png`;

        return await new Promise((resolve) => {
            canvas.toBlob((pngBlob) => {
                if (!pngBlob) {
                    addToast?.({ type: 'error', title: 'Export failed', message: 'Couldn\'t rasterise the chart. Try again or use a browser screenshot tool as a fallback.' });
                    resolve(null);
                    return;
                }
                const url = URL.createObjectURL(pngBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = name;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 500);
                addToast?.({
                    type: 'success',
                    title: 'Chart exported',
                    message: hasDates ? `Saved ${name} (with date axis)` : `Saved ${name}`
                });
                resolve(pngBlob);
            }, 'image/png');
        });
    } catch (err) {
        console.error('exportChartAsPng failed:', err);
        addToast?.({ type: 'error', title: 'Export failed', message: err?.message || 'Unknown error — use a browser screenshot tool as a fallback.' });
        return null;
    }
}
