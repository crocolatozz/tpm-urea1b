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
const RELOAD_FADE_DELAY_MS = 260;

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

async function checkServiceWorkersForWaiting(): Promise<boolean> {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.update().catch(() => {})));
    return regs.some((r) => Boolean(r.waiting));
  } catch {
    return false;
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
  timeoutMs = 5000
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

  // Pure in-memory postpone state for the current app session only (resets on cold start)
  const isDismissedRef = useRef(false);
  const coldStartCheckedRef = useRef(false);
  const isReloadingRef = useRef(false);

  const onBeforeReloadFadeOutRef = useRef(onBeforeReloadFadeOut);
  onBeforeReloadFadeOutRef.current = onBeforeReloadFadeOut;
  const onCancelFadeOutRef = useRef(onCancelFadeOut);
  onCancelFadeOutRef.current = onCancelFadeOut;
  const onUpdateErrorRef = useRef(onUpdateError);
  onUpdateErrorRef.current = onUpdateError;

  const {
    needRefresh: [needRefresh],
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

  const needRefreshRef = useRef(needRefresh);
  needRefreshRef.current = needRefresh;

  const probeForUpdate = useCallback(async (withMinDelay = false) => {
    const tasks: [Promise<boolean>, Promise<VersionJsonPayload | null>, Promise<void>?] = [
      checkServiceWorkersForWaiting(),
      fetchRemoteVersionJson(),
    ];
    if (withMinDelay) {
      tasks.push(
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 600);
        })
      );
    }

    const [hasWaitingSw, data] = await Promise.all(tasks);
    const hasNewerVersion = Boolean(
      data?.version && compareSemver(APP_VERSION, data.version) > 0
    );
    const swUpdateReady = (needRefreshRef.current || hasWaitingSw) && !import.meta.env.DEV;

    return { data, hasNewerVersion, swUpdateReady };
  }, []);

  // Kondisi (a): Cek otomatis HANYA sekali setelah jeda 2 detik saat aplikasi dibuka (cold load)
  useEffect(() => {
    if (coldStartCheckedRef.current) return;
    coldStartCheckedRef.current = true;

    let cancelled = false;

    const runColdStartCheck = async () => {
      if (cancelled || isDismissedRef.current) return;

      const { data, hasNewerVersion, swUpdateReady } = await probeForUpdate(false);

      if (cancelled || isDismissedRef.current) return;

      if ((hasNewerVersion && data?.version) || swUpdateReady) {
        setModalState({
          mode: 'prompt',
          remoteVersion: hasNewerVersion && data?.version ? data.version : APP_VERSION,
          releaseNotes: normalizeReleaseNotes(data?.notes),
          swDriven: swUpdateReady,
          manualTriggered: false,
        });
      }
    };

    const initialTimerId = window.setTimeout(() => {
      void runColdStartCheck();
    }, INITIAL_CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimerId);
    };
  }, [probeForUpdate]);

  // Kondisi (b): Cek manual lewat tombol bundar hijau Cek Update
  const checkForUpdatesManual = useCallback(async (): Promise<ManualCheckResult> => {
    setIsCheckingUpdate(true);
    try {
      const { data, hasNewerVersion, swUpdateReady } = await probeForUpdate(true);

      if (!data) {
        return 'offline';
      }

      if (hasNewerVersion || swUpdateReady) {
        isDismissedRef.current = false;
        setErrorMsg(null);
        setModalState({
          mode: 'prompt',
          remoteVersion: hasNewerVersion && data.version ? data.version : APP_VERSION,
          releaseNotes: normalizeReleaseNotes(data.notes),
          swDriven: swUpdateReady,
          manualTriggered: true,
        });
        return 'update-available';
      }

      return 'up-to-date';
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [probeForUpdate]);

  const simulateUpdatePrompt = useCallback(() => {
    isDismissedRef.current = false;
    setErrorMsg(null);
    setUpdatePhase('idle');
    setModalState({
      mode: 'prompt',
      remoteVersion: '2.10.2',
      releaseNotes: [
        'Simulasi pratinjau pop-up pembaruan PWA (mode uji lokal, tidak memuat ulang aplikasi).',
        'Memastikan tata letak modal update, badge versi, dan tombol aksi tampil presisi di layar mobile.',
      ],
      swDriven: false,
      manualTriggered: true,
      simulated: true,
    });
  }, []);

  const dismissUpdate = useCallback(() => {
    if (updatePhase !== 'idle' || isReloadingRef.current) return;
    isDismissedRef.current = true;
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
        setUpdatePhase('reloading');
        window.setTimeout(() => {
          setUpdatePhase('idle');
          setModalState({ mode: 'closed' });
        }, 350);
      }, 650);
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
        let registrations = await swContainer.getRegistrations();
        let waitingWorkers = registrations
          .map((reg) => reg.waiting)
          .filter((w): w is ServiceWorker => w !== null);

        if (waitingWorkers.length === 0) {
          const probe = await fetchRemoteVersionJson();
          if (!probe) {
            throw new Error('offline');
          }

          await Promise.all(registrations.map((reg) => reg.update()));
          registrations = await swContainer.getRegistrations();
          waitingWorkers = registrations
            .map((reg) => reg.waiting)
            .filter((w): w is ServiceWorker => w !== null);

          if (waitingWorkers.length === 0) {
            const installedWorkers = await Promise.all(
              registrations.map((reg) => waitForInstalledWorker(reg, 4500))
            );
            waitingWorkers = installedWorkers.filter((w): w is ServiceWorker => w !== null);
          }
        }

        if (waitingWorkers.length > 0) {
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

            waitingWorkers.forEach((worker) => {
              worker.postMessage({ type: 'SKIP_WAITING' });
            });
          });
          return;
        }
      }

      // Jika belum ada waiting worker setelah update(), verifikasi koneksi lalu bersihkan cache & reload halus
      const probe = await fetchRemoteVersionJson();
      if (!probe) {
        throw new Error('offline');
      }

      await clearAllBrowserCaches();
      executeSmoothReload();
    } catch {
      abortWithError(
        'Gagal memperbarui aplikasi. Periksa koneksi internet Anda—cache offline tetap aman.'
      );
    }
  }, [modalState, updatePhase]);

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
