import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION, compareSemver } from '../data/tpmData';

export type UpdateModalState =
  | { mode: 'closed' }
  | {
      mode: 'prompt';
      remoteVersion: string;
      releaseNotes: string;
      swDriven: boolean;
    };

interface VersionJsonPayload {
  version?: string;
  notes?: string;
  offline?: boolean;
}

async function fetchRemoteVersionJson(): Promise<VersionJsonPayload | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as VersionJsonPayload;
    if (!data || data.offline || !data.version) return null;
    return data;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function useAppUpdater() {
  const [modalState, setModalState] = useState<UpdateModalState>({ mode: 'closed' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Pure in-memory postpone state for the current active screen session only (never persisted)
  const [isDismissed, setIsDismissed] = useState(false);
  const isDismissedRef = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!import.meta.env.DEV && registration) {
        registration.update().catch(() => {});
      }
    },
    onRegisterError(err) {
      if (!import.meta.env.DEV) {
        console.warn('SW registration error:', err);
      }
    },
  });

  const checkForUpdates = useCallback(async () => {
    let hasWaitingSw = false;

    if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => {})));
        hasWaitingSw = regs.some((r) => Boolean(r.waiting));
      } catch {
        // Ignore SW inspection errors
      }
    }

    const data = await fetchRemoteVersionJson();

    // Respect active-session dismiss only until next cold start or visibility resume
    if (isDismissedRef.current) return;

    const hasNewerVersion = Boolean(
      data?.version && compareSemver(APP_VERSION, data.version) > 0
    );

    if (hasNewerVersion && data?.version) {
      setModalState({
        mode: 'prompt',
        remoteVersion: data.version,
        releaseNotes: data.notes || '',
        swDriven: needRefresh || hasWaitingSw,
      });
      return;
    }

    if ((needRefresh || hasWaitingSw) && !import.meta.env.DEV) {
      setModalState({
        mode: 'prompt',
        remoteVersion: data?.version || APP_VERSION,
        releaseNotes:
          data?.notes ||
          'Pembaruan aplikasi siap dipasang. Ketuk Update Sekarang untuk memuat tampilan dan fitur terbaru.',
        swDriven: true,
      });
    }
  }, [needRefresh]);

  // Enrich and open prompt when Workbox detects a waiting SW (Android Chrome & iOS Safari)
  useEffect(() => {
    if (!needRefresh || isDismissed) return;
    let cancelled = false;

    fetchRemoteVersionJson().then((data) => {
      if (cancelled || isDismissedRef.current) return;

      const hasNewerRemote = Boolean(
        data?.version && compareSemver(APP_VERSION, data.version) > 0
      );
      if (import.meta.env.DEV && !hasNewerRemote) {
        return;
      }

      const remoteVer = hasNewerRemote && data?.version ? data.version : APP_VERSION;
      const releaseNotes =
        data?.notes ||
        'Pembaruan aplikasi siap dipasang. Ketuk Update Sekarang untuk memuat tampilan dan fitur terbaru.';

      setModalState({
        mode: 'prompt',
        remoteVersion: remoteVer,
        releaseNotes,
        swDriven: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [needRefresh, isDismissed]);

  // Cold start + visibilitychange resume check: reset postpone state and re-check version.json & SW
  useEffect(() => {
    isDismissedRef.current = false;
    setIsDismissed(false);
    void checkForUpdates();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        isDismissedRef.current = false;
        setIsDismissed(false);
        setErrorMsg(null);
        void checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForUpdates]);

  const dismissUpdate = useCallback(() => {
    isDismissedRef.current = true;
    setIsDismissed(true);
    setErrorMsg(null);
    setIsUpdating(false);
    setModalState({ mode: 'closed' });
  }, []);

  const confirmUpdate = useCallback(async () => {
    if (modalState.mode !== 'prompt') return;
    setIsUpdating(true);
    setErrorMsg(null);

    let aborted = false;
    const timeoutId = window.setTimeout(() => {
      aborted = true;
      setIsUpdating(false);
      setErrorMsg(
        '📶 Sinyal lemah atau koneksi terputus. Cache offline tetap aman—kamu bisa menutup jendela ini dan tetap bekerja offline.'
      );
    }, 8000);

    try {
      // Pastikan koneksi stabil & server benar-benar merespons sebelum proses reload / aktivasi SW
      const probe = await fetchRemoteVersionJson();
      if (aborted) return;

      if (!probe || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        window.clearTimeout(timeoutId);
        setIsUpdating(false);
        setErrorMsg(
          '📶 Koneksi terputus atau sinyal tidak stabil. Cache offline tetap dipertahankan agar aplikasi tetap bisa dipakai.'
        );
        return;
      }

      if (needRefresh) {
        await updateServiceWorker(true);
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await reg.update().catch(() => {});
        }
      }

      window.setTimeout(() => {
        if (aborted) return;
        window.clearTimeout(timeoutId);
        window.location.reload();
      }, 900);
    } catch {
      window.clearTimeout(timeoutId);
      setIsUpdating(false);
      setErrorMsg(
        '📶 Gagal memuat pembaruan. Cache offline tetap aman—silakan tutup dan coba lagi saat sinyal stabil.'
      );
    }
  }, [modalState, needRefresh, updateServiceWorker]);

  return {
    modalState,
    isUpdating,
    errorMsg,
    confirmUpdate,
    dismissUpdate,
  };
}
