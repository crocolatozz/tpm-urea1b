import React, { useMemo, useState } from 'react';
import {
  SHIFT_TIME_RANGES,
  formatDateIndo,
  getCurrentActiveShift,
  getCycleDayForDate,
  getLocalTodayStr,
  getNextDateForCycleDay,
  getOffsetDateStr,
  getScheduleForDate,
  masterTPMUrea1B,
  normalizeEquipmentSearch,
  type ReportedLogEntry,
  type ShiftName,
} from '../data/tpmData';

interface DashboardViewProps {
  reportedLog: Record<string, ReportedLogEntry>;
  onSelectShift: (params: { date: string; shift: ShiftName; area: string }) => void;
}

interface SearchMatch {
  cycleDay: number;
  shift: ShiftName;
  areaName: string;
  nextDateStr: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reportedLog,
  onSelectShift,
}) => {
  const todayStr = getLocalTodayStr();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;
  const isToday = selectedDate === todayStr;
  const activeShift = isToday ? getCurrentActiveShift() : null;
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

  return (
    <div className="w-full overflow-hidden rounded-xl bg-[#1e1e1e] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.3)] sm:p-5">
      {/* Navigasi Tanggal Minimalis (< Tanggal >) */}
      <div className="mb-3 flex w-full min-w-0 flex-col gap-1.5">
        <label htmlFor="tpmDate" className="text-[0.82rem] font-semibold text-[#aaaaaa]">
          Tanggal Jadwal
        </label>
        <div className="flex w-full min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => handleStepDate(-1)}
            aria-label="Tanggal sebelumnya"
            className="flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#3c3c3c] bg-[#262626] text-lg font-bold text-white transition active:scale-[0.95] active:bg-[#333]"
          >
            &lt;
          </button>
          <input
            type="date"
            id="tpmDate"
            value={selectedDate}
            onChange={handleDateChange}
            className="tpm-input min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => handleStepDate(1)}
            aria-label="Tanggal berikutnya"
            className="flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#3c3c3c] bg-[#262626] text-lg font-bold text-white transition active:scale-[0.95] active:bg-[#333]"
          >
            &gt;
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
            placeholder="Ketik kode alat (GA101, FLARE, GB301)..."
            className="tpm-input pr-10!"
          />
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus pencarian"
              className="absolute right-2.5 flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 bg-[#3d3d3d] text-[0.85rem] text-white"
            >
              ✕
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
                      <span>
                        SHIFT {m.shift} • HARI {m.cycleDay}
                      </span>
                      {isTodayMatch && (
                        <span className="rounded-[10px] border border-[#34c759]/50 bg-[#34c759]/20 px-1.5 py-[1px] text-[0.65rem] font-bold text-[#4cd964]">
                          ● HARI INI
                        </span>
                      )}
                      {reported && (
                        <span className="rounded-[10px] border border-[#64b5f6]/45 bg-[#64b5f6]/16 px-1.5 py-[1px] text-[0.65rem] font-bold text-[#7cc0ff]">
                          ✓ DILAPORKAN
                        </span>
                      )}
                    </div>
                    <div className="break-words text-[1.05rem] font-bold text-white">
                      {m.areaName}
                    </div>
                    <div className="text-[0.8rem] text-[#d8b47c]">
                      {isTodayMatch
                        ? `📅 Hari Ini (${formatDateIndo(m.nextDateStr)})`
                        : `📅 Terdekat: ${formatDateIndo(m.nextDateStr)}`}
                    </div>
                  </div>

                  <span className="shrink-0 self-center whitespace-nowrap text-[0.76rem] font-semibold text-[#8ab4f8]">
                    Buat Kolase ➔
                  </span>
                </div>
              );
            })
          )
        ) : dailyTasks.length === 0 ? (
          <p className="py-5 text-center text-sm text-[#888]">Belum ada jadwal di tanggal ini.</p>
        ) : (
          dailyTasks.map((task) => {
            const isCurrentShift = isToday && !task.isOff && task.shift === activeShift;
            const reported = !task.isOff && Boolean(reportedLog[`${selectedDate}_${task.shift}`]);
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
                    <span>{task.shift === 'INFO' ? 'STATUS' : `SHIFT ${task.shift}`}</span>
                    {shiftRange && (
                      <span className="text-[0.68rem] font-medium normal-case text-[#9a9a9a]">
                        ({shiftRange})
                      </span>
                    )}
                    {isCurrentShift && (
                      <span className="rounded-[10px] border border-[#34c759]/50 bg-[#34c759]/20 px-1.5 py-[1px] text-[0.66rem] font-bold text-[#4cd964]">
                        ● SHIFT AKTIF
                      </span>
                    )}
                    {reported && (
                      <span className="rounded-[10px] border border-[#64b5f6]/45 bg-[#64b5f6]/16 px-1.5 py-[1px] text-[0.66rem] font-bold text-[#7cc0ff]">
                        ✓ DILAPORKAN
                      </span>
                    )}
                  </div>

                  <div className="break-words text-[1.05rem] font-bold text-white">
                    {task.text}
                  </div>

                  {task.subtext && (
                    <div className="text-[0.8rem] text-[#d8b47c]">{task.subtext}</div>
                  )}
                </div>

                {!task.isOff && (
                  <span className="shrink-0 self-center whitespace-nowrap text-[0.76rem] font-semibold text-[#8ab4f8]">
                    Buat Kolase ➔
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
