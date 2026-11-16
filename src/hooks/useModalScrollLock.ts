import { useEffect, useRef } from 'react';

const activeLockIds = new Set<symbol>();

function syncDocumentScrollLock(): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const body = document.body;
  if (activeLockIds.size > 0) {
    html.classList.add('overflow-hidden', 'touch-none', 'overscroll-contain');
    body.classList.add('overflow-hidden', 'touch-none', 'overscroll-contain');
  } else {
    html.classList.remove('overflow-hidden', 'touch-none', 'overscroll-contain');
    body.classList.remove('overflow-hidden', 'touch-none', 'overscroll-contain');
  }
}

export function useModalScrollLock(isLocked: boolean): void {
  const lockIdRef = useRef<symbol | null>(null);
  if (lockIdRef.current === null) {
    lockIdRef.current = Symbol('modal-scroll-lock');
  }

  useEffect(() => {
    const lockId = lockIdRef.current;
    if (!lockId) return;

    if (isLocked) {
      activeLockIds.add(lockId);
    } else {
      activeLockIds.delete(lockId);
    }
    syncDocumentScrollLock();

    return () => {
      activeLockIds.delete(lockId);
      syncDocumentScrollLock();
    };
  }, [isLocked]);
}
