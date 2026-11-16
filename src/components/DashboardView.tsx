import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SHIFT_TIME_RANGES,
  formatDateIndo,
  formatDateIndoFull,
  getCycleDayForDate,
  getLocalTodayStr,
  getNextDateForCycleDay,
  getOffsetDateStr,
  getOperationalShiftInfo,
  getScheduleForDate,
  masterTPMUrea1B,
  normalizeEquipmentSearch,
  type ReportedLogEntry,
  type ShiftName,
} from '../data/tpmData';

import { useModalScrollLock } from '../hooks/useModalScrollLock';
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconFileText,
  IconInfoCircle,
  IconSearch,
  IconUndo,
  ReportedBadge,
  ShiftWeatherIcon,
} from './Icons';

interface DashboardViewProps {
  reportedLog: Record<string, ReportedLogEntry>;
  devModeActive?: boolean;
  onSelectShift: (params: { date: string; shift: ShiftName; area: string }) => void;
  onUndoReport: (dateStr: string, shift: ShiftName) => Promise<boolean>;
  onShowToast: (message: string, kind?: 'success' | 'warning' | 'error', durationMs?: number) => void;
}

interface SearchMatch {
  cycleDay: number;
  shift: ShiftName;
  areaName: string;
  nextDateStr: string;
}

interface ReportedStatusTarget {
  date: string;
  shift: ShiftName;
  area: string;
  entry: ReportedLogEntry | null;
}

interface ScheduleCardProps {
  shift: ShiftName | 'INFO';
  areaText: string;
  isOff?: boolean;
  isHighlighted?: boolean;
  highlightLabel?: string;
  highlightDot?: boolean;
  reportedEntry: ReportedLogEntry | null;
  subtext?: string;
  subtextWithCalendarIcon?: boolean;
  onCardClick?: () => void;
  onBadgeClick?: () => void;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({
  shift,
  areaText,
  isOff = false,
  isHighlighted = false,
  highlightLabel,
  highlightDot = false,
  reportedEntry,
  subtext,
  subtextWithCalendarIcon = false,
  onCardClick,
  onBadgeClick,
}) => {
  const reported = Boolean(reportedEntry) && !isOff && shift !== 'INFO';
  const shiftRange = !isOff && shift !== 'INFO' ? SHIFT_TIME_RANGES[shift] : null;

  return (
    <div
      onClick={onCardClick}
      className={`relative flex items-stretch overflow-hidden rounded-[10px] border border-l-4 transition ${
        isOff
          ? 'border-amber-500/35 border-l-amber-400 bg-amber-950/30'
          : isHighlighted
            ? 'cursor-pointer border-emerald-500/45 border-l-emerald-400 bg-emerald-950/35 hover:bg-emerald-950/50 active:scale-[0.98]'
            : 'cursor-pointer border-slate-700/80 border-l-sky-400 bg-slate-800/70 hover:bg-slate-800 active:scale-[0.98]'
      }`}
    >
      <div
        className={`flex min-w-0 flex-1 flex-col justify-center gap-2 py-3.5 pl-3.5 ${
          isOff ? 'pr-3.5' : 'pr-10 sm:pr-12'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          {shift === 'INFO' ? (
            <span className="inline-flex items-center gap-1.5 text-[15px] font-extrabold uppercase text-amber-300">
              <IconInfoCircle className="h-4 w-4 text-amber-400" /> STATUS
            </span>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1.5 text-[15px] font-extrabold uppercase leading-tight text-white">
                <ShiftWeatherIcon
                  shift={shift}
                  tone={isHighlighted ? 'semantic-active' : 'semantic-default'}
                  className="h-4 w-4"
                />
                <span>SHIFT {shift}</span>
              </span>
              {shiftRange && (
                <span
                  className={`text-xs font-medium tabular-nums ${
                    isHighlighted ? 'text-emerald-100' : 'text-slate-300'
                  }`}
                >
                  {shiftRange}
                </span>
              )}
            </div>
          )}

          {isHighlighted && highlightLabel && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
              {highlightDot && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              {highlightLabel}
            </span>
          )}
        </div>

        <div className="inline-flex flex-wrap items-center gap-2">
          <div className="font-equipment min-w-0 break-words text-[21px] font-bold leading-tight tracking-wide text-white sm:text-[22px]">
            {areaText}
          </div>

          {reported && onBadgeClick && (
            <button
              type="button"
              aria-label={`Lihat status dilaporkan SHIFT ${shift}`}
              onClick={(e) => {
                e.stopPropagation();
                onBadgeClick();
              }}
              className="relative z-20 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full transition hover:brightness-125 active:scale-90"
            >
              <ReportedBadge size="md" />
            </button>
          )}
        </div>

        {subtext && (
          <div className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-amber-200">
            {subtextWithCalendarIcon ? (
              <IconCalendar className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <IconInfoCircle className="h-3.5 w-3.5 text-amber-400" />
            )}
            <span>{subtext}</span>
          </div>
        )}
      </div>

      {!isOff && (
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-5 w-5 ${isHighlighted ? 'text-emerald-400/80' : 'text-sky-400/75'}`}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      )}
    </div>
  );
};

function formatReportedTime(ts?: number): string {
  if (!ts || !Number.isFinite(ts)) return '-';
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '-';
  }
}

interface OperationalClockSnapshot {
  dateStr: string;
  shift: ShiftName;
  todayStr: string;
}

function readOperationalClock(): OperationalClockSnapshot {
  const op = getOperationalShiftInfo();
  return {
    dateStr: op.dateStr,
    shift: op.shift,
    todayStr: getLocalTodayStr(),
  };
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reportedLog,
  devModeActive = false,
  onSelectShift,
  onUndoReport,
  onShowToast,
}) => {
  const [clockSnapshot, setClockSnapshot] = useState<OperationalClockSnapshot>(() =>
    readOperationalClock()
  );
  const operationalInfo = useMemo(
    () => ({ dateStr: clockSnapshot.dateStr, shift: clockSnapshot.shift }),
    [clockSnapshot.dateStr, clockSnapshot.shift]
  );
  const todayStr = clockSnapshot.todayStr;
  const prevOpDateRef = useRef<string>(operationalInfo.dateStr);
  const prevDevModeRef = useRef<boolean>(devModeActive);

  const [selectedDate, setSelectedDate] = useState<string>(operationalInfo.dateStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusTarget, setStatusTarget] = useState<ReportedStatusTarget | null>(null);
  const [cycleInfoOpen, setCycleInfoOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  useModalScrollLock(statusTarget !== null || cycleInfoOpen);

  // Saat keluar dari Developer Mode, kembalikan tanggal jadwal ke shift aktif saat ini
  useEffect(() => {
    if (prevDevModeRef.current && !devModeActive) {
      const fresh = readOperationalClock();
      setClockSnapshot(fresh);
      prevOpDateRef.current = fresh.dateStr;
      setSelectedDate(fresh.dateStr);
      setSearchQuery('');
      setStatusTarget(null);
      setCycleInfoOpen(false);
    }
    prevDevModeRef.current = devModeActive;
  }, [devModeActive]);

  // Auto-refresh active shift (07:00, 15:00, 23:00) & operational day rollover without unnecessary re-renders
  useEffect(() => {
    const syncClock = () => {
      const next = readOperationalClock();
      setClockSnapshot((prev) => {
        if (
          prev.dateStr === next.dateStr &&
          prev.shift === next.shift &&
          prev.todayStr === next.todayStr
        ) {
          return prev;
        }
        return next;
      });
    };
    const intervalId = window.setInterval(syncClock, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncClock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Automatically follow operational date rollover (e.g., 07:00 AM H-1 MALAM -> Today PAGI)
  useEffect(() => {
    if (prevOpDateRef.current !== operationalInfo.dateStr) {
      const previousOpDate = prevOpDateRef.current;
      prevOpDateRef.current = operationalInfo.dateStr;
      setSelectedDate((prev) => (prev === previousOpDate ? operationalInfo.dateStr : prev));
    }
  }, [operationalInfo.dateStr]);

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;
  const isToday = selectedDate === todayStr;
  const isOperationalDay = selectedDate === operationalInfo.dateStr;
  const activeShift = isOperationalDay ? operationalInfo.shift : null;
  const cycleDay = getCycleDayForDate(selectedDate);
  const dailyTasks = useMemo(() => getScheduleForDate(selectedDate), [selectedDate]);

  const searchMatches = useMemo<SearchMatch[]>(() => {
    if (!trimmedQuery) return [];
    const normalizedQuery = normalizeEquipmentSearch(trimmedQuery);
    const matches: SearchMatch[] = [];

    for (let cDay = 1; cDay <= 15; cDay++) {
      const dayObj = masterTPMUrea1B[cDay];
      if (!dayObj) continue;
      (['PAGI', 'SORE', 'MALAM'] as ShiftName[]).forEach((shift) => {
        const areaName = dayObj[shift];
        if (areaName && normalizeEquipmentSearch(areaName).includes(normalizedQuery)) {
          matches.push({
            cycleDay: cDay,
            shift,
            areaName,
            nextDateStr: getNextDateForCycleDay(cDay),
          });
        }
      });
    }
    return matches;
  }, [trimmedQuery]);

  const handleStepDate = (offset: number) => {
    const nextDate = getOffsetDateStr(offset, selectedDate);
    setSelectedDate(nextDate);
    if (searchQuery.trim()) {
      setSearchQuery('');
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value || getLocalTodayStr();
    setSelectedDate(val);
    if (searchQuery.trim()) {
      setSearchQuery('');
    }
  };

  const handleConfirmUndo = async () => {
    if (!statusTarget || isUndoing) return;
    setIsUndoing(true);
    try {
      const ok = await onUndoReport(statusTarget.date, statusTarget.shift);
      setStatusTarget(null);
      if (ok) {
        onShowToast('Status laporan berhasil direset.', 'success', 2600);
      }
    } catch {
      onShowToast('Gagal mereset status laporan.', 'error');
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <>
      <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-[0_4px_16px_rgba(2,6,23,0.5)] sm:p-5">
        {/* Kontrol Atas Responsif: Tanggal Jadwal & Cari Alat / Area */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {/* Tanggal Jadwal */}
          <div className="flex w-full min-w-0 flex-col gap-2">
            <label
              htmlFor="tpm_d_f1"
              className="inline-flex items-center gap-2 text-[15px] font-bold text-white sm:text-base"
            >
              <IconCalendar className="h-5 w-5 text-sky-400" /> Tanggal Jadwal
            </label>
            <div className="flex w-full min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => handleStepDate(-1)}
                aria-label="Tanggal sebelumnya"
                className="flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-slate-600 active:scale-[0.95]"
              >
                <IconChevronLeft className="h-5 w-5" />
              </button>
              <div className="relative flex h-[46px] min-w-0 flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-3">
                <span className="pointer-events-none whitespace-nowrap text-[16px] font-semibold tabular-nums text-white">
                  {formatDateIndoFull(selectedDate)}
                </span>
                <input
                  type="date"
                  id="tpm_d_f1"
                  name="tpm_d_f1"
                  autoComplete="off"
                  data-form-type="other"
                  data-lpignore="true"
                  value={selectedDate}
                  onChange={handleDateChange}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.();
                    } catch {
                      // Ignore on browsers without showPicker
                    }
                  }}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => handleStepDate(1)}
                aria-label="Tanggal berikutnya"
                className="flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-slate-600 active:scale-[0.95]"
              >
                <IconChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Pencarian Alat */}
          <div className="flex w-full min-w-0 flex-col gap-2">
            <label
              htmlFor="tpm_q_f1"
              className="inline-flex items-center gap-2 text-[15px] font-bold text-white sm:text-base"
            >
              <IconSearch className="h-5 w-5 text-sky-400" /> Cari Alat / Area
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                id="tpm_q_f1"
                name="tpm_q_f1"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Misal: GA101, FLARE..."
                className="tpm-input pr-10! font-semibold text-white placeholder:font-normal placeholder:text-slate-400 placeholder:normal-case"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border border-slate-600 bg-slate-700 text-[13px] text-white transition hover:bg-slate-600"
                >
                  <IconClose className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Header Daftar Jadwal */}
        <div className="mt-4 mb-3.5 flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <h2 className="inline-flex min-w-0 items-center gap-2 truncate text-[15px] font-bold text-white sm:text-base">
            {isSearching ? (
              <>
                <IconSearch className="h-5 w-5 text-sky-400" />
                <span className="truncate">Hasil Pencarian: &quot;{trimmedQuery}&quot;</span>
              </>
            ) : (
              <>
                <IconFileText className="h-5 w-5 text-sky-400" />
                <span className="truncate">
                  {isToday ? 'Jadwal TPM Hari Ini' : 'Daftar Jadwal TPM'}
                </span>
              </>
            )}
          </h2>
          {!isSearching && cycleDay !== null && (
            <button
              type="button"
              onClick={() => setCycleInfoOpen(true)}
              aria-label={`Info siklus rotasi ${cycleDay} dari 15`}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-sky-300 transition hover:border-sky-400/70 hover:bg-sky-500/25 active:scale-95"
            >
              <span>Siklus {cycleDay}/15</span>
              <IconInfoCircle className="h-3.5 w-3.5 text-sky-400" />
            </button>
          )}
        </div>

        {/* Daftar Kartu Shift */}
        <div className="flex flex-col gap-2.5">
          {isSearching ? (
            searchMatches.length === 0 ? (
              <p className="py-5 text-center text-[15px] text-slate-300">
                Alat &quot;{trimmedQuery}&quot; tidak ditemukan.
              </p>
            ) : (
              searchMatches.map((m) => {
                const isTodayMatch = m.nextDateStr === todayStr;
                const entry = reportedLog[`${m.nextDateStr}_${m.shift}`] ?? null;

                return (
                  <ScheduleCard
                    key={`${m.cycleDay}-${m.shift}-${m.areaName}`}
                    shift={m.shift}
                    areaText={m.areaName}
                    isHighlighted={isTodayMatch}
                    highlightLabel="HARI INI"
                    highlightDot={true}
                    reportedEntry={entry}
                    subtext={
                      isTodayMatch
                        ? `Hari Ini (${formatDateIndo(m.nextDateStr)})`
                        : `Terdekat: ${formatDateIndo(m.nextDateStr)} • Hari ${m.cycleDay}`
                    }
                    subtextWithCalendarIcon={true}
                    onCardClick={() =>
                      onSelectShift({
                        date: m.nextDateStr,
                        shift: m.shift,
                        area: m.areaName,
                      })
                    }
                    onBadgeClick={() =>
                      setStatusTarget({
                        date: m.nextDateStr,
                        shift: m.shift,
                        area: m.areaName,
                        entry,
                      })
                    }
                  />
                );
              })
            )
          ) : dailyTasks.length === 0 ? (
            <p className="py-5 text-center text-[15px] text-slate-300">
              Belum ada jadwal di tanggal ini.
            </p>
          ) : (
            dailyTasks.map((task) => {
              const isCurrentShift = isOperationalDay && !task.isOff && task.shift === activeShift;
              const entry =
                !task.isOff && task.shift !== 'INFO'
                  ? (reportedLog[`${selectedDate}_${task.shift}`] ?? null)
                  : null;

              return (
                <ScheduleCard
                  key={`${task.shift}-${task.text}`}
                  shift={task.shift}
                  areaText={task.text}
                  isOff={task.isOff}
                  isHighlighted={isCurrentShift}
                  highlightLabel="AKTIF"
                  highlightDot={true}
                  reportedEntry={entry}
                  subtext={task.subtext}
                  onCardClick={
                    !task.isOff && task.shift !== 'INFO'
                      ? () =>
                          onSelectShift({
                            date: selectedDate,
                            shift: task.shift as ShiftName,
                            area: task.text,
                          })
                      : undefined
                  }
                  onBadgeClick={
                    !task.isOff && task.shift !== 'INFO'
                      ? () =>
                          setStatusTarget({
                            date: selectedDate,
                            shift: task.shift as ShiftName,
                            area: task.text,
                            entry,
                          })
                      : undefined
                  }
                />
              );
            })
          )}
        </div>
      </div>

      {/* Pop-up Info Sistem Rotasi Siklus 15 Hari */}
      {cycleInfoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cycle-info-title"
          className="fixed inset-0 z-[9999] flex touch-none items-center justify-center overscroll-contain bg-slate-950/82 p-4 backdrop-blur-[4px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCycleInfoOpen(false);
          }}
        >
          <div className="modal-pop w-full max-w-[390px] overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_10px_30px_rgba(2,6,23,0.75)]">
            <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3
                id="cycle-info-title"
                className="flex items-center gap-2 text-base font-bold text-white"
              >
                <IconInfoCircle className="h-5 w-5 text-sky-400" /> Sistem Rotasi Siklus 15 Hari
              </h3>
              <button
                type="button"
                onClick={() => setCycleInfoOpen(false)}
                aria-label="Tutup informasi siklus"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-[14px] leading-relaxed text-slate-300">
              <p>
                Jadwal TPM Urea 1B berputar otomatis mengikuti{' '}
                <strong className="text-white">siklus 15 hari</strong> berdasarkan tanggal kalender
                setiap bulan:
              </p>
              <ul className="list-disc space-y-1.5 pl-4 text-[13px] text-slate-300">
                <li>
                  Tanggal <strong className="tabular-nums text-sky-300">1–15</strong> menjalankan
                  Siklus <strong className="tabular-nums text-white">1/15 – 15/15</strong>.
                </li>
                <li>
                  Tanggal <strong className="tabular-nums text-sky-300">16–30</strong> mengulang
                  Siklus <strong className="tabular-nums text-white">1/15 – 15/15</strong>.
                </li>
                <li>
                  Tanggal <strong className="tabular-nums text-amber-300">31</strong> otomatis libur
                  rutin TPM.
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setCycleInfoOpen(false)}
              className="mt-4 inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-[14px] font-bold text-white transition hover:bg-sky-500 active:scale-[0.98]"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Pop-up Status Sinkronisasi & Reset Dilaporkan */}
      {statusTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-sync-title"
          className="fixed inset-0 z-[9999] flex touch-none items-center justify-center overscroll-contain bg-slate-950/82 p-4 backdrop-blur-[4px]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUndoing) setStatusTarget(null);
          }}
        >
          <div className="modal-pop w-full max-w-[390px] overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_10px_30px_rgba(2,6,23,0.75)]">
            <h3
              id="status-sync-title"
              className="mb-2 flex items-center gap-2 text-base font-bold text-white"
            >
              <ReportedBadge size="sm" /> Status Dilaporkan
            </h3>
            <p className="mb-3 text-[14px] leading-[1.5] text-slate-300">
              {statusTarget.entry?.pendingOffline
                ? 'Laporan tersimpan di perangkat (menunggu sinkronisasi saat koneksi internet kembali stabil).'
                : 'Laporan ini sudah tercatat & tersinkronisasi real-time ke semua HP operator lain.'}
            </p>
            <div className="mb-4 rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 font-bold tabular-nums text-sky-300">
                <span>
                  {statusTarget.shift} • {formatDateIndo(statusTarget.date)}
                </span>
                {statusTarget.entry?.ts && (
                  <span className="text-slate-300">
                    Pukul {formatReportedTime(statusTarget.entry.ts)}
                  </span>
                )}
              </div>
              <div className="font-equipment mt-1 truncate text-[16px] font-bold text-white">
                {statusTarget.area}
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isUndoing}
                onClick={() => setStatusTarget(null)}
                className="flex-1 cursor-pointer rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-[0.97] disabled:opacity-50"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={isUndoing}
                onClick={handleConfirmUndo}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-600 px-3 py-2.5 text-[14px] font-bold text-white transition hover:bg-rose-500 active:scale-[0.97] disabled:opacity-60"
              >
                {isUndoing ? (
                  <>
                    <span className="spinner" /> Mereset...
                  </>
                ) : (
                  <>
                    <IconUndo className="h-4 w-4" /> Reset Status
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
