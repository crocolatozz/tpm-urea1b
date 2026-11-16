import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatDateIndo,
  getAreaForDateAndShift,
  getLocalTodayStr,
  getOperationalShiftInfo,
  type GridType,
  type ReportedLogEntry,
  type ShiftName,
} from '../data/tpmData';
import {
  COLLAGE_PREVIEW_SPEC,
  computeFooterFontCqw,
  copyTextToClipboard,
  disposeSlotCanvases,
  formatFileSizeCompact,
  freeSingleSlot,
  isHeicFile,
  processAndResizeFile,
  renderCollageToCanvas,
  type LoadedPhotoSlot,
} from '../utils/imageCollage';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { ConfirmModal } from './ConfirmModal';
import { PhotoEditorModal } from './PhotoEditorModal';
import {
  IconAlertTriangle,
  IconBroom,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconEditPen,
  IconFileText,
  IconImage,
  IconLock,
  IconMessageSquare,
  IconPlus,
  IconSend,
  IconTrash,
  IconUnlock,
  ReportedBadge,
  ShiftWeatherIcon,
} from './Icons';

export type KolaseToastKind = 'success' | 'warning' | 'error' | 'loading';

interface KolaseViewProps {
  date: string;
  shift: ShiftName;
  area: string;
  selectionKey: number;
  reportedLog: Record<string, ReportedLogEntry>;
  devModeActive?: boolean;
  gridType: GridType;
  beforeSlots: Array<LoadedPhotoSlot | null>;
  afterSlots: Array<LoadedPhotoSlot | null>;
  rowCaptions: [string, string, string];
  onGridTypeChange: React.Dispatch<React.SetStateAction<GridType>>;
  onBeforeSlotsChange: React.Dispatch<React.SetStateAction<Array<LoadedPhotoSlot | null>>>;
  onAfterSlotsChange: React.Dispatch<React.SetStateAction<Array<LoadedPhotoSlot | null>>>;
  onRowCaptionsChange: React.Dispatch<React.SetStateAction<[string, string, string]>>;
  onReportSubmittedStateChange: (submitted: boolean) => void;
  onDateChange: (date: string) => void;
  onShiftChange: (shift: ShiftName) => void;
  onAreaChange: (area: string) => void;
  onReportSubmitted: (dateStr: string, shift: ShiftName, area: string) => Promise<void>;
  onRestoreReport: (
    dateStr: string,
    shift: ShiftName,
    previousEntry: ReportedLogEntry | null
  ) => Promise<void>;
  onShowToast: (message: string, kind?: KolaseToastKind, durationMs?: number) => void;
  onDismissLoadingToast: () => void;
  onDragLockChange?: (locked: boolean) => void;
}

const MAX_CAPTION_LEN = 30;
const TOTAL_SLOT_ROWS = 3;

const ACTIVITY_ROW_CONFIGS = [
  {
    index: 0,
    inputId: 'tpm_r1_f1',
    inputName: 'tpm_r1_f1',
    ariaLabel: 'Kegiatan Baris 1',
    placeholder: 'Misal: Cleaning baseplate',
  },
  {
    index: 1,
    inputId: 'tpm_r2_f2',
    inputName: 'tpm_r2_f2',
    ariaLabel: 'Kegiatan Baris 2',
    placeholder: 'Misal: Cleaning instrumentasi',
  },
  {
    index: 2,
    inputId: 'tpm_r3_f3',
    inputName: 'tpm_r3_f3',
    ariaLabel: 'Kegiatan Baris 3',
    placeholder: 'Misal: Regreasing BV',
  },
] as const;



function getRowsForGrid(grid: GridType): number {
  return parseInt(grid.split('x')[1], 10) || 3;
}

function countValidSlots(slots: Array<LoadedPhotoSlot | null>): number {
  return slots.filter(Boolean).length;
}

interface PostSendModalState {
  dateStr: string;
  shift: ShiftName;
  areaStr: string;
  previousEntry: ReportedLogEntry | null;
  fileSizeBytes: number;
}

type ConfirmDialogType = 'unlock' | 'clear-captions' | 'reset-photos' | null;

interface SlotCoord {
  side: 'before' | 'after';
  index: number;
}

interface ActiveDragState {
  source: SlotCoord;
  previewUrl: string;
  label: string;
  width: number;
  height: number;
  initialX: number;
  initialY: number;
}

export const KolaseView: React.FC<KolaseViewProps> = ({
  date,
  shift,
  area,
  selectionKey,
  reportedLog,
  devModeActive = false,
  gridType,
  beforeSlots,
  afterSlots,
  rowCaptions,
  onGridTypeChange: setGridType,
  onBeforeSlotsChange: setBeforeSlots,
  onAfterSlotsChange: setAfterSlots,
  onRowCaptionsChange: setRowCaptions,
  onReportSubmittedStateChange: setIsReportSubmitted,
  onDateChange,
  onShiftChange,
  onAreaChange,
  onReportSubmitted,
  onRestoreReport,
  onShowToast,
  onDismissLoadingToast,
  onDragLockChange,
}) => {
  // Single source of truth berasal dari App.tsx (sinkron penuh ke UI, filter Tag Equipment, Preview, & Caption WA)
  const tpmDate = date;
  const tpmShift = shift;
  const tpmArea = area;

  // Data Laporan terkunci default & auto-lock saat pindah tab / pilih jadwal baru / kirim WA
  const [isDataLocked, setIsDataLocked] = useState<boolean>(true);
  const [activeConfirm, setActiveConfirm] = useState<ConfirmDialogType>(null);

  const [shiftMenuOpen, setShiftMenuOpen] = useState(false);
  const shiftDropdownRef = useRef<HTMLDivElement | null>(null);

  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const [dragTarget, setDragTarget] = useState<SlotCoord | null>(null);

  const [isPickingFile, setIsPickingFile] = useState(false);
  const [isPickerMulti, setIsPickerMulti] = useState(true);
  const [loadingSlotKeys, setLoadingSlotKeys] = useState<Set<string>>(() => new Set());
  const [editingTarget, setEditingTarget] = useState<{
    side: 'before' | 'after';
    index: number;
  } | null>(null);
  const [postSendModal, setPostSendModal] = useState<PostSendModalState | null>(null);
  const [fontReadyTick, setFontReadyTick] = useState(0);

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimerRef = useRef<number | null>(null);

  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting'>('idle');

  const slotPickerRef = useRef<HTMLInputElement | null>(null);
  const pendingTargetRef = useRef<{
    side: 'before' | 'after';
    index: number;
    mode: 'multi' | 'single';
  } | null>(null);
  const fileQueueRunIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const prevDevModeRef = useRef(devModeActive);

  const slotElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const ghostCardRef = useRef<HTMLDivElement | null>(null);
  const suppressNextClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const dragListenersCleanupRef = useRef<(() => void) | null>(null);
  const dragSessionRef = useRef<{
    phase: 'idle' | 'pending' | 'dragging';
    pointerId: number | null;
    source: SlotCoord | null;
    target: SlotCoord | null;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    slotWidth: number;
    slotHeight: number;
    holdTimerId: number | null;
  }>({
    phase: 'idle',
    pointerId: null,
    source: null,
    target: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    slotWidth: 140,
    slotHeight: 140,
    holdTimerId: null,
  });

  useModalScrollLock(postSendModal !== null);

  const cancelSlotDrag = useCallback(() => {
    const session = dragSessionRef.current;
    if (session.holdTimerId !== null) {
      window.clearTimeout(session.holdTimerId);
      session.holdTimerId = null;
    }
    const wasDragging = session.phase === 'dragging';
    session.phase = 'idle';
    session.pointerId = null;
    session.source = null;
    session.target = null;

    if (dragListenersCleanupRef.current) {
      dragListenersCleanupRef.current();
      dragListenersCleanupRef.current = null;
    }
    if (wasDragging) {
      onDragLockChange?.(false);
    }
    if (isMountedRef.current) {
      setActiveDrag(null);
      setDragTarget(null);
    }
  }, [onDragLockChange]);

  // Pastikan font kustom Barlow Condensed selesai dimuat agar kalkulasi footer Preview 1:1 presisi
  useEffect(() => {
    let active = true;
    if (typeof document !== 'undefined' && document.fonts) {
      void document.fonts
        .load('700 20px "Barlow Condensed"')
        .then(() => document.fonts.ready)
        .then(() => {
          if (active) setFontReadyTick((t) => t + 1);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, []);

  // Auto-lock Data Laporan setiap ada pilihan jadwal baru dari Dashboard/URL
  useEffect(() => {
    setIsDataLocked(true);
    setShiftMenuOpen(false);
    setActiveConfirm(null);
    cancelSlotDrag();
  }, [cancelSlotDrag, selectionKey]);

  // Bersihkan modal transient lokal, antrean foto, & kunci kembali Data Laporan saat keluar dari Developer Mode
  useEffect(() => {
    if (prevDevModeRef.current && !devModeActive) {
      fileQueueRunIdRef.current += 1;
      cancelSlotDrag();
      setLoadingSlotKeys(new Set());
      setIsPickingFile(false);
      setIsDataLocked(true);
      setShiftMenuOpen(false);
      setEditingTarget(null);
      setPostSendModal(null);
      setActiveConfirm(null);
      onDismissLoadingToast();
      if (slotPickerRef.current) slotPickerRef.current.value = '';
    }
    prevDevModeRef.current = devModeActive;
  }, [cancelSlotDrag, devModeActive, onDismissLoadingToast]);

  // Keep refs to slots for async duplicate checks & swaps
  const slotsCleanupRef = useRef<{
    before: Array<LoadedPhotoSlot | null>;
    after: Array<LoadedPhotoSlot | null>;
  }>({ before: [], after: [] });
  slotsCleanupRef.current = { before: beforeSlots, after: afterSlots };

  // Saat unmount (pindah tab), JANGAN mencabut ObjectURL / membuang canvas karena slot dipertahankan di App.tsx
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      fileQueueRunIdRef.current += 1;
      cancelSlotDrag();
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
      }
    };
  }, [cancelSlotDrag]);

  // Tutup custom dropdown Shift saat tap/klik di luar area atau menekan Escape
  useEffect(() => {
    if (!shiftMenuOpen) return;
    const handleOutside = (event: PointerEvent) => {
      if (
        shiftDropdownRef.current &&
        !shiftDropdownRef.current.contains(event.target as Node)
      ) {
        setShiftMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShiftMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [shiftMenuOpen]);

  const rows = getRowsForGrid(gridType);
  const effectiveDate = tpmDate || getLocalTodayStr();
  const isOffDay = parseInt(effectiveDate.split('-')[2] || '', 10) === 31;

  const beforeCountNum = countValidSlots(beforeSlots.slice(0, rows));
  const afterCountNum = countValidSlots(afterSlots.slice(0, rows));
  const hasVisiblePhotos = beforeCountNum > 0 || afterCountNum > 0;
  const hasAnyStoredPhotos =
    countValidSlots(beforeSlots) > 0 || countValidSlots(afterSlots) > 0;
  const hasAnyCaptionText = rowCaptions.some((val) => val.length > 0);

  const captionText = useMemo(() => {
    const dateFormatted = formatDateIndo(effectiveDate);
    const areaName = tpmArea.trim() || '-';
    const lines = [`*TPM ${areaName}*`, `*SHIFT ${tpmShift} ~ ${dateFormatted}*`];

    const bullets: string[] = [];
    for (let i = 0; i < rows; i++) {
      const text = rowCaptions[i]?.trim();
      if (text) {
        bullets.push(`- ${text}`);
      }
    }
    if (bullets.length > 0) {
      lines.push('', ...bullets);
    }
    return lines.join('\n');
  }, [effectiveDate, tpmArea, tpmShift, rowCaptions, rows]);

  const handleLockedFieldTap = () => {
    onShowToast('Data laporan terkunci. Ketuk tombol Locked untuk edit manual', 'warning');
  };

  const handleToggleDataLock = () => {
    if (isDataLocked) {
      setShiftMenuOpen(false);
      setActiveConfirm('unlock');
    } else {
      setShiftMenuOpen(false);
      setIsDataLocked(true);
    }
  };

  const handleConfirmUnlock = () => {
    setActiveConfirm(null);
    setIsDataLocked(false);
  };

  const handleDateChange = (newDate: string) => {
    if (isDataLocked) return;
    const val = newDate || getOperationalShiftInfo().dateStr;
    onDateChange(val);
  };

  const handleShiftChange = (newShift: ShiftName) => {
    if (isDataLocked) return;
    onShiftChange(newShift);
    setShiftMenuOpen(false);
  };

  const handleAreaInputChange = (nextArea: string) => {
    if (isDataLocked) return;
    onAreaChange(nextArea);
  };

  const handleRowCaptionChange = (rowIdx: number, value: string) => {
    const clipped = value.slice(0, MAX_CAPTION_LEN);
    setRowCaptions((prev) => {
      const next: [string, string, string] = [...prev];
      next[rowIdx] = clipped;
      return next;
    });
  };

  // Mode grid hanya mengatur baris yang ditampilkan & dirender (6 slot foto tetap tersimpan permanen)
  const handleGridSelect = (nextGrid: GridType) => {
    if (nextGrid === gridType) return;
    setGridType(nextGrid);
  };

  const triggerSlotPicker = (
    side: 'before' | 'after',
    index: number,
    mode: 'multi' | 'single'
  ) => {
    if (isPickingFile || !slotPickerRef.current) return;
    const allowMulti = mode === 'multi';
    setIsPickerMulti(allowMulti);
    slotPickerRef.current.multiple = allowMulti;
    pendingTargetRef.current = { side, index, mode };
    slotPickerRef.current.click();
  };

  const handleSlotFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    if (isPickingFile) {
      inputEl.value = '';
      return;
    }

    const files = Array.from(inputEl.files || []);
    const target = pendingTargetRef.current;
    pendingTargetRef.current = null;

    if (files.length === 0 || !target) {
      inputEl.value = '';
      return;
    }

    // Tentukan daftar slot target: single (Ganti Foto) vs multi-select (tap slot kosong +)
    let candidateTargets: Array<{ side: 'before' | 'after'; index: number }> = [];
    let filesToProcess: File[] = [];
    let overflowCount = 0;

    if (target.mode === 'single') {
      candidateTargets = [{ side: target.side, index: target.index }];
      filesToProcess = [files[files.length - 1]];
    } else {
      const orderedSlots: Array<{ side: 'before' | 'after'; index: number }> = [];
      for (let rIdx = 0; rIdx < rows; rIdx++) {
        orderedSlots.push({ side: 'before', index: rIdx });
        orderedSlots.push({ side: 'after', index: rIdx });
      }
      const startPos = orderedSlots.findIndex(
        (s) => s.side === target.side && s.index === target.index
      );
      candidateTargets = orderedSlots
        .slice(Math.max(0, startPos))
        .filter((s) => {
          const arr =
            s.side === 'before'
              ? slotsCleanupRef.current.before
              : slotsCleanupRef.current.after;
          return !arr[s.index];
        });

      if (candidateTargets.length === 0) {
        inputEl.value = '';
        onShowToast('Semua sisa slot foto pada layout ini sudah terisi.', 'warning');
        return;
      }

      if (files.length > candidateTargets.length) {
        overflowCount = files.length - candidateTargets.length;
        filesToProcess = files.slice(0, candidateTargets.length);
      } else {
        filesToProcess = files;
      }
    }

    const targetSlots = candidateTargets.slice(0, filesToProcess.length);
    const targetKeys = targetSlots.map((s) => `${s.side}-${s.index}`);
    const hasHeic = filesToProcess.some(isHeicFile);
    const shouldShowQueueToast = filesToProcess.length > 1 || hasHeic;

    const queueRunId = ++fileQueueRunIdRef.current;
    setIsPickingFile(true);
    setLoadingSlotKeys((prev) => {
      const next = new Set(prev);
      targetKeys.forEach((k) => next.add(k));
      return next;
    });

    if (shouldShowQueueToast) {
      onShowToast(`Memproses ${filesToProcess.length} foto, mohon tunggu...`, 'loading');
    }

    let duplicateDetected = false;
    let failedCount = 0;

    // Salinan lokal untuk cek duplikasi akurat selama antrean berurutan berjalan
    const workingBefore = [...slotsCleanupRef.current.before];
    const workingAfter = [...slotsCleanupRef.current.after];

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        if (!isMountedRef.current || queueRunId !== fileQueueRunIdRef.current) {
          break;
        }

        const file = filesToProcess[i];
        const slotTarget = targetSlots[i];
        const slotKey = `${slotTarget.side}-${slotTarget.index}`;

        let processed: LoadedPhotoSlot | null = null;
        try {
          processed = await processAndResizeFile(file);
        } catch {
          processed = null;
        }

        if (isMountedRef.current) {
          setLoadingSlotKeys((prev) => {
            if (!prev.has(slotKey)) return prev;
            const next = new Set(prev);
            next.delete(slotKey);
            return next;
          });
        }

        if (!isMountedRef.current || queueRunId !== fileQueueRunIdRef.current) {
          freeSingleSlot(processed);
          break;
        }

        if (!processed) {
          failedCount += 1;
          const fileLabel = file.name ? `"${file.name}"` : `#${i + 1}`;
          onShowToast(
            `Gagal memuat foto ${fileLabel}. Pastikan format gambar didukung.`,
            'error'
          );
          continue;
        }

        const activeOtherSlots = [
          ...workingBefore
            .slice(0, rows)
            .map((slot, idx) => ({ side: 'before' as const, idx, slot })),
          ...workingAfter
            .slice(0, rows)
            .map((slot, idx) => ({ side: 'after' as const, idx, slot })),
        ];
        const isDuplicateElsewhere = activeOtherSlots.some(
          (item) =>
            !(item.side === slotTarget.side && item.idx === slotTarget.index) &&
            item.slot !== null &&
            item.slot.fileSize !== undefined &&
            item.slot.lastModified !== undefined &&
            item.slot.fileSize === file.size &&
            item.slot.lastModified === file.lastModified
        );
        if (isDuplicateElsewhere) {
          duplicateDetected = true;
        }

        const previousSlot = (
          slotTarget.side === 'before' ? workingBefore : workingAfter
        )[slotTarget.index];

        if (slotTarget.side === 'before') {
          workingBefore[slotTarget.index] = processed;
        } else {
          workingAfter[slotTarget.index] = processed;
        }

        const setSlots = slotTarget.side === 'before' ? setBeforeSlots : setAfterSlots;
        setSlots((prev) => {
          const len = Math.max(TOTAL_SLOT_ROWS, prev.length, slotTarget.index + 1);
          const next = Array.from({ length: len }, (_, idx) => prev[idx] || null);
          next[slotTarget.index] = processed;
          return next;
        });
        disposeSlotCanvases(previousSlot);
        setIsReportSubmitted(false);
      }

      if (isMountedRef.current && queueRunId === fileQueueRunIdRef.current) {
        onDismissLoadingToast();
        if (overflowCount > 0) {
          onShowToast(
            `${overflowCount} foto berlebih diabaikan karena sisa slot pada layout sudah penuh.`,
            'warning',
            4000
          );
        } else if (failedCount === 0 && duplicateDetected && filesToProcess.length === 1) {
          onShowToast('Foto yang sama terdeteksi sudah terpasang di slot lain.', 'warning');
        }
      }
    } finally {
      inputEl.value = '';
      if (isMountedRef.current) {
        setLoadingSlotKeys((prev) => {
          const next = new Set(prev);
          targetKeys.forEach((k) => next.delete(k));
          return next;
        });
        if (queueRunId === fileQueueRunIdRef.current) {
          setIsPickingFile(false);
          onDismissLoadingToast();
        }
      }
    }
  };

  const removeSingleSlot = (side: 'before' | 'after', index: number) => {
    const previousSlot = (
      side === 'before' ? slotsCleanupRef.current.before : slotsCleanupRef.current.after
    )[index];
    const setSlots = side === 'before' ? setBeforeSlots : setAfterSlots;
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    disposeSlotCanvases(previousSlot);
    setIsReportSubmitted(false);
  };

  const swapAnySlots = useCallback(
    (source: SlotCoord, target: SlotCoord) => {
      if (source.side === target.side && source.index === target.index) return;

      const currentBefore = slotsCleanupRef.current.before;
      const currentAfter = slotsCleanupRef.current.after;
      const sourceSlot =
        (source.side === 'before' ? currentBefore : currentAfter)[source.index] || null;
      const targetSlot =
        (target.side === 'before' ? currentBefore : currentAfter)[target.index] || null;

      if (!sourceSlot && !targetSlot) return;

      if (source.side === target.side) {
        const setSlots = source.side === 'before' ? setBeforeSlots : setAfterSlots;
        setSlots((prev) => {
          const len = Math.max(TOTAL_SLOT_ROWS, prev.length, source.index + 1, target.index + 1);
          const next = Array.from({ length: len }, (_, idx) => prev[idx] || null);
          next[source.index] = targetSlot;
          next[target.index] = sourceSlot;
          return next;
        });
      } else {
        const beforeIdx = source.side === 'before' ? source.index : target.index;
        const beforeVal = source.side === 'before' ? targetSlot : sourceSlot;
        const afterIdx = source.side === 'after' ? source.index : target.index;
        const afterVal = source.side === 'after' ? targetSlot : sourceSlot;

        setBeforeSlots((prev) => {
          const len = Math.max(TOTAL_SLOT_ROWS, prev.length, beforeIdx + 1);
          const next = Array.from({ length: len }, (_, idx) => prev[idx] || null);
          next[beforeIdx] = beforeVal;
          return next;
        });
        setAfterSlots((prev) => {
          const len = Math.max(TOTAL_SLOT_ROWS, prev.length, afterIdx + 1);
          const next = Array.from({ length: len }, (_, idx) => prev[idx] || null);
          next[afterIdx] = afterVal;
          return next;
        });
      }

      setIsReportSubmitted(false);
    },
    [setAfterSlots, setBeforeSlots, setIsReportSubmitted]
  );

  const hitTestSlotAtPoint = useCallback(
    (clientX: number, clientY: number, source: SlotCoord | null): SlotCoord | null => {
      for (let rIdx = 0; rIdx < rows; rIdx++) {
        for (const side of ['before', 'after'] as const) {
          const el = slotElementsRef.current.get(`${side}-${rIdx}`);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
          ) {
            if (source && source.side === side && source.index === rIdx) {
              return null;
            }
            return { side, index: rIdx };
          }
        }
      }
      return null;
    },
    [rows]
  );

  const handleSlotPointerDown = useCallback(
    (
      side: 'before' | 'after',
      index: number,
      label: string,
      slot: LoadedPhotoSlot | null,
      e: React.PointerEvent<HTMLDivElement>
    ) => {
      if (!slot || e.button !== 0 || isPickingFile || editingTarget !== null) return;
      if (loadingSlotKeys.has(`${side}-${index}`)) return;

      const slotEl = slotElementsRef.current.get(`${side}-${index}`);
      if (!slotEl) return;

      cancelSlotDrag();

      const rect = slotEl.getBoundingClientRect();
      const session = dragSessionRef.current;
      session.phase = 'pending';
      session.pointerId = e.pointerId;
      session.source = { side, index };
      session.target = null;
      session.startX = e.clientX;
      session.startY = e.clientY;
      session.currentX = e.clientX;
      session.currentY = e.clientY;
      session.slotWidth = rect.width;
      session.slotHeight = rect.height;

      const armClickSuppress = () => {
        suppressNextClickRef.current = true;
        if (suppressClickTimerRef.current !== null) {
          window.clearTimeout(suppressClickTimerRef.current);
        }
        suppressClickTimerRef.current = window.setTimeout(() => {
          suppressNextClickRef.current = false;
          suppressClickTimerRef.current = null;
        }, 120);
      };

      const updatePointerMove = (clientX: number, clientY: number) => {
        session.currentX = clientX;
        session.currentY = clientY;

        if (session.phase === 'pending') {
          const dist = Math.hypot(clientX - session.startX, clientY - session.startY);
          if (dist > 8) {
            cancelSlotDrag();
          }
          return;
        }

        if (session.phase === 'dragging') {
          if (ghostCardRef.current) {
            ghostCardRef.current.style.transform = `translate3d(${clientX - session.slotWidth / 2}px, ${clientY - session.slotHeight / 2}px, 0) scale(1.06)`;
          }
          const nextTarget = hitTestSlotAtPoint(clientX, clientY, session.source);
          const prevTarget = session.target;
          const changed =
            prevTarget?.side !== nextTarget?.side || prevTarget?.index !== nextTarget?.index;
          if (changed) {
            session.target = nextTarget;
            setDragTarget(nextTarget);
          }
        }
      };

      const handlePointerMove = (ev: PointerEvent) => {
        if (ev.pointerId !== session.pointerId) return;
        updatePointerMove(ev.clientX, ev.clientY);
      };

      const handleTouchMove = (ev: TouchEvent) => {
        if (session.phase === 'dragging') {
          ev.preventDefault();
          const t = ev.touches[0];
          if (t) {
            updatePointerMove(t.clientX, t.clientY);
          }
        }
      };

      const handlePointerUp = (ev: PointerEvent) => {
        if (ev.pointerId !== session.pointerId) return;
        const wasDragging = session.phase === 'dragging';
        const src = session.source;
        const finalTarget = wasDragging
          ? hitTestSlotAtPoint(ev.clientX, ev.clientY, src) ?? session.target
          : null;

        if (wasDragging) {
          armClickSuppress();
        }
        cancelSlotDrag();

        if (wasDragging && src && finalTarget) {
          swapAnySlots(src, finalTarget);
        }
      };

      const handlePointerCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== session.pointerId) return;
        if (session.phase === 'dragging') {
          armClickSuppress();
        }
        cancelSlotDrag();
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerCancel);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });

      dragListenersCleanupRef.current = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
        document.removeEventListener('touchmove', handleTouchMove);
      };

      session.holdTimerId = window.setTimeout(() => {
        session.holdTimerId = null;
        if (!isMountedRef.current || session.phase !== 'pending') return;

        session.phase = 'dragging';
        onDragLockChange?.(true);
        try {
          navigator.vibrate?.(12);
        } catch {
          // Ignore vibration errors on unsupported browsers
        }

        setActiveDrag({
          source: { side, index },
          previewUrl: slot.previewUrl || slot.sourceUrl,
          label,
          width: session.slotWidth,
          height: session.slotHeight,
          initialX: session.currentX,
          initialY: session.currentY,
        });
        setDragTarget(null);
      }, 200);
    },
    [
      cancelSlotDrag,
      editingTarget,
      hitTestSlotAtPoint,
      isPickingFile,
      loadingSlotKeys,
      onDragLockChange,
      swapAnySlots,
    ]
  );

  const handleConfirmResetAllPhotos = () => {
    setActiveConfirm(null);
    cancelSlotDrag();
    fileQueueRunIdRef.current += 1;
    setLoadingSlotKeys(new Set());
    setIsPickingFile(false);
    const prevBefore = beforeSlots;
    const prevAfter = afterSlots;
    setBeforeSlots([]);
    setAfterSlots([]);
    prevBefore.forEach(disposeSlotCanvases);
    prevAfter.forEach(disposeSlotCanvases);
    setIsReportSubmitted(false);
    onDismissLoadingToast();
    setEditingTarget(null);
    if (slotPickerRef.current) slotPickerRef.current.value = '';
    onShowToast('Semua foto kolase berhasil direset.', 'success', 2200);
  };

  const handleSaveEditedSlot = (updatedSlot: LoadedPhotoSlot) => {
    if (!editingTarget) return;
    const setSlots = editingTarget.side === 'before' ? setBeforeSlots : setAfterSlots;
    setSlots((prev) => {
      const next = [...prev];
      next[editingTarget.index] = updatedSlot;
      return next;
    });
    setIsReportSubmitted(false);
    setEditingTarget(null);
  };

  const handleReplaceEditedPhoto = () => {
    if (!editingTarget) return;
    const { side, index } = editingTarget;
    triggerSlotPicker(side, index, 'single');
    setEditingTarget(null);
  };

  const handleConfirmClearCaptions = () => {
    setActiveConfirm(null);
    setRowCaptions(['', '', '']);
    onShowToast('Keterangan kegiatan berhasil dikosongkan.', 'success', 2200);
  };

  const handleCopyCaption = async () => {
    const copied = await copyTextToClipboard(captionText);
    if (!isMountedRef.current) return;
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    if (copied) {
      setCopyStatus('copied');
      onShowToast('Caption WhatsApp berhasil disalin.', 'success', 2000);
      copyTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) setCopyStatus('idle');
        copyTimerRef.current = null;
      }, 2000);
    } else {
      setCopyStatus('error');
      onShowToast('Gagal menyalin caption ke clipboard.', 'error', 3000);
      copyTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) setCopyStatus('idle');
        copyTimerRef.current = null;
      }, 2500);
    }
  };

  const triggerPostSendConfirmation = useCallback(
    (
      dateStr: string,
      shiftName: ShiftName,
      areaStr: string,
      previousEntry: ReportedLogEntry | null,
      fileSizeBytes: number
    ) => {
      // Optimistic status update langsung ke state & Firestore tanpa menunggu visibilitychange
      void onReportSubmitted(dateStr, shiftName, areaStr);
      if (isMountedRef.current) {
        setIsReportSubmitted(true);
        setExportStatus('idle');
        setPostSendModal({
          dateStr,
          shift: shiftName,
          areaStr,
          previousEntry,
          fileSizeBytes,
        });
      }
    },
    [onReportSubmitted, setIsReportSubmitted]
  );

  const handleConfirmPostSend = () => {
    setPostSendModal(null);
    fileQueueRunIdRef.current += 1;
    setLoadingSlotKeys(new Set());
    setIsPickingFile(false);
    const prevBefore = beforeSlots;
    const prevAfter = afterSlots;
    setBeforeSlots([]);
    setAfterSlots([]);
    prevBefore.forEach(disposeSlotCanvases);
    prevAfter.forEach(disposeSlotCanvases);
    setRowCaptions(['', '', '']);
    setEditingTarget(null);
    onDismissLoadingToast();
    setIsReportSubmitted(true);
    if (slotPickerRef.current) slotPickerRef.current.value = '';
    // tpmArea (Tag Equipment) dipertahankan!
  };

  const handleCancelPostSend = () => {
    if (!postSendModal) return;
    const { dateStr, shift: modalShift, previousEntry } = postSendModal;
    setPostSendModal(null);
    setIsReportSubmitted(false);
    void onRestoreReport(dateStr, modalShift, previousEntry);
  };

  const handleExportCollage = async () => {
    if (!hasVisiblePhotos || exportStatus === 'exporting') return;

    // Validasi wajib minimal 1 baris keterangan kegiatan aktif terisi
    const activeActivities = rowCaptions.slice(0, rows);
    const hasActivityNote = activeActivities.some((val) => val.trim().length > 0);
    if (!hasActivityNote) {
      onShowToast('Isi minimal 1 baris keterangan kegiatan dulu', 'warning');
      return;
    }

    // Auto-lock Data Laporan setelah menekan Kirim ke WhatsApp
    setIsDataLocked(true);
    setShiftMenuOpen(false);
    setExportStatus('exporting');

    const currentAreaStr = tpmArea.trim() || 'TPM';
    const previousEntry = reportedLog[`${effectiveDate}_${tpmShift}`] ?? null;

    // Auto-tandai jadwal terlapor saat Kirim ke WhatsApp ditekan jika tag equipment & shift cocok dengan jadwal hari aktif
    const opInfo = getOperationalShiftInfo();
    const normTag = tpmArea.trim().toUpperCase();
    const normShift = tpmShift.trim().toUpperCase() as ShiftName;
    if (
      effectiveDate === opInfo.dateStr &&
      (['PAGI', 'SORE', 'MALAM'] as const).includes(normShift)
    ) {
      const scheduledTag = getAreaForDateAndShift(opInfo.dateStr, normShift)
        .trim()
        .toUpperCase();
      if (scheduledTag && scheduledTag !== 'TIDAK ADA KEGIATAN' && normTag === scheduledTag) {
        void onReportSubmitted(opInfo.dateStr, normShift, currentAreaStr);
        onShowToast('Jadwal otomatis ditandai', 'success', 2600);
      }
    }

    const exportCanvas = document.createElement('canvas');
    try {
      // Pastikan font kustom termuat sebelum merender kanvas ekspor
      if (typeof document !== 'undefined' && document.fonts?.load) {
        await Promise.all([
          document.fonts.load('700 20px "Rajdhani"'),
          document.fonts.load('700 20px "Barlow Condensed"'),
        ]).catch(() => {});
      }

      if (!isMountedRef.current) {
        exportCanvas.width = 0;
        exportCanvas.height = 0;
        return;
      }

      const rendered = renderCollageToCanvas(exportCanvas, {
        rows,
        beforeSlots,
        afterSlots,
        rowTexts: activeActivities,
        areaName: tpmArea,
        shiftName: tpmShift,
        dateStr: effectiveDate,
      });

      if (!rendered) {
        exportCanvas.width = 0;
        exportCanvas.height = 0;
        setExportStatus('idle');
        onShowToast('Gagal merender kanvas kolase.', 'error');
        return;
      }

      exportCanvas.toBlob(
        async (blob) => {
          exportCanvas.width = 0;
          exportCanvas.height = 0;

          try {
            if (!blob) {
              if (isMountedRef.current) {
                setExportStatus('idle');
                onShowToast('Gagal menghasilkan file gambar kolase JPEG.', 'error');
              }
              return;
            }

            const areaNameClean = currentAreaStr.replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `Kolase_${areaNameClean}_${Date.now()}.jpg`;
            const file = new File([blob], filename, { type: 'image/jpeg' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: `TPM ${currentAreaStr}`,
                  text: captionText,
                });
                triggerPostSendConfirmation(
                  effectiveDate,
                  tpmShift,
                  currentAreaStr,
                  previousEntry,
                  blob.size
                );
                return;
              } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                  // Dibatalkan langsung di Share Sheet -> jangan reset form & pulihkan status bila baru ditandai
                  if (isMountedRef.current) {
                    setExportStatus('idle');
                    void onRestoreReport(effectiveDate, tpmShift, previousEntry);
                  }
                  return;
                }
              }
            }

            // Fallback PC/Desktop: Unduh JPG + salin caption ke clipboard
            await copyTextToClipboard(captionText);
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

            triggerPostSendConfirmation(
              effectiveDate,
              tpmShift,
              currentAreaStr,
              previousEntry,
              blob.size
            );
          } catch {
            if (isMountedRef.current) {
              setExportStatus('idle');
              onShowToast('Gagal membagikan atau mengunduh kolase.', 'error');
            }
          }
        },
        'image/jpeg',
        0.95
      );
    } catch {
      exportCanvas.width = 0;
      exportCanvas.height = 0;
      if (isMountedRef.current) {
        setExportStatus('idle');
        onShowToast('Terjadi kesalahan saat memproses ekspor kolase.', 'error');
      }
    }
  };

  const editingSlot =
    editingTarget !== null
      ? (editingTarget.side === 'before' ? beforeSlots : afterSlots)[editingTarget.index] || null
      : null;

  const editingSlotLabel =
    editingTarget !== null
      ? `${editingTarget.side === 'before' ? 'Before' : 'After'} ${editingTarget.index + 1}`
      : '';

  const displayAreaStamp = tpmArea.trim() || '-';
  const footerPreviewText = `TPM ${displayAreaStamp}   •   SHIFT ${tpmShift}   •   ${formatDateIndo(effectiveDate)}`;
  const footerFontCqw = useMemo(
    () => computeFooterFontCqw(footerPreviewText),
    [footerPreviewText, fontReadyTick]
  );

  const renderCounterBadge = (len: number) => {
    const colorClass =
      len >= MAX_CAPTION_LEN
        ? 'text-rose-400'
        : len >= MAX_CAPTION_LEN - 3
          ? 'text-amber-400'
          : 'text-slate-400';

    return (
      <span
        className={`pointer-events-none absolute right-3 text-xs font-semibold tabular-nums ${colorClass}`}
      >
        {len}/{MAX_CAPTION_LEN}
      </span>
    );
  };

  return (
    <>
      <div className="mb-2 flex w-full flex-col gap-4 overflow-x-clip rounded-xl border border-slate-800 bg-slate-900 p-3.5 shadow-[0_4px_16px_rgba(2,6,23,0.5)] sm:p-5">
        {/* File Picker: multiple otomatis pada slot kosong (+), single pada Ganti Foto */}
        <input
          ref={slotPickerRef}
          type="file"
          accept="image/*"
          multiple={isPickerMulti}
          onChange={handleSlotFileChange}
          className="hidden"
        />

        {/* Bagian 1: Header Pengunci Data Laporan + Kontrol Tanggal, Shift, & Tag Equipment */}
        <div className="flex w-full flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-[15px] font-bold text-white sm:text-base">
              <IconFileText className="h-5 w-5 text-sky-400" /> Data Laporan
            </span>

            <button
              type="button"
              onClick={handleToggleDataLock}
              aria-label={isDataLocked ? 'Buka kunci Data Laporan' : 'Kunci Data Laporan'}
              className={`inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition active:scale-95 ${
                isDataLocked
                  ? 'border-slate-700 bg-slate-800 text-sky-300 hover:border-slate-600'
                  : 'border-amber-400/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
              }`}
            >
              {isDataLocked ? (
                <>
                  <IconLock className="h-5 w-5 text-sky-400" />
                  <span>Locked</span>
                </>
              ) : (
                <>
                  <IconUnlock className="h-5 w-5 text-amber-300" />
                  <span>Unlocked</span>
                </>
              )}
            </button>
          </div>

          <div className="grid w-full grid-cols-2 gap-2">
            {/* Tanggal */}
            <div className="flex min-w-0 flex-col gap-1">
              <label
                htmlFor="tpm_d_f2"
                className="text-[13px] font-semibold text-slate-200"
              >
                Tanggal
              </label>
              <div
                className={`relative flex h-[42px] min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 ${
                  isDataLocked ? 'opacity-80' : ''
                }`}
              >
                <IconCalendar className="h-4 w-4 shrink-0 text-sky-400" />
                <span className="pointer-events-none whitespace-nowrap text-[16px] font-semibold tabular-nums text-white">
                  {formatDateIndo(effectiveDate)}
                </span>
                <input
                  type="date"
                  id="tpm_d_f2"
                  name="tpm_d_f2"
                  aria-label="Tanggal"
                  autoComplete="off"
                  data-form-type="other"
                  data-lpignore="true"
                  disabled={isDataLocked}
                  value={effectiveDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  onClick={(e) => {
                    if (isDataLocked) return;
                    try {
                      e.currentTarget.showPicker?.();
                    } catch {
                      // Ignore on browsers without showPicker
                    }
                  }}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                {isDataLocked && (
                  <button
                    type="button"
                    aria-label="Tanggal terkunci"
                    onClick={handleLockedFieldTap}
                    className="absolute inset-0 z-20 cursor-not-allowed rounded-lg bg-transparent"
                  />
                )}
              </div>
            </div>

            {/* Custom Dropdown Shift */}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[13px] font-semibold text-slate-200">Shift</span>
              <div ref={shiftDropdownRef} className="relative flex h-[42px] min-w-0 items-center">
                <button
                  type="button"
                  id="tpm_s_f1"
                  aria-label="Shift"
                  aria-haspopup="listbox"
                  aria-expanded={shiftMenuOpen}
                  onClick={() => {
                    if (isDataLocked) {
                      handleLockedFieldTap();
                      return;
                    }
                    setShiftMenuOpen((prev) => !prev);
                  }}
                  className={`relative flex h-[42px] w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-8 text-[16px] font-semibold text-white transition ${
                    isDataLocked
                      ? 'cursor-not-allowed opacity-80'
                      : 'cursor-pointer hover:border-slate-600 active:scale-[0.99]'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ShiftWeatherIcon shift={tpmShift} className="h-4 w-4" />
                    <span>{tpmShift}</span>
                  </span>
                  <IconChevronDown
                    className={`pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400 transition-transform duration-150 ${
                      shiftMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {shiftMenuOpen && !isDataLocked && (
                  <div
                    role="listbox"
                    aria-label="Pilih Shift"
                    className="modal-pop absolute top-[calc(100%+6px)] right-0 left-0 z-30 overflow-hidden rounded-lg border border-slate-600 bg-slate-800 py-1 shadow-[0_10px_28px_rgba(2,6,23,0.85)]"
                  >
                    {(['PAGI', 'SORE', 'MALAM'] as const).map((optShift) => {
                      const selected = tpmShift === optShift;
                      return (
                        <button
                          key={optShift}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => handleShiftChange(optShift)}
                          className={`flex w-full cursor-pointer items-center justify-center gap-1.5 px-3 py-2.5 text-[16px] font-semibold transition ${
                            selected
                              ? 'bg-sky-950/70 text-sky-300'
                              : 'text-white hover:bg-slate-700'
                          }`}
                        >
                          <ShiftWeatherIcon shift={optShift} className="h-4 w-4" />
                          <span>{optShift}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Input Tag Equipment Full-Width (Rajdhani saat terisi, Plus Jakarta placeholder) */}
          <div className="flex w-full flex-col gap-1">
            <label htmlFor="tpm_t_f1" className="text-[13px] font-semibold text-slate-200">
              Tag Equipment / Area
            </label>
            <div className="relative w-full">
              <input
                type="text"
                id="tpm_t_f1"
                name="tpm_t_f1"
                aria-label="Area / Equipment TPM"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
                readOnly={isDataLocked}
                value={tpmArea}
                onChange={(e) => handleAreaInputChange(e.target.value)}
                placeholder="Misal: GA101A, FLARE..."
                className={`tpm-input font-equipment min-h-[42px]! w-full py-1.5! text-center text-xl! font-bold tracking-wider text-white placeholder:font-sans placeholder:text-base! placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 placeholder:normal-case ${
                  isDataLocked ? 'cursor-not-allowed opacity-80' : ''
                }`}
              />
              {isDataLocked && (
                <button
                  type="button"
                  aria-label="Tag Equipment terkunci"
                  onClick={handleLockedFieldTap}
                  className="absolute inset-0 z-10 cursor-not-allowed rounded-lg bg-transparent"
                />
              )}
            </div>
          </div>

          {isOffDay && (
            <span className="inline-flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-amber-300">
              <IconAlertTriangle className="h-4 w-4 text-amber-400" /> Tanggal 31 jadwal rutin libur TPM
            </span>
          )}
        </div>

        {/* Bagian 2: Live Preview Grid 1:1 dengan Canvas Ekspor + Selector 2x1 | 2x2 | 2x3 */}
        <div className="flex w-full flex-col gap-2.5 border-t border-slate-800 pt-3.5">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[15px] font-bold text-white sm:text-base">
              <IconImage className="h-5 w-5 text-sky-400" /> Preview
            </span>

            <div
              role="group"
              aria-label="Ukuran Grid Kolase"
              className="flex h-[34px] shrink-0 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5"
            >
              {(['2x1', '2x2', '2x3'] as const).map((grid) => {
                const active = gridType === grid;
                return (
                  <button
                    key={grid}
                    type="button"
                    onClick={() => handleGridSelect(grid)}
                    className={`h-full cursor-pointer rounded-md px-2.5 text-xs font-bold transition active:scale-95 ${
                      active
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-transparent text-slate-300 hover:text-white'
                    }`}
                  >
                    {grid}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frame Kolase Live Preview 1:1 (Deep Slate #0F172A, Barlow Condensed 700 Monokrom Putih) */}
          <div
            className="w-full max-w-full overflow-hidden rounded-xl border border-slate-700/80 bg-[#0F172A] [container-type:inline-size]"
            style={{ padding: COLLAGE_PREVIEW_SPEC.paddingCqw }}
          >
            {/* 1. Header Kolom: BEFORE | AFTER (Barlow Condensed 700, Monokrom Putih #FFFFFF, 7.4cqw) */}
            <div
              className="grid w-full grid-cols-2 items-center text-center"
              style={{
                marginTop: COLLAGE_PREVIEW_SPEC.subHeaderTopGapCqw,
                height: COLLAGE_PREVIEW_SPEC.subHeaderHeightCqw,
                marginBottom: COLLAGE_PREVIEW_SPEC.subHeaderBottomGapCqw,
                gap: COLLAGE_PREVIEW_SPEC.gapCqw,
              }}
            >
              <span
                className="font-collage truncate font-bold tracking-[0.05em] text-white"
                style={{ fontSize: COLLAGE_PREVIEW_SPEC.subHeaderFontCqw, lineHeight: 1.15 }}
              >
                BEFORE
              </span>
              <span
                className="font-collage truncate font-bold tracking-[0.05em] text-white"
                style={{ fontSize: COLLAGE_PREVIEW_SPEC.subHeaderFontCqw, lineHeight: 1.15 }}
              >
                AFTER
              </span>
            </div>

            {/* 2. Grid Baris 1..N (Sudut 8px, Kapsul bawah-tengah, Drag-and-Drop antar-slot) */}
            <div className="flex w-full flex-col" style={{ gap: COLLAGE_PREVIEW_SPEC.gapCqw }}>
              {Array.from({ length: rows }).map((_, r) => {
                const rowOverlayText = rowCaptions[r]?.trim();
                const cells = [
                  {
                    side: 'before' as const,
                    label: `Before ${r + 1}`,
                    slot: beforeSlots[r] || null,
                  },
                  {
                    side: 'after' as const,
                    label: `After ${r + 1}`,
                    slot: afterSlots[r] || null,
                  },
                ];

                return (
                  <div
                    key={r}
                    className="relative grid w-full min-w-0 grid-cols-2"
                    style={{ gap: COLLAGE_PREVIEW_SPEC.gapCqw }}
                  >
                    {cells.map((cell) => {
                      const slotNumber = r * 2 + (cell.side === 'before' ? 1 : 2);
                      const cellKey = `${cell.side}-${r}`;
                      const isSlotLoading = loadingSlotKeys.has(cellKey);
                      const isDragSource =
                        activeDrag?.source.side === cell.side && activeDrag.source.index === r;
                      const isDropTarget =
                        dragTarget?.side === cell.side && dragTarget.index === r;

                      return (
                        <div
                          key={cell.side}
                          ref={(el) => {
                            if (el) {
                              slotElementsRef.current.set(cellKey, el);
                            } else {
                              slotElementsRef.current.delete(cellKey);
                            }
                          }}
                          onPointerDown={(e) =>
                            handleSlotPointerDown(cell.side, r, cell.label, cell.slot, e)
                          }
                          onContextMenu={(e) => {
                            if (cell.slot) e.preventDefault();
                          }}
                          className={`@container relative aspect-square w-full min-w-0 select-none overflow-hidden rounded-[8px] bg-slate-800 transition-all duration-150 ${
                            isDragSource
                              ? 'scale-[0.96] opacity-35 ring-2 ring-dashed ring-sky-400/50'
                              : isDropTarget
                                ? 'z-20 scale-[1.02] ring-2 ring-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.45)]'
                                : ''
                          }`}
                        >
                          {cell.slot ? (
                            <div className="relative h-full w-full overflow-hidden rounded-[8px] [-webkit-touch-callout:none]">
                              {cell.slot.previewUrl ? (
                                <img
                                  src={cell.slot.previewUrl}
                                  alt={cell.label}
                                  draggable={false}
                                  onDragStart={(e) => e.preventDefault()}
                                  onContextMenu={(e) => e.preventDefault()}
                                  onClick={() => {
                                    if (
                                      suppressNextClickRef.current ||
                                      dragSessionRef.current.phase === 'dragging'
                                    ) {
                                      return;
                                    }
                                    setEditingTarget({ side: cell.side, index: r });
                                  }}
                                  className="h-full w-full cursor-pointer select-none object-cover [-webkit-touch-callout:none]"
                                />
                              ) : (
                                <div
                                  onClick={() => {
                                    if (
                                      suppressNextClickRef.current ||
                                      dragSessionRef.current.phase === 'dragging'
                                    ) {
                                      return;
                                    }
                                    setEditingTarget({ side: cell.side, index: r });
                                  }}
                                  className="flex h-full w-full cursor-pointer items-center justify-center bg-slate-800 text-xs font-semibold text-slate-300"
                                >
                                  {cell.label}
                                </div>
                              )}

                              {isDropTarget && (
                                <div className="pointer-events-none absolute inset-0 z-10 bg-cyan-400/15" />
                              )}

                              {isSlotLoading && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/65 backdrop-blur-[1px]">
                                  <span className="spinner h-6 w-6 border-sky-400/30! border-t-sky-400!" />
                                </div>
                              )}

                              {/* Tombol Hapus Bulat Frosted Deep Slate dengan Ikon Tempat Sampah Mini */}
                              <button
                                type="button"
                                aria-label={`Hapus ${cell.label}`}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSingleSlot(cell.side, r);
                                }}
                                className="absolute top-1.5 right-1.5 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-600/80 bg-slate-900/85 backdrop-blur-sm transition hover:border-rose-400/70 hover:bg-rose-950/90 active:scale-90"
                              >
                                <IconTrash className="h-3.5 w-3.5 text-rose-300" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isSlotLoading}
                              aria-label={`Tambah foto ${cell.label} (Slot ${slotNumber})`}
                              onClick={() => {
                                if (
                                  suppressNextClickRef.current ||
                                  dragSessionRef.current.phase === 'dragging'
                                ) {
                                  return;
                                }
                                triggerSlotPicker(cell.side, r, 'multi');
                              }}
                              className={`relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-[8px] border border-dashed p-2 transition hover:border-sky-500/60 active:border-sky-400 active:bg-sky-950/50 disabled:cursor-wait ${
                                isDropTarget
                                  ? 'border-cyan-400 bg-sky-950/55'
                                  : 'border-slate-700/80 bg-slate-900/90'
                              }`}
                            >
                              {isSlotLoading ? (
                                <span className="spinner relative z-10 h-6 w-6 border-sky-400/30! border-t-sky-400!" />
                              ) : (
                                <>
                                  <span
                                    aria-hidden="true"
                                    className="font-collage pointer-events-none absolute inset-0 flex select-none items-center justify-center text-[62cqw] font-bold leading-none text-white/[0.06]"
                                  >
                                    {slotNumber}
                                  </span>
                                  <IconPlus className="relative z-10 h-6 w-6 text-sky-400" />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Kapsul Keterangan Tengah Tiap Baris (Barlow Condensed 700, Monokrom Putih #FFFFFF, 4.9cqw, maks 85%) */}
                    {rowOverlayText && (
                      <div className="pointer-events-none absolute bottom-2.5 left-1/2 z-10 flex max-w-[85%] -translate-x-1/2 justify-center">
                        <span
                          className="font-collage max-w-full truncate whitespace-nowrap rounded-full border border-slate-400/45 bg-[#0F172A] font-bold text-white shadow-sm"
                          style={{
                            fontSize: COLLAGE_PREVIEW_SPEC.pillFontCqw,
                            lineHeight: 1.18,
                            paddingLeft: COLLAGE_PREVIEW_SPEC.pillPadXCqw,
                            paddingRight: COLLAGE_PREVIEW_SPEC.pillPadXCqw,
                            paddingTop: COLLAGE_PREVIEW_SPEC.pillPadYCqw,
                            paddingBottom: COLLAGE_PREVIEW_SPEC.pillPadYCqw,
                          }}
                        >
                          {rowOverlayText}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 3. Footer 1 Baris Terpusat: TPM [TAG]   •   SHIFT   •   TANGGAL (Auto-scale 1:1 dengan ekspor JPEG, tanpa elipsis) */}
            <div
              className="flex w-full items-center justify-center px-1 text-center"
              style={{
                marginTop: COLLAGE_PREVIEW_SPEC.footerTopGapCqw,
                height: COLLAGE_PREVIEW_SPEC.footerHeightCqw,
              }}
            >
              <div
                className="font-collage max-w-[90%] whitespace-pre! font-bold leading-[1.2] text-white"
                style={{ fontSize: footerFontCqw }}
              >
                {footerPreviewText}
              </div>
            </div>
          </div>

          {hasAnyStoredPhotos && (
            <button
              type="button"
              onClick={() => setActiveConfirm('reset-photos')}
              className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-[14px] font-semibold text-rose-300 transition hover:bg-rose-500/25 active:scale-[0.98]"
            >
              <IconTrash className="h-4 w-4" /> Reset Semua Foto
            </button>
          )}
        </div>

        {/* Bagian 3: Keterangan Kegiatan Dinamis, Pratinjau Caption & Tombol Kirim ke WhatsApp */}
        <div className="flex w-full flex-col gap-3 border-t border-slate-800 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-[15px] font-bold text-white sm:text-base">
              <IconEditPen className="h-5 w-5 text-sky-400" /> Keterangan Kegiatan
            </span>
            <button
              type="button"
              disabled={!hasAnyCaptionText}
              onClick={() => setActiveConfirm('clear-captions')}
              aria-label="Bersihkan Keterangan"
              title="Bersihkan Keterangan"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-300 transition hover:bg-rose-500/25 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconBroom className="h-4 w-4" />
            </button>
          </div>

          <div className="flex w-full flex-col gap-2">
            {ACTIVITY_ROW_CONFIGS.slice(0, rows).map((cfg) => {
              const val = rowCaptions[cfg.index];
              return (
                <div key={cfg.inputId} className="relative flex w-full items-center">
                  <input
                    type="text"
                    id={cfg.inputId}
                    name={cfg.inputName}
                    aria-label={cfg.ariaLabel}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-form-type="other"
                    data-lpignore="true"
                    maxLength={MAX_CAPTION_LEN}
                    value={val}
                    onChange={(e) => handleRowCaptionChange(cfg.index, e.target.value)}
                    placeholder={cfg.placeholder}
                    className="tpm-input pr-14! font-semibold text-white placeholder:font-normal placeholder:text-slate-400 placeholder:normal-case"
                  />
                  {renderCounterBadge(val.length)}
                </div>
              );
            })}
          </div>

          {/* Pratinjau Caption WhatsApp */}
          <div className="flex w-full min-w-0 flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[15px] font-bold text-white sm:text-base">
                <IconMessageSquare className="h-5 w-5 text-sky-400" /> Caption WhatsApp
              </span>
              <button
                type="button"
                onClick={handleCopyCaption}
                aria-label="Salin Caption"
                title="Salin Caption"
                className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border transition active:scale-90 ${
                  copyStatus === 'copied'
                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-400'
                    : 'border-slate-600 bg-slate-800/90 text-slate-200 hover:border-slate-500'
                }`}
              >
                {copyStatus === 'copied' ? (
                  <IconCheck className="h-4 w-4 text-emerald-400" />
                ) : (
                  <IconCopy className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="w-full whitespace-pre-wrap break-words rounded-lg border border-slate-700 bg-slate-800/80 p-3 font-mono text-[13px] text-emerald-300">
              {captionText}
            </div>
          </div>

          {/* Tombol Utama "Kirim ke WhatsApp" (Emerald konsisten dengan tombol aksi utama) */}
          <button
            type="button"
            disabled={!hasVisiblePhotos || exportStatus === 'exporting'}
            onClick={() => void handleExportCollage()}
            className="mt-0.5 inline-flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-emerald-600 px-5 py-3.5 text-base font-extrabold text-white shadow-[0_4px_14px_rgba(16,185,129,0.28)] transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            {exportStatus === 'exporting' ? (
              <>
                <span className="spinner border-white/30! border-t-white!" /> Menyiapkan
                gambar...
              </>
            ) : (
              <>
                <IconSend className="h-5 w-5" /> Kirim ke WhatsApp
              </>
            )}
          </button>
        </div>
      </div>

      <PhotoEditorModal
        isOpen={editingTarget !== null && editingSlot !== null}
        slotLabel={editingSlotLabel}
        slot={editingSlot}
        onSave={handleSaveEditedSlot}
        onReplacePhoto={handleReplaceEditedPhoto}
        onCancel={() => setEditingTarget(null)}
        onError={(msg) => onShowToast(msg, 'error')}
      />

      {/* Modal Konfirmasi Buka Kunci Data Laporan */}
      <ConfirmModal
        isOpen={activeConfirm === 'unlock'}
        titleId="unlock-data-title"
        title={
          <>
            <IconUnlock className="h-5 w-5 text-amber-400" /> Buka Kunci Data Laporan?
          </>
        }
        titleToneClass="text-amber-300"
        confirmLabel="Buka Kunci"
        confirmTone="sky"
        onConfirm={handleConfirmUnlock}
        onCancel={() => setActiveConfirm(null)}
      >
        <p className="mb-2 text-[14px] leading-[1.5] text-slate-300">
          Membuka kunci (<strong className="text-white">Locked → Unlocked</strong>) akan
          mengaktifkan mode input manual untuk mengubah Tanggal, Shift, atau Tag Equipment.
        </p>
        <p className="mb-4 text-xs leading-[1.45] text-slate-400">
          Catatan: Data akan otomatis terkunci kembali saat memilih jadwal baru, berpindah tab, atau
          menekan Kirim ke WhatsApp.
        </p>
      </ConfirmModal>

      {/* Modal Konfirmasi Bersihkan Keterangan */}
      <ConfirmModal
        isOpen={activeConfirm === 'clear-captions'}
        titleId="clear-caption-title"
        title={
          <>
            <IconBroom className="h-5 w-5 text-rose-400" /> Bersihkan Keterangan?
          </>
        }
        titleToneClass="text-rose-300"
        confirmLabel="Ya, Bersihkan"
        confirmTone="rose"
        onConfirm={handleConfirmClearCaptions}
        onCancel={() => setActiveConfirm(null)}
      >
        <p className="mb-4 text-[14px] leading-[1.5] text-slate-300">
          Semua teks di kolom <strong className="text-white">Keterangan Kegiatan</strong> akan
          dikosongkan. Lanjutkan?
        </p>
      </ConfirmModal>

      {/* Modal Konfirmasi Reset Semua Foto */}
      <ConfirmModal
        isOpen={activeConfirm === 'reset-photos'}
        titleId="reset-photos-title"
        title={
          <>
            <IconTrash className="h-5 w-5 text-rose-400" /> Reset Semua Foto?
          </>
        }
        titleToneClass="text-rose-300"
        confirmLabel="Ya, Reset Foto"
        confirmTone="rose"
        onConfirm={handleConfirmResetAllPhotos}
        onCancel={() => setActiveConfirm(null)}
      >
        <p className="mb-4 text-[14px] leading-[1.5] text-slate-300">
          Seluruh foto Before &amp; After yang sudah terpasang di grid akan dihapus. Lanjutkan?
        </p>
      </ConfirmModal>

      {/* Modal Konfirmasi Pasca-Kirim WA (Terkunci / No Backdrop Dismiss) */}
      {postSendModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-send-title"
          className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overscroll-contain bg-slate-950/84 p-4 backdrop-blur-[4px]"
        >
          <div className="modal-pop w-full max-w-[390px] overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_12px_34px_rgba(2,6,23,0.8)]">
            <h3
              id="post-send-title"
              className="mb-2 flex items-center gap-2 text-base font-bold text-emerald-400"
            >
              <IconCheck className="h-5 w-5" /> Kolase TPM Berhasil Dibuat!
            </h3>
            <p className="mb-3.5 text-[14px] leading-[1.5] text-slate-300">
              Pertahankan status alat{' '}
              <strong className="inline-flex items-center gap-1 text-sky-300">
                <ReportedBadge size="sm" /> Terlapor
              </strong>{' '}
              &amp; bersihkan foto serta keterangan form?
            </p>
            <div className="mb-4 rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2 font-bold tabular-nums text-sky-300">
                <span className="inline-flex items-center gap-1.5">
                  <ShiftWeatherIcon shift={postSendModal.shift} className="h-3.5 w-3.5" />
                  <span>
                    {postSendModal.shift} • {formatDateIndo(postSendModal.dateStr)}
                  </span>
                </span>
                <span className="rounded-md border border-emerald-500/35 bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-300">
                  {formatFileSizeCompact(postSendModal.fileSizeBytes)}
                </span>
              </div>
              <div className="font-equipment mt-1 truncate text-[15px] font-bold text-white">
                {postSendModal.areaStr}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCancelPostSend}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmPostSend}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-emerald-600 px-3 py-2.5 text-[14px] font-extrabold text-white transition hover:bg-emerald-500 active:scale-[0.98]"
              >
                Ya, Update
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Pratinjau Kartu Melayang saat Drag-and-Drop Slot Foto */}
      {activeDrag && (
        <div
          ref={ghostCardRef}
          aria-hidden="true"
          style={{
            width: `${activeDrag.width}px`,
            height: `${activeDrag.height}px`,
            transform: `translate3d(${activeDrag.initialX - activeDrag.width / 2}px, ${activeDrag.initialY - activeDrag.height / 2}px, 0) scale(1.06)`,
          }}
          className="pointer-events-none fixed top-0 left-0 z-[9990] overflow-hidden rounded-[8px] bg-slate-900 shadow-[0_18px_38px_rgba(2,6,23,0.88)] ring-2 ring-cyan-400"
        >
          {activeDrag.previewUrl ? (
            <img
              src={activeDrag.previewUrl}
              alt={activeDrag.label}
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-800 text-xs font-bold text-white">
              {activeDrag.label}
            </div>
          )}
        </div>
      )}
    </>
  );
};
