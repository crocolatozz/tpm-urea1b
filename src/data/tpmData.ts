export const APP_VERSION = '2.10.4';
export const STORAGE_VERSION = '2.10.4';

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
  pendingOffline?: boolean;
}

export interface KolaseDraftPrefs {
  grid: GridType;
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

export function buildExtremeDummyTag(): string {
  return 'TEST-TAG-9999';
}

export const SHIFT_TIME_RANGES: Record<ShiftName, string> = {
  PAGI: '07:00 – 15:00',
  SORE: '15:00 – 23:00',
  MALAM: '23:00 – 07:00',
};

export const REPORTED_LOG_KEY = 'tpm_reported_log_v1';
export const REPORTED_PENDING_DELETE_KEY = 'tpm_reported_pending_delete_v1';
export const PREFS_STORAGE_KEY = 'tpm_kolase_prefs_v1';
export const STORAGE_VERSION_KEY = 'tpm_storage_version_v1';
const LEGACY_OVERLAY_HISTORY_KEY = 'tpm_overlay_history_v1';

export function clearLegacyOverlayHistory(): void {
  try {
    localStorage.removeItem(LEGACY_OVERLAY_HISTORY_KEY);
  } catch {
    // Ignore storage access errors
  }
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function sanitizeReportedLogMap(raw: unknown): Record<string, ReportedLogEntry> {
  if (!isPlainObject(raw)) return {};
  const clean: Record<string, ReportedLogEntry> = {};
  Object.entries(raw).forEach(([key, val]) => {
    if (!/^\d{4}-\d{2}-\d{2}_(PAGI|SORE|MALAM)$/.test(key) || !isPlainObject(val)) return;
    const area = typeof val.area === 'string' && val.area.trim() ? val.area : '-';
    const ts = typeof val.ts === 'number' && Number.isFinite(val.ts) ? val.ts : Date.now();
    clean[key] = {
      area,
      ts,
      ...(val.pendingOffline === true ? { pendingOffline: true } : {}),
    };
  });
  return clean;
}

function sanitizePendingDeletesMap(raw: unknown): Record<string, number> {
  if (!isPlainObject(raw)) return {};
  const clean: Record<string, number> = {};
  Object.entries(raw).forEach(([key, ts]) => {
    if (
      /^\d{4}-\d{2}-\d{2}_(PAGI|SORE|MALAM)$/.test(key) &&
      typeof ts === 'number' &&
      Number.isFinite(ts)
    ) {
      clean[key] = ts;
    }
  });
  return clean;
}

export function ensureStorageVersionGuard(): void {
  try {
    const currentStoredVer = localStorage.getItem(STORAGE_VERSION_KEY);
    clearLegacyOverlayHistory();

    if (currentStoredVer === STORAGE_VERSION) {
      return;
    }

    // Validasi & sanitasi defensif data tersimpan saat transisi versi agar tidak crash
    try {
      const rawLog = localStorage.getItem(REPORTED_LOG_KEY);
      if (rawLog) {
        const sanitizedLog = sanitizeReportedLogMap(JSON.parse(rawLog));
        localStorage.setItem(REPORTED_LOG_KEY, JSON.stringify(sanitizedLog));
      }
    } catch {
      localStorage.removeItem(REPORTED_LOG_KEY);
    }

    try {
      const rawPending = localStorage.getItem(REPORTED_PENDING_DELETE_KEY);
      if (rawPending) {
        const sanitizedPending = sanitizePendingDeletesMap(JSON.parse(rawPending));
        if (Object.keys(sanitizedPending).length === 0) {
          localStorage.removeItem(REPORTED_PENDING_DELETE_KEY);
        } else {
          localStorage.setItem(REPORTED_PENDING_DELETE_KEY, JSON.stringify(sanitizedPending));
        }
      }
    } catch {
      localStorage.removeItem(REPORTED_PENDING_DELETE_KEY);
    }

    try {
      const rawPrefs = localStorage.getItem(PREFS_STORAGE_KEY);
      if (rawPrefs) {
        const parsedPrefs: unknown = JSON.parse(rawPrefs);
        const safeGrid =
          isPlainObject(parsedPrefs) &&
          typeof parsedPrefs.grid === 'string' &&
          (['2x1', '2x2', '2x3'] as const).includes(parsedPrefs.grid as GridType)
            ? (parsedPrefs.grid as GridType)
            : DEFAULT_PREFS.grid;
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ grid: safeGrid }));
      }
    } catch {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_PREFS }));
    }

    localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
  } catch {
    // Ignore storage access errors (Private mode / restricted WebView)
  }
}

export function normalizeEquipmentSearch(str: string): string {
  return str.toUpperCase().replace(/\s+/g, '');
}

interface DateCycleInfo {
  isValid: boolean;
  dayOfMonth: number;
  isOffDay: boolean;
  cycleDay: number | null;
}

function getCycleInfoForDate(dateStr: string): DateCycleInfo {
  if (!dateStr) {
    return { isValid: false, dayOfMonth: 0, isOffDay: false, cycleDay: null };
  }
  const dayOfMonth = parseInt(dateStr.split('-')[2] || '', 10);
  if (!dayOfMonth || Number.isNaN(dayOfMonth)) {
    return { isValid: false, dayOfMonth: 0, isOffDay: false, cycleDay: null };
  }
  if (dayOfMonth === 31) {
    return { isValid: true, dayOfMonth, isOffDay: true, cycleDay: null };
  }
  return {
    isValid: true,
    dayOfMonth,
    isOffDay: false,
    cycleDay: ((dayOfMonth - 1) % 15) + 1,
  };
}

export function getCycleDayForDate(dateStr: string): number | null {
  return getCycleInfoForDate(dateStr).cycleDay;
}

export function getScheduleForDate(dateStr: string): ScheduleTask[] {
  const info = getCycleInfoForDate(dateStr);
  if (!info.isValid) return [];

  if (info.isOffDay) {
    return [
      {
        shift: 'INFO',
        text: 'TIDAK ADA KEGIATAN',
        subtext: 'Libur rutin tiap tanggal 31',
        isOff: true,
      },
    ];
  }

  const dayData = info.cycleDay !== null ? masterTPMUrea1B[info.cycleDay] : undefined;
  if (!dayData) return [];

  return [
    { shift: 'PAGI', text: dayData.PAGI },
    { shift: 'SORE', text: dayData.SORE },
    { shift: 'MALAM', text: dayData.MALAM },
  ];
}

export function getAreaForDateAndShift(dateStr: string, shift: ShiftName): string {
  const info = getCycleInfoForDate(dateStr);
  if (!info.isValid) return '';
  if (info.isOffDay) return 'TIDAK ADA KEGIATAN';
  return info.cycleDay !== null ? (masterTPMUrea1B[info.cycleDay]?.[shift] ?? '') : '';
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

const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export function formatDateIndoFull(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const monthIdx = parseInt(m, 10) - 1;
  const dayNum = parseInt(d, 10);
  const monthName = INDONESIAN_MONTHS[monthIdx];
  if (!monthName || Number.isNaN(dayNum)) return dateStr;
  return `${dayNum} ${monthName} ${y}`;
}

export interface OperationalShiftInfo {
  dateStr: string;
  shift: ShiftName;
}

export function getOperationalShiftInfo(now: Date = new Date()): OperationalShiftInfo {
  const hour = now.getHours();
  if (hour < 7) {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    return { dateStr: `${y}-${m}-${d}`, shift: 'MALAM' };
  }

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  if (hour < 15) return { dateStr: todayStr, shift: 'PAGI' };
  if (hour < 23) return { dateStr: todayStr, shift: 'SORE' };
  return { dateStr: todayStr, shift: 'MALAM' };
}

export function getReportedLog(): Record<string, ReportedLogEntry> {
  try {
    const raw = localStorage.getItem(REPORTED_LOG_KEY);
    if (!raw) return {};
    return sanitizeReportedLogMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

function getPendingDeletes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(REPORTED_PENDING_DELETE_KEY);
    if (!raw) return {};
    return sanitizePendingDeletesMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

function savePendingDeletes(map: Record<string, number>): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const cleaned: Record<string, number> = {};
  Object.entries(map).forEach(([k, ts]) => {
    if (typeof ts === 'number' && ts >= cutoff) {
      cleaned[k] = ts;
    }
  });
  try {
    if (Object.keys(cleaned).length === 0) {
      localStorage.removeItem(REPORTED_PENDING_DELETE_KEY);
    } else {
      localStorage.setItem(REPORTED_PENDING_DELETE_KEY, JSON.stringify(cleaned));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function clearPendingDeleteLocal(dateStr: string, shift: string): void {
  if (!dateStr || !shift) return;
  const pending = getPendingDeletes();
  const key = `${dateStr}_${shift}`;
  if (key in pending) {
    delete pending[key];
    savePendingDeletes(pending);
  }
}

function pruneReportedLog(log: Record<string, ReportedLogEntry>): void {
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  Object.keys(log).forEach((k) => {
    if (log[k] && log[k].ts && log[k].ts < cutoff) {
      delete log[k];
    }
  });
}

function saveReportedLog(log: Record<string, ReportedLogEntry>): void {
  pruneReportedLog(log);
  try {
    localStorage.setItem(REPORTED_LOG_KEY, JSON.stringify(log));
  } catch {
    // Ignore storage quota errors
  }
}

export function markShiftAsReportedLocal(
  dateStr: string,
  shift: string,
  area: string,
  pendingOffline = false
): Record<string, ReportedLogEntry> {
  const log = getReportedLog();
  if (!dateStr || !shift) return log;

  const key = `${dateStr}_${shift}`;
  clearPendingDeleteLocal(dateStr, shift);

  log[key] = {
    area: area || '-',
    ts: Date.now(),
    ...(pendingOffline ? { pendingOffline: true } : {}),
  };

  saveReportedLog(log);
  return log;
}

export function unmarkShiftAsReportedLocal(
  dateStr: string,
  shift: string
): Record<string, ReportedLogEntry> {
  const log = getReportedLog();
  if (!dateStr || !shift) return log;

  const key = `${dateStr}_${shift}`;
  delete log[key];
  saveReportedLog(log);

  const pendingDeletes = getPendingDeletes();
  pendingDeletes[key] = Date.now();
  savePendingDeletes(pendingDeletes);

  return log;
}

export function mergeRemoteReportedLog(
  remoteEntries: Record<string, ReportedLogEntry>,
  isAuthoritativeFromServer = false
): Record<string, ReportedLogEntry> {
  const local = getReportedLog();
  const pendingDeletes = getPendingDeletes();
  let merged: Record<string, ReportedLogEntry>;

  if (isAuthoritativeFromServer) {
    merged = {};
    // Clean up any pending delete keys once the server snapshot confirms absence
    Object.keys(pendingDeletes).forEach((k) => {
      if (!(k in remoteEntries)) {
        delete pendingDeletes[k];
      }
    });
    savePendingDeletes(pendingDeletes);

    // Apply authoritative server records (skipping keys still pending local delete)
    Object.entries(remoteEntries).forEach(([key, entry]) => {
      if (!(key in pendingDeletes)) {
        merged[key] = { area: entry.area, ts: entry.ts };
      }
    });

    // Preserve local-only offline reports that haven't reached server yet
    Object.entries(local).forEach(([key, entry]) => {
      if (entry.pendingOffline && !(key in merged) && !(key in pendingDeletes)) {
        merged[key] = entry;
      }
    });
  } else {
    merged = { ...local };
    Object.entries(remoteEntries).forEach(([key, entry]) => {
      if (key in pendingDeletes) return;
      const existing = merged[key];
      if (!existing || entry.ts >= existing.ts) {
        merged[key] = { area: entry.area, ts: entry.ts };
      }
    });
  }

  saveReportedLog(merged);
  return merged;
}

export const DEFAULT_PREFS: KolaseDraftPrefs = {
  grid: '2x3',
};

export function loadSavedPreferences(): KolaseDraftPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return { ...DEFAULT_PREFS };
    return {
      grid:
        typeof parsed.grid === 'string' &&
        (['2x1', '2x2', '2x3'] as const).includes(parsed.grid as GridType)
          ? (parsed.grid as GridType)
          : DEFAULT_PREFS.grid,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePreferences(prefs: KolaseDraftPrefs): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ grid: prefs.grid }));
  } catch {
    // Ignore storage errors
  }
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
