import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatDateIndo,
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
  IconClose,
  IconCopy,
  IconEditPen,
  IconFileText,
  IconImage,
  IconLoader,
  IconLock,
  IconMessageSquare,
  IconPlus,
  IconSend,
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

const MAX_CAPTION_LEN = 30;
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
  kind: 'loading' | 'warning';
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
  const [clearStatus, setClearStatus] = useState<'idle' | 'cleared'>('idle');
  const copyTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting'>('idle');

  const slotPickerRef = useRef<HTMLInputElement | null>(null);
  const pendingTargetRef = useRef<{ side: 'before' | 'after'; index: number } | null>(null);
  const isMountedRef = useRef(true);

  useModalScrollLock(unlockConfirmOpen || postSendModal !== null);

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

  const showWarningToast = useCallback(
    (message: string) => {
      clearToastTimers();
      setToast({ message, kind: 'warning' });
      toastTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          setToast(null);
        }
        toastTimerRef.current = null;
      }, 3500);
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
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
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
    showWarningToast('Data laporan terkunci. Klik ikon gembok untuk edit manual');
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
    if (isPickingFile) return;

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
        setToast({ message: 'Memuat foto...', kind: 'loading' });
      }
    }, 150);

    try {
      const processed = await processAndResizeFile(selectedFile);
      inputEl.value = '';

      if (loadingDelayTimerRef.current !== null) {
        window.clearTimeout(loadingDelayTimerRef.current);
        loadingDelayTimerRef.current = null;
      }

      if (!isMountedRef.current) {
        freeSingleSlot(processed);
        return;
      }

      if (!processed) {
        showWarningToast('Gagal memuat foto. Pastikan format gambar didukung.');
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
        showWarningToast('Foto yang sama terdeteksi sudah terpasang di slot lain.');
      } else if (files.length > 1) {
        showWarningToast(
          `Terdeteksi ${files.length} foto dipilih — otomatis memakai foto terakhir yang diklik.`
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

  const handleResetAllPhotos = () => {
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

  const handleClearCaptions = () => {
    setRow1('');
    setRow2('');
    setRow3('');
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }
    setClearStatus('cleared');
    clearTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) setClearStatus('idle');
      clearTimerRef.current = null;
    }, 2000);
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

  const handleExportCollage = () => {
    if (!hasVisiblePhotos || exportStatus === 'exporting') return;

    // Validasi wajib minimal 1 baris keterangan kegiatan terisi
    const hasActivityNote = [row1, row2, row3]
      .slice(0, rows)
      .some((val) => val.trim().length > 0);
    if (!hasActivityNote) {
      showWarningToast('Isi minimal 1 baris keterangan kegiatan dulu');
      return;
    }

    // Auto-lock Data Laporan setelah menekan Kirim ke WhatsApp
    setIsDataLocked(true);
    setShiftMenuOpen(false);
    setExportStatus('exporting');

    const exportCanvas = document.createElement('canvas');
    const rendered = renderCollageToCanvas(exportCanvas, {
      rows,
      beforeSlots,
      afterSlots,
      rowTexts: [row1, row2, row3],
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

    const currentAreaStr = tpmArea.trim() || 'TPM';
    const previousEntry = reportedLog[`${effectiveDate}_${tpmShift}`] ?? null;

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
                // Dibatalkan langsung di Share Sheet -> jangan ubah status & jangan reset form
                if (isMountedRef.current) setExportStatus('idle');
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
            previousEntry
          );
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

  return (
    <>
      {toast && (
        <div
          role={toast.kind === 'loading' ? 'status' : 'alert'}
          className="modal-pop fixed bottom-6 left-1/2 z-[10000] flex w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 items-center justify-center gap-2 rounded-xl border border-[#ff9500]/60 bg-[#2a2216]/95 px-4 py-3 text-center text-[13px] font-semibold text-[#ffd180] shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-md"
        >
          {toast.kind === 'loading' ? <IconLoader /> : <IconAlertTriangle />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="mb-2 flex w-full flex-col gap-4 overflow-x-clip rounded-xl bg-[#1e1e1e] p-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.3)] sm:p-5">
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
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex items-center gap-2 text-[17px] font-semibold text-sky-200 sm:text-[18px]">
                <IconFileText className="text-sky-400" /> Data Laporan
              </span>
              {!isDataLocked && (
                <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[12px] font-semibold text-amber-300">
                  Mode Manual
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleDataLock}
              aria-label={isDataLocked ? 'Buka kunci Data Laporan' : 'Kunci Data Laporan'}
              title={isDataLocked ? 'Buka kunci Data Laporan' : 'Kunci Data Laporan'}
              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border text-base transition active:scale-95 ${
                isDataLocked
                  ? 'border-[#3a3a3a] bg-[#252525] text-sky-400 hover:border-[#4b4b4b]'
                  : 'border-amber-500/45 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
              }`}
            >
              {isDataLocked ? <IconLock /> : <IconUnlock />}
            </button>
          </div>

          <div className="grid w-full grid-cols-2 gap-2">
            {/* Input Tanggal dengan Ikon SVG Kalender + Overlay Rata Tengah DD/MM/YYYY */}
            <div
              className={`relative flex h-[42px] min-w-0 items-center justify-center gap-2 rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] px-3 ${
                isDataLocked ? 'opacity-80' : ''
              }`}
            >
              <IconCalendar className="h-4 w-4 shrink-0 text-sky-400" />
              <span className="pointer-events-none whitespace-nowrap text-[16px] font-semibold text-white">
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

            {/* Custom Dropdown Shift dengan Ikon SVG Cuaca 1em Menempel Rapat */}
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
                className={`relative flex h-[42px] w-full items-center justify-center rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] px-8 text-[16px] font-semibold text-white transition ${
                  isDataLocked
                    ? 'cursor-not-allowed opacity-80'
                    : 'cursor-pointer hover:border-[#4b4b4b] active:scale-[0.99]'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ShiftWeatherIcon shift={tpmShift} />
                  <span>{tpmShift}</span>
                </span>
                <IconChevronDown
                  className={`pointer-events-none absolute right-2.5 text-sm text-[#9ca3af] transition-transform duration-150 ${
                    shiftMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {shiftMenuOpen && !isDataLocked && (
                <div
                  role="listbox"
                  aria-label="Pilih Shift"
                  className="modal-pop absolute top-[calc(100%+6px)] right-0 left-0 z-30 overflow-hidden rounded-lg border border-[#3f3f3f] bg-[#242424] py-1 shadow-[0_10px_28px_rgba(0,0,0,0.75)]"
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
                            ? 'bg-[#1a2736] text-[#8ab4f8]'
                            : 'text-white hover:bg-[#303030]'
                        }`}
                      >
                        <ShiftWeatherIcon shift={optShift} />
                        <span>{optShift}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Input Tag Equipment Full-Width & Rata Tengah */}
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
              placeholder="Area / Equipment TPM..."
              className={`tpm-input min-h-[42px]! w-full py-2! text-center font-semibold ${
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

          {isOffDay && (
            <span className="inline-flex items-center justify-center gap-1.5 text-center text-[13px] font-medium text-[#ff9500]">
              <IconAlertTriangle /> Tanggal 31 jadwal rutin libur TPM
            </span>
          )}
        </div>

        {/* Bagian 2: Live Preview Grid 1:1 dengan Canvas Ekspor + Selector 2x1 | 2x2 | 2x3 */}
        <div className="flex w-full flex-col gap-2.5 border-t border-[#2c2c2c] pt-3.5">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[17px] font-semibold text-sky-200 sm:text-[18px]">
              <IconImage className="text-sky-400" /> Preview
            </span>

            <div
              role="group"
              aria-label="Ukuran Grid Kolase"
              className="flex h-[34px] shrink-0 items-center gap-1 rounded-lg border border-[#3a3a3a] bg-[#252525] p-0.5"
            >
              {(['2x1', '2x2', '2x3'] as const).map((grid) => {
                const active = gridType === grid;
                return (
                  <button
                    key={grid}
                    type="button"
                    onClick={() => handleGridSelect(grid)}
                    className={`h-full cursor-pointer rounded-md px-2.5 text-[12px] font-bold transition active:scale-95 ${
                      active
                        ? 'bg-[#007aff] text-white shadow-xs'
                        : 'bg-transparent text-[#aaa] hover:text-white'
                    }`}
                  >
                    {grid}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frame Kolase Live Preview 1:1 (container-type: inline-size agar proporsi cqw identik Canvas) */}
          <div
            className="w-full max-w-full overflow-hidden rounded-lg border border-[#2f2f2f] bg-black [container-type:inline-size]"
            style={{ padding: COLLAGE_PREVIEW_SPEC.paddingCqw }}
          >
            {/* 1. Header Paling Atas (Tengah): TPM [TAG EQUIPMENT] */}
            <div
              className="flex w-full items-center justify-center px-1 text-center"
              style={{ height: COLLAGE_PREVIEW_SPEC.topHeaderHeightCqw }}
            >
              <span
                className="max-w-[92%] truncate font-extrabold text-white"
                style={{ fontSize: COLLAGE_PREVIEW_SPEC.topHeaderFontCqw, lineHeight: 1.15 }}
              >
                TPM {displayAreaStamp}
              </span>
            </div>

            {/* 2. Sub-Header Kolom: BEFORE | AFTER */}
            <div
              className="grid w-full grid-cols-2 items-center text-center"
              style={{
                height: COLLAGE_PREVIEW_SPEC.subHeaderHeightCqw,
                gap: COLLAGE_PREVIEW_SPEC.gapCqw,
              }}
            >
              <span
                className="truncate font-extrabold tracking-[0.06em] text-[#e5e7eb]"
                style={{ fontSize: COLLAGE_PREVIEW_SPEC.subHeaderFontCqw, lineHeight: 1.15 }}
              >
                BEFORE
              </span>
              <span
                className="truncate font-extrabold tracking-[0.06em] text-[#e5e7eb]"
                style={{ fontSize: COLLAGE_PREVIEW_SPEC.subHeaderFontCqw, lineHeight: 1.15 }}
              >
                AFTER
              </span>
            </div>

            {/* 3. Area Tengah: Grid Baris 1..N dengan Radius Sudut Identik roundRect */}
            <div className="flex w-full flex-col" style={{ gap: COLLAGE_PREVIEW_SPEC.gapCqw }}>
              {Array.from({ length: rows }).map((_, r) => {
                const rowOverlayText = rowValues[r]?.trim();
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
                        className="relative aspect-square w-full min-w-0 overflow-hidden bg-[#141414]"
                        style={{ borderRadius: COLLAGE_PREVIEW_SPEC.cellRadiusCqw }}
                      >
                        {cell.slot ? (
                          <div
                            className="relative h-full w-full overflow-hidden"
                            style={{ borderRadius: COLLAGE_PREVIEW_SPEC.cellRadiusCqw }}
                          >
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
                                className="flex h-full w-full cursor-pointer items-center justify-center bg-[#1c1c1c] text-xs text-[#888]"
                              >
                                {cell.label}
                              </div>
                            )}

                            {/* Tombol Hapus saja — tap langsung foto untuk buka editor Atur Foto */}
                            <button
                              type="button"
                              aria-label={`Hapus ${cell.label}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSingleSlot(cell.side, r);
                              }}
                              className="absolute top-1.5 right-1.5 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-rose-500/40 bg-slate-950/80 text-sm font-bold text-rose-400 backdrop-blur-xs transition hover:bg-rose-950/90 active:scale-90"
                            >
                              <IconClose />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => triggerSlotPicker(cell.side, r)}
                            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-[#444] bg-[#141414] p-2 text-[#8f8f8f] transition active:border-[#007aff] active:bg-[#1a2736] active:text-white"
                            style={{ borderRadius: COLLAGE_PREVIEW_SPEC.cellRadiusCqw }}
                          >
                            <IconPlus className="text-xl text-[#007aff]" />
                            <span className="text-[12px] font-semibold">{cell.label}</span>
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Kapsul Keterangan Melayang di Tepi Bawah-Tengah Baris Foto */}
                    {rowOverlayText && (
                      <div
                        className="pointer-events-none absolute inset-x-3 z-[5] flex justify-center"
                        style={{ bottom: COLLAGE_PREVIEW_SPEC.pillBottomCqw }}
                      >
                        <span
                          className="max-w-full truncate rounded-md bg-black/82 font-bold text-white shadow-sm"
                          style={{
                            fontSize: COLLAGE_PREVIEW_SPEC.pillFontCqw,
                            lineHeight: 1.15,
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

            {/* 4. Footer Paling Bawah (Tengah): SHIFT [PAGI/SORE/MALAM] • [DD/MM/YYYY] */}
            <div
              className="flex w-full items-center justify-center px-1 text-center"
              style={{ height: COLLAGE_PREVIEW_SPEC.footerHeightCqw }}
            >
              <span
                className="max-w-[92%] truncate font-bold text-[#d1d5db]"
                style={{ fontSize: COLLAGE_PREVIEW_SPEC.footerFontCqw, lineHeight: 1.15 }}
              >
                SHIFT {tpmShift} • {formatDateIndo(effectiveDate)}
              </span>
            </div>
          </div>

          {hasAnyStoredPhotos && (
            <button
              type="button"
              onClick={handleResetAllPhotos}
              className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#ff453a]/40 bg-[#ff453a]/12 px-3 py-2 text-[14px] font-semibold text-[#ff6961] transition active:scale-[0.98] active:bg-[#ff453a]/22"
            >
              <IconTrash /> Reset Semua Foto
            </button>
          )}
        </div>

        {/* Bagian 3: Keterangan Kegiatan, Pratinjau Caption & Tombol Kirim ke WhatsApp */}
        <div className="flex w-full flex-col gap-3 border-t border-[#2c2c2c] pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-[17px] font-semibold text-sky-200 sm:text-[18px]">
              <IconEditPen className="text-sky-400" /> Keterangan Kegiatan
            </span>
            <button
              type="button"
              onClick={handleClearCaptions}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-semibold transition active:scale-[0.96] ${
                clearStatus === 'cleared'
                  ? 'border-rose-400 bg-rose-600 text-white'
                  : 'border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-950/60'
              }`}
            >
              {clearStatus === 'cleared' ? (
                <>
                  <IconCheck /> Dibersihkan!
                </>
              ) : (
                <>
                  <IconBroom /> Bersihkan
                </>
              )}
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
                onChange={(e) => setRow1(e.target.value)}
                placeholder="Misal: Cleaning baseplate pompa"
                className="tpm-input pr-14!"
              />
              <span
                className={`pointer-events-none absolute right-3 text-[12px] font-medium tabular-nums ${
                  row1.length >= MAX_CAPTION_LEN ? 'text-amber-400' : 'text-[#888]'
                }`}
              >
                {row1.length}/{MAX_CAPTION_LEN}
              </span>
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
                  onChange={(e) => setRow2(e.target.value)}
                  placeholder="Misal: Cleaning instrumentasi"
                  className="tpm-input pr-14!"
                />
                <span
                  className={`pointer-events-none absolute right-3 text-[12px] font-medium tabular-nums ${
                    row2.length >= MAX_CAPTION_LEN ? 'text-amber-400' : 'text-[#888]'
                  }`}
                >
                  {row2.length}/{MAX_CAPTION_LEN}
                </span>
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
                  onChange={(e) => setRow3(e.target.value)}
                  placeholder="Misal: Regreasing BV"
                  className="tpm-input pr-14!"
                />
                <span
                  className={`pointer-events-none absolute right-3 text-[12px] font-medium tabular-nums ${
                    row3.length >= MAX_CAPTION_LEN ? 'text-amber-400' : 'text-[#888]'
                  }`}
                >
                  {row3.length}/{MAX_CAPTION_LEN}
                </span>
              </div>
            )}
          </div>

          {/* Pratinjau Caption WhatsApp */}
          <div className="flex w-full min-w-0 flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[17px] font-semibold text-sky-200 sm:text-[18px]">
                <IconMessageSquare className="text-sky-400" /> Caption WhatsApp
              </span>
              <button
                type="button"
                onClick={handleCopyCaption}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-semibold transition active:scale-[0.97] ${
                  copyStatus === 'copied'
                    ? 'border-emerald-400 bg-emerald-600 text-white'
                    : 'border-[#444] bg-[#2e2e2e] text-white'
                }`}
              >
                {copyStatus === 'copied' ? (
                  <>
                    <IconCheck /> Tersalin!
                  </>
                ) : copyStatus === 'error' ? (
                  <>
                    <IconAlertTriangle className="text-[#ff9500]" /> Gagal Salin
                  </>
                ) : (
                  <>
                    <IconCopy /> Salin Caption
                  </>
                )}
              </button>
            </div>
            <div className="w-full whitespace-pre-wrap break-words rounded-lg border border-[#3a3a3a] bg-[#252525] p-2.5 font-mono text-[13px] text-[#72d572]">
              {captionText}
            </div>
          </div>

          {/* Tombol Utama "Kirim ke WhatsApp" (Emerald konsisten dengan tombol aksi utama) */}
          <button
            type="button"
            disabled={!hasVisiblePhotos || exportStatus === 'exporting'}
            onClick={handleExportCollage}
            className="mt-0.5 inline-flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-emerald-600 px-5 py-3.5 text-base font-extrabold text-white shadow-[0_4px_14px_rgba(16,185,129,0.28)] transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#2a332d] disabled:text-[#6b7c70] disabled:shadow-none"
          >
            {exportStatus === 'exporting' ? (
              <>
                <span className="spinner border-white/30! border-t-white!" /> Menyiapkan
                gambar...
              </>
            ) : (
              <>
                <IconSend /> Kirim ke WhatsApp
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
          className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overscroll-contain bg-black/84 p-4 backdrop-blur-[4px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUnlockConfirmOpen(false);
          }}
        >
          <div className="modal-pop w-full max-w-[380px] overscroll-contain rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-5 text-white shadow-[0_12px_34px_rgba(0,0,0,0.75)]">
            <h3
              id="unlock-data-title"
              className="mb-2 flex items-center gap-2 text-[18px] font-bold text-amber-300"
            >
              <IconUnlock /> Buka Kunci Data Laporan?
            </h3>
            <p className="mb-4 text-[14px] leading-[1.5] text-[#d4d4d4]">
              Aktifkan <strong>Mode Manual</strong> untuk mengubah Tanggal, Shift, atau Tag
              Equipment secara manual?
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setUnlockConfirmOpen(false)}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-slate-600/50 bg-slate-700 px-3 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-600 active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlock}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-[#007aff] px-3 py-2.5 text-[14px] font-bold text-white transition hover:opacity-92 active:scale-[0.98]"
              >
                Buka Kunci
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
          className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overscroll-contain bg-black/84 p-4 backdrop-blur-[4px]"
        >
          <div className="modal-pop w-full max-w-[390px] overscroll-contain rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-5 text-white shadow-[0_12px_34px_rgba(0,0,0,0.75)]">
            <h3
              id="post-send-title"
              className="mb-2 flex items-center gap-2 text-[18px] font-bold text-[#34c759]"
            >
              <IconCheck /> Kolase TPM Berhasil Dibuat!
            </h3>
            <p className="mb-3.5 text-[14px] leading-[1.5] text-[#d4d4d4]">
              Update status alat menjadi{' '}
              <strong className="inline-flex items-center gap-1 text-sky-400">
                <IconCheck /> DILAPORKAN
              </strong>{' '}
              &amp; bersihkan form?
            </p>
            <div className="mb-4 rounded-lg border border-[#333] bg-[#252525] px-3 py-2 text-[13px]">
              <div className="flex items-center gap-1.5 font-bold text-[#8ab4f8]">
                <ShiftWeatherIcon shift={postSendModal.shift} />
                <span>
                  {postSendModal.shift} • {formatDateIndo(postSendModal.dateStr)}
                </span>
              </div>
              <div className="truncate font-semibold text-white">{postSendModal.areaStr}</div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCancelPostSend}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-slate-600/50 bg-slate-700 px-3 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-600 active:scale-[0.98]"
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
