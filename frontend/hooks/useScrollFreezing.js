import { useEffect } from 'react';

/**
 * Freezes pointer events during scroll for performance
 * @param {React.RefObject} containerRef - Ref to scroll container
 */
export const useScrollFreezing = (containerRef) => {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let isScrolling;

        const onScroll = () => {
            container.style.pointerEvents = 'none';
            window.clearTimeout(isScrolling);
            isScrolling = setTimeout(() => {
                container.style.pointerEvents = 'auto';
            }, 150);
        };

        container.addEventListener('scroll', onScroll, { passive: true });
        return () => container.removeEventListener('scroll', onScroll);
    }, [containerRef]);
};

export default useScrollFreezing;
