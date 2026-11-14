import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION, compareSemver } from '../data/tpmData';

export type UpdateModalState =
  | { mode: 'closed' }
  | {
      mode: 'prompt';
      remoteVersion: string;
      releaseNotes: string;
      isRetryLoop: boolean;
      swDriven: boolean;
    }
  | { mode: 'success'; newVersion: string };

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
  const lastCheckTsRef = useRef<number>(0);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        registration.update().catch(() => {});
      }
    },
    onRegisterError(err) {
      console.warn('SW registration error:', err);
    },
  });

  const checkVersionManifest = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheckTsRef.current < 60_000) return;
    lastCheckTsRef.current = now;

    // Also ask browser to check for waiting Service Worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.update().catch(() => {})))
        .catch(() => {});
    }

    const data = await fetchRemoteVersionJson();
    if (!data || !data.version) return;

    if (compareSemver(APP_VERSION, data.version) > 0) {
      setModalState({
        mode: 'prompt',
        remoteVersion: data.version,
        releaseNotes: data.notes || '',
        isRetryLoop: false,
        swDriven: false,
      });
    }
  }, []);

  // When Workbox detects a waiting SW on Android Chrome or iOS Safari, enrich the prompt with version.json notes
  useEffect(() => {
    if (!needRefresh) return;
    let cancelled = false;

    fetchRemoteVersionJson().then((data) => {
      if (cancelled) return;
      const remoteVer =
        data?.version && compareSemver(APP_VERSION, data.version) > 0
          ? data.version
          : APP_VERSION;
      const releaseNotes =
        data?.notes ||
        'Pembaruan aplikasi siap dipasang. Ketuk Update Sekarang untuk memuat tampilan dan fitur terbaru.';

      setModalState((prev) => {
        if (prev.mode === 'prompt' && !prev.swDriven) {
          return { ...prev, swDriven: true };
        }
        return {
          mode: 'prompt',
          remoteVersion: remoteVer,
          releaseNotes,
          isRetryLoop: false,
          swDriven: true,
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [needRefresh]);

  // Startup check + visibility resume check (handles PWA kept open in background on Android/iOS)
  useEffect(() => {
    const pendingTargetVer = sessionStorage.getItem('tpm_updating_to');
    const attempts = parseInt(sessionStorage.getItem('tpm_update_attempts') || '0', 10);

    if (pendingTargetVer) {
      if (compareSemver(APP_VERSION, pendingTargetVer) <= 0) {
        sessionStorage.removeItem('tpm_updating_to');
        sessionStorage.removeItem('tpm_update_attempts');
        setModalState({ mode: 'success', newVersion: APP_VERSION });
      } else if (attempts >= 1) {
        setModalState({
          mode: 'prompt',
          remoteVersion: pendingTargetVer,
          releaseNotes: '',
          isRetryLoop: true,
          swDriven: false,
        });
      }
    } else {
      void checkVersionManifest(true);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkVersionManifest(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVersionManifest]);

  const dismissUpdate = useCallback(() => {
    sessionStorage.removeItem('tpm_updating_to');
    sessionStorage.removeItem('tpm_update_attempts');
    setNeedRefresh(false);
    setErrorMsg(null);
    setIsUpdating(false);
    setModalState({ mode: 'closed' });
  }, [setNeedRefresh]);

  const confirmUpdate = useCallback(async () => {
    if (modalState.mode !== 'prompt') return;
    setIsUpdating(true);
    setErrorMsg(null);

    const prevAttempts = parseInt(sessionStorage.getItem('tpm_update_attempts') || '0', 10);
    if (!modalState.swDriven || compareSemver(APP_VERSION, modalState.remoteVersion) > 0) {
      sessionStorage.setItem('tpm_updating_to', modalState.remoteVersion);
      sessionStorage.setItem('tpm_update_attempts', String(prevAttempts + 1));
    }

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      setIsUpdating(false);
      setErrorMsg(
        '📶 Sinyal lemah atau koneksi terputus. Kamu tetap bisa menutup jendela ini dan pakai versi offline yang ada.'
      );
    }, 8000);

    try {
      if (needRefresh) {
        // Activate waiting Workbox SW cleanly (prompts controllerchange reload)
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

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      window.setTimeout(() => {
        if (timedOut) return;
        window.clearTimeout(timeoutId);
        window.location.reload();
      }, 900);
    } catch {
      window.clearTimeout(timeoutId);
      setIsUpdating(false);
      setErrorMsg('📶 Gagal memuat pembaruan. Silakan tutup dan coba lagi nanti.');
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
