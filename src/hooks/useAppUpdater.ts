import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION, compareSemver } from '../data/tpmData';

export const UPDATING_FROM_STORAGE_KEY = 'tpm_updating_from';
export const UPDATE_VALIDATION_TTL_MS = 30000;

export type UpdatePhase = 'idle' | 'updating' | 'reloading';

export type UpdateModalState =
  | { mode: 'closed' }
  | {
      mode: 'prompt';
      remoteVersion: string;
      releaseNotes: string[];
      swDriven: boolean;
      manualTriggered: boolean;
      simulated?: boolean;
    };

export type ManualCheckResult = 'update-available' | 'up-to-date' | 'offline';

interface VersionJsonPayload {
  version?: string;
  notes?: string[] | string;
  offline?: boolean;
}

interface UseAppUpdaterOptions {
  suppressPrompt?: boolean;
  onBeforeReloadFadeOut?: () => void;
  onCancelFadeOut?: () => void;
  onUpdateError?: (message: string) => void;
}

const DEFAULT_RELEASE_NOTES: string[] = [
  'Versi baru aplikasi TPM Urea 1B sudah siap. Perbarui sekarang agar fitur dan jadwal selalu akurat.',
];

const INITIAL_CHECK_DELAY_MS = 2000;
const FALLBACK_RELOAD_TIMEOUT_MS = 3500;
const RELOAD_FADE_DELAY_MS = 200;

export function normalizeReleaseNotes(rawNotes: unknown): string[] {
  if (Array.isArray(rawNotes)) {
    const cleaned = rawNotes
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : DEFAULT_RELEASE_NOTES;
  }

  if (typeof rawNotes === 'string') {
    const cleaned = rawNotes
      .split(/\r?\n|,\s+/)
      .map((item) => item.trim().replace(/^[-•*]\s*/, ''))
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : DEFAULT_RELEASE_NOTES;
  }

  return DEFAULT_RELEASE_NOTES;
}

async function fetchRemoteVersionJson(): Promise<VersionJsonPayload | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
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

async function clearAllBrowserCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const keys = await window.caches.keys();
    await Promise.all(keys.map((key) => window.caches.delete(key).catch(() => false)));
  } catch {
    // Ignore cache clearing errors
  }
}

function waitForInstalledWorker(
  reg: ServiceWorkerRegistration,
  timeoutMs = 6000
): Promise<ServiceWorker | null> {
  if (reg.waiting) {
    return Promise.resolve(reg.waiting);
  }

  return new Promise((resolve) => {
    let settled = false;
    let watchedWorker: ServiceWorker | null = null;
    let timerId: number | null = null;

    const finish = (worker: ServiceWorker | null) => {
      if (settled) return;
      settled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      reg.removeEventListener('updatefound', handleUpdateFound);
      if (watchedWorker) {
        watchedWorker.removeEventListener('statechange', handleStateChange);
      }
      resolve(worker);
    };

    const handleStateChange = () => {
      if (reg.waiting) {
        finish(reg.waiting);
        return;
      }
      if (!watchedWorker) return;
      if (watchedWorker.state === 'installed') {
        finish(reg.waiting || watchedWorker);
      } else if (watchedWorker.state === 'redundant') {
        finish(null);
      }
    };

    const watchInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker || settled) return;
      if (watchedWorker && watchedWorker !== worker) {
        watchedWorker.removeEventListener('statechange', handleStateChange);
      }
      watchedWorker = worker;
      if (worker.state === 'installed') {
        finish(reg.waiting || worker);
        return;
      }
      if (worker.state === 'redundant') {
        finish(null);
        return;
      }
      worker.addEventListener('statechange', handleStateChange);
    };

    const handleUpdateFound = () => {
      watchInstallingWorker(reg.installing);
    };

    timerId = window.setTimeout(() => {
      finish(reg.waiting || null);
    }, timeoutMs);

    reg.addEventListener('updatefound', handleUpdateFound);
    if (reg.installing) {
      watchInstallingWorker(reg.installing);
    }
  });
}

async function checkServiceWorkersForWaiting(waitIfInstalling = false): Promise<boolean> {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    let regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.update().catch(() => {})));
    regs = await navigator.serviceWorker.getRegistrations();
    if (regs.some((r) => Boolean(r.waiting))) {
      return true;
    }
    if (waitIfInstalling) {
      const installingRegs = regs.filter((r) => Boolean(r.installing));
      if (installingRegs.length > 0) {
        await Promise.all(installingRegs.map((r) => waitForInstalledWorker(r, 6000)));
        regs = await navigator.serviceWorker.getRegistrations();
        return regs.some((r) => Boolean(r.waiting));
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function useAppUpdater(options: UseAppUpdaterOptions = {}) {
  const {
    suppressPrompt = false,
    onBeforeReloadFadeOut,
    onCancelFadeOut,
    onUpdateError,
  } = options;

  const [modalState, setModalState] = useState<UpdateModalState>({ mode: 'closed' });
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>('idle');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [initialDelayDone, setInitialDelayDone] = useState(false);

  // Pure in-memory postpone state for the current app session only (resets on cold start)
  const isDismissedRef = useRef(false);
  const isReloadingRef = useRef(false);
  const modalOpenTriggeredRef = useRef(false);

  const onBeforeReloadFadeOutRef = useRef(onBeforeReloadFadeOut);
  onBeforeReloadFadeOutRef.current = onBeforeReloadFadeOut;
  const onCancelFadeOutRef = useRef(onCancelFadeOut);
  onCancelFadeOutRef.current = onCancelFadeOut;
  const onUpdateErrorRef = useRef(onUpdateError);
  onUpdateErrorRef.current = onUpdateError;

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!import.meta.env.DEV && registration) {
        registration.update().catch(() => {});
      }
    },
    onNeedReload() {
      // Reload ditangani terkontrol via listener controllerchange + transisi fade-out
    },
    onRegisterError(err) {
      if (!import.meta.env.DEV) {
        console.warn('SW registration error:', err);
      }
    },
  });

  const needRefreshRef = useRef(needRefresh);
  needRefreshRef.current = needRefresh;

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setInitialDelayDone(true);
    }, INITIAL_CHECK_DELAY_MS);
    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  const openPromptWithMetadata = useCallback(async (manualTriggered: boolean) => {
    const data = await fetchRemoteVersionJson();
    const hasNewerVersion = Boolean(
      data?.version && compareSemver(APP_VERSION, data.version) > 0
    );
    setErrorMsg(null);
    setModalState({
      mode: 'prompt',
      remoteVersion: hasNewerVersion && data?.version ? data.version : APP_VERSION,
      releaseNotes: normalizeReleaseNotes(data?.notes),
      swDriven: true,
      manualTriggered,
    });
  }, []);

  // Kondisi (a): Tampilkan pop-up HANYA setelah aset baru selesai terunduh & SW resmi berada di status registration.waiting (onNeedRefresh)
  useEffect(() => {
    if (!initialDelayDone || import.meta.env.DEV) return;
    if (isDismissedRef.current || modalState.mode !== 'closed') return;

    let cancelled = false;

    const verifyAndOpenIfWaiting = async () => {
      let swReady = needRefreshRef.current;
      if (!swReady) {
        swReady = await checkServiceWorkersForWaiting(false);
      }
      if (
        cancelled ||
        !swReady ||
        isDismissedRef.current ||
        modalOpenTriggeredRef.current
      ) {
        return;
      }
      modalOpenTriggeredRef.current = true;
      await openPromptWithMetadata(false);
    };

    void verifyAndOpenIfWaiting();

    return () => {
      cancelled = true;
    };
  }, [initialDelayDone, needRefresh, modalState.mode, openPromptWithMetadata]);

  // Kondisi (b): Cek manual lewat tombol bundar hijau Cek Update (hanya membuka modal bila SW benar-benar berstatus waiting)
  const checkForUpdatesManual = useCallback(async (): Promise<ManualCheckResult> => {
    setIsCheckingUpdate(true);
    try {
      const [hasWaitingSw, data] = await Promise.all([
        checkServiceWorkersForWaiting(true),
        fetchRemoteVersionJson(),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 600);
        }),
      ]);

      const swUpdateReady = (needRefreshRef.current || hasWaitingSw) && !import.meta.env.DEV;

      if (swUpdateReady) {
        isDismissedRef.current = false;
        modalOpenTriggeredRef.current = true;
        const hasNewerVersion = Boolean(
          data?.version && compareSemver(APP_VERSION, data.version) > 0
        );
        setErrorMsg(null);
        setModalState({
          mode: 'prompt',
          remoteVersion: hasNewerVersion && data?.version ? data.version : APP_VERSION,
          releaseNotes: normalizeReleaseNotes(data?.notes),
          swDriven: true,
          manualTriggered: true,
        });
        return 'update-available';
      }

      if (!data) {
        return 'offline';
      }

      return 'up-to-date';
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const simulateUpdatePrompt = useCallback(() => {
    isDismissedRef.current = false;
    setErrorMsg(null);
    setUpdatePhase('idle');
    setModalState({
      mode: 'prompt',
      remoteVersion: '2.12.0',
      releaseNotes: [
        'Simulasi pratinjau pop-up pembaruan PWA dengan alur animasi asli (tanpa reload browser).',
        'Memastikan transisi overlay fade-out/fade-in, badge versi, dan tombol aksi tampil persis seperti update nyata.',
      ],
      swDriven: false,
      manualTriggered: true,
      simulated: true,
    });
  }, []);

  const dismissUpdate = useCallback(() => {
    if (updatePhase !== 'idle' || isReloadingRef.current) return;
    isDismissedRef.current = true;
    modalOpenTriggeredRef.current = false;
    setErrorMsg(null);
    setUpdatePhase('idle');
    setModalState({ mode: 'closed' });
  }, [updatePhase]);

  const confirmUpdate = useCallback(async () => {
    if (modalState.mode !== 'prompt' || updatePhase !== 'idle' || isReloadingRef.current) return;
    setUpdatePhase('updating');
    setErrorMsg(null);

    if (modalState.simulated) {
      window.setTimeout(() => {
        if (isReloadingRef.current) return;
        isReloadingRef.current = true;
        setUpdatePhase('reloading');
        onBeforeReloadFadeOutRef.current?.();

        window.setTimeout(() => {
          isReloadingRef.current = false;
          setUpdatePhase('idle');
          setModalState({ mode: 'closed' });
          onCancelFadeOutRef.current?.();
        }, RELOAD_FADE_DELAY_MS);
      }, 450);
      return;
    }

    const swContainer = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    let fallbackTimerId: number | null = null;
    let activeControllerHandler: (() => void) | null = null;

    const cleanupControllerListener = () => {
      if (swContainer && activeControllerHandler) {
        swContainer.removeEventListener('controllerchange', activeControllerHandler);
        activeControllerHandler = null;
      }
    };

    const clearFallbackTimer = () => {
      if (fallbackTimerId !== null) {
        window.clearTimeout(fallbackTimerId);
        fallbackTimerId = null;
      }
    };

    const removeUpdatingSessionFlag = () => {
      try {
        window.sessionStorage.removeItem(UPDATING_FROM_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    };

    const executeSmoothReload = () => {
      if (isReloadingRef.current) return;
      isReloadingRef.current = true;
      clearFallbackTimer();
      cleanupControllerListener();

      setUpdatePhase('reloading');
      onBeforeReloadFadeOutRef.current?.();

      window.setTimeout(() => {
        window.location.reload();
      }, RELOAD_FADE_DELAY_MS);
    };

    const abortWithError = (inlineMsg: string) => {
      if (isReloadingRef.current) return;
      clearFallbackTimer();
      cleanupControllerListener();
      removeUpdatingSessionFlag();
      onCancelFadeOutRef.current?.();
      setUpdatePhase('idle');
      setErrorMsg(inlineMsg);
      onUpdateErrorRef.current?.('Gagal memperbarui aplikasi. Periksa koneksi internet Anda.');
    };

    try {
      window.sessionStorage.setItem(
        UPDATING_FROM_STORAGE_KEY,
        JSON.stringify({ version: APP_VERSION, timestamp: Date.now() })
      );
    } catch {
      // Ignore storage restrictions
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('offline');
      }

      if (swContainer && !import.meta.env.DEV) {
        await new Promise<void>((resolve) => {
          const handleControllerChange = () => {
            cleanupControllerListener();
            executeSmoothReload();
            resolve();
          };
          activeControllerHandler = handleControllerChange;
          swContainer.addEventListener('controllerchange', handleControllerChange, { once: true });

          fallbackTimerId = window.setTimeout(() => {
            fallbackTimerId = null;
            void clearAllBrowserCaches().finally(() => {
              executeSmoothReload();
              resolve();
            });
          }, FALLBACK_RELOAD_TIMEOUT_MS);

          void updateServiceWorker(true)
            .then(async () => {
              const regs = await swContainer.getRegistrations().catch(() => []);
              regs.forEach((reg) => {
                if (reg.waiting) {
                  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            })
            .catch(() => {
              // Fallback timer tetap menjamin recovery bila Workbox gagal mengirim SKIP_WAITING
            });
        });
        return;
      }

      await clearAllBrowserCaches();
      executeSmoothReload();
    } catch {
      abortWithError(
        'Gagal memperbarui aplikasi. Periksa koneksi internet Anda—cache offline tetap aman.'
      );
    }
  }, [modalState, updatePhase, updateServiceWorker]);

  const visibleModalState: UpdateModalState =
    modalState.mode === 'prompt' && suppressPrompt && !modalState.manualTriggered
      ? { mode: 'closed' }
      : modalState;

  return {
    modalState: visibleModalState,
    updatePhase,
    isUpdating: updatePhase !== 'idle',
    isCheckingUpdate,
    errorMsg,
    confirmUpdate,
    dismissUpdate,
    checkForUpdatesManual,
    simulateUpdatePrompt,
  };
}
