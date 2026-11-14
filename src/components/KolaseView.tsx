import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatDateIndo,
  getAreaForDateAndShift,
  getCurrentActiveShift,
  getLocalTodayStr,
  loadOverlayHistory,
  loadSavedPreferences,
  saveOverlayHistory,
  savePreferences,
  type GridType,
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

export interface KolaseInitialParams {
  date?: string;
  shift?: string;
  area?: string;
  requestKey?: number;
}

interface KolaseViewProps {
  initialParams?: KolaseInitialParams;
  onReportSubmitted: (dateStr: string, shift: ShiftName, area: string) => Promise<void>;
}

function getRowsForGrid(grid: GridType): number {
  return parseInt(grid.split('x')[1], 10) || 3;
}

function countValidSlots(slots: Array<LoadedPhotoSlot | null>): number {
  return slots.filter(Boolean).length;
}

export const KolaseView: React.FC<KolaseViewProps> = ({
  initialParams,
  onReportSubmitted,
}) => {
  const savedPrefs = useMemo(() => loadSavedPreferences(), []);

  const resolveInitialDate = (p?: KolaseInitialParams) =>
    p?.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : getLocalTodayStr();

  const resolveInitialShift = (p?: KolaseInitialParams): ShiftName =>
    p?.shift && (['PAGI', 'SORE', 'MALAM'] as const).includes(p.shift as ShiftName)
      ? (p.shift as ShiftName)
      : getCurrentActiveShift();

  const [tpmDate, setTpmDate] = useState<string>(() => resolveInitialDate(initialParams));
  const [tpmShift, setTpmShift] = useState<ShiftName>(() => resolveInitialShift(initialParams));
  const [tpmArea, setTpmArea] = useState<string>(() => {
    if (initialParams?.area) return initialParams.area;
    return getAreaForDateAndShift(
      resolveInitialDate(initialParams),
      resolveInitialShift(initialParams)
    );
  });

  const [gridType, setGridType] = useState<GridType>(savedPrefs.grid);
  const [row1, setRow1] = useState<string>(savedPrefs.row1);
  const [row2, setRow2] = useState<string>(savedPrefs.row2);
  const [row3, setRow3] = useState<string>(savedPrefs.row3);

  const [overlayHistory, setOverlayHistory] = useState<string[]>(() => loadOverlayHistory());

  const [beforeSlots, setBeforeSlots] = useState<Array<LoadedPhotoSlot | null>>([]);
  const [afterSlots, setAfterSlots] = useState<Array<LoadedPhotoSlot | null>>([]);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [isPickingFile, setIsPickingFile] = useState(false);

  const [copyBtnLabel, setCopyBtnLabel] = useState('📋 Salin Caption');
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done'>('idle');

  const slotPickerRef = useRef<HTMLInputElement | null>(null);
  const pendingTargetRef = useRef<{ side: 'before' | 'after'; index: number } | null>(null);
  const isMountedRef = useRef(true);

  // Keep refs to slots for safe unmount memory cleanup
  const slotsCleanupRef = useRef<{
    before: Array<LoadedPhotoSlot | null>;
    after: Array<LoadedPhotoSlot | null>;
  }>({ before: [], after: [] });
  slotsCleanupRef.current = { before: beforeSlots, after: afterSlots };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      freeSlotArray(slotsCleanupRef.current.before);
      freeSlotArray(slotsCleanupRef.current.after);
    };
  }, []);

  // Sync incoming navigation params when user taps a schedule card
  useEffect(() => {
    if (!initialParams?.requestKey) return;
    const nextDate = resolveInitialDate(initialParams);
    const nextShift = resolveInitialShift(initialParams);
    setTpmDate(nextDate);
    setTpmShift(nextShift);
    setTpmArea(initialParams.area || getAreaForDateAndShift(nextDate, nextShift));
  }, [initialParams]);

  // Persist grid & row draft texts automatically
  useEffect(() => {
    savePreferences({
      grid: gridType,
      row1,
      row2,
      row3,
    });
  }, [gridType, row1, row2, row3]);

  const rows = getRowsForGrid(gridType);
  const effectiveDate = tpmDate || getLocalTodayStr();
  const isOffDay = parseInt(effectiveDate.split('-')[2], 10) === 31;

  const beforeCountNum = countValidSlots(beforeSlots.slice(0, rows));
  const afterCountNum = countValidSlots(afterSlots.slice(0, rows));
  const hasPhotos = beforeCountNum > 0 || afterCountNum > 0;

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
    const val = newDate || getLocalTodayStr();
    setTpmDate(val);
    setTpmArea(getAreaForDateAndShift(val, tpmShift));
  };

  const handleShiftChange = (newShift: ShiftName) => {
    setTpmShift(newShift);
    setTpmArea(getAreaForDateAndShift(effectiveDate, newShift));
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

    const file = inputEl.files?.[0];
    const target = pendingTargetRef.current;
    pendingTargetRef.current = null;

    if (!file || !target) {
      inputEl.value = '';
      return;
    }

    setIsPickingFile(true);
    setLoadingMsg('⏳ Memproses foto...');

    try {
      const processed = await processAndResizeFile(file);
      // Reset input AFTER processing so iOS Safari temp file handle stays valid
      inputEl.value = '';

      if (!isMountedRef.current) {
        freeSingleSlot(processed);
        return;
      }

      if (!processed) {
        setLoadingMsg('⚠️ Gagal memuat foto. Pastikan format gambar didukung.');
        return;
      }

      const setSlots = target.side === 'before' ? setBeforeSlots : setAfterSlots;
      setSlots((prev) => {
        const len = Math.max(rows, target.index + 1);
        const next = Array.from({ length: len }, (_, idx) => prev[idx] || null);
        freeSingleSlot(next[target.index]);
        next[target.index] = processed;
        return next.slice(0, rows);
      });
      setLoadingMsg(null);
    } finally {
      if (isMountedRef.current) {
        setIsPickingFile(false);
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
  };

  const handleResetAllPhotos = () => {
    freeSlotArray(beforeSlots);
    freeSlotArray(afterSlots);
    setBeforeSlots([]);
    setAfterSlots([]);
    setLoadingMsg(null);
    if (slotPickerRef.current) slotPickerRef.current.value = '';
  };

  const handleCommitHistory = useCallback(() => {
    const updated = saveOverlayHistory([row1, row2, row3]);
    setOverlayHistory(updated);
  }, [row1, row2, row3]);

  const handleCopyCaption = async () => {
    handleCommitHistory();
    const copied = await copyTextToClipboard(captionText);
    if (!isMountedRef.current) return;
    if (copied) {
      setCopyBtnLabel('✅ Tersalin!');
      window.setTimeout(() => {
        if (isMountedRef.current) setCopyBtnLabel('📋 Salin Caption');
      }, 2000);
    } else {
      setCopyBtnLabel('⚠️ Gagal Salin');
      window.setTimeout(() => {
        if (isMountedRef.current) setCopyBtnLabel('📋 Salin Caption');
      }, 2500);
    }
  };

  const handleExportCollage = () => {
    if (!hasPhotos || exportStatus === 'exporting') return;

    setExportStatus('exporting');
    handleCommitHistory();

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
              await onReportSubmitted(effectiveDate, tpmShift, currentAreaStr);
              if (isMountedRef.current) setExportStatus('idle');
              return;
            } catch (err) {
              if (err instanceof Error && err.name === 'AbortError') {
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

          await onReportSubmitted(effectiveDate, tpmShift, currentAreaStr);
          if (isMountedRef.current) {
            setExportStatus('done');
            window.setTimeout(() => {
              if (isMountedRef.current) setExportStatus('idle');
            }, 2500);
          }
        } catch {
          if (isMountedRef.current) setExportStatus('idle');
        }
      },
      'image/jpeg',
      0.95
    );
  };

  const rowValues = [row1, row2, row3];
  const displayAreaStamp = tpmArea.trim() || 'TPM UREA 1B';

  return (
    <div className="mb-2 flex w-full flex-col gap-4 overflow-hidden rounded-xl bg-[#1e1e1e] p-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.3)] sm:p-5">
      {/* Hidden Single-Photo Picker untuk Tap Langsung Grid (strictly 1 foto per tap) */}
      <input
        ref={slotPickerRef}
        type="file"
        accept="image/*"
        onChange={handleSlotFileChange}
        className="hidden"
      />

      {/* Bagian 1: Kontrol Atas (Tanggal, Shift, & Full-Width Area / Equipment) */}
      <div className="flex w-full flex-col gap-2">
        <div className="grid w-full grid-cols-2 gap-2">
          <input
            type="date"
            id="tpmDateInput"
            aria-label="Tanggal"
            value={tpmDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="tpm-input min-h-[42px]! py-2!"
          />
          <select
            id="tpmShiftInput"
            aria-label="Shift"
            value={tpmShift}
            onChange={(e) => handleShiftChange(e.target.value as ShiftName)}
            className="tpm-select min-h-[42px]! py-2!"
          >
            <option value="PAGI">☀️ PAGI</option>
            <option value="SORE">🌤️ SORE</option>
            <option value="MALAM">🌙 MALAM</option>
          </select>
        </div>

        <input
          type="text"
          id="tpmAreaInput"
          aria-label="Area / Equipment TPM"
          value={tpmArea}
          onChange={(e) => setTpmArea(e.target.value)}
          placeholder="Area / Equipment TPM..."
          className="tpm-input min-h-[42px]! w-full py-2!"
        />

        {isOffDay && (
          <span className="text-[0.78rem] font-medium text-[#ff9500]">
            ⚠️ Tanggal 31 jadwal rutin libur TPM
          </span>
        )}
      </div>

      {/* Bagian 2: Live Preview Grid + Header Sejajar dengan Selector 2x1 | 2x2 | 2x3 */}
      <div className="flex w-full flex-col gap-2.5 border-t border-[#2c2c2c] pt-3.5">
        <div className="flex w-full items-center justify-between gap-2">
          <span className="shrink-0 whitespace-nowrap text-[0.88rem] font-bold text-[#007aff]">
            🖼️ Preview
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

        {loadingMsg && (
          <div className="w-full rounded-lg border border-[#2b4c70] bg-[#1a2736] px-3 py-1.5 text-center text-xs font-semibold text-[#8ab4f8]">
            {loadingMsg}
          </div>
        )}

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
                <div key={r} className="relative grid w-full min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
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
                              onClick={() => triggerSlotPicker(cell.side, r)}
                              className="h-full w-full cursor-pointer object-cover"
                            />
                          ) : (
                            <div
                              onClick={() => triggerSlotPicker(cell.side, r)}
                              className="flex h-full w-full cursor-pointer items-center justify-center bg-[#1c1c1c] text-xs text-[#888]"
                            >
                              {cell.label}
                            </div>
                          )}

                          {/* Tombol mini Ganti / Hapus pada slot terisi */}
                          <div className="absolute top-1.5 right-1.5 z-10 flex gap-1">
                            <button
                              type="button"
                              aria-label={`Ganti ${cell.label}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerSlotPicker(cell.side, r);
                              }}
                              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-black/70 text-xs font-bold text-white backdrop-blur-xs active:scale-90"
                            >
                              ↻
                            </button>
                            <button
                              type="button"
                              aria-label={`Hapus ${cell.label}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSingleSlot(cell.side, r);
                              }}
                              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-[#ff453a]/85 text-xs font-bold text-white backdrop-blur-xs active:scale-90"
                            >
                              ✕
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => triggerSlotPicker(cell.side, r)}
                          className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-[#444] bg-[#141414] p-2 text-[#8f8f8f] transition active:border-[#007aff] active:bg-[#1a2736] active:text-white"
                        >
                          <span className="text-xl leading-none font-bold text-[#007aff]">+</span>
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
            🗑️ Reset Semua Foto
          </button>
        )}
      </div>

      {/* Bagian 3: Keterangan Kegiatan, Pratinjau Caption & Tombol Kirim ke WhatsApp */}
      <div className="flex w-full flex-col gap-3 border-t border-[#2c2c2c] pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.9rem] font-bold text-[#007aff]">✍️ Keterangan Kegiatan</span>
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

        <datalist id="overlayHistoryList">
          {overlayHistory.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <div className="flex w-full flex-col gap-2">
          <input
            type="text"
            id="row1Text"
            aria-label="Kegiatan Baris 1"
            list="overlayHistoryList"
            value={row1}
            onChange={(e) => setRow1(e.target.value)}
            onBlur={handleCommitHistory}
            placeholder="Baris 1 (misal: Regreasing BV)"
            className="tpm-input"
          />

          {rows >= 2 && (
            <input
              type="text"
              id="row2Text"
              aria-label="Kegiatan Baris 2"
              list="overlayHistoryList"
              value={row2}
              onChange={(e) => setRow2(e.target.value)}
              onBlur={handleCommitHistory}
              placeholder="Baris 2 (misal: Cleaning baseplate pompa)"
              className="tpm-input"
            />
          )}

          {rows >= 3 && (
            <input
              type="text"
              id="row3Text"
              aria-label="Kegiatan Baris 3"
              list="overlayHistoryList"
              value={row3}
              onChange={(e) => setRow3(e.target.value)}
              onBlur={handleCommitHistory}
              placeholder="Baris 3 (misal: Cleaning area & grating)"
              className="tpm-input"
            />
          )}
        </div>

        {/* Pratinjau Caption WhatsApp */}
        <div className="flex w-full min-w-0 flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.82rem] font-semibold text-[#aaaaaa]">
              💬 Caption WhatsApp
            </span>
            <button
              type="button"
              onClick={handleCopyCaption}
              className="cursor-pointer rounded-md border border-[#444] bg-[#2e2e2e] px-2.5 py-1 text-[0.75rem] font-semibold text-white transition active:scale-[0.97]"
            >
              {copyBtnLabel}
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
          ) : exportStatus === 'done' ? (
            '✅ Gambar Diunduh & Caption Tersalin!'
          ) : (
            '🚀 Kirim ke WhatsApp'
          )}
        </button>
      </div>
    </div>
  );
};
