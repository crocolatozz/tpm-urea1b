import { useEffect } from 'react';

let activeModalLockCount = 0;

function applyDocumentScrollLock(): void {
  const html = document.documentElement;
  const body = document.body;
  html.classList.add('overflow-hidden', 'touch-none', 'overscroll-contain');
  body.classList.add('overflow-hidden', 'touch-none', 'overscroll-contain');
}

function releaseDocumentScrollLock(): void {
  const html = document.documentElement;
  const body = document.body;
  html.classList.remove('overflow-hidden', 'touch-none', 'overscroll-contain');
  body.classList.remove('overflow-hidden', 'touch-none', 'overscroll-contain');
}

export function useModalScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    activeModalLockCount += 1;
    if (activeModalLockCount === 1) {
      applyDocumentScrollLock();
    }

    return () => {
      activeModalLockCount = Math.max(0, activeModalLockCount - 1);
      if (activeModalLockCount === 0) {
        releaseDocumentScrollLock();
      }
    };
  }, [isLocked]);
}
