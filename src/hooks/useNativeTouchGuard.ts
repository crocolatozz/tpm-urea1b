import { useEffect } from 'react';

export function useNativeTouchGuard(): void {
  useEffect(() => {
    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    const gestureEvents = ['gesturestart', 'gesturechange', 'gestureend'];
    gestureEvents.forEach((evtName) => {
      document.addEventListener(evtName, preventGesture, { passive: false });
    });

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName ? target.tagName.toUpperCase() : '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    };
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLInputElement | HTMLElement | null;
      const tag = target?.tagName ? target.tagName.toUpperCase() : '';
      const type =
        target && 'type' in target && typeof target.type === 'string'
          ? target.type.toLowerCase()
          : '';
      if ((tag === 'INPUT' && type === 'text') || tag === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      gestureEvents.forEach((evtName) => {
        document.removeEventListener(evtName, preventGesture);
      });
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);
}
