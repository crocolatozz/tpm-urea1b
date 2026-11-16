import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APP_VERSION,
  ensureStorageVersionGuard,
  getAreaForDateAndShift,
  getOperationalShiftInfo,
  type ReportedLogEntry,
  type ShiftName,
} from './data/tpmData';
import { useNativeTouchGuard } from './hooks/useNativeTouchGuard';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useAppUpdater } from './hooks/useAppUpdater';
import {
  publishShiftReport,
  subscribeToShiftReports,
  unpublishShiftReport,
} from './services/shiftReportSync';
import { DashboardView } from './components/DashboardView';
import { KolaseView } from './components/KolaseView';
import { GuideModal } from './components/GuideModal';
import { ChangelogModal } from './components/ChangelogModal';
import { IosInstallModal } from './components/IosInstallModal';
import { ForceUpdateModal } from './components/ForceUpdateModal';
import { OfflineBanner } from './components/OfflineBanner';
import {
  IconAlertTriangle,
  IconCalendar,
  IconCamera,
  IconCheck,
  IconDownload,
  IconHelpCircle,
  IconSettings,
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [hasFilledPhotos, setHasFilledPhotos] = useState(false);
  const [updateToast, setUpdateToast] = useState<{
    message: string;
    tone: 'success' | 'warning';
  } | null>(null);
  const updateToastTimerRef = useRef<number | null>(null);

  const effectiveHasFilledPhotos = route === 'kolase' && hasFilledPhotos;

  const { isInstallable, isIOS, showInstallButton, install } = usePWAInstall();
  const {
    modalState,
    isUpdating,
    isCheckingUpdate,
    errorMsg,
    confirmUpdate,
    dismissUpdate,
    checkForUpdatesManual,
  } = useAppUpdater(effectiveHasFilledPhotos);

  const showUpdateToast = useCallback((message: string, tone: 'success' | 'warning') => {
    if (updateToastTimerRef.current !== null) {
      window.clearTimeout(updateToastTimerRef.current);
    }
    setUpdateToast({ message, tone });
    updateToastTimerRef.current = window.setTimeout(() => {
      setUpdateToast(null);
      updateToastTimerRef.current = null;
    }, 3500);
  }, []);

  // Jalankan Storage Version Guard & pembersihan legacy key saat aplikasi dimuat
  useEffect(() => {
    ensureStorageVersionGuard();
    return () => {
      if (updateToastTimerRef.current !== null) {
        window.clearTimeout(updateToastTimerRef.current);
      }
    };
  }, []);

  // Real-time Firestore + localStorage sync for reported shift badges
  useEffect(() => {
    const unsubscribe = subscribeToShiftReports((merged) => {
      setReportedLog(merged);
    });
    return () => unsubscribe();
  }, []);

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
      // Optimistic local state update + Firestore real-time write
      setReportedLog((prev) => ({
        ...prev,
        [`${dateStr}_${shift}`]: { area: area || '-', ts: Date.now() },
      }));
      await publishShiftReport(dateStr, shift, area);
    },
    []
  );

  const handleReportUndo = useCallback(async (dateStr: string, shift: ShiftName) => {
    const key = `${dateStr}_${shift}`;
    setReportedLog((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    await unpublishShiftReport(dateStr, shift);
  }, []);

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
      await publishShiftReport(dateStr, shift, previousEntry.area);
    },
    [handleReportUndo]
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
      showUpdateToast('Aplikasi sudah versi terbaru', 'success');
    } else {
      showUpdateToast('Gagal cek update (mode offline)', 'warning');
    }
  }, [checkForUpdatesManual, showUpdateToast]);

  return (
    <div className="flex w-full max-w-[800px] flex-1 flex-col gap-4">
      <header className="flex flex-col items-center text-center">
        <h1 className="mb-1 flex items-center justify-center gap-2 text-[21px] font-bold tracking-tight text-white sm:text-[22px]">
          <IconSettings className="h-5 w-5 text-sky-400" /> Dashboard TPM Urea 1B
        </h1>
        <p className="text-sm text-slate-300">Monitoring Jadwal &amp; Pembuatan Kolase Foto</p>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-[18px] py-[7px] text-[13px] font-semibold text-sky-300 transition hover:bg-sky-500/25 active:scale-[0.96]"
        >
          <IconHelpCircle className="h-4 w-4" /> Panduan
        </button>
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
          />
        ) : (
          <KolaseView
            date={kolaseContext.date}
            shift={kolaseContext.shift}
            area={kolaseContext.area}
            selectionKey={kolaseSelectionKey}
            reportedLog={reportedLog}
            onDateChange={handleKolaseDateChange}
            onShiftChange={handleKolaseShiftChange}
            onAreaChange={handleKolaseAreaChange}
            onReportSubmitted={handleReportSubmitted}
            onRestoreReport={handleReportRestore}
            onHasFilledPhotosChange={setHasFilledPhotos}
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
      <OfflineBanner />

      {updateToast && (
        <div
          role={updateToast.tone === 'success' ? 'status' : 'alert'}
          className={`modal-pop fixed bottom-6 left-1/2 z-[10050] flex w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13px] font-semibold leading-snug shadow-[0_8px_24px_rgba(2,6,23,0.75)] backdrop-blur-md ${
            updateToast.tone === 'success'
              ? 'border-emerald-400/50 bg-emerald-950/95 text-emerald-200'
              : 'border-amber-400/50 bg-amber-950/95 text-amber-200'
          }`}
        >
          {updateToast.tone === 'success' ? (
            <IconCheck className="h-[22px] w-[22px] shrink-0 text-emerald-400" />
          ) : (
            <IconAlertTriangle className="h-[22px] w-[22px] shrink-0 text-amber-400" />
          )}
          <span>{updateToast.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
