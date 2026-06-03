// Z-Index Layering System
export const Z_INDEX = {
    GRID_BODY: 0,
    GRID_DECOR: 10,
    STICKY_COL: 30,
    STICKY_HEADER: 40,
    MENU_BACKDROP: 100,
    CONTROLS: 110,
    DROPDOWN: 120,
    TOOLTIP: 130,
    MODAL_BACKDROP: 2000,
    MODAL: 2100,
    TOAST: 3000,
    TOUR: 5000
};

// Zoom levels configuration
// NOTE: Only `width` (column width in px) is consumed (see Dashboard.jsx).
export const ZOOM_CONFIG = {
    compact: { width: 28 },
    comfortable: { width: 44 },
    spacious: { width: 64 }
};
