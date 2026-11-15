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
  copyTextToClipboard,
  freeSingleSlot,
  freeSlotArray,
  processAndResizeFile,
  renderCollageToCanvas,
  type LoadedPhotoSlot,
} from '../utils/imageCollage';
import { PhotoEditorModal } from './PhotoEditorModal';
import {
  IconAlertTriangle,
  IconCheck,
  IconClose,
  IconCopy,
  IconEditPen,
  IconImage,
  IconLoader,
  IconMessageSquare,
  IconPlus,
  IconSend,
  IconTrash,
  ShiftWeatherIcon,
} from './Icons';

export interface KolaseInitialParams {
  date?: string;
  shift?: string;
  area?: string;
  requestKey?: number;
}

interface KolaseViewProps {
  initialParams?: KolaseInitialParams;
  reportedLog: Record<string, ReportedLogEntry>;
  onReportSubmitted: (dateStr: string, shift: ShiftName, area: string) => Promise<void>;
  onRestoreReport: (
    dateStr: string,
    shift: ShiftName,
    previousEntry: ReportedLogEntry | null
  ) => Promise<void>;
  onAreaChange?: (area: string) => void;
  onHasFilledPhotosChange?: (hasPhotos: boolean) => void;
}

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

function resolveKolaseDate(p?: KolaseInitialParams, fallbackDate?: string): string {
  if (p?.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) return p.date;
  return fallbackDate || getOperationalShiftInfo().dateStr;
}

function resolveKolaseShift(p?: KolaseInitialParams, fallbackShift?: ShiftName): ShiftName {
  if (p?.shift && (['PAGI', 'SORE', 'MALAM'] as const).includes(p.shift as ShiftName)) {
    return p.shift as ShiftName;
  }
  return fallbackShift || getOperationalShiftInfo().shift;
}

interface PostSendModalState {
  dateStr: string;
  shift: ShiftName;
  areaStr: string;
  previousEntry: ReportedLogEntry | null;
}

export const KolaseView: React.FC<KolaseViewProps> = ({
  initialParams,
  reportedLog,
  onReportSubmitted,
  onRestoreReport,
  onAreaChange,
  onHasFilledPhotosChange,
}) => {
  const savedPrefs = useMemo(() => loadSavedPreferences(), []);
  const isIOS = useMemo(() => detectIOSDevice(), []);
  const defaultOpShift = useMemo(() => getOperationalShiftInfo(), []);

  const [tpmDate, setTpmDate] = useState<string>(() =>
    resolveKolaseDate(initialParams, defaultOpShift.dateStr)
  );
  const [tpmShift, setTpmShift] = useState<ShiftName>(() =>
    resolveKolaseShift(initialParams, defaultOpShift.shift)
  );
  const [tpmArea, setTpmArea] = useState<string>(() => {
    if (typeof initialParams?.area === 'string') return initialParams.area;
    const initDate = resolveKolaseDate(initialParams, defaultOpShift.dateStr);
    const initShift = resolveKolaseShift(initialParams, defaultOpShift.shift);
    return getAreaForDateAndShift(initDate, initShift);
  });

  const [gridType, setGridType] = useState<GridType>(savedPrefs.grid);
  // Caption Baris 1-3 selalu bersih di local state & tidak disimpan ke localStorage/App.tsx
  const [row1, setRow1] = useState<string>('');
  const [row2, setRow2] = useState<string>('');
  const [row3, setRow3] = useState<string>('');

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
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting'>('idle');

  const slotPickerRef = useRef<HTMLInputElement | null>(null);
  const pendingTargetRef = useRef<{ side: 'before' | 'after'; index: number } | null>(null);
  const isMountedRef = useRef(true);

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
      freeSlotArray(slotsCleanupRef.current.before);
      freeSlotArray(slotsCleanupRef.current.after);
    };
  }, [clearToastTimers]);

  // Sync incoming navigation params when user taps a schedule card
  useEffect(() => {
    if (!initialParams?.requestKey) return;
    const nextDate = resolveKolaseDate(initialParams);
    const nextShift = resolveKolaseShift(initialParams);
    const nextArea = initialParams.area || getAreaForDateAndShift(nextDate, nextShift);
    setTpmDate(nextDate);
    setTpmShift(nextShift);
    setTpmArea(nextArea);
  }, [initialParams]);

  // Persist ONLY grid layout preference (captions are never stored to localStorage)
  useEffect(() => {
    savePreferences({ grid: gridType });
  }, [gridType]);

  const rows = getRowsForGrid(gridType);
  const effectiveDate = tpmDate || getLocalTodayStr();
  const isOffDay = parseInt(effectiveDate.split('-')[2], 10) === 31;

  const beforeCountNum = countValidSlots(beforeSlots.slice(0, rows));
  const afterCountNum = countValidSlots(afterSlots.slice(0, rows));
  const hasPhotos = beforeCountNum > 0 || afterCountNum > 0;

  useEffect(() => {
    onHasFilledPhotosChange?.(hasPhotos && !isReportSubmitted);
  }, [hasPhotos, isReportSubmitted, onHasFilledPhotosChange]);

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

  const handleDateChange = (newDate: string) => {
    const val = newDate || getOperationalShiftInfo().dateStr;
    const nextArea = getAreaForDateAndShift(val, tpmShift);
    setTpmDate(val);
    setTpmArea(nextArea);
    onAreaChange?.(nextArea);
  };

  const handleShiftChange = (newShift: ShiftName) => {
    const nextArea = getAreaForDateAndShift(effectiveDate, newShift);
    setTpmShift(newShift);
    setTpmArea(nextArea);
    onAreaChange?.(nextArea);
  };

  const handleAreaInputChange = (nextArea: string) => {
    setTpmArea(nextArea);
    onAreaChange?.(nextArea);
  };

  const handleGridSelect = (nextGrid: GridType) => {
    if (nextGrid === gridType) return;
    const nextRows = getRowsForGrid(nextGrid);
    setGridType(nextGrid);

    setBeforeSlots((prev) => {
      if (prev.length > nextRows) {
        freeSlotArray(prev.slice(nextRows));
        return prev.slice(0, nextRows);
      }
      return prev;
    });
    setAfterSlots((prev) => {
      if (prev.length > nextRows) {
        freeSlotArray(prev.slice(nextRows));
        return prev.slice(0, nextRows);
      }
      return prev;
    });
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
      // Selalu reset input setelah diproses agar handle file sementara Safari iOS tetap valid
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
        const len = Math.max(rows, target.index + 1);
        const next = Array.from({ length: len }, (_, idx) => prev[idx] || null);
        freeSingleSlot(next[target.index]);
        next[target.index] = processed;
        return next.slice(0, rows);
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

  const handleCopyCaption = async () => {
    const copied = await copyTextToClipboard(captionText);
    if (!isMountedRef.current) return;
    if (copied) {
      setCopyStatus('copied');
      window.setTimeout(() => {
        if (isMountedRef.current) setCopyStatus('idle');
      }, 2000);
    } else {
      setCopyStatus('error');
      window.setTimeout(() => {
        if (isMountedRef.current) setCopyStatus('idle');
      }, 2500);
    }
  };

  const triggerPostSendConfirmation = useCallback(
    (
      dateStr: string,
      shift: ShiftName,
      areaStr: string,
      previousEntry: ReportedLogEntry | null
    ) => {
      // Optimistic status update langsung ke state & Firestore tanpa menunggu visibilitychange
      void onReportSubmitted(dateStr, shift, areaStr);
      if (isMountedRef.current) {
        setIsReportSubmitted(true);
        onHasFilledPhotosChange?.(false);
        setExportStatus('idle');
        setPostSendModal({
          dateStr,
          shift,
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
    const { dateStr, shift, previousEntry } = postSendModal;
    setPostSendModal(null);
    setIsReportSubmitted(false);
    onHasFilledPhotosChange?.(hasPhotos);
    void onRestoreReport(dateStr, shift, previousEntry);
  };

  const handleExportCollage = () => {
    if (!hasPhotos || exportStatus === 'exporting') return;

    // Validasi wajib minimal 1 baris keterangan kegiatan terisi
    const hasActivityNote = [row1, row2, row3]
      .slice(0, rows)
      .some((val) => val.trim().length > 0);
    if (!hasActivityNote) {
      showWarningToast('Isi minimal 1 baris keterangan kegiatan dulu');
      return;
    }

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
  const displayAreaStamp = tpmArea.trim() || 'TPM UREA 1B';

  return (
    <>
      {toast && (
        <div
          role={toast.kind === 'loading' ? 'status' : 'alert'}
          className="modal-pop fixed bottom-6 left-1/2 z-[10000] flex w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 items-center justify-center gap-2 rounded-xl border border-[#ff9500]/60 bg-[#2a2216]/95 px-4 py-3 text-center text-[0.84rem] font-semibold text-[#ffd180] shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-md"
        >
          {toast.kind === 'loading' ? <IconLoader /> : <IconAlertTriangle />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="mb-2 flex w-full flex-col gap-4 overflow-hidden rounded-xl bg-[#1e1e1e] p-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.3)] sm:p-5">
        {/* File Picker: multiple khusus iOS (dengan auto-pick terakhir), Android single-select */}
        <input
          ref={slotPickerRef}
          type="file"
          accept="image/*"
          multiple={isIOS}
          onChange={handleSlotFileChange}
          className="hidden"
        />

        {/* Bagian 1: Kontrol Atas Rata Tengah (Tanggal, Shift, & Full-Width Tag Equipment) */}
        <div className="flex w-full flex-col gap-2">
          <div className="grid w-full grid-cols-2 gap-2">
            {/* Input Tanggal dengan Overlay Rata Tengah DD/MM/YYYY */}
            <div className="relative flex h-[42px] min-w-0 items-center justify-center rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] px-3">
              <span className="pointer-events-none whitespace-nowrap text-[16px] font-semibold text-white">
                {formatDateIndo(effectiveDate)}
              </span>
              <input
                type="date"
                id="tpmDateInput"
                aria-label="Tanggal"
                value={tpmDate}
                onChange={(e) => handleDateChange(e.target.value)}
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

            {/* Dropdown Shift Rata Tengah dengan Ikon Cuaca SVG 1em */}
            <div className="relative flex h-[42px] min-w-0 items-center">
              <span className="pointer-events-none absolute left-3 z-10 flex items-center text-base">
                <ShiftWeatherIcon shift={tpmShift} />
              </span>
              <select
                id="tpmShiftInput"
                aria-label="Shift"
                value={tpmShift}
                onChange={(e) => handleShiftChange(e.target.value as ShiftName)}
                className="tpm-select tpm-select-centered min-h-[42px]! px-8! py-2! text-center font-semibold"
              >
                <option value="PAGI">PAGI</option>
                <option value="SORE">SORE</option>
                <option value="MALAM">MALAM</option>
              </select>
            </div>
          </div>

          {/* Input Tag Equipment Full-Width & Rata Tengah */}
          <input
            type="text"
            id="tpmAreaInput"
            aria-label="Area / Equipment TPM"
            value={tpmArea}
            onChange={(e) => handleAreaInputChange(e.target.value)}
            placeholder="Area / Equipment TPM..."
            className="tpm-input min-h-[42px]! w-full py-2! text-center font-semibold"
          />

          {isOffDay && (
            <span className="inline-flex items-center justify-center gap-1.5 text-center text-[0.78rem] font-medium text-[#ff9500]">
              <IconAlertTriangle /> Tanggal 31 jadwal rutin libur TPM
            </span>
          )}
        </div>

        {/* Bagian 2: Live Preview Grid + Header Sejajar dengan Selector 2x1 | 2x2 | 2x3 */}
        <div className="flex w-full flex-col gap-2.5 border-t border-[#2c2c2c] pt-3.5">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[0.88rem] font-bold text-[#007aff]">
              <IconImage /> Preview
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
                    className={`h-full cursor-pointer rounded-md px-2.5 text-[0.76rem] font-bold transition active:scale-95 ${
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

          {/* Frame Kolase Live Preview (Anti-Overflow) */}
          <div className="w-full max-w-full overflow-hidden rounded-lg border border-[#2f2f2f] bg-black p-2 sm:p-2.5">
            {/* Header Frame: BEFORE | AFTER */}
            <div className="grid w-full grid-cols-2 gap-1.5 pb-1.5 text-center sm:gap-2">
              <span className="truncate text-sm font-extrabold tracking-wider text-white sm:text-base">
                BEFORE
              </span>
              <span className="truncate text-sm font-extrabold tracking-wider text-white sm:text-base">
                AFTER
              </span>
            </div>

            {/* Grid Baris 1..N */}
            <div className="flex w-full flex-col gap-1.5 sm:gap-2">
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
                    className="relative grid w-full min-w-0 grid-cols-2 gap-1.5 sm:gap-2"
                  >
                    {cells.map((cell) => (
                      <div
                        key={cell.side}
                        className="relative aspect-square w-full min-w-0 overflow-hidden rounded-[4px] bg-[#141414]"
                      >
                        {cell.slot ? (
                          <>
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
                              className="absolute top-1.5 right-1.5 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-[#ff453a]/85 text-sm font-bold text-white backdrop-blur-xs active:scale-90"
                            >
                              <IconClose />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => triggerSlotPicker(cell.side, r)}
                            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-[#444] bg-[#141414] p-2 text-[#8f8f8f] transition active:border-[#007aff] active:bg-[#1a2736] active:text-white"
                          >
                            <IconPlus className="text-xl text-[#007aff]" />
                            <span className="text-[0.72rem] font-semibold">{cell.label}</span>
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Overlay Keterangan Baris */}
                    {rowOverlayText && (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[5] flex justify-center">
                        <span className="max-w-full truncate rounded-md bg-black/80 px-2.5 py-1 text-center text-[0.7rem] font-bold text-white shadow-sm sm:text-xs">
                          {rowOverlayText}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Timestamp Metadata Strip Terbaca Jelas di Frame Bawah */}
            <div className="mt-2 border-t border-[#222] pt-2 text-center">
              <span className="block truncate text-[0.72rem] font-bold tracking-wide text-[#e5e7eb] sm:text-[0.8rem]">
                TPM {displayAreaStamp} &nbsp;•&nbsp; SHIFT {tpmShift} &nbsp;•&nbsp;{' '}
                {formatDateIndo(effectiveDate)}
              </span>
            </div>
          </div>

          {hasPhotos && (
            <button
              type="button"
              onClick={handleResetAllPhotos}
              className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#ff453a]/40 bg-[#ff453a]/12 px-3 py-2 text-[0.84rem] font-semibold text-[#ff6961] transition active:scale-[0.98] active:bg-[#ff453a]/22"
            >
              <IconTrash /> Reset Semua Foto
            </button>
          )}
        </div>

        {/* Bagian 3: Keterangan Kegiatan, Pratinjau Caption & Tombol Kirim ke WhatsApp */}
        <div className="flex w-full flex-col gap-3 border-t border-[#2c2c2c] pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[0.9rem] font-bold text-[#007aff]">
              <IconEditPen /> Keterangan Kegiatan
            </span>
            <button
              type="button"
              onClick={() => {
                setRow1('');
                setRow2('');
                setRow3('');
              }}
              className="cursor-pointer rounded-md border border-[#444] bg-[#2a2a2a] px-2.5 py-1 text-[0.72rem] font-semibold text-[#ccc] active:scale-[0.96] active:bg-[#383838]"
            >
              Bersihkan
            </button>
          </div>

          <div className="flex w-full flex-col gap-2">
            <input
              type="text"
              id="row1Text"
              aria-label="Kegiatan Baris 1"
              autoComplete="off"
              value={row1}
              onChange={(e) => setRow1(e.target.value)}
              placeholder="Misal: Regreasing BV"
              className="tpm-input"
            />

            {rows >= 2 && (
              <input
                type="text"
                id="row2Text"
                aria-label="Kegiatan Baris 2"
                autoComplete="off"
                value={row2}
                onChange={(e) => setRow2(e.target.value)}
                placeholder="Misal: Cleaning baseplate pompa"
                className="tpm-input"
              />
            )}

            {rows >= 3 && (
              <input
                type="text"
                id="row3Text"
                aria-label="Kegiatan Baris 3"
                autoComplete="off"
                value={row3}
                onChange={(e) => setRow3(e.target.value)}
                placeholder="Misal: Cleaning area & grating"
                className="tpm-input"
              />
            )}
          </div>

          {/* Pratinjau Caption WhatsApp */}
          <div className="flex w-full min-w-0 flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-[#aaaaaa]">
                <IconMessageSquare /> Caption WhatsApp
              </span>
              <button
                type="button"
                onClick={handleCopyCaption}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#444] bg-[#2e2e2e] px-2.5 py-1 text-[0.75rem] font-semibold text-white transition active:scale-[0.97]"
              >
                {copyStatus === 'copied' ? (
                  <>
                    <IconCheck className="text-[#4cd964]" /> Tersalin!
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
            <div className="w-full whitespace-pre-wrap break-words rounded-lg border border-[#3a3a3a] bg-[#252525] p-2.5 font-mono text-[0.8rem] text-[#72d572]">
              {captionText}
            </div>
          </div>

          {/* Tombol Utama "Kirim ke WhatsApp" (Aksen Hijau selaras indikator SHIFT AKTIF) */}
          <button
            type="button"
            disabled={!hasPhotos || exportStatus === 'exporting'}
            onClick={handleExportCollage}
            className="mt-0.5 inline-flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#34c759] px-5 py-3.5 text-base font-extrabold text-[#052310] shadow-[0_4px_14px_rgba(52,199,89,0.28)] transition hover:bg-[#3fd164] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#2a332d] disabled:text-[#6b7c70] disabled:shadow-none"
          >
            {exportStatus === 'exporting' ? (
              <>
                <span className="spinner border-[#052310]/30! border-t-[#052310]!" /> Menyiapkan
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

      {/* Modal Konfirmasi Pasca-Kirim WA (Terkunci / No Backdrop Dismiss) */}
      {postSendModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-send-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/84 p-4 backdrop-blur-[4px]"
        >
          <div className="modal-pop w-full max-w-[390px] rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-5 text-white shadow-[0_12px_34px_rgba(0,0,0,0.75)]">
            <h3
              id="post-send-title"
              className="mb-2 flex items-center gap-2 text-[1.04rem] font-bold text-[#34c759]"
            >
              <IconCheck /> Kolase TPM Berhasil Dibuat!
            </h3>
            <p className="mb-3.5 text-[0.88rem] leading-[1.5] text-[#d4d4d4]">
              Update status alat menjadi Terlapor &amp; bersihkan form?
            </p>
            <div className="mb-4 rounded-lg border border-[#333] bg-[#252525] px-3 py-2 text-[0.8rem]">
              <div className="flex items-center gap-1.5 font-bold text-[#8ab4f8]">
                <ShiftWeatherIcon shift={postSendModal.shift} />
                <span>
                  SHIFT {postSendModal.shift} • {formatDateIndo(postSendModal.dateStr)}
                </span>
              </div>
              <div className="truncate font-semibold text-white">{postSendModal.areaStr}</div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCancelPostSend}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-slate-600/50 bg-slate-700 px-3 py-2.5 text-[0.88rem] font-semibold text-slate-200 transition hover:bg-slate-600 active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmPostSend}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-[#34c759] px-3 py-2.5 text-[0.88rem] font-extrabold text-[#052310] transition hover:bg-[#3fd164] active:scale-[0.98]"
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
