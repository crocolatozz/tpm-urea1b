import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatDateIndo,
  getAreaForDateAndShift,
  getLocalTodayStr,
  getOperationalShiftInfo,
  loadSavedPreferences,
  savePreferences,
  type GridType,
  type ReportedLogEntry,
  type ShiftName,
} from '../data/tpmData';
import {
  COLLAGE_PREVIEW_SPEC,
  copyTextToClipboard,
  freeSingleSlot,
  freeSlotArray,
  processAndResizeFile,
  renderCollageToCanvas,
  type LoadedPhotoSlot,
} from '../utils/imageCollage';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
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
  IconLoader,
  IconLock,
  IconMessageSquare,
  IconPlus,
  IconSend,
  IconSwapHorizontal,
  IconTrash,
  IconUnlock,
  ShiftWeatherIcon,
} from './Icons';

interface KolaseViewProps {
  date: string;
  shift: ShiftName;
  area: string;
  selectionKey: number;
  reportedLog: Record<string, ReportedLogEntry>;
  onDateChange: (date: string) => void;
  onShiftChange: (shift: ShiftName) => void;
  onAreaChange: (area: string) => void;
  onReportSubmitted: (dateStr: string, shift: ShiftName, area: string) => Promise<void>;
  onRestoreReport: (
    dateStr: string,
    shift: ShiftName,
    previousEntry: ReportedLogEntry | null
  ) => Promise<void>;
  onHasFilledPhotosChange?: (hasPhotos: boolean) => void;
}

const MAX_CAPTION_LEN = 25;
const TOTAL_SLOT_ROWS = 3;

function getRowsForGrid(grid: GridType): number {
  return parseInt(grid.split('x')[1], 10) || 3;
}

function countValidSlots(slots: Array<LoadedPhotoSlot | null>): number {
  return slots.filter(Boolean).length;
}

function detectIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

interface FloatingToastState {
  message: string;
  kind: 'loading' | 'warning' | 'success';
}

interface PostSendModalState {
  dateStr: string;
  shift: ShiftName;
  areaStr: string;
  previousEntry: ReportedLogEntry | null;
}

export const KolaseView: React.FC<KolaseViewProps> = ({
  date,
  shift,
  area,
  selectionKey,
  reportedLog,
  onDateChange,
  onShiftChange,
  onAreaChange,
  onReportSubmitted,
  onRestoreReport,
  onHasFilledPhotosChange,
}) => {
  const savedPrefs = useMemo(() => loadSavedPreferences(), []);
  const isIOS = useMemo(() => detectIOSDevice(), []);

  // Single source of truth berasal dari App.tsx (sinkron penuh ke UI, filter Tag Equipment, Preview, & Caption WA)
  const tpmDate = date;
  const tpmShift = shift;
  const tpmArea = area;

  // Data Laporan terkunci default & auto-lock saat pindah tab / pilih jadwal baru / kirim WA
  const [isDataLocked, setIsDataLocked] = useState<boolean>(true);
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState<boolean>(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState<boolean>(false);
  const [resetPhotosConfirmOpen, setResetPhotosConfirmOpen] = useState<boolean>(false);

  const [gridType, setGridType] = useState<GridType>(savedPrefs.grid);
  // Caption Baris 1-3 selalu bersih di local state & tidak disimpan ke localStorage/App.tsx
  const [row1, setRow1] = useState<string>('');
  const [row2, setRow2] = useState<string>('');
  const [row3, setRow3] = useState<string>('');

  const [shiftMenuOpen, setShiftMenuOpen] = useState(false);
  const shiftDropdownRef = useRef<HTMLDivElement | null>(null);

  // Penyimpanan permanen 6 slot foto (3 Before + 3 After) agar tidak ter-reset saat pindah mode grid 2x1/2x2/2x3
  const [beforeSlots, setBeforeSlots] = useState<Array<LoadedPhotoSlot | null>>([]);
  const [afterSlots, setAfterSlots] = useState<Array<LoadedPhotoSlot | null>>([]);
  const [swappedRow, setSwappedRow] = useState<number | null>(null);
  const swapTimerRef = useRef<number | null>(null);

  const [isPickingFile, setIsPickingFile] = useState(false);
  const [isReportSubmitted, setIsReportSubmitted] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{
    side: 'before' | 'after';
    index: number;
  } | null>(null);
  const [postSendModal, setPostSendModal] = useState<PostSendModalState | null>(null);

  const [toast, setToast] = useState<FloatingToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const loadingDelayTimerRef = useRef<number | null>(null);

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimerRef = useRef<number | null>(null);

  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting'>('idle');

  const slotPickerRef = useRef<HTMLInputElement | null>(null);
  const pendingTargetRef = useRef<{ side: 'before' | 'after'; index: number } | null>(null);
  const isMountedRef = useRef(true);

  useModalScrollLock(
    unlockConfirmOpen || clearConfirmOpen || resetPhotosConfirmOpen || postSendModal !== null
  );

  const clearToastTimers = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (loadingDelayTimerRef.current !== null) {
      window.clearTimeout(loadingDelayTimerRef.current);
      loadingDelayTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string, kind: 'warning' | 'success' = 'warning', durationMs = 3500) => {
      clearToastTimers();
      setToast({ message, kind });
      toastTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          setToast(null);
        }
        toastTimerRef.current = null;
      }, durationMs);
    },
    [clearToastTimers]
  );

  // Auto-lock Data Laporan setiap ada pilihan jadwal baru dari Dashboard/URL
  useEffect(() => {
    setIsDataLocked(true);
    setShiftMenuOpen(false);
    setUnlockConfirmOpen(false);
  }, [selectionKey]);

  // Keep refs to slots for safe unmount memory cleanup & async duplicate checks
  const slotsCleanupRef = useRef<{
    before: Array<LoadedPhotoSlot | null>;
    after: Array<LoadedPhotoSlot | null>;
  }>({ before: [], after: [] });
  slotsCleanupRef.current = { before: beforeSlots, after: afterSlots };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearToastTimers();
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
      freeSlotArray(slotsCleanupRef.current.before);
      freeSlotArray(slotsCleanupRef.current.after);
    };
  }, [clearToastTimers]);

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

  // Persist ONLY grid layout preference (captions are never stored to localStorage)
  useEffect(() => {
    savePreferences({ grid: gridType });
  }, [gridType]);

  const rows = getRowsForGrid(gridType);
  const effectiveDate = tpmDate || getLocalTodayStr();
  const isOffDay = parseInt(effectiveDate.split('-')[2], 10) === 31;

  const beforeCountNum = countValidSlots(beforeSlots.slice(0, rows));
  const afterCountNum = countValidSlots(afterSlots.slice(0, rows));
  const hasVisiblePhotos = beforeCountNum > 0 || afterCountNum > 0;
  const hasAnyStoredPhotos =
    countValidSlots(beforeSlots) > 0 || countValidSlots(afterSlots) > 0;
  const hasAnyCaptionText = row1.length > 0 || row2.length > 0 || row3.length > 0;

  useEffect(() => {
    onHasFilledPhotosChange?.(hasAnyStoredPhotos && !isReportSubmitted);
  }, [hasAnyStoredPhotos, isReportSubmitted, onHasFilledPhotosChange]);

  useEffect(() => {
    return () => {
      onHasFilledPhotosChange?.(false);
    };
  }, [onHasFilledPhotosChange]);

  const captionText = useMemo(() => {
    const dateFormatted = formatDateIndo(effectiveDate);
    const areaName = tpmArea.trim() || '-';
    const lines = [`*TPM ${areaName}*`, `*SHIFT ${tpmShift} ~ ${dateFormatted}*`];

    const rowValues = [row1, row2, row3];
    const bullets: string[] = [];
    for (let i = 0; i < rows; i++) {
      const text = rowValues[i]?.trim();
      if (text) {
        bullets.push(`- ${text}`);
      }
    }
    if (bullets.length > 0) {
      lines.push('', ...bullets);
    }
    return lines.join('\n');
  }, [effectiveDate, tpmArea, tpmShift, row1, row2, row3, rows]);

  const handleLockedFieldTap = () => {
    showToast('Data laporan terkunci. Ketuk tombol Locked untuk edit manual', 'warning');
  };

  const handleToggleDataLock = () => {
    if (isDataLocked) {
      setShiftMenuOpen(false);
      setUnlockConfirmOpen(true);
    } else {
      setShiftMenuOpen(false);
      setIsDataLocked(true);
    }
  };

  const handleConfirmUnlock = () => {
    setUnlockConfirmOpen(false);
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

  // Mode grid hanya mengatur baris yang ditampilkan & dirender (6 slot foto tetap tersimpan permanen)
  const handleGridSelect = (nextGrid: GridType) => {
    if (nextGrid === gridType) return;
    setGridType(nextGrid);
  };

  const triggerSlotPicker = (side: 'before' | 'after', index: number) => {
    if (isPickingFile || !slotPickerRef.current) return;
    pendingTargetRef.current = { side, index };
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

    const selectedFile = files[files.length - 1];
    setIsPickingFile(true);

    // Smart delay 150ms agar decode cepat bebas kedipan & bebas layout shift
    if (loadingDelayTimerRef.current !== null) {
      window.clearTimeout(loadingDelayTimerRef.current);
    }
    loadingDelayTimerRef.current = window.setTimeout(() => {
      loadingDelayTimerRef.current = null;
      if (isMountedRef.current) {
        if (toastTimerRef.current !== null) {
          window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = null;
        }
        setToast({ message: 'Memuat & mengompres foto...', kind: 'loading' });
      }
    }, 150);

    try {
      const processed = await processAndResizeFile(selectedFile);

      if (loadingDelayTimerRef.current !== null) {
        window.clearTimeout(loadingDelayTimerRef.current);
        loadingDelayTimerRef.current = null;
      }

      if (!isMountedRef.current) {
        freeSingleSlot(processed);
        return;
      }

      if (!processed) {
        showToast('Gagal memuat foto. Pastikan format gambar didukung.', 'warning');
        return;
      }

      // Cek apakah foto identik (size + lastModified) sudah terpasang di slot aktif lain
      const activeOtherSlots = [
        ...slotsCleanupRef.current.before
          .slice(0, rows)
          .map((slot, idx) => ({ side: 'before' as const, idx, slot })),
        ...slotsCleanupRef.current.after
          .slice(0, rows)
          .map((slot, idx) => ({ side: 'after' as const, idx, slot })),
      ];
      const isDuplicateElsewhere = activeOtherSlots.some(
        (item) =>
          !(item.side === target.side && item.idx === target.index) &&
          item.slot !== null &&
          item.slot.fileSize !== undefined &&
          item.slot.lastModified !== undefined &&
          item.slot.fileSize === selectedFile.size &&
          item.slot.lastModified === selectedFile.lastModified
      );

      const setSlots = target.side === 'before' ? setBeforeSlots : setAfterSlots;
      setSlots((prev) => {
        const len = Math.max(TOTAL_SLOT_ROWS, prev.length, target.index + 1);
        const next = Array.from({ length: len }, (_, idx) => prev[idx] || null);
        freeSingleSlot(next[target.index]);
        next[target.index] = processed;
        return next;
      });
      setIsReportSubmitted(false);

      if (isDuplicateElsewhere) {
        showToast('Foto yang sama terdeteksi sudah terpasang di slot lain.', 'warning');
      } else if (files.length > 1) {
        showToast(
          `Terdeteksi ${files.length} foto dipilih — otomatis memakai foto terakhir yang diklik.`,
          'warning'
        );
      } else {
        setToast((prev) => (prev?.kind === 'loading' ? null : prev));
      }
    } finally {
      inputEl.value = '';
      if (loadingDelayTimerRef.current !== null) {
        window.clearTimeout(loadingDelayTimerRef.current);
        loadingDelayTimerRef.current = null;
      }
      if (isMountedRef.current) {
        setIsPickingFile(false);
        setToast((prev) => (prev?.kind === 'loading' ? null : prev));
      }
    }
  };

  const removeSingleSlot = (side: 'before' | 'after', index: number) => {
    const setSlots = side === 'before' ? setBeforeSlots : setAfterSlots;
    setSlots((prev) => {
      const next = [...prev];
      freeSingleSlot(next[index]);
      next[index] = null;
      return next;
    });
    setIsReportSubmitted(false);
  };

  const handleSwapRowPhotos = (rowIndex: number) => {
    const currentBefore = slotsCleanupRef.current.before[rowIndex] || null;
    const currentAfter = slotsCleanupRef.current.after[rowIndex] || null;
    if (!currentBefore && !currentAfter) return;

    setBeforeSlots((prev) => {
      const len = Math.max(TOTAL_SLOT_ROWS, prev.length, rowIndex + 1);
      const next = Array.from({ length: len }, (_, idx) => prev[idx] || null);
      next[rowIndex] = currentAfter;
      return next;
    });
    setAfterSlots((prev) => {
      const len = Math.max(TOTAL_SLOT_ROWS, prev.length, rowIndex + 1);
      const next = Array.from({ length: len }, (_, idx) => prev[idx] || null);
      next[rowIndex] = currentBefore;
      return next;
    });

    setSwappedRow(rowIndex);
    if (swapTimerRef.current !== null) {
      window.clearTimeout(swapTimerRef.current);
    }
    swapTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) setSwappedRow(null);
      swapTimerRef.current = null;
    }, 350);
  };

  const handleConfirmResetAllPhotos = () => {
    setResetPhotosConfirmOpen(false);
    freeSlotArray(beforeSlots);
    freeSlotArray(afterSlots);
    setBeforeSlots([]);
    setAfterSlots([]);
    setIsReportSubmitted(false);
    clearToastTimers();
    setToast(null);
    setEditingTarget(null);
    if (slotPickerRef.current) slotPickerRef.current.value = '';
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
    triggerSlotPicker(side, index);
    setEditingTarget(null);
  };

  const handleConfirmClearCaptions = () => {
    setClearConfirmOpen(false);
    setRow1('');
    setRow2('');
    setRow3('');
  };

  const handleCopyCaption = async () => {
    const copied = await copyTextToClipboard(captionText);
    if (!isMountedRef.current) return;
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    if (copied) {
      setCopyStatus('copied');
      copyTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) setCopyStatus('idle');
        copyTimerRef.current = null;
      }, 2000);
    } else {
      setCopyStatus('error');
      showToast('Gagal menyalin caption ke clipboard.', 'warning', 2500);
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
      previousEntry: ReportedLogEntry | null
    ) => {
      // Optimistic status update langsung ke state & Firestore tanpa menunggu visibilitychange
      void onReportSubmitted(dateStr, shiftName, areaStr);
      if (isMountedRef.current) {
        setIsReportSubmitted(true);
        onHasFilledPhotosChange?.(false);
        setExportStatus('idle');
        setPostSendModal({
          dateStr,
          shift: shiftName,
          areaStr,
          previousEntry,
        });
      }
    },
    [onHasFilledPhotosChange, onReportSubmitted]
  );

  const handleConfirmPostSend = () => {
    setPostSendModal(null);
    freeSlotArray(beforeSlots);
    freeSlotArray(afterSlots);
    setBeforeSlots([]);
    setAfterSlots([]);
    setRow1('');
    setRow2('');
    setRow3('');
    setEditingTarget(null);
    clearToastTimers();
    setToast(null);
    setIsReportSubmitted(true);
    onHasFilledPhotosChange?.(false);
    if (slotPickerRef.current) slotPickerRef.current.value = '';
    // tpmArea (Tag Equipment) dipertahankan!
  };

  const handleCancelPostSend = () => {
    if (!postSendModal) return;
    const { dateStr, shift: modalShift, previousEntry } = postSendModal;
    setPostSendModal(null);
    setIsReportSubmitted(false);
    onHasFilledPhotosChange?.(hasAnyStoredPhotos);
    void onRestoreReport(dateStr, modalShift, previousEntry);
  };

  const handleExportCollage = async () => {
    if (!hasVisiblePhotos || exportStatus === 'exporting') return;

    // Validasi wajib minimal 1 baris keterangan kegiatan aktif terisi
    const activeActivities = [row1, row2, row3].slice(0, rows);
    const hasActivityNote = activeActivities.some((val) => val.trim().length > 0);
    if (!hasActivityNote) {
      showToast('Isi minimal 1 baris keterangan kegiatan dulu', 'warning');
      return;
    }

    // Auto-lock Data Laporan setelah menekan Kirim ke WhatsApp
    setIsDataLocked(true);
    setShiftMenuOpen(false);
    setExportStatus('exporting');

    const currentAreaStr = tpmArea.trim() || 'TPM';
    const previousEntry = reportedLog[`${effectiveDate}_${tpmShift}`] ?? null;

    // Auto-tandai [✓] saat Kirim ke WhatsApp ditekan jika tag equipment & shift cocok dengan jadwal hari aktif
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
        showToast('Jadwal otomatis ditandai ✓', 'success', 2600);
      }
    }

    // Pastikan font kustom termuat sebelum merender kanvas ekspor
    if (typeof document !== 'undefined' && document.fonts?.load) {
      await Promise.all([
        document.fonts.load('700 20px "Rajdhani"'),
        document.fonts.load('700 20px "Barlow Condensed"'),
      ]).catch(() => {});
    }

    if (!isMountedRef.current) return;

    const exportCanvas = document.createElement('canvas');
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
      return;
    }

    exportCanvas.toBlob(
      async (blob) => {
        exportCanvas.width = 0;
        exportCanvas.height = 0;

        try {
          if (!blob) {
            if (isMountedRef.current) setExportStatus('idle');
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
                previousEntry
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

          triggerPostSendConfirmation(effectiveDate, tpmShift, currentAreaStr, previousEntry);
        } catch {
          if (isMountedRef.current) setExportStatus('idle');
        }
      },
      'image/jpeg',
      0.95
    );
  };

  const editingSlot =
    editingTarget !== null
      ? (editingTarget.side === 'before' ? beforeSlots : afterSlots)[editingTarget.index] || null
      : null;

  const editingSlotLabel =
    editingTarget !== null
      ? `${editingTarget.side === 'before' ? 'Before' : 'After'} ${editingTarget.index + 1}`
      : '';

  const rowValues = [row1, row2, row3];
  const displayAreaStamp = tpmArea.trim() || '-';

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
      {toast && (
        <div
          role={toast.kind === 'warning' ? 'alert' : 'status'}
          className={`modal-pop fixed bottom-6 left-1/2 z-[10050] flex w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13px] font-semibold leading-snug shadow-[0_8px_24px_rgba(2,6,23,0.75)] backdrop-blur-md ${
            toast.kind === 'success'
              ? 'border-emerald-400/50 bg-emerald-950/95 text-emerald-200'
              : 'border-amber-400/50 bg-amber-950/95 text-amber-200'
          }`}
        >
          {toast.kind === 'loading' ? (
            <IconLoader className="h-[22px] w-[22px] shrink-0 text-amber-400" />
          ) : toast.kind === 'success' ? (
            <IconCheck className="h-[22px] w-[22px] shrink-0 text-emerald-400" />
          ) : (
            <IconAlertTriangle className="h-[22px] w-[22px] shrink-0 text-amber-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="mb-2 flex w-full flex-col gap-4 overflow-x-clip rounded-xl border border-slate-800 bg-slate-900 p-3.5 shadow-[0_4px_16px_rgba(2,6,23,0.5)] sm:p-5">
        {/* File Picker: multiple khusus iOS (dengan auto-pick terakhir), Android single-select */}
        <input
          ref={slotPickerRef}
          type="file"
          accept="image/*"
          multiple={isIOS}
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
                htmlFor="tpmDateInput"
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
                  id="tpmDateInput"
                  aria-label="Tanggal"
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
                  id="tpmShiftInput"
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
            <label htmlFor="tpmAreaInput" className="text-[13px] font-semibold text-slate-200">
              Tag Equipment / Area
            </label>
            <div className="relative w-full">
              <input
                type="text"
                id="tpmAreaInput"
                name="tpm_field_area_tag_x1"
                aria-label="Area / Equipment TPM"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                readOnly={isDataLocked}
                value={tpmArea}
                onChange={(e) => handleAreaInputChange(e.target.value)}
                placeholder="Misal: GA101A, FLARE..."
                className={`tpm-input font-equipment min-h-[42px]! w-full py-2! text-center font-bold text-white placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 placeholder:normal-case ${
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
            {/* 1. Header Kolom: BEFORE | AFTER (Barlow Condensed 700, Monokrom Putih #FFFFFF, 6.2cqw) */}
            <div
              className="grid w-full grid-cols-2 items-center text-center"
              style={{
                height: COLLAGE_PREVIEW_SPEC.subHeaderHeightCqw,
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

            {/* 2. Grid Baris 1..N (Sudut 8px, Kapsul bawah-tengah, Tombol Tukar Cepat ⇄) */}
            <div className="flex w-full flex-col" style={{ gap: COLLAGE_PREVIEW_SPEC.gapCqw }}>
              {Array.from({ length: rows }).map((_, r) => {
                const rowOverlayText = rowValues[r]?.trim();
                const hasRowPhoto = Boolean(beforeSlots[r] || afterSlots[r]);
                const isRowSwapped = swappedRow === r;
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
                    {cells.map((cell) => (
                      <div
                        key={cell.side}
                        className="relative aspect-square w-full min-w-0 overflow-hidden rounded-[8px] bg-slate-800"
                      >
                        {cell.slot ? (
                          <div className="relative h-full w-full overflow-hidden rounded-[8px]">
                            {cell.slot.previewUrl ? (
                              <img
                                src={cell.slot.previewUrl}
                                alt={cell.label}
                                onClick={() => setEditingTarget({ side: cell.side, index: r })}
                                className="h-full w-full cursor-pointer object-cover"
                              />
                            ) : (
                              <div
                                onClick={() => setEditingTarget({ side: cell.side, index: r })}
                                className="flex h-full w-full cursor-pointer items-center justify-center bg-slate-800 text-xs font-semibold text-slate-300"
                              >
                                {cell.label}
                              </div>
                            )}

                            {/* Tombol Hapus Bulat Frosted Deep Slate dengan Ikon Tempat Sampah Mini */}
                            <button
                              type="button"
                              aria-label={`Hapus ${cell.label}`}
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
                            onClick={() => triggerSlotPicker(cell.side, r)}
                            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-slate-700/80 bg-slate-900/90 p-2 transition hover:border-sky-500/60 active:border-sky-400 active:bg-sky-950/50"
                          >
                            <IconPlus className="h-6 w-6 text-sky-400" />
                            <span className="text-xs font-semibold text-slate-300">
                              {cell.label}
                            </span>
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Tombol Tukar Cepat Per Baris (⇄) — hanya muncul jika min. 1 slot terisi & tidak ter-render saat ekspor */}
                    {hasRowPhoto && (
                      <button
                        type="button"
                        aria-label={`Tukar foto Before dan After Baris ${r + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwapRowPhotos(r);
                        }}
                        className={`absolute top-1/2 left-1/2 z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border bg-slate-900/85 backdrop-blur-sm transition active:scale-90 ${
                          isRowSwapped
                            ? 'border-sky-400 text-white shadow-[0_0_10px_rgba(56,189,248,0.45)]'
                            : 'border-slate-600/80 text-sky-300/90 hover:border-sky-400 hover:text-white'
                        }`}
                      >
                        <IconSwapHorizontal className="h-4 w-4" />
                      </button>
                    )}

                    {/* Kapsul Keterangan Tengah Tiap Baris (Barlow Condensed 700, Monokrom Putih #FFFFFF, 4.9cqw) */}
                    {rowOverlayText && (
                      <div className="pointer-events-none absolute bottom-2.5 left-1/2 z-10 flex max-w-[calc(100%-16px)] -translate-x-1/2 justify-center">
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

            {/* 3. Footer 1 Baris Terpusat: TPM [TAG]   •   SHIFT   •   TANGGAL (Barlow Condensed 700, Monokrom Putih #FFFFFF, 4.5cqw) */}
            <div
              className="flex w-full items-center justify-center px-1 text-center"
              style={{
                marginTop: COLLAGE_PREVIEW_SPEC.footerTopGapCqw,
                height: COLLAGE_PREVIEW_SPEC.footerHeightCqw,
              }}
            >
              <div
                className="font-collage max-w-[90%] truncate whitespace-pre! font-bold leading-[1.2] text-white"
                style={{ fontSize: COLLAGE_PREVIEW_SPEC.footerFontCqw }}
              >
                {`TPM ${displayAreaStamp}   •   SHIFT ${tpmShift}   •   ${formatDateIndo(effectiveDate)}`}
              </div>
            </div>
          </div>

          {hasAnyStoredPhotos && (
            <button
              type="button"
              onClick={() => setResetPhotosConfirmOpen(true)}
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
              onClick={() => setClearConfirmOpen(true)}
              aria-label="Bersihkan Keterangan"
              title="Bersihkan Keterangan"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-300 transition hover:bg-rose-500/25 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconBroom className="h-4 w-4" />
            </button>
          </div>

          <div className="flex w-full flex-col gap-2">
            <div className="relative flex w-full items-center">
              <input
                type="text"
                id="row1Text"
                name="tpm_field_act_row1_x1"
                aria-label="Kegiatan Baris 1"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={MAX_CAPTION_LEN}
                value={row1}
                onChange={(e) => setRow1(e.target.value.slice(0, MAX_CAPTION_LEN))}
                placeholder="Misal: Cleaning baseplate"
                className="tpm-input pr-14! font-semibold text-white placeholder:font-normal placeholder:text-slate-400 placeholder:normal-case"
              />
              {renderCounterBadge(row1.length)}
            </div>

            {rows >= 2 && (
              <div className="relative flex w-full items-center">
                <input
                  type="text"
                  id="row2Text"
                  name="tpm_field_act_row2_x2"
                  aria-label="Kegiatan Baris 2"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={MAX_CAPTION_LEN}
                  value={row2}
                  onChange={(e) => setRow2(e.target.value.slice(0, MAX_CAPTION_LEN))}
                  placeholder="Misal: Cleaning instrumen"
                  className="tpm-input pr-14! font-semibold text-white placeholder:font-normal placeholder:text-slate-400 placeholder:normal-case"
                />
                {renderCounterBadge(row2.length)}
              </div>
            )}

            {rows >= 3 && (
              <div className="relative flex w-full items-center">
                <input
                  type="text"
                  id="row3Text"
                  name="tpm_field_act_row3_x3"
                  aria-label="Kegiatan Baris 3"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={MAX_CAPTION_LEN}
                  value={row3}
                  onChange={(e) => setRow3(e.target.value.slice(0, MAX_CAPTION_LEN))}
                  placeholder="Misal: Regreasing BV"
                  className="tpm-input pr-14! font-semibold text-white placeholder:font-normal placeholder:text-slate-400 placeholder:normal-case"
                />
                {renderCounterBadge(row3.length)}
              </div>
            )}
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
      />

      {/* Modal Konfirmasi Buka Kunci Data Laporan */}
      {unlockConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unlock-data-title"
          className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overscroll-contain bg-slate-950/84 p-4 backdrop-blur-[4px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUnlockConfirmOpen(false);
          }}
        >
          <div className="modal-pop w-full max-w-[380px] overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_12px_34px_rgba(2,6,23,0.8)]">
            <h3
              id="unlock-data-title"
              className="mb-2 flex items-center gap-2 text-base font-bold text-amber-300"
            >
              <IconUnlock className="h-5 w-5 text-amber-400" /> Buka Kunci Data Laporan?
            </h3>
            <p className="mb-2 text-[14px] leading-[1.5] text-slate-300">
              Membuka kunci (<strong className="text-white">Locked → Unlocked</strong>) akan
              mengaktifkan mode input manual untuk mengubah Tanggal, Shift, atau Tag Equipment.
            </p>
            <p className="mb-4 text-xs leading-[1.45] text-slate-400">
              Catatan: Data akan otomatis terkunci kembali saat memilih jadwal baru, berpindah tab,
              atau menekan Kirim ke WhatsApp.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setUnlockConfirmOpen(false)}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlock}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-sky-600 px-3 py-2.5 text-[14px] font-bold text-white transition hover:bg-sky-500 active:scale-[0.98]"
              >
                Buka Kunci
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Bersihkan Keterangan */}
      {clearConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-caption-title"
          className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overscroll-contain bg-slate-950/84 p-4 backdrop-blur-[4px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setClearConfirmOpen(false);
          }}
        >
          <div className="modal-pop w-full max-w-[380px] overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_12px_34px_rgba(2,6,23,0.8)]">
            <h3
              id="clear-caption-title"
              className="mb-2 flex items-center gap-2 text-base font-bold text-rose-300"
            >
              <IconBroom className="h-5 w-5 text-rose-400" /> Bersihkan Keterangan?
            </h3>
            <p className="mb-4 text-[14px] leading-[1.5] text-slate-300">
              Semua teks di kolom <strong className="text-white">Keterangan Kegiatan</strong> akan
              dikosongkan. Lanjutkan?
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setClearConfirmOpen(false)}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmClearCaptions}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-rose-500/40 bg-rose-600 px-3 py-2.5 text-[14px] font-bold text-white transition hover:bg-rose-500 active:scale-[0.98]"
              >
                Ya, Bersihkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Reset Semua Foto */}
      {resetPhotosConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-photos-title"
          className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overscroll-contain bg-slate-950/84 p-4 backdrop-blur-[4px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResetPhotosConfirmOpen(false);
          }}
        >
          <div className="modal-pop w-full max-w-[380px] overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_12px_34px_rgba(2,6,23,0.8)]">
            <h3
              id="reset-photos-title"
              className="mb-2 flex items-center gap-2 text-base font-bold text-rose-300"
            >
              <IconTrash className="h-5 w-5 text-rose-400" /> Reset Semua Foto?
            </h3>
            <p className="mb-4 text-[14px] leading-[1.5] text-slate-300">
              Seluruh foto Before &amp; After yang sudah terpasang di grid akan dihapus. Lanjutkan?
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setResetPhotosConfirmOpen(false)}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResetAllPhotos}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-rose-500/40 bg-rose-600 px-3 py-2.5 text-[14px] font-bold text-white transition hover:bg-rose-500 active:scale-[0.98]"
              >
                Ya, Reset Foto
              </button>
            </div>
          </div>
        </div>
      )}

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
                <IconCheck className="h-4 w-4" /> Terlapor
              </strong>{' '}
              &amp; bersihkan foto serta keterangan form?
            </p>
            <div className="mb-4 rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold tabular-nums text-sky-300">
                <ShiftWeatherIcon shift={postSendModal.shift} className="h-3.5 w-3.5" />
                <span>
                  {postSendModal.shift} • {formatDateIndo(postSendModal.dateStr)}
                </span>
              </div>
              <div className="font-equipment mt-0.5 truncate text-[15px] font-bold text-white">
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
    </>
  );
};
