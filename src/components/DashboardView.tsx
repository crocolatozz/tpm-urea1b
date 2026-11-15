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

import {
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconInfoCircle,
  IconUndo,
  ShiftWeatherIcon,
} from './Icons';

interface DashboardViewProps {
  reportedLog: Record<string, ReportedLogEntry>;
  onSelectShift: (params: { date: string; shift: ShiftName; area: string }) => void;
  onUndoReport: (dateStr: string, shift: ShiftName) => Promise<void>;
}

interface SearchMatch {
  cycleDay: number;
  shift: ShiftName;
  areaName: string;
  nextDateStr: string;
}

interface UndoTarget {
  date: string;
  shift: ShiftName;
  area: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reportedLog,
  onSelectShift,
  onUndoReport,
}) => {
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const operationalInfo = useMemo(() => {
    void nowTick;
    return getOperationalShiftInfo();
  }, [nowTick]);
  const todayStr = useMemo(() => {
    void nowTick;
    return getLocalTodayStr();
  }, [nowTick]);
  const prevOpDateRef = useRef<string>(operationalInfo.dateStr);

  const [selectedDate, setSelectedDate] = useState<string>(operationalInfo.dateStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [undoTarget, setUndoTarget] = useState<UndoTarget | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  // Auto-refresh active shift (07:00, 15:00, 23:00) & operational day rollover
  useEffect(() => {
    const syncClock = () => setNowTick(Date.now());
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
  }, [trimmedQuery, todayStr]);

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
    if (!undoTarget || isUndoing) return;
    setIsUndoing(true);
    try {
      await onUndoReport(undoTarget.date, undoTarget.shift);
      setUndoTarget(null);
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <>
      <div className="w-full overflow-hidden rounded-xl bg-[#1e1e1e] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.3)] sm:p-5">
        {/* Navigasi Tanggal Minimalis dengan Ikon SVG Chevron */}
        <div className="mb-3 flex w-full min-w-0 flex-col gap-1.5">
          <label htmlFor="tpmDate" className="text-[0.82rem] font-semibold text-[#aaaaaa]">
            Tanggal Jadwal
          </label>
          <div className="flex w-full min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepDate(-1)}
              aria-label="Tanggal sebelumnya"
              className="flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#3c3c3c] bg-[#262626] text-xl text-white transition active:scale-[0.95] active:bg-[#333]"
            >
              <IconChevronLeft />
            </button>
            <div className="relative flex h-[46px] min-w-0 flex-1 items-center justify-center rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] px-3">
              <span className="pointer-events-none whitespace-nowrap text-[16px] font-semibold text-white">
                {formatDateIndoFull(selectedDate)}
              </span>
              <input
                type="date"
                id="tpmDate"
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
              className="flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#3c3c3c] bg-[#262626] text-xl text-white transition active:scale-[0.95] active:bg-[#333]"
            >
              <IconChevronRight />
            </button>
          </div>
        </div>

        {/* Pencarian Alat */}
        <div className="mb-1 flex w-full min-w-0 flex-col gap-1.5">
          <label
            htmlFor="equipmentSearchInput"
            className="text-[0.82rem] font-semibold text-[#aaaaaa]"
          >
            Cari Alat / Area
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              id="equipmentSearchInput"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari alat (GA101, FLARE)..."
              className="tpm-input pr-10!"
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 bg-[#3d3d3d] text-[0.85rem] text-white"
              >
                <IconClose />
              </button>
            )}
          </div>
        </div>

        {/* Header Daftar Jadwal */}
        <div className="mt-3.5 mb-3.5 flex items-center justify-between gap-2 border-b border-[#333] pb-2">
          <h2 className="min-w-0 truncate text-[1rem] font-bold text-[#007aff]">
            {isSearching
              ? `Pencarian: "${trimmedQuery}"`
              : isToday
                ? 'Jadwal Hari Ini'
                : isOperationalDay
                  ? `Jadwal Shift Aktif (${formatDateIndo(selectedDate)})`
                  : `Jadwal ${formatDateIndo(selectedDate)}`}
          </h2>
          {!isSearching && cycleDay !== null && (
            <span className="shrink-0 whitespace-nowrap rounded-xl border border-[#2b4c70] bg-[#1a2736] px-2.5 py-0.5 text-[0.72rem] font-bold text-[#8ab4f8]">
              Siklus {cycleDay}/15
            </span>
          )}
        </div>

        {/* Daftar Kartu Shift */}
        <div className="flex flex-col gap-2.5">
          {isSearching ? (
            searchMatches.length === 0 ? (
              <p className="py-5 text-center text-sm text-[#888]">
                Alat &quot;{trimmedQuery}&quot; tidak ditemukan.
              </p>
            ) : (
              searchMatches.map((m) => {
                const isTodayMatch = m.nextDateStr === todayStr;
                const reported = Boolean(reportedLog[`${m.nextDateStr}_${m.shift}`]);
                return (
                  <div
                    key={`${m.cycleDay}-${m.shift}-${m.areaName}`}
                    onClick={() =>
                      onSelectShift({
                        date: m.nextDateStr,
                        shift: m.shift,
                        area: m.areaName,
                      })
                    }
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-l-4 p-3.5 transition active:scale-[0.98] active:bg-[#2c3540] ${
                      isTodayMatch
                        ? 'border-[#34c759]/45 border-l-[#34c759] bg-[#1b2a22]'
                        : 'border-[#303030] border-l-[#007aff] bg-[#252525]'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div
                        className={`flex flex-wrap items-center gap-1.5 text-[0.72rem] font-bold uppercase ${
                          isTodayMatch ? 'text-[#34c759]' : 'text-[#007aff]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <ShiftWeatherIcon shift={m.shift} />
                          SHIFT {m.shift} • HARI {m.cycleDay}
                        </span>
                        {isTodayMatch && (
                          <span className="inline-flex items-center gap-1 rounded-[10px] border border-[#34c759]/50 bg-[#34c759]/20 px-1.5 py-[1px] text-[0.65rem] font-bold text-[#4cd964]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#4cd964]" /> HARI INI
                          </span>
                        )}
                        {reported && (
                          <button
                            type="button"
                            aria-label={`Batalkan status dilaporkan Shift ${m.shift}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setUndoTarget({
                                date: m.nextDateStr,
                                shift: m.shift,
                                area: m.areaName,
                              });
                            }}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-[10px] border border-[#64b5f6]/50 bg-[#64b5f6]/18 px-1.5 py-[1px] text-[0.65rem] font-bold text-[#8cc8ff] transition active:scale-95"
                          >
                            <IconCheck /> DILAPORKAN <IconClose className="opacity-70" />
                          </button>
                        )}
                      </div>
                      <div className="break-words text-[1.05rem] font-bold text-white">
                        {m.areaName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[0.8rem] text-[#d8b47c]">
                        <IconCalendar />
                        <span>
                          {isTodayMatch
                            ? `Hari Ini (${formatDateIndo(m.nextDateStr)})`
                            : `Terdekat: ${formatDateIndo(m.nextDateStr)}`}
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex shrink-0 items-center gap-1 self-center whitespace-nowrap text-[0.76rem] font-semibold text-[#8ab4f8]">
                      Buat Kolase <IconArrowRight />
                    </span>
                  </div>
                );
              })
            )
          ) : dailyTasks.length === 0 ? (
            <p className="py-5 text-center text-sm text-[#888]">Belum ada jadwal di tanggal ini.</p>
          ) : (
            dailyTasks.map((task) => {
              const isCurrentShift = isOperationalDay && !task.isOff && task.shift === activeShift;
              const reported =
                !task.isOff &&
                task.shift !== 'INFO' &&
                Boolean(reportedLog[`${selectedDate}_${task.shift}`]);
              const shiftRange =
                !task.isOff && task.shift !== 'INFO' ? SHIFT_TIME_RANGES[task.shift] : null;

              return (
                <div
                  key={`${task.shift}-${task.text}`}
                  onClick={() => {
                    if (!task.isOff && task.shift !== 'INFO') {
                      onSelectShift({
                        date: selectedDate,
                        shift: task.shift,
                        area: task.text,
                      });
                    }
                  }}
                  className={`flex items-center justify-between gap-3 rounded-[10px] border border-l-4 p-3.5 transition ${
                    task.isOff
                      ? 'border-[#303030] border-l-[#ff9500] bg-[#2a2419]'
                      : isCurrentShift
                        ? 'cursor-pointer border-[#34c759]/45 border-l-[#34c759] bg-[#1b2a22] active:scale-[0.98] active:bg-[#2c3540]'
                        : 'cursor-pointer border-[#303030] border-l-[#007aff] bg-[#252525] active:scale-[0.98] active:bg-[#2c3540]'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div
                      className={`flex flex-wrap items-center gap-1.5 text-[0.73rem] font-bold uppercase ${
                        task.isOff
                          ? 'text-[#ff9500]'
                          : isCurrentShift
                            ? 'text-[#34c759]'
                            : 'text-[#007aff]'
                      }`}
                    >
                      {task.shift === 'INFO' ? (
                        <span className="inline-flex items-center gap-1">
                          <IconInfoCircle /> STATUS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <ShiftWeatherIcon shift={task.shift} />
                          SHIFT {task.shift}
                        </span>
                      )}
                      {shiftRange && (
                        <span className="text-[0.68rem] font-medium normal-case text-[#9a9a9a]">
                          ({shiftRange})
                        </span>
                      )}
                      {isCurrentShift && (
                        <span className="inline-flex items-center gap-1 rounded-[10px] border border-[#34c759]/50 bg-[#34c759]/20 px-1.5 py-[1px] text-[0.66rem] font-bold text-[#4cd964]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#4cd964]" /> SHIFT AKTIF
                        </span>
                      )}
                      {reported && task.shift !== 'INFO' && (
                        <button
                          type="button"
                          aria-label={`Batalkan status dilaporkan Shift ${task.shift}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setUndoTarget({
                              date: selectedDate,
                              shift: task.shift as ShiftName,
                              area: task.text,
                            });
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-[10px] border border-[#64b5f6]/50 bg-[#64b5f6]/18 px-1.5 py-[1px] text-[0.66rem] font-bold text-[#8cc8ff] transition active:scale-95"
                        >
                          <IconCheck /> DILAPORKAN <IconClose className="opacity-70" />
                        </button>
                      )}
                    </div>

                    <div className="break-words text-[1.05rem] font-bold text-white">
                      {task.text}
                    </div>

                    {task.subtext && (
                      <div className="flex items-center gap-1.5 text-[0.8rem] text-[#d8b47c]">
                        <IconInfoCircle />
                        <span>{task.subtext}</span>
                      </div>
                    )}
                  </div>

                  {!task.isOff && (
                    <span className="inline-flex shrink-0 items-center gap-1 self-center whitespace-nowrap text-[0.76rem] font-semibold text-[#8ab4f8]">
                      Buat Kolase <IconArrowRight />
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Dialog Konfirmasi Undo / Reset Status Dilaporkan */}
      {undoTarget && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/82 p-4 backdrop-blur-[4px]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUndoing) setUndoTarget(null);
          }}
        >
          <div className="modal-pop w-full max-w-[390px] rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
            <h3 className="mb-2 flex items-center gap-1.5 text-[1.02rem] font-bold text-[#ffb340]">
              <IconUndo /> Reset Status Dilaporkan?
            </h3>
            <p className="mb-3 text-[0.86rem] leading-[1.5] text-[#d4d4d4]">
              Status{' '}
              <strong className="inline-flex items-center gap-1 text-[#8cc8ff]">
                <IconCheck /> DILAPORKAN
              </strong>{' '}
              akan dibatalkan dan tersinkron ke semua perangkat operator.
            </p>
            <div className="mb-4 rounded-lg border border-[#343434] bg-[#252525] px-3 py-2 text-[0.82rem]">
              <div className="font-bold text-[#8ab4f8]">
                SHIFT {undoTarget.shift} • {formatDateIndo(undoTarget.date)}
              </div>
              <div className="truncate font-semibold text-white">{undoTarget.area}</div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isUndoing}
                onClick={() => setUndoTarget(null)}
                className="flex-1 cursor-pointer rounded-lg border border-[#444] bg-[#2c2c2c] px-3 py-2.5 text-[0.88rem] font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isUndoing}
                onClick={handleConfirmUndo}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 bg-[#ff453a] px-3 py-2.5 text-[0.88rem] font-bold text-white transition active:scale-[0.97] disabled:opacity-60"
              >
                {isUndoing ? (
                  <>
                    <span className="spinner" /> Mereset...
                  </>
                ) : (
                  'Ya, Reset Status'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
