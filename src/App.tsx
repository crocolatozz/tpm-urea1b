import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { usePWAInstall } from './hooks/usePWAInstall';
import { useAppUpdater } from './hooks/useAppUpdater';
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

  const hasAnyStoredPhotos = beforeSlots.some(Boolean) || afterSlots.some(Boolean);
  const effectiveHasFilledPhotos = hasAnyStoredPhotos && !isReportSubmitted;

  const { isInstallable, isIOS, showInstallButton, install } = usePWAInstall();
  const {
    modalState,
    isUpdating,
    isCheckingUpdate,
    errorMsg,
    confirmUpdate,
    dismissUpdate,
    checkForUpdatesManual,
    simulateUpdatePrompt,
  } = useAppUpdater(effectiveHasFilledPhotos);

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

  // Jalankan Storage Version Guard & pembersihan legacy key saat aplikasi dimuat, bersihkan memori hanya saat App unmount
  useEffect(() => {
    ensureStorageVersionGuard();
    return () => {
      setFirestoreWriteBlocked(false);
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
  }, [clearTestToastSequence, clearToastTimer]);

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

  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseLocationToRouteState();
      setRoute(parsed.route);
      if (
        parsed.route === 'kolase' &&
        (parsed.date !== undefined || parsed.shift !== undefined || parsed.area !== undefined)
      ) {
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
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    document.title = route === 'kolase' ? 'Kolase Foto TPM' : 'Dashboard TPM Urea 1B';
  }, [route]);

  const navigateToJadwal = useCallback(() => {
    window.location.hash = '#jadwal';
    setRoute('jadwal');
    window.scrollTo(0, 0);
  }, []);

  const navigateToKolase = useCallback(
    (params?: { date: string; shift: ShiftName; area: string }) => {
      if (params) {
        const search = new URLSearchParams({
          date: params.date,
          shift: params.shift,
          area: params.area,
        });
        window.location.hash = `#kolase?${search.toString()}`;
        setKolaseContext({
          date: params.date,
          shift: params.shift,
          area: params.area,
        });
        setKolaseSelectionKey((k) => k + 1);
      } else {
        window.location.hash = '#kolase';
      }
      setRoute('kolase');
      window.scrollTo(0, 0);
    },
    []
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

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setIosModalOpen(true);
    }
  };

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
    // Putuskan tautan jadwal operasional hari ini agar dummy test selalu netral
    setKolaseContext({
      date: op.dateStr,
      shift: op.shift,
      area: extremeTag,
    });
    setKolaseSelectionKey((k) => k + 1);
    setRowCaptions([...DEV_TEST_ROWS]);
    window.location.hash = '#kolase';
    setRoute('kolase');
    window.scrollTo(0, 0);

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
  }, []);

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
    const extremeTag = buildExtremeDummyTag();
    clearTestToastSequence();

    const prevBefore = slotsCleanupRef.current.before;
    const prevAfter = slotsCleanupRef.current.after;
    setBeforeSlots([]);
    setAfterSlots([]);
    prevBefore.forEach(disposeSlotCanvases);
    prevAfter.forEach(disposeSlotCanvases);
    setRowCaptions(['', '', '']);
    setIsReportSubmitted(false);
    setKolaseContext((prev) =>
      prev.area === extremeTag ? { ...prev, area: '' } : prev
    );

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
    showToast('Data dummy dibersihkan & sinkronisasi dipulihkan.', 'success', 2500);
  }, [clearTestToastSequence, showToast]);

  return (
    <div className="flex w-full max-w-[800px] flex-1 flex-col gap-4">
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
            className="inline-flex select-none touch-manipulation cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-sky-400 transition active:scale-90"
          >
            <IconSettings className="h-5 w-5" />
          </button>
          <span>Dashboard TPM Urea 1B</span>
        </h1>
        <p className="text-sm text-slate-300">Monitoring Jadwal &amp; Pembuatan Kolase Foto</p>
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-[18px] py-[7px] text-[13px] font-semibold text-sky-300 transition hover:bg-sky-500/25 active:scale-[0.96]"
          >
            <IconHelpCircle className="h-4 w-4" /> Panduan
          </button>
          {devModeActive && (
            <button
              type="button"
              onClick={() => setDevModalOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-[7px] text-[11px] font-bold tracking-wider text-amber-400 transition hover:bg-amber-500/25 active:scale-95"
            >
              <IconWrench className="h-3 w-3" />
              <span>TEST MODE</span>
            </button>
          )}
        </div>
      </header>

      {/* Navigasi */}
      <nav className="grid grid-cols-2 gap-2.5 sm:gap-3" aria-label="Navigasi utama">
        <a
          href="#jadwal"
          onClick={(e) => {
            e.preventDefault();
            navigateToJadwal();
          }}
          className={`flex min-w-0 items-center justify-center gap-2.5 rounded-xl border p-3 text-white no-underline transition sm:gap-3 sm:p-3.5 ${
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
          onClick={(e) => {
            e.preventDefault();
            navigateToKolase();
          }}
          className={`flex min-w-0 items-center justify-center gap-2.5 rounded-xl border p-3 text-white no-underline transition sm:gap-3 sm:p-3.5 ${
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
      </nav>

      {/* Main View */}
      <main className="w-full min-w-0">
        {route === 'jadwal' ? (
          <DashboardView
            reportedLog={reportedLog}
            onSelectShift={(params) => navigateToKolase(params)}
            onUndoReport={handleReportUndo}
            onShowToast={showToast}
          />
        ) : (
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
          />
        )}
      </main>

      {/* Footer dengan Smart Install, Credit & Versi */}
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
            onClick={() => setChangelogOpen(true)}
            aria-label={`Lihat riwayat pembaruan Versi ${APP_VERSION}`}
            className="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-semibold tracking-tight text-sky-300 transition hover:border-sky-400/60 active:scale-95"
          >
            v{APP_VERSION}
          </button>
        </div>
      </footer>

      <GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      <ChangelogModal
        isOpen={changelogOpen}
        onClose={() => setChangelogOpen(false)}
        onCheckUpdate={handleCheckUpdate}
        isCheckingUpdate={isCheckingUpdate}
      />
      <IosInstallModal isOpen={iosModalOpen} onClose={() => setIosModalOpen(false)} />
      <ForceUpdateModal
        modalState={modalState}
        isUpdating={isUpdating}
        errorMsg={errorMsg}
        onConfirm={confirmUpdate}
        onDismiss={dismissUpdate}
      />
      <DeveloperModeModal
        isOpen={devModalOpen}
        onClose={() => setDevModalOpen(false)}
        onAutoFillExtreme={() => void handleDevAutoFill()}
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
