import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION, compareSemver } from '../data/tpmData';

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

const DEFAULT_RELEASE_NOTES: string[] = [
  'Versi baru aplikasi TPM Urea 1B sudah siap. Perbarui sekarang agar fitur dan jadwal selalu akurat.',
];

const INITIAL_CHECK_DELAY_MS = 2000;
const STABILIZE_RELOAD_DELAY_MS = 500;
const FALLBACK_RELOAD_TIMEOUT_MS = 3000;

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

export function useAppUpdater(suppressPrompt = false) {
  const [modalState, setModalState] = useState<UpdateModalState>({ mode: 'closed' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pure in-memory postpone state for the current app session only (resets on cold start)
  const isDismissedRef = useRef(false);
  const coldStartCheckedRef = useRef(false);
  const reloadTriggeredRef = useRef(false);

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
    setIsUpdating(false);
    setModalState({
      mode: 'prompt',
      remoteVersion: '2.10.0',
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
    isDismissedRef.current = true;
    setErrorMsg(null);
    setIsUpdating(false);
    setModalState({ mode: 'closed' });
  }, []);

  const confirmUpdate = useCallback(async () => {
    if (modalState.mode !== 'prompt' || isUpdating) return;
    setIsUpdating(true);
    setErrorMsg(null);

    if (modalState.simulated) {
      window.setTimeout(() => {
        setIsUpdating(false);
        setModalState({ mode: 'closed' });
      }, 900);
      return;
    }

    let aborted = false;
    let stabilizeTimerId: number | null = null;
    let fallbackReloadTimerId: number | null = null;
    const swContainer = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    let activeControllerHandler: (() => void) | null = null;

    const cleanupControllerListener = () => {
      if (swContainer && activeControllerHandler) {
        swContainer.removeEventListener('controllerchange', activeControllerHandler);
        activeControllerHandler = null;
      }
    };

    const clearAllTimers = () => {
      window.clearTimeout(hardTimeoutId);
      if (stabilizeTimerId !== null) {
        window.clearTimeout(stabilizeTimerId);
        stabilizeTimerId = null;
      }
      if (fallbackReloadTimerId !== null) {
        window.clearTimeout(fallbackReloadTimerId);
        fallbackReloadTimerId = null;
      }
    };

    const triggerSingleReload = () => {
      if (aborted || reloadTriggeredRef.current) return;
      reloadTriggeredRef.current = true;
      clearAllTimers();
      cleanupControllerListener();
      window.location.reload();
    };

    const scheduleStabilizedReload = () => {
      if (aborted || reloadTriggeredRef.current || stabilizeTimerId !== null) return;
      if (fallbackReloadTimerId !== null) {
        window.clearTimeout(fallbackReloadTimerId);
        fallbackReloadTimerId = null;
      }
      stabilizeTimerId = window.setTimeout(() => {
        stabilizeTimerId = null;
        triggerSingleReload();
      }, STABILIZE_RELOAD_DELAY_MS);
    };

    const hardTimeoutId = window.setTimeout(() => {
      aborted = true;
      clearAllTimers();
      cleanupControllerListener();
      setIsUpdating(false);
      setErrorMsg(
        'Sinyal lemah atau koneksi terputus. Cache offline tetap aman—kamu bisa menutup jendela ini dan tetap bekerja offline.'
      );
    }, 8000);

    try {
      const probe = await fetchRemoteVersionJson();
      if (aborted) return;

      if (!probe || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        aborted = true;
        clearAllTimers();
        setIsUpdating(false);
        setErrorMsg(
          'Koneksi terputus atau sinyal tidak stabil. Cache offline tetap dipertahankan agar aplikasi tetap bisa dipakai.'
        );
        return;
      }

      // Batas tunggu maksimal 3 detik agar tombol Update tidak pernah macet berputar jika controllerchange terlambat
      fallbackReloadTimerId = window.setTimeout(() => {
        fallbackReloadTimerId = null;
        triggerSingleReload();
      }, FALLBACK_RELOAD_TIMEOUT_MS);

      if (swContainer && !import.meta.env.DEV) {
        const controllerChangedPromise = new Promise<void>((resolve) => {
          const handleControllerChange = () => {
            cleanupControllerListener();
            resolve();
          };
          activeControllerHandler = handleControllerChange;
          swContainer.addEventListener('controllerchange', handleControllerChange);
        });

        const registrations = await swContainer.getRegistrations();
        await Promise.all(registrations.map((r) => r.update().catch(() => {})));

        const waitingRegs = registrations.filter((r) => Boolean(r.waiting));
        const hasWaitingOrInstalling =
          needRefreshRef.current ||
          waitingRegs.length > 0 ||
          registrations.some((r) => Boolean(r.installing));

        if (needRefreshRef.current) {
          await updateServiceWorker(false).catch(() => {});
        }
        waitingRegs.forEach((reg) => {
          reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
        });

        if (hasWaitingOrInstalling) {
          await Promise.race([
            controllerChangedPromise,
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, FALLBACK_RELOAD_TIMEOUT_MS);
            }),
          ]);
        }
        cleanupControllerListener();
      }

      if (!aborted) {
        scheduleStabilizedReload();
      }
    } catch {
      aborted = true;
      clearAllTimers();
      cleanupControllerListener();
      setIsUpdating(false);
      setErrorMsg(
        'Gagal memuat pembaruan. Cache offline tetap aman—silakan tutup dan coba lagi saat sinyal stabil.'
      );
    }
  }, [isUpdating, modalState, updateServiceWorker]);

  const visibleModalState: UpdateModalState =
    modalState.mode === 'prompt' && suppressPrompt && !modalState.manualTriggered
      ? { mode: 'closed' }
      : modalState;

  return {
    modalState: visibleModalState,
    isUpdating,
    isCheckingUpdate,
    errorMsg,
    confirmUpdate,
    dismissUpdate,
    checkForUpdatesManual,
    simulateUpdatePrompt,
  };
}
