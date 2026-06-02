import { useEffect, useCallback } from 'react';

/**
 * Global keyboard shortcuts hook
 * Handles Cmd/Ctrl + key combinations and standalone keys
 */
export const useKeyboardShortcuts = (shortcuts, enabled = true) => {
    const handleKeyDown = useCallback((e) => {
        if (!enabled) return;

        // Don't trigger shortcuts when typing in inputs/textareas
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
            // Allow Escape in inputs
            if (e.key !== 'Escape') return;
        }

        const key = e.key.toLowerCase();
        const isMod = e.metaKey || e.ctrlKey;
        const isShift = e.shiftKey;

        // Check each shortcut
        for (const shortcut of shortcuts) {
            const matchesKey = shortcut.key.toLowerCase() === key;
            const matchesMod = shortcut.mod ? isMod : !isMod;
            const matchesShift = shortcut.shift ? isShift : true;

            if (matchesKey && matchesMod && matchesShift) {
                e.preventDefault();
                shortcut.action();
                return;
            }
        }
    }, [shortcuts, enabled]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
};

export default useKeyboardShortcuts;
