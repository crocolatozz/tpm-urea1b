import React, { useCallback, useEffect, useState } from 'react';
import { APP_VERSION, type ReportedLogEntry, type ShiftName } from './data/tpmData';
import { useNativeTouchGuard } from './hooks/useNativeTouchGuard';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useAppUpdater } from './hooks/useAppUpdater';
import { publishShiftReport, subscribeToShiftReports } from './services/shiftReportSync';
import { DashboardView } from './components/DashboardView';
import { KolaseView, type KolaseInitialParams } from './components/KolaseView';
import { GuideModal } from './components/GuideModal';
import { IosInstallModal } from './components/IosInstallModal';
import { ForceUpdateModal } from './components/ForceUpdateModal';
import { OfflineBanner } from './components/OfflineBanner';

type AppRoute = 'jadwal' | 'kolase';

interface RouteState {
  route: AppRoute;
  kolaseParams: KolaseInitialParams;
}

function parseLocationToRouteState(): RouteState {
  const hash = window.location.hash || '';
  if (hash.startsWith('#kolase')) {
    const queryIdx = hash.indexOf('?');
    const searchStr = queryIdx !== -1 ? hash.slice(queryIdx + 1) : '';
    const params = new URLSearchParams(searchStr);
    return {
      route: 'kolase',
      kolaseParams: {
        date: params.get('date') || undefined,
        shift: params.get('shift') || undefined,
        area: params.get('area') || undefined,
      },
    };
  }

  const legacyParams = new URLSearchParams(window.location.search);
  if (legacyParams.has('date') || legacyParams.has('shift') || legacyParams.has('area')) {
    return {
      route: 'kolase',
      kolaseParams: {
        date: legacyParams.get('date') || undefined,
        shift: legacyParams.get('shift') || undefined,
        area: legacyParams.get('area') || undefined,
      },
    };
  }

  return {
    route: 'jadwal',
    kolaseParams: {},
  };
}

export const App: React.FC = () => {
  useNativeTouchGuard();

  const [routeState, setRouteState] = useState<RouteState>(() => parseLocationToRouteState());
  const [reportedLog, setReportedLog] = useState<Record<string, ReportedLogEntry>>({});
  const [guideOpen, setGuideOpen] = useState(false);
  const [iosModalOpen, setIosModalOpen] = useState(false);

  const { isInstallable, isIOS, showInstallButton, install } = usePWAInstall();
  const { modalState, isUpdating, errorMsg, confirmUpdate, dismissUpdate } = useAppUpdater();

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
      setRouteState((prev) => ({
        route: parsed.route,
        kolaseParams:
          parsed.route === 'kolase'
            ? { ...parsed.kolaseParams, requestKey: (prev.kolaseParams.requestKey || 0) + 1 }
            : prev.kolaseParams,
      }));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    document.title =
      routeState.route === 'kolase' ? 'Kolase Foto TPM' : 'Dashboard TPM Urea 1B';
  }, [routeState.route]);

  const navigateToJadwal = useCallback(() => {
    window.location.hash = '#jadwal';
    setRouteState((prev) => ({ ...prev, route: 'jadwal' }));
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
        setRouteState((prev) => ({
          route: 'kolase',
          kolaseParams: {
            date: params.date,
            shift: params.shift,
            area: params.area,
            requestKey: (prev.kolaseParams.requestKey || 0) + 1,
          },
        }));
      } else {
        window.location.hash = '#kolase';
        setRouteState((prev) => ({
          route: 'kolase',
          kolaseParams: prev.kolaseParams,
        }));
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
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

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setIosModalOpen(true);
    }
  };

  return (
    <div className="flex w-full max-w-[800px] flex-1 flex-col gap-4">
      <header className="flex flex-col items-center text-center">
        <h1 className="mb-1 text-[1.45rem] font-bold text-white sm:text-[1.5rem]">
          {routeState.route === 'kolase'
            ? '🖼️ Kolase Foto TPM'
            : '⚙️ Dashboard TPM Urea 1B'}
        </h1>
        <p className="text-[0.88rem] text-[#aaaaaa]">
          {routeState.route === 'kolase'
            ? 'Susun Dokumentasi Before & After'
            : 'Monitoring & Jadwal Inspeksi Mesin'}
        </p>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-[20px] border border-[#2b4c70] bg-[#1a2736] px-[18px] py-[7px] text-[0.84rem] font-semibold text-[#64b5f6] transition active:scale-[0.96] active:bg-[#23364b]"
        >
          ❓ Panduan
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
          className={`flex min-w-0 items-center gap-2.5 rounded-xl border p-3 text-white no-underline transition sm:gap-3 sm:p-3.5 ${
            routeState.route === 'jadwal'
              ? 'border-[#007aff] bg-[#1a2736]'
              : 'border-[#333] bg-[#1e1e1e]'
          }`}
        >
          <span className="shrink-0 text-[1.3rem] sm:text-[1.4rem]">📅</span>
          <div className="min-w-0">
            <h3 className="truncate text-[0.9rem] font-bold sm:text-[0.95rem]">Jadwal TPM</h3>
            <p className="truncate text-[0.72rem] text-[#aaaaaa] sm:text-[0.75rem]">
              Monitoring Rutin
            </p>
          </div>
        </a>

        <a
          href="#kolase"
          onClick={(e) => {
            e.preventDefault();
            navigateToKolase();
          }}
          className={`flex min-w-0 items-center gap-2.5 rounded-xl border p-3 text-white no-underline transition sm:gap-3 sm:p-3.5 ${
            routeState.route === 'kolase'
              ? 'border-[#007aff] bg-[#1a2736]'
              : 'border-[#333] bg-[#1e1e1e]'
          }`}
        >
          <span className="shrink-0 text-[1.3rem] sm:text-[1.4rem]">📸</span>
          <div className="min-w-0">
            <h3 className="truncate text-[0.9rem] font-bold sm:text-[0.95rem]">Kolase Foto</h3>
            <p className="truncate text-[0.72rem] text-[#aaaaaa] sm:text-[0.75rem]">
              Before &amp; After
            </p>
          </div>
        </a>
      </nav>

      {/* Main View */}
      <main className="w-full min-w-0">
        {routeState.route === 'jadwal' ? (
          <DashboardView
            reportedLog={reportedLog}
            onSelectShift={(params) => navigateToKolase(params)}
          />
        ) : (
          <KolaseView
            initialParams={routeState.kolaseParams}
            onReportSubmitted={handleReportSubmitted}
          />
        )}
      </main>

      {/* Footer dengan Smart Install, Credit & Versi */}
      <footer className="mt-1 flex w-full flex-col items-center gap-3 pt-2 text-center">
        {showInstallButton && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex cursor-pointer items-center gap-2 rounded-[25px] border-0 bg-gradient-to-br from-[#007aff] to-[#0056b3] px-6 py-3 text-[0.95rem] font-bold text-white shadow-[0_4px_14px_rgba(0,122,255,0.4)] transition active:scale-[0.96]"
          >
            📲 Install Aplikasi
          </button>
        )}

        <p className="text-[0.76rem] leading-[1.55] tracking-[0.2px] text-[#888888]">
          Dibuat untuk mempermudah laporan TPM Urea 1B
          <span className="mt-0.5 block font-medium text-[#777777]">
            © 2026 — Developed by FIKRI
          </span>
          <span className="mt-1.5 inline-block rounded-xl border border-[#303030] bg-[#1c1c1c] px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-[0.3px] text-[#7a7a7a]">
            Versi {APP_VERSION}
          </span>
        </p>
      </footer>

      <GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      <IosInstallModal isOpen={iosModalOpen} onClose={() => setIosModalOpen(false)} />
      <ForceUpdateModal
        modalState={modalState}
        isUpdating={isUpdating}
        errorMsg={errorMsg}
        onConfirm={confirmUpdate}
        onDismiss={dismissUpdate}
      />
      <OfflineBanner />
    </div>
  );
};

export default App;
