import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  APP_VERSION,
  buildExtremeDummyTag,
  ensureStorageVersionGuard,
  getAreaForDateAndShift,
  getOperationalShiftInfo,
  getReportedLog,
  loadSavedPreferences,
  savePreferences,
  type GridType,
  type ReportedLogEntry,
  type ShiftName,
} from './data/tpmData';
import {
  collectSlotBlobUrls,
  createSyntheticContrastFile,
  disposeSlotCanvases,
  freeSlotArray,
  processAndResizeFile,
  type LoadedPhotoSlot,
} from './utils/imageCollage';
import { useNativeTouchGuard } from './hooks/useNativeTouchGuard';
import { useIsAnyModalOpen } from './hooks/useModalScrollLock';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  UPDATE_VALIDATION_TTL_MS,
  UPDATING_FROM_STORAGE_KEY,
  useAppUpdater,
} from './hooks/useAppUpdater';
import {
  publishShiftReport,
  reloadShiftReportsFromFirestore,
  setFirestoreWriteBlocked,
  subscribeToShiftReports,
  unpublishShiftReport,
} from './services/shiftReportSync';
import { DashboardView } from './components/DashboardView';
import { KolaseView, type KolaseToastKind } from './components/KolaseView';
import { GuideModal } from './components/GuideModal';
import { ChangelogModal } from './components/ChangelogModal';
import { IosInstallModal } from './components/IosInstallModal';
import { ForceUpdateModal } from './components/ForceUpdateModal';
import { DeveloperModeModal } from './components/DeveloperModeModal';
import { OfflineBanner } from './components/OfflineBanner';
import {
  IconAlertTriangle,
  IconCalendar,
  IconCamera,
  IconCheck,
  IconDownload,
  IconHelpCircle,
  IconLoader,
  IconSettings,
  IconWrench,
  IconXCircle,
} from './components/Icons';

type AppRoute = 'jadwal' | 'kolase';

interface KolaseContextState {
  date: string;
  shift: ShiftName;
  area: string;
}

interface ParsedHashRoute {
  route: AppRoute;
  date?: string;
  shift?: ShiftName;
  area?: string;
}

interface UnifiedToastState {
  message: string;
  kind: KolaseToastKind;
}

const DEV_TEST_ROWS: [string, string, string] = [
  'ABCDEFGHIJKLMnopqrstuvwxyz0123',
  'NOPQRSTUVWXYZabcdefghijklm4567',
  '0123456789 &/-().,:+!?@#%*=_<>',
];

function parseLocationToRouteState(): ParsedHashRoute {
  const hash = window.location.hash || '';
  if (hash.startsWith('#kolase')) {
    const queryIdx = hash.indexOf('?');
    const searchStr = queryIdx !== -1 ? hash.slice(queryIdx + 1) : '';
    const params = new URLSearchParams(searchStr);
    const rawDate = params.get('date') || undefined;
    const rawShift = params.get('shift') || undefined;
    const rawArea = params.get('area');
    return {
      route: 'kolase',
      date: rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined,
      shift:
        rawShift && (['PAGI', 'SORE', 'MALAM'] as const).includes(rawShift as ShiftName)
          ? (rawShift as ShiftName)
          : undefined,
      area: rawArea !== null ? rawArea : undefined,
    };
  }

  const legacyParams = new URLSearchParams(window.location.search);
  if (legacyParams.has('date') || legacyParams.has('shift') || legacyParams.has('area')) {
    const rawDate = legacyParams.get('date') || undefined;
    const rawShift = legacyParams.get('shift') || undefined;
    const rawArea = legacyParams.get('area');
    return {
      route: 'kolase',
      date: rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined,
      shift:
        rawShift && (['PAGI', 'SORE', 'MALAM'] as const).includes(rawShift as ShiftName)
          ? (rawShift as ShiftName)
          : undefined,
      area: rawArea !== null ? rawArea : undefined,
    };
  }

  return {
    route: 'jadwal',
  };
}

function buildInitialKolaseContext(parsed: ParsedHashRoute): KolaseContextState {
  const op = getOperationalShiftInfo();
  const date = parsed.date || op.dateStr;
  const shift = parsed.shift || op.shift;
  const area = parsed.area !== undefined ? parsed.area : getAreaForDateAndShift(date, shift);
  return { date, shift, area };
}

export const App: React.FC = () => {
  useNativeTouchGuard();

  const [route, setRoute] = useState<AppRoute>(() => parseLocationToRouteState().route);
  const [kolaseContext, setKolaseContext] = useState<KolaseContextState>(() =>
    buildInitialKolaseContext(parseLocationToRouteState())
  );
  const [kolaseSelectionKey, setKolaseSelectionKey] = useState<number>(1);
  const [reportedLog, setReportedLog] = useState<Record<string, ReportedLogEntry>>({});

  // State Kolase (slot foto, keterangan, layout) disimpan di App.tsx agar persisten lintas tab
  const [kolaseGridType, setKolaseGridType] = useState<GridType>(() => loadSavedPreferences().grid);
  const [beforeSlots, setBeforeSlots] = useState<Array<LoadedPhotoSlot | null>>([]);
  const [afterSlots, setAfterSlots] = useState<Array<LoadedPhotoSlot | null>>([]);
  const [rowCaptions, setRowCaptions] = useState<[string, string, string]>(['', '', '']);
  const [isReportSubmitted, setIsReportSubmitted] = useState<boolean>(false);

  const [guideOpen, setGuideOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [devModeActive, setDevModeActive] = useState(false);
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const gearTapCountRef = useRef(0);
  const gearLastTapRef = useRef(0);
  const devModeActiveRef = useRef(false);
  const devFillRunIdRef = useRef(0);
  const latestRealReportedLogRef = useRef<Record<string, ReportedLogEntry>>(getReportedLog());

  const activeBlobUrlsRef = useRef<Set<string>>(new Set());
  const pendingRevokeTimersRef = useRef<Set<number>>(new Set());
  const slotsCleanupRef = useRef<{
    before: Array<LoadedPhotoSlot | null>;
    after: Array<LoadedPhotoSlot | null>;
  }>({ before: [], after: [] });
  slotsCleanupRef.current = { before: beforeSlots, after: afterSlots };

  const [toast, setToast] = useState<UnifiedToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const testToastSeqTimersRef = useRef<number[]>([]);

  // Wadah dual-panel horizontal CSS Scroll-Snap + dua panel vertikal independen + header tunggal melayang
  const dualPanelRef = useRef<HTMLElement | null>(null);
  const jadwalPanelRef = useRef<HTMLElement | null>(null);
  const kolasePanelRef = useRef<HTMLElement | null>(null);
  const jadwalInnerRef = useRef<HTMLDivElement | null>(null);
  const kolaseInnerRef = useRef<HTMLDivElement | null>(null);
  const headerWrapperRef = useRef<HTMLDivElement | null>(null);
  const headerHeightRef = useRef<number>(0);
  const indicatorTrackRef = useRef<HTMLDivElement | null>(null);
  const indicatorBarRef = useRef<HTMLDivElement | null>(null);
  const routeRef = useRef<AppRoute>(route);
  routeRef.current = route;
  const programmaticSlideRef = useRef<{ target: AppRoute | null; timerId: number | null }>({
    target: null,
    timerId: null,
  });
  const isModalLocked = useIsAnyModalOpen();
  const [isDragLocked, setIsDragLocked] = useState(false);
  const isSwipeLockedRef = useRef(false);
  isSwipeLockedRef.current = isModalLocked || isDragLocked;

  const handleDragLockChange = useCallback((locked: boolean) => {
    setIsDragLocked(locked);
  }, []);

  const hasAnyStoredPhotos = beforeSlots.some(Boolean) || afterSlots.some(Boolean);
  const effectiveHasFilledPhotos = hasAnyStoredPhotos && !isReportSubmitted;

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const clearTestToastSequence = useCallback(() => {
    testToastSeqTimersRef.current.forEach((tid) => window.clearTimeout(tid));
    testToastSeqTimersRef.current = [];
  }, []);

  const showToast = useCallback(
    (message: string, kind: KolaseToastKind = 'warning', durationMs = 3500) => {
      clearToastTimer();
      setToast({ message, kind });
      if (kind !== 'loading') {
        toastTimerRef.current = window.setTimeout(() => {
          setToast(null);
          toastTimerRef.current = null;
        }, durationMs);
      }
    },
    [clearToastTimer]
  );

  const dismissLoadingToast = useCallback(() => {
    setToast((prev) => (prev?.kind === 'loading' ? null : prev));
  }, []);

  const handleBeforeReloadFadeOut = useCallback(() => {
    setIsFadingOut(true);
  }, []);

  const handleCancelFadeOut = useCallback(() => {
    setIsFadingOut(false);
  }, []);

  const handleUpdateErrorToast = useCallback(
    (msg: string) => {
      showToast(msg, 'error', 4500);
    },
    [showToast]
  );

  const { isInstallable, isIOS, showInstallButton, install } = usePWAInstall();
  const {
    modalState,
    updatePhase,
    isCheckingUpdate,
    errorMsg,
    confirmUpdate,
    dismissUpdate,
    checkForUpdatesManual,
    simulateUpdatePrompt,
  } = useAppUpdater({
    suppressPrompt: effectiveHasFilledPhotos,
    onBeforeReloadFadeOut: handleBeforeReloadFadeOut,
    onCancelFadeOut: handleCancelFadeOut,
    onUpdateError: handleUpdateErrorToast,
  });

  // Validasi hasil pembaruan PWA pasca-reload dengan pengaman kedaluwarsa 30 detik
  useEffect(() => {
    const checkTimerId = window.setTimeout(() => {
      try {
        const rawUpdateState = window.sessionStorage.getItem(UPDATING_FROM_STORAGE_KEY);
        if (!rawUpdateState) return;
        window.sessionStorage.removeItem(UPDATING_FROM_STORAGE_KEY);

        const parsed = JSON.parse(rawUpdateState) as {
          version?: unknown;
          timestamp?: unknown;
        };
        if (
          typeof parsed?.version !== 'string' ||
          typeof parsed?.timestamp !== 'number' ||
          !Number.isFinite(parsed.timestamp)
        ) {
          return;
        }

        const elapsed = Date.now() - parsed.timestamp;
        if (elapsed < 0 || elapsed > UPDATE_VALIDATION_TTL_MS) {
          return;
        }

        if (parsed.version !== APP_VERSION) {
          showToast(`Aplikasi berhasil diperbarui ke v${APP_VERSION}!`, 'success', 4500);
        } else {
          showToast(
            'Pembaruan belum terpasang, masih versi lama. Silakan coba lagi.',
            'error',
            5000
          );
        }
      } catch {
        try {
          window.sessionStorage.removeItem(UPDATING_FROM_STORAGE_KEY);
        } catch {
          // Ignore storage errors
        }
      }
    }, 50);

    return () => {
      window.clearTimeout(checkTimerId);
    };
  }, [showToast]);

  // Simpan preferensi grid hanya di luar Developer Mode
  useEffect(() => {
    if (devModeActive) return;
    savePreferences({ grid: kolaseGridType });
  }, [devModeActive, kolaseGridType]);

  // Post-commit ObjectURL cleanup di level App.tsx: tidak pernah mencabut URL aktif saat pindah tab
  useEffect(() => {
    const nextUrls = new Set<string>([
      ...collectSlotBlobUrls(beforeSlots),
      ...collectSlotBlobUrls(afterSlots),
    ]);

    activeBlobUrlsRef.current.forEach((oldUrl) => {
      if (!nextUrls.has(oldUrl)) {
        const timerId = window.setTimeout(() => {
          pendingRevokeTimersRef.current.delete(timerId);
          try {
            URL.revokeObjectURL(oldUrl);
          } catch {
            // Ignore revoke errors
          }
        }, 120);
        pendingRevokeTimersRef.current.add(timerId);
      }
    });

    activeBlobUrlsRef.current = nextUrls;
  }, [beforeSlots, afterSlots]);

  const updateTabIndicator = useCallback((progress: number) => {
    const track = indicatorTrackRef.current;
    const bar = indicatorBarRef.current;
    if (!track || !bar) return;
    const clamped = Math.min(1, Math.max(0, progress));
    const maxShift = Math.max(0, track.clientWidth - bar.offsetWidth);
    bar.style.transform = `translate3d(${clamped * maxShift}px, 0, 0)`;
  }, []);

  const syncHeaderTransform = useCallback(() => {
    const header = headerWrapperRef.current;
    const dual = dualPanelRef.current;
    const jadwal = jadwalPanelRef.current;
    const kolase = kolasePanelRef.current;
    const headerHeight = headerHeightRef.current;
    if (!header || !dual || !jadwal || !kolase || headerHeight <= 0) return;

    const progress =
      dual.clientWidth > 0 ? Math.min(1, Math.max(0, dual.scrollLeft / dual.clientWidth)) : 0;
    const effectiveScroll = jadwal.scrollTop * (1 - progress) + kolase.scrollTop * progress;
    const headerY = -Math.min(effectiveScroll, headerHeight);
    header.style.transform = `translate3d(0, ${headerY}px, 0)`;
    header.style.visibility = Math.abs(headerY) >= headerHeight - 0.5 ? 'hidden' : 'visible';
  }, []);

  const measureAndApplyHeaderHeight = useCallback(() => {
    const header = headerWrapperRef.current;
    if (!header) return;
    const nextHeight = Math.ceil(header.getBoundingClientRect().height);
    if (nextHeight > 0) {
      headerHeightRef.current = nextHeight;
      if (jadwalInnerRef.current) {
        jadwalInnerRef.current.style.paddingTop = `${nextHeight}px`;
      }
      if (kolaseInnerRef.current) {
        kolaseInnerRef.current.style.paddingTop = `${nextHeight}px`;
      }
    }
    syncHeaderTransform();
  }, [syncHeaderTransform]);

  const clearProgrammaticSlide = useCallback(() => {
    if (programmaticSlideRef.current.timerId !== null) {
      window.clearTimeout(programmaticSlideRef.current.timerId);
      programmaticSlideRef.current.timerId = null;
    }
    programmaticSlideRef.current.target = null;
  }, []);

  const slideToPanel = useCallback(
    (target: AppRoute, behavior: ScrollBehavior = 'smooth') => {
      const container = dualPanelRef.current;
      if (!container) return;

      clearProgrammaticSlide();
      if (behavior === 'smooth') {
        programmaticSlideRef.current.target = target;
        programmaticSlideRef.current.timerId = window.setTimeout(() => {
          programmaticSlideRef.current.target = null;
          programmaticSlideRef.current.timerId = null;
        }, 650);
      }

      const runScroll = () => {
        const currentContainer = dualPanelRef.current;
        if (!currentContainer) return;
        const targetLeft = target === 'kolase' ? currentContainer.clientWidth : 0;
        currentContainer.scrollTo({ left: targetLeft, behavior });
        if (behavior !== 'smooth') {
          updateTabIndicator(target === 'kolase' ? 1 : 0);
          syncHeaderTransform();
        }
      };

      if (behavior === 'smooth') {
        window.requestAnimationFrame(runScroll);
      } else {
        runScroll();
      }
    },
    [clearProgrammaticSlide, syncHeaderTransform, updateTabIndicator]
  );

  // Jalankan Storage Version Guard & pembersihan legacy key saat aplikasi dimuat, bersihkan memori hanya saat App unmount
  useEffect(() => {
    ensureStorageVersionGuard();
    return () => {
      setFirestoreWriteBlocked(false);
      clearProgrammaticSlide();
      clearToastTimer();
      clearTestToastSequence();
      pendingRevokeTimersRef.current.forEach((tid) => window.clearTimeout(tid));
      pendingRevokeTimersRef.current.clear();
      activeBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore revoke errors
        }
      });
      activeBlobUrlsRef.current.clear();
      slotsCleanupRef.current.before.forEach(disposeSlotCanvases);
      slotsCleanupRef.current.after.forEach(disposeSlotCanvases);
    };
  }, [clearProgrammaticSlide, clearTestToastSequence, clearToastTimer]);

  // Real-time Firestore + localStorage sync for reported shift badges
  useEffect(() => {
    const unsubscribe = subscribeToShiftReports(
      (merged) => {
        latestRealReportedLogRef.current = merged;
        if (!devModeActiveRef.current) {
          setReportedLog(merged);
        }
      },
      (errMessage) => {
        if (!devModeActiveRef.current) {
          showToast(errMessage, 'error');
        }
      }
    );
    return () => unsubscribe();
  }, [showToast]);

  // Ukur tinggi header tunggal & posisikan panel awal sebelum paint, pantau via ResizeObserver
  useLayoutEffect(() => {
    measureAndApplyHeaderHeight();
    const container = dualPanelRef.current;
    if (!container) return;
    const isKolase = routeRef.current === 'kolase';
    container.scrollLeft = isKolase ? container.clientWidth : 0;
    updateTabIndicator(isKolase ? 1 : 0);
    syncHeaderTransform();
  }, [measureAndApplyHeaderHeight, syncHeaderTransform, updateTabIndicator]);

  // Mulai fade-in opacity 250ms hanya setelah mount + useLayoutEffect selesai dan frame awal opacity-0 ter-paint
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setIsAppReady(true);
      });
    });
    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    const headerEl = headerWrapperRef.current;
    let observer: ResizeObserver | null = null;
    if (headerEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        measureAndApplyHeaderHeight();
      });
      observer.observe(headerEl);
    }

    const handleResize = () => {
      measureAndApplyHeaderHeight();
      const container = dualPanelRef.current;
      if (!container) return;
      const isKolase = routeRef.current === 'kolase';
      container.scrollLeft = isKolase ? container.clientWidth : 0;
      updateTabIndicator(isKolase ? 1 : 0);
      syncHeaderTransform();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [measureAndApplyHeaderHeight, syncHeaderTransform, updateTabIndicator]);

  // Pastikan posisi scrollLeft, indikator, & transform header tetap sinkron setelah kunci horizontal (modal/drag) dilepas
  useLayoutEffect(() => {
    if (isModalLocked || isDragLocked) return;
    const container = dualPanelRef.current;
    if (!container) return;
    const isKolase = routeRef.current === 'kolase';
    const expectedLeft = isKolase ? container.clientWidth : 0;
    if (Math.abs(container.scrollLeft - expectedLeft) > 2) {
      container.scrollLeft = expectedLeft;
    }
    updateTabIndicator(isKolase ? 1 : 0);
    syncHeaderTransform();
  }, [isDragLocked, isModalLocked, syncHeaderTransform, updateTabIndicator]);

  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseLocationToRouteState();
      if (
        parsed.route === 'kolase' &&
        (parsed.date !== undefined || parsed.shift !== undefined || parsed.area !== undefined)
      ) {
        kolasePanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        setKolaseContext((prev) => {
          const nextDate = parsed.date || prev.date;
          const nextShift = parsed.shift || prev.shift;
          const nextArea =
            parsed.area !== undefined
              ? parsed.area
              : getAreaForDateAndShift(nextDate, nextShift);
          return {
            date: nextDate,
            shift: nextShift,
            area: nextArea,
          };
        });
        setKolaseSelectionKey((k) => k + 1);
      }
      routeRef.current = parsed.route;
      setRoute(parsed.route);
      slideToPanel(parsed.route, 'smooth');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [slideToPanel]);

  useEffect(() => {
    document.title = route === 'kolase' ? 'Kolase Foto TPM' : 'Dashboard TPM Urea 1B';
  }, [route]);

  const handleDualPanelScroll = useCallback(() => {
    if (isSwipeLockedRef.current) return;
    const container = dualPanelRef.current;
    if (!container) return;
    const width = container.clientWidth;
    if (width <= 0) return;

    const progress = Math.min(1, Math.max(0, container.scrollLeft / width));
    updateTabIndicator(progress);
    syncHeaderTransform();

    const lockedTarget = programmaticSlideRef.current.target;
    if (lockedTarget) {
      const targetLeft = lockedTarget === 'kolase' ? width : 0;
      if (Math.abs(container.scrollLeft - targetLeft) <= 2) {
        clearProgrammaticSlide();
      } else {
        return;
      }
    }

    const nextRoute: AppRoute = progress >= 0.5 ? 'kolase' : 'jadwal';
    if (nextRoute !== routeRef.current) {
      routeRef.current = nextRoute;
      setRoute(nextRoute);
      const targetHash = nextRoute === 'kolase' ? '#kolase' : '#jadwal';
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    }
  }, [clearProgrammaticSlide, syncHeaderTransform, updateTabIndicator]);

  const navigateToJadwal = useCallback(() => {
    if (routeRef.current === 'jadwal') return;
    routeRef.current = 'jadwal';
    setRoute('jadwal');
    window.history.replaceState(null, '', '#jadwal');
    slideToPanel('jadwal', 'smooth');
  }, [slideToPanel]);

  const navigateToKolase = useCallback(
    (params?: { date: string; shift: ShiftName; area: string }) => {
      if (params) {
        // Ketuk kartu jadwal: pertahankan scroll jadwalPanelRef, gulir kolasePanelRef ke atas & geser mulus
        const search = new URLSearchParams({
          date: params.date,
          shift: params.shift,
          area: params.area,
        });
        window.history.replaceState(null, '', `#kolase?${search.toString()}`);
        setKolaseContext({
          date: params.date,
          shift: params.shift,
          area: params.area,
        });
        setKolaseSelectionKey((k) => k + 1);
        routeRef.current = 'kolase';
        setRoute('kolase');
        kolasePanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        slideToPanel('kolase', 'smooth');
        return;
      }

      if (routeRef.current === 'kolase') return;

      routeRef.current = 'kolase';
      setRoute('kolase');
      window.history.replaceState(null, '', '#kolase');
      slideToPanel('kolase', 'smooth');
    },
    [slideToPanel]
  );

  const handleReportSubmitted = useCallback(
    async (dateStr: string, shift: ShiftName, area: string) => {
      // Optimistic local React state update (Firestore & localStorage diblokir penuh saat Test Mode aktif)
      setReportedLog((prev) => ({
        ...prev,
        [`${dateStr}_${shift}`]: { area: area || '-', ts: Date.now() },
      }));
      if (!devModeActive) {
        const res = await publishShiftReport(dateStr, shift, area);
        if (!res.ok && res.errorMessage) {
          showToast(res.errorMessage, 'error');
        }
      }
    },
    [devModeActive, showToast]
  );

  const handleReportUndo = useCallback(
    async (dateStr: string, shift: ShiftName): Promise<boolean> => {
      const key = `${dateStr}_${shift}`;
      setReportedLog((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (!devModeActive) {
        const res = await unpublishShiftReport(dateStr, shift);
        if (!res.ok) {
          if (res.errorMessage) {
            showToast(res.errorMessage, 'error');
          }
          return false;
        }
      }
      return true;
    },
    [devModeActive, showToast]
  );

  const handleReportRestore = useCallback(
    async (dateStr: string, shift: ShiftName, previousEntry: ReportedLogEntry | null) => {
      if (!previousEntry) {
        await handleReportUndo(dateStr, shift);
        return;
      }
      setReportedLog((prev) => ({
        ...prev,
        [`${dateStr}_${shift}`]: previousEntry,
      }));
      if (!devModeActive) {
        const res = await publishShiftReport(dateStr, shift, previousEntry.area);
        if (!res.ok && res.errorMessage) {
          showToast(res.errorMessage, 'error');
        }
      }
    },
    [devModeActive, handleReportUndo, showToast]
  );

  const handleKolaseDateChange = useCallback((newDate: string) => {
    setKolaseContext((prev) => ({
      date: newDate,
      shift: prev.shift,
      area: getAreaForDateAndShift(newDate, prev.shift),
    }));
  }, []);

  const handleKolaseShiftChange = useCallback((newShift: ShiftName) => {
    setKolaseContext((prev) => ({
      date: prev.date,
      shift: newShift,
      area: getAreaForDateAndShift(prev.date, newShift),
    }));
  }, []);

  const handleKolaseAreaChange = useCallback((area: string) => {
    setKolaseContext((prev) => ({
      ...prev,
      area,
    }));
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setIosModalOpen(true);
    }
  }, [install, isIOS, isInstallable]);

  const handleCheckUpdate = useCallback(async () => {
    const result = await checkForUpdatesManual();
    if (result === 'update-available') {
      setChangelogOpen(false);
    } else if (result === 'up-to-date') {
      showToast('Aplikasi sudah versi terbaru', 'success');
    } else {
      showToast('Gagal cek update (mode offline)', 'warning');
    }
  }, [checkForUpdatesManual, showToast]);

  const handleSettingsGearTap = useCallback(() => {
    const now = Date.now();
    if (now - gearLastTapRef.current > 3000) {
      gearTapCountRef.current = 0;
    }
    gearLastTapRef.current = now;
    gearTapCountRef.current += 1;

    if (gearTapCountRef.current >= 5) {
      gearTapCountRef.current = 0;
      setFirestoreWriteBlocked(true);
      devModeActiveRef.current = true;
      setDevModeActive(true);
      setDevModalOpen(true);
    }
  }, []);

  const handleDevAutoFill = useCallback(async () => {
    const runId = ++devFillRunIdRef.current;
    const extremeTag = buildExtremeDummyTag();
    const op = getOperationalShiftInfo();
    setDevModalOpen(false);
    setKolaseGridType('2x3');
    setRowCaptions([...DEV_TEST_ROWS]);
    navigateToKolase({
      date: op.dateStr,
      shift: op.shift,
      area: extremeTag,
    });

    const specs = [
      { color: '#F8FAFC', striped: false },
      { color: '#090D16', striped: false },
      { color: '#EAB308', striped: false },
      { color: '#64748B', striped: false },
      { color: '#0284C7', striped: false },
      { color: '#0F172A', striped: true },
    ];

    const loaded = await Promise.all(
      specs.map(async (spec, idx) => {
        const file = await createSyntheticContrastFile(idx, spec.color, spec.striped);
        if (!file) return null;
        return await processAndResizeFile(file);
      })
    );

    if (runId !== devFillRunIdRef.current || !devModeActiveRef.current) {
      freeSlotArray(loaded);
      return;
    }

    const prevBefore = slotsCleanupRef.current.before;
    const prevAfter = slotsCleanupRef.current.after;
    setBeforeSlots([loaded[0] ?? null, loaded[2] ?? null, loaded[4] ?? null]);
    setAfterSlots([loaded[1] ?? null, loaded[3] ?? null, loaded[5] ?? null]);
    prevBefore.forEach(disposeSlotCanvases);
    prevAfter.forEach(disposeSlotCanvases);
    setIsReportSubmitted(false);
  }, [navigateToKolase]);

  const handleDevTestToasts = useCallback(() => {
    clearTestToastSequence();
    setDevModalOpen(false);
    showToast('Tes Toast Peringatan: Data belum lengkap.', 'warning', 1500);
    const errTimer = window.setTimeout(() => {
      showToast('Tes Toast Error: Gagal memproses atau sinkronisasi data.', 'error', 1500);
    }, 1600);
    const okTimer = window.setTimeout(() => {
      showToast('Tes Toast Sukses: Operasi berhasil dijalankan.', 'success', 2200);
    }, 3200);
    testToastSeqTimersRef.current = [errTimer, okTimer];
  }, [clearTestToastSequence, showToast]);

  const handleDevSimulateUpdate = useCallback(() => {
    setDevModalOpen(false);
    simulateUpdatePrompt();
  }, [simulateUpdatePrompt]);

  const handleDevCleanupAndExit = useCallback(() => {
    devFillRunIdRef.current += 1;
    clearTestToastSequence();

    const prevBefore = slotsCleanupRef.current.before;
    const prevAfter = slotsCleanupRef.current.after;
    setBeforeSlots([]);
    setAfterSlots([]);
    prevBefore.forEach(disposeSlotCanvases);
    prevAfter.forEach(disposeSlotCanvases);
    setRowCaptions(['', '', '']);
    setIsReportSubmitted(false);

    // Wajib kembalikan Tanggal, Shift, Tag Equipment & Locked ke jadwal shift aktif saat ini
    const op = getOperationalShiftInfo();
    const activeArea = getAreaForDateAndShift(op.dateStr, op.shift);
    setKolaseContext({
      date: op.dateStr,
      shift: op.shift,
      area: activeArea,
    });
    setKolaseSelectionKey((k) => k + 1);

    devModeActiveRef.current = false;
    setDevModeActive(false);
    setDevModalOpen(false);
    setFirestoreWriteBlocked(false);

    // Hapus semua centang simulasi & pulihkan status real dari cache, lalu muat ulang data asli Firestore tanpa refresh halaman
    setReportedLog({ ...latestRealReportedLogRef.current });
    void reloadShiftReportsFromFirestore().then((freshLog) => {
      latestRealReportedLogRef.current = freshLog;
      if (!devModeActiveRef.current) {
        setReportedLog(freshLog);
      }
    });
    showToast('Data dummy dibersihkan & jadwal shift aktif dipulihkan.', 'success', 2500);
  }, [clearTestToastSequence, showToast]);

  const handleOpenGuide = useCallback(() => setGuideOpen(true), []);
  const handleCloseGuide = useCallback(() => setGuideOpen(false), []);
  const handleOpenChangelog = useCallback(() => setChangelogOpen(true), []);
  const handleCloseChangelog = useCallback(() => setChangelogOpen(false), []);
  const handleCloseIosModal = useCallback(() => setIosModalOpen(false), []);
  const handleOpenDevModal = useCallback(() => setDevModalOpen(true), []);
  const handleCloseDevModal = useCallback(() => setDevModalOpen(false), []);
  const handleTriggerDevAutoFill = useCallback(() => {
    void handleDevAutoFill();
  }, [handleDevAutoFill]);

  const panelFooter = useMemo(
    () => (
      <footer className="mt-1 flex w-full flex-col items-center gap-3 pt-2 text-center">
        {showInstallButton && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-sky-400/40 bg-gradient-to-br from-sky-500 to-sky-700 px-6 py-3 text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(14,165,233,0.35)] transition active:scale-[0.96]"
          >
            <IconDownload className="h-5 w-5" /> Install Aplikasi
          </button>
        )}

        <div className="text-xs leading-[1.6] tracking-[0.2px] text-slate-300">
          <p>Dibuat untuk mempermudah laporan TPM Urea 1B</p>
          <p className="mt-0.5 font-medium text-slate-400">© 2026 — Developed by FIKRI</p>
          <button
            type="button"
            onClick={handleOpenChangelog}
            aria-label={`Lihat riwayat pembaruan Versi ${APP_VERSION}`}
            className="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-semibold tracking-tight text-sky-300 transition hover:border-sky-400/60 active:scale-95"
          >
            v{APP_VERSION}
          </button>
        </div>
      </footer>
    ),
    [handleInstallClick, handleOpenChangelog, showInstallButton]
  );

  return (
    <div
      className={`relative flex h-[100dvh] w-full max-w-[800px] flex-col overflow-hidden pl-[calc(14px+env(safe-area-inset-left))] pr-[calc(14px+env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] transition-opacity duration-250 ${
        isFadingOut
          ? 'pointer-events-none opacity-0'
          : isAppReady
            ? 'opacity-100'
            : 'opacity-0'
      }`}
    >
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        {/* 1 Header & 1 Tab Bar Tunggal Melayang (Tergulung GPU translate3d & Berinterpolasi Antar-Panel) */}
        <div
          ref={headerWrapperRef}
          className="pointer-events-none absolute top-0 right-0 left-0 z-20 flex flex-col gap-3.5 pt-5 pb-3.5 will-change-transform"
        >
          <header className="flex flex-col items-center text-center">
            <h1 className="mb-1 flex items-center justify-center gap-2 text-[21px] font-bold tracking-tight text-white sm:text-[22px]">
              <button
                type="button"
                onPointerDown={handleSettingsGearTap}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSettingsGearTap();
                  }
                }}
                aria-label="Ikon Pengaturan Dashboard TPM"
                className="pointer-events-auto inline-flex select-none touch-manipulation cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-sky-400 transition active:scale-90"
              >
                <IconSettings className="h-5 w-5" />
              </button>
              <span>Dashboard TPM Urea 1B</span>
            </h1>
            <p className="text-sm text-slate-300">Monitoring Jadwal &amp; Pembuatan Kolase Foto</p>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleOpenGuide}
                className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-[18px] py-[7px] text-[13px] font-semibold text-sky-300 transition hover:bg-sky-500/25 active:scale-[0.96]"
              >
                <IconHelpCircle className="h-4 w-4" /> Panduan
              </button>
              {devModeActive && (
                <button
                  type="button"
                  onClick={handleOpenDevModal}
                  className="pointer-events-auto inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-[7px] text-[11px] font-bold tracking-wider text-amber-400 transition hover:bg-amber-500/25 active:scale-95"
                >
                  <IconWrench className="h-3 w-3" />
                  <span>TEST MODE</span>
                </button>
              )}
            </div>
          </header>

          <nav className="flex flex-col gap-1.5" aria-label="Navigasi utama">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <a
                href="#jadwal"
                aria-current={route === 'jadwal' ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToJadwal();
                }}
                className={`pointer-events-auto flex min-w-0 items-center justify-center gap-2.5 rounded-xl border p-3 text-white no-underline transition sm:gap-3 sm:p-3.5 ${
                  route === 'jadwal'
                    ? 'border-sky-500/70 bg-sky-950/60 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
              >
                <IconCalendar className="h-5 w-5 shrink-0 text-sky-400" />
                <div className="min-w-0 text-left">
                  <h3 className="truncate text-[16px] font-bold text-white">Jadwal TPM</h3>
                  <p className="truncate text-xs text-slate-300">Monitoring Rutin</p>
                </div>
              </a>

              <a
                href="#kolase"
                aria-current={route === 'kolase' ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToKolase();
                }}
                className={`pointer-events-auto flex min-w-0 items-center justify-center gap-2.5 rounded-xl border p-3 text-white no-underline transition sm:gap-3 sm:p-3.5 ${
                  route === 'kolase'
                    ? 'border-sky-500/70 bg-sky-950/60 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
              >
                <IconCamera className="h-5 w-5 shrink-0 text-sky-400" />
                <div className="min-w-0 text-left">
                  <h3 className="truncate text-[16px] font-bold text-white">Kolase Foto</h3>
                  <p className="truncate text-xs text-slate-300">Before &amp; After</p>
                </div>
              </a>
            </div>

            <div
              ref={indicatorTrackRef}
              aria-hidden="true"
              className="relative h-[3px] w-full overflow-hidden rounded-full bg-slate-800/85"
            >
              <div
                ref={indicatorBarRef}
                className="h-full w-[calc(50%-0.3125rem)] rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)] will-change-transform sm:w-[calc(50%-0.375rem)]"
              />
            </div>
          </nav>
        </div>

        {/* Wadah Dual-Panel CSS Scroll-Snap Horizontal dengan 2 Panel Scroll Vertikal Independen */}
        <main
          ref={dualPanelRef}
          onScroll={handleDualPanelScroll}
          onTouchStart={clearProgrammaticSlide}
          className={`no-scrollbar grid h-full w-full grid-flow-col grid-rows-1 auto-cols-[100%] snap-x snap-mandatory overflow-y-hidden overscroll-x-contain ${
            isModalLocked || isDragLocked ? 'overflow-x-hidden' : 'overflow-x-auto'
          }`}
        >
          <section
            ref={jadwalPanelRef}
            onScroll={syncHeaderTransform}
            aria-label="Panel Jadwal TPM"
            className="no-scrollbar h-full w-full snap-start snap-always overflow-y-auto overscroll-y-contain pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div ref={jadwalInnerRef} className="flex flex-col gap-4">
              <DashboardView
                reportedLog={reportedLog}
                devModeActive={devModeActive}
                onSelectShift={navigateToKolase}
                onUndoReport={handleReportUndo}
                onShowToast={showToast}
              />
              {panelFooter}
            </div>
          </section>

          <section
            ref={kolasePanelRef}
            onScroll={syncHeaderTransform}
            aria-label="Panel Kolase Foto"
            className="no-scrollbar h-full w-full snap-start snap-always overflow-y-auto overscroll-y-contain pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div ref={kolaseInnerRef} className="flex flex-col gap-4">
              <KolaseView
                date={kolaseContext.date}
                shift={kolaseContext.shift}
                area={kolaseContext.area}
                selectionKey={kolaseSelectionKey}
                reportedLog={reportedLog}
                devModeActive={devModeActive}
                gridType={kolaseGridType}
                beforeSlots={beforeSlots}
                afterSlots={afterSlots}
                rowCaptions={rowCaptions}
                onGridTypeChange={setKolaseGridType}
                onBeforeSlotsChange={setBeforeSlots}
                onAfterSlotsChange={setAfterSlots}
                onRowCaptionsChange={setRowCaptions}
                onReportSubmittedStateChange={setIsReportSubmitted}
                onDateChange={handleKolaseDateChange}
                onShiftChange={handleKolaseShiftChange}
                onAreaChange={handleKolaseAreaChange}
                onReportSubmitted={handleReportSubmitted}
                onRestoreReport={handleReportRestore}
                onShowToast={showToast}
                onDismissLoadingToast={dismissLoadingToast}
                onDragLockChange={handleDragLockChange}
              />
              {panelFooter}
            </div>
          </section>
        </main>
      </div>

      <GuideModal isOpen={guideOpen} onClose={handleCloseGuide} />
      <ChangelogModal
        isOpen={changelogOpen}
        onClose={handleCloseChangelog}
        onCheckUpdate={handleCheckUpdate}
        isCheckingUpdate={isCheckingUpdate}
      />
      <IosInstallModal isOpen={iosModalOpen} onClose={handleCloseIosModal} />
      <ForceUpdateModal
        modalState={modalState}
        updatePhase={updatePhase}
        errorMsg={errorMsg}
        onConfirm={confirmUpdate}
        onDismiss={dismissUpdate}
      />
      <DeveloperModeModal
        isOpen={devModalOpen}
        onClose={handleCloseDevModal}
        onAutoFillExtreme={handleTriggerDevAutoFill}
        onTestToasts={handleDevTestToasts}
        onSimulatePwaUpdate={handleDevSimulateUpdate}
        onCleanupAndExit={handleDevCleanupAndExit}
      />
      <OfflineBanner />

      {toast && (
        <div
          role={toast.kind === 'warning' || toast.kind === 'error' ? 'alert' : 'status'}
          className={`modal-pop fixed bottom-6 left-1/2 z-[10050] flex w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13px] font-semibold leading-snug shadow-[0_8px_24px_rgba(2,6,23,0.75)] backdrop-blur-md ${
            toast.kind === 'success'
              ? 'border-emerald-400/50 bg-emerald-950/95 text-emerald-200'
              : toast.kind === 'error'
                ? 'border-rose-400/50 bg-rose-950/95 text-rose-200'
                : 'border-amber-400/50 bg-amber-950/95 text-amber-200'
          }`}
        >
          {toast.kind === 'loading' ? (
            <IconLoader className="h-[22px] w-[22px] shrink-0 text-amber-400" />
          ) : toast.kind === 'success' ? (
            <IconCheck className="h-[22px] w-[22px] shrink-0 text-emerald-400" />
          ) : toast.kind === 'error' ? (
            <IconXCircle className="h-[22px] w-[22px] shrink-0 text-rose-400" />
          ) : (
            <IconAlertTriangle className="h-[22px] w-[22px] shrink-0 text-amber-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
