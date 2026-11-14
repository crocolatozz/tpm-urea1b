export const APP_VERSION = '2.0.0';

export type ShiftName = 'PAGI' | 'SORE' | 'MALAM';
export type GridType = '2x1' | '2x2' | '2x3';

export interface DayRotation {
  PAGI: string;
  SORE: string;
  MALAM: string;
}

export interface ScheduleTask {
  shift: ShiftName | 'INFO';
  text: string;
  subtext?: string;
  isOff?: boolean;
}

export interface ReportedLogEntry {
  area: string;
  ts: number;
}

export interface KolaseDraftPrefs {
  grid: GridType;
  row1: string;
  row2: string;
  row3: string;
}

// Master Database Rotasi 15 Hari TPM Urea 1B (Standar Penamaan Equipment Resmi & Konsisten)
export const masterTPMUrea1B: Record<number, DayRotation> = {
  1: { PAGI: 'GA122', SORE: 'GA123 & GB801', MALAM: 'GB701' },
  2: { PAGI: 'GA101A', SORE: 'GA103', MALAM: 'GA104' },
  3: { PAGI: 'GA101B', SORE: 'GA105', MALAM: 'GA106' },
  4: { PAGI: 'GA102A', SORE: 'GA107', MALAM: 'GA109' },
  5: { PAGI: 'GA102B', SORE: 'GA110', MALAM: 'GA121' },
  6: { PAGI: 'GT101', SORE: 'GA201', MALAM: 'GA204' },
  7: { PAGI: 'GB101LP', SORE: 'GA401', MALAM: 'GA402' },
  8: { PAGI: 'GB101HP', SORE: 'GA403', MALAM: 'GA404' },
  9: { PAGI: 'IA301', SORE: 'GA405', MALAM: 'GB301' },
  10: { PAGI: 'JW301', SORE: 'GB302', MALAM: 'GA301' },
  11: { PAGI: 'JD301', SORE: 'GA302', MALAM: 'GA303' },
  12: { PAGI: 'FD304', SORE: 'GA501', MALAM: 'GA502' },
  13: { PAGI: 'FD305', SORE: 'GA503', MALAM: 'GA504 & GA704' },
  14: { PAGI: 'GA101A OIL', SORE: 'GA101B OIL', MALAM: 'GA801 & GA803' },
  15: { PAGI: 'GA102A OIL', SORE: 'GA102B OIL', MALAM: 'FLARE' },
};

export const SHIFT_TIME_RANGES: Record<ShiftName, string> = {
  PAGI: '07:00 – 15:00',
  SORE: '15:00 – 23:00',
  MALAM: '23:00 – 07:00',
};

export const DEFAULT_OVERLAY_SUGGESTIONS: string[] = [
  'Regreasing BV',
  'Cleaning baseplate pompa',
  'Cleaning instrumentasi',
  'Cleaning area & grating',
  'Pengecekan level & kondisi oli',
  'Cleaning body motor & coupling',
];

export const REPORTED_LOG_KEY = 'tpm_reported_log_v1';
export const PREFS_STORAGE_KEY = 'tpm_kolase_prefs_v1';
export const HISTORY_STORAGE_KEY = 'tpm_overlay_history_v1';

export function normalizeEquipmentSearch(str: string): string {
  return str.toUpperCase().replace(/\s+/g, '');
}

export function getCycleDayForDate(dateStr: string): number | null {
  if (!dateStr) return null;
  const dayOfMonth = parseInt(dateStr.split('-')[2], 10);
  if (!dayOfMonth || dayOfMonth === 31) return null;
  return ((dayOfMonth - 1) % 15) + 1;
}

export function getScheduleForDate(dateStr: string): ScheduleTask[] {
  if (!dateStr) return [];
  const dayOfMonth = parseInt(dateStr.split('-')[2], 10);

  if (dayOfMonth === 31) {
    return [
      {
        shift: 'INFO',
        text: 'TIDAK ADA KEGIATAN',
        subtext: '🏖️ Libur rutin tiap tanggal 31',
        isOff: true,
      },
    ];
  }

  const cycleDay = ((dayOfMonth - 1) % 15) + 1;
  const dayData = masterTPMUrea1B[cycleDay];
  if (!dayData) return [];

  return [
    { shift: 'PAGI', text: dayData.PAGI },
    { shift: 'SORE', text: dayData.SORE },
    { shift: 'MALAM', text: dayData.MALAM },
  ];
}

export function getAreaForDateAndShift(dateStr: string, shift: ShiftName): string {
  if (!dateStr) return '';
  const dayOfMonth = parseInt(dateStr.split('-')[2], 10);
  if (dayOfMonth === 31) return 'TIDAK ADA KEGIATAN';
  const cycleDay = ((dayOfMonth - 1) % 15) + 1;
  return masterTPMUrea1B[cycleDay]?.[shift] ?? '';
}

export function getLocalTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getOffsetDateStr(offsetDays: number, baseDateStr?: string): string {
  let base: Date;
  if (baseDateStr && /^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) {
    const [y, m, d] = baseDateStr.split('-').map((n) => parseInt(n, 10));
    base = new Date(y, m - 1, d + offsetDays);
  } else {
    const now = new Date();
    base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  }
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getNextDateForCycleDay(cycleDay: number): string {
  const now = new Date();
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  const baseDate = now.getDate();

  for (let offset = 0; offset <= 45; offset++) {
    const candidate = new Date(baseYear, baseMonth, baseDate + offset);
    const dom = candidate.getDate();
    if (dom === 31) continue;
    const cDay = ((dom - 1) % 15) + 1;
    if (cDay === cycleDay) {
      const y = candidate.getFullYear();
      const m = String(candidate.getMonth() + 1).padStart(2, '0');
      const d = String(dom).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return getLocalTodayStr();
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export function getCurrentActiveShift(): ShiftName {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return 'PAGI';
  if (hour >= 15 && hour < 23) return 'SORE';
  return 'MALAM';
}

export function getReportedLog(): Record<string, ReportedLogEntry> {
  try {
    const raw = localStorage.getItem(REPORTED_LOG_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ReportedLogEntry>) : {};
  } catch {
    return {};
  }
}

export function markShiftAsReportedLocal(dateStr: string, shift: string, area: string): void {
  if (!dateStr || !shift) return;
  const log = getReportedLog();
  log[`${dateStr}_${shift}`] = {
    area: area || '-',
    ts: Date.now(),
  };

  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  Object.keys(log).forEach((k) => {
    if (log[k] && log[k].ts && log[k].ts < cutoff) {
      delete log[k];
    }
  });

  try {
    localStorage.setItem(REPORTED_LOG_KEY, JSON.stringify(log));
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeRemoteReportedLog(
  remoteEntries: Record<string, ReportedLogEntry>
): Record<string, ReportedLogEntry> {
  const local = getReportedLog();
  const merged: Record<string, ReportedLogEntry> = { ...local };

  Object.entries(remoteEntries).forEach(([key, entry]) => {
    const existing = merged[key];
    if (!existing || entry.ts >= existing.ts) {
      merged[key] = entry;
    }
  });

  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  Object.keys(merged).forEach((k) => {
    if (merged[k] && merged[k].ts && merged[k].ts < cutoff) {
      delete merged[k];
    }
  });

  try {
    localStorage.setItem(REPORTED_LOG_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage quota errors
  }

  return merged;
}

export const DEFAULT_PREFS: KolaseDraftPrefs = {
  grid: '2x3',
  row1: '',
  row2: '',
  row3: '',
};

export function loadSavedPreferences(): KolaseDraftPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<KolaseDraftPrefs>;
    return {
      grid:
        parsed.grid && (['2x1', '2x2', '2x3'] as const).includes(parsed.grid)
          ? parsed.grid
          : DEFAULT_PREFS.grid,
      row1: typeof parsed.row1 === 'string' ? parsed.row1 : DEFAULT_PREFS.row1,
      row2: typeof parsed.row2 === 'string' ? parsed.row2 : DEFAULT_PREFS.row2,
      row3: typeof parsed.row3 === 'string' ? parsed.row3 : DEFAULT_PREFS.row3,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePreferences(prefs: KolaseDraftPrefs): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

export function loadOverlayHistory(): string[] {
  let saved: string[] = [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        saved = parsed.filter((x): x is string => typeof x === 'string');
      }
    }
  } catch {
    saved = [];
  }
  return [...new Set([...saved, ...DEFAULT_OVERLAY_SUGGESTIONS])].slice(0, 20);
}

export function saveOverlayHistory(texts: string[]): string[] {
  const currentTexts = texts.map((t) => t.trim()).filter((t) => t.length >= 3);
  if (currentTexts.length === 0) return loadOverlayHistory();

  let saved: string[] = [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        saved = parsed.filter((x): x is string => typeof x === 'string');
      }
    }
  } catch {
    saved = [];
  }

  const updated = [...new Set([...currentTexts, ...saved])].slice(0, 20);
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return [...new Set([...updated, ...DEFAULT_OVERLAY_SUGGESTIONS])].slice(0, 20);
}

export function compareSemver(localVer: string, remoteVer: string): number {
  const a = String(localVer)
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const b = String(remoteVer)
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const numA = a[i] || 0;
    const numB = b[i] || 0;
    if (numB > numA) return 1;
    if (numB < numA) return -1;
  }
  return 0;
}
