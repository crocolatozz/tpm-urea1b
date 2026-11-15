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

  // Kondisi (a): Cek otomatis HANYA sekali saat aplikasi pertama kali dibuka (cold load)
  useEffect(() => {
    if (coldStartCheckedRef.current) return;
    coldStartCheckedRef.current = true;

    let cancelled = false;

    const runColdStartCheck = async () => {
      if (isDismissedRef.current) return;

      const [hasWaitingSw, data] = await Promise.all([
        checkServiceWorkersForWaiting(),
        fetchRemoteVersionJson(),
      ]);

      if (cancelled || isDismissedRef.current) return;

      const hasNewerVersion = Boolean(
        data?.version && compareSemver(APP_VERSION, data.version) > 0
      );
      const swUpdateReady = (needRefreshRef.current || hasWaitingSw) && !import.meta.env.DEV;

      if (hasNewerVersion && data?.version) {
        setModalState({
          mode: 'prompt',
          remoteVersion: data.version,
          releaseNotes: normalizeReleaseNotes(data.notes),
          swDriven: swUpdateReady,
          manualTriggered: false,
        });
        return;
      }

      if (swUpdateReady) {
        setModalState({
          mode: 'prompt',
          remoteVersion: data?.version || APP_VERSION,
          releaseNotes: normalizeReleaseNotes(data?.notes),
          swDriven: true,
          manualTriggered: false,
        });
      }
    };

    void runColdStartCheck();

    return () => {
      cancelled = true;
    };
  }, []);

  // Kondisi (b): Cek manual lewat tombol bundar hijau Cek Update
  const checkForUpdatesManual = useCallback(async (): Promise<ManualCheckResult> => {
    setIsCheckingUpdate(true);
    try {
      const minSpinDelay = new Promise<void>((resolve) => {
        window.setTimeout(resolve, 600);
      });
      const [hasWaitingSw, data] = await Promise.all([
        checkServiceWorkersForWaiting(),
        fetchRemoteVersionJson(),
        minSpinDelay,
      ]);

      if (!data) {
        return 'offline';
      }

      const hasNewerVersion = compareSemver(APP_VERSION, data.version ?? '') > 0;
      const swUpdateReady = (needRefreshRef.current || hasWaitingSw) && !import.meta.env.DEV;

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
  }, []);

  const dismissUpdate = useCallback(() => {
    isDismissedRef.current = true;
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
        'Sinyal lemah atau koneksi terputus. Cache offline tetap aman—kamu bisa menutup jendela ini dan tetap bekerja offline.'
      );
    }, 8000);

    try {
      const probe = await fetchRemoteVersionJson();
      if (aborted) return;

      if (!probe || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        window.clearTimeout(timeoutId);
        setIsUpdating(false);
        setErrorMsg(
          'Koneksi terputus atau sinyal tidak stabil. Cache offline tetap dipertahankan agar aplikasi tetap bisa dipakai.'
        );
        return;
      }

      if (needRefreshRef.current) {
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
        'Gagal memuat pembaruan. Cache offline tetap aman—silakan tutup dan coba lagi saat sinyal stabil.'
      );
    }
  }, [modalState, updateServiceWorker]);

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
  };
}
