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
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconFileText,
  IconInfoCircle,
  IconSearch,
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

  useModalScrollLock(undoTarget !== null);

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
        {/* Kontrol Atas Responsif: Tanggal Jadwal & Cari Alat / Area */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {/* Tanggal Jadwal */}
          <div className="flex w-full min-w-0 flex-col gap-2">
            <label
              htmlFor="tpmDate"
              className="inline-flex items-center gap-2 text-[17px] font-semibold text-sky-200 sm:text-[18px]"
            >
              <IconCalendar className="text-sky-400" /> Tanggal Jadwal
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
          <div className="flex w-full min-w-0 flex-col gap-2">
            <label
              htmlFor="equipmentSearchInput"
              className="inline-flex items-center gap-2 text-[17px] font-semibold text-sky-200 sm:text-[18px]"
            >
              <IconSearch className="text-sky-400" /> Cari Alat / Area
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                id="equipmentSearchInput"
                name="tpm_field_search_equip_x1"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Misal: GA101, FLARE..."
                className="tpm-input pr-10!"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 bg-[#3d3d3d] text-[13px] text-white"
                >
                  <IconClose />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Header Daftar Jadwal */}
        <div className="mt-4 mb-3.5 flex items-center justify-between gap-2 border-b border-[#333] pb-2.5">
          <h2 className="inline-flex min-w-0 items-center gap-2 truncate text-[17px] font-semibold text-sky-200 sm:text-[18px]">
            {isSearching ? (
              <>
                <IconSearch className="text-sky-400" />
                <span className="truncate">Hasil Pencarian: &quot;{trimmedQuery}&quot;</span>
              </>
            ) : (
              <>
                <IconFileText className="text-sky-400" />
                <span className="truncate">
                  {isToday ? 'Jadwal TPM Hari Ini' : 'Daftar Jadwal TPM'}
                </span>
              </>
            )}
          </h2>
          {!isSearching && cycleDay !== null && (
            <span className="shrink-0 whitespace-nowrap rounded-xl border border-[#2b4c70] bg-[#1a2736] px-2.5 py-0.5 text-[12px] font-bold text-[#8ab4f8]">
              Siklus {cycleDay}/15
            </span>
          )}
        </div>

        {/* Daftar Kartu Shift */}
        <div className="flex flex-col gap-2.5">
          {isSearching ? (
            searchMatches.length === 0 ? (
              <p className="py-5 text-center text-[16px] text-[#888]">
                Alat &quot;{trimmedQuery}&quot; tidak ditemukan.
              </p>
            ) : (
              searchMatches.map((m) => {
                const isTodayMatch = m.nextDateStr === todayStr;
                const reported = Boolean(reportedLog[`${m.nextDateStr}_${m.shift}`]);
                const shiftRange = SHIFT_TIME_RANGES[m.shift];
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
                    className={`relative flex cursor-pointer items-stretch overflow-hidden rounded-[10px] border border-l-4 transition active:scale-[0.98] active:bg-[#2c3540] ${
                      isTodayMatch
                        ? 'border-[#34c759]/45 border-l-[#34c759] bg-[#1b2a22]'
                        : 'border-[#303030] border-l-[#007aff] bg-[#252525]'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-3.5 pr-10 pl-3.5 sm:pr-12">
                      {/* Baris 1: Ikon + Nama Shift (Jam) di kiri, Pil Hari Ini di kanan */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[13px] font-bold uppercase ${
                            isTodayMatch ? 'text-[#34c759]' : 'text-[#007aff]'
                          }`}
                        >
                          <ShiftWeatherIcon shift={m.shift} />
                          <span>{m.shift}</span>
                          <span className="text-[12px] font-medium normal-case text-[#9a9a9a]">
                            ({shiftRange})
                          </span>
                        </span>
                        {isTodayMatch && (
                          <span className="inline-flex items-center gap-1 rounded-[10px] border border-[#34c759]/50 bg-[#34c759]/20 px-2 py-[2px] text-[12px] font-bold text-[#4cd964]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#4cd964]" /> HARI INI
                          </span>
                        )}
                      </div>

                      {/* Baris 2: Tag Equipment di kiri, Pil DILAPORKAN di kanan */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 break-words text-[20px] font-bold leading-tight text-white sm:text-[21px]">
                          {m.areaName}
                        </div>
                        {reported && (
                          <button
                            type="button"
                            aria-label={`Batalkan status dilaporkan ${m.shift}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setUndoTarget({
                                date: m.nextDateStr,
                                shift: m.shift,
                                area: m.areaName,
                              });
                            }}
                            className="relative z-20 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[10px] border border-[#64b5f6]/50 bg-[#64b5f6]/18 px-2 py-[2px] text-[12px] font-bold text-[#8cc8ff] transition active:scale-95"
                          >
                            <IconCheck /> DILAPORKAN <IconClose className="opacity-70" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[13px] text-[#d8b47c]">
                        <IconCalendar />
                        <span>
                          {isTodayMatch
                            ? `Hari Ini (${formatDateIndo(m.nextDateStr)})`
                            : `Terdekat: ${formatDateIndo(m.nextDateStr)} • Hari ${m.cycleDay}`}
                        </span>
                      </div>
                    </div>

                    {/* Panah Sudut Lebar Penuh (Top-to-Bottom) */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-stretch sm:w-10">
                      <svg
                        viewBox="0 0 24 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        className={`h-full w-full ${
                          isTodayMatch ? 'text-emerald-400/80' : 'text-sky-400/75'
                        }`}
                      >
                        <polyline
                          points="7,8 19,50 7,92"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                  </div>
                );
              })
            )
          ) : dailyTasks.length === 0 ? (
            <p className="py-5 text-center text-[16px] text-[#888]">
              Belum ada jadwal di tanggal ini.
            </p>
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
                  className={`relative flex items-stretch overflow-hidden rounded-[10px] border border-l-4 transition ${
                    task.isOff
                      ? 'border-[#303030] border-l-[#ff9500] bg-[#2a2419]'
                      : isCurrentShift
                        ? 'cursor-pointer border-[#34c759]/45 border-l-[#34c759] bg-[#1b2a22] active:scale-[0.98] active:bg-[#2c3540]'
                        : 'cursor-pointer border-[#303030] border-l-[#007aff] bg-[#252525] active:scale-[0.98] active:bg-[#2c3540]'
                  }`}
                >
                  <div
                    className={`flex min-w-0 flex-1 flex-col justify-center gap-2 py-3.5 pl-3.5 ${
                      task.isOff ? 'pr-3.5' : 'pr-10 sm:pr-12'
                    }`}
                  >
                    {/* Baris 1: [Ikon] PAGI/SORE/MALAM (jam) di kiri sejajar dengan pil SHIFT AKTIF di kanan */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {task.shift === 'INFO' ? (
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase text-[#ff9500]">
                          <IconInfoCircle /> STATUS
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 text-[13px] font-bold uppercase ${
                            isCurrentShift ? 'text-[#34c759]' : 'text-[#007aff]'
                          }`}
                        >
                          <ShiftWeatherIcon shift={task.shift} />
                          <span>{task.shift}</span>
                          {shiftRange && (
                            <span className="text-[12px] font-medium normal-case text-[#9a9a9a]">
                              ({shiftRange})
                            </span>
                          )}
                        </span>
                      )}

                      {isCurrentShift && (
                        <span className="inline-flex items-center gap-1 rounded-[10px] border border-[#34c759]/50 bg-[#34c759]/20 px-2 py-[2px] text-[12px] font-bold text-[#4cd964]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#4cd964]" /> SHIFT AKTIF
                        </span>
                      )}
                    </div>

                    {/* Baris 2: Tag Equipment di kiri sejajar dengan pil DILAPORKAN di kanan */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 break-words text-[20px] font-bold leading-tight text-white sm:text-[21px]">
                        {task.text}
                      </div>

                      {reported && task.shift !== 'INFO' && (
                        <button
                          type="button"
                          aria-label={`Batalkan status dilaporkan ${task.shift}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setUndoTarget({
                              date: selectedDate,
                              shift: task.shift as ShiftName,
                              area: task.text,
                            });
                          }}
                          className="relative z-20 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[10px] border border-[#64b5f6]/50 bg-[#64b5f6]/18 px-2 py-[2px] text-[12px] font-bold text-[#8cc8ff] transition active:scale-95"
                        >
                          <IconCheck /> DILAPORKAN <IconClose className="opacity-70" />
                        </button>
                      )}
                    </div>

                    {task.subtext && (
                      <div className="flex items-center gap-1.5 text-[13px] text-[#d8b47c]">
                        <IconInfoCircle />
                        <span>{task.subtext}</span>
                      </div>
                    )}
                  </div>

                  {/* Panah Sudut Lebar Penuh (Top-to-Bottom) */}
                  {!task.isOff && (
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-stretch sm:w-10">
                      <svg
                        viewBox="0 0 24 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        className={`h-full w-full ${
                          isCurrentShift ? 'text-emerald-400/80' : 'text-sky-400/75'
                        }`}
                      >
                        <polyline
                          points="7,8 19,50 7,92"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
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
          className="fixed inset-0 z-[9999] flex touch-none items-center justify-center overscroll-contain bg-black/82 p-4 backdrop-blur-[4px]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUndoing) setUndoTarget(null);
          }}
        >
          <div className="modal-pop w-full max-w-[390px] overscroll-contain rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
            <h3 className="mb-2 flex items-center gap-1.5 text-[17px] font-bold text-[#ffb340]">
              <IconUndo /> Reset Status Dilaporkan?
            </h3>
            <p className="mb-3 text-[14px] leading-[1.5] text-[#d4d4d4]">
              Status{' '}
              <strong className="inline-flex items-center gap-1 text-[#8cc8ff]">
                <IconCheck /> DILAPORKAN
              </strong>{' '}
              akan dibatalkan dan tersinkron ke semua perangkat operator.
            </p>
            <div className="mb-4 rounded-lg border border-[#343434] bg-[#252525] px-3 py-2 text-[13px]">
              <div className="font-bold text-[#8ab4f8]">
                {undoTarget.shift} • {formatDateIndo(undoTarget.date)}
              </div>
              <div className="truncate font-semibold text-white">{undoTarget.area}</div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isUndoing}
                onClick={() => setUndoTarget(null)}
                className="flex-1 cursor-pointer rounded-lg border border-[#444] bg-[#2c2c2c] px-3 py-2.5 text-[14px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isUndoing}
                onClick={handleConfirmUndo}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 bg-[#ff453a] px-3 py-2.5 text-[14px] font-bold text-white transition active:scale-[0.97] disabled:opacity-60"
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
