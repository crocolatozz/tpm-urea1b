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

  // Keep refs to slots for safe unmount memory cleanup
  const slotsCleanupRef = useRef<{
    before: Array<LoadedPhotoSlot | null>;
    after: Array<LoadedPhotoSlot | null>;
  }>({ before: [], after: [] });
  slotsCleanupRef.current = { before: beforeSlots, after: afterSlots };

  useEffect(() => {
    return () => {
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

    const files = Array.from(inputEl.files || []);
    const target = pendingTargetRef.current;
    pendingTargetRef.current = null;

    if (files.length === 0 || !target) {
      inputEl.value = '';
      return;
    }

    setIsPickingFile(true);
    setLoadingMsg(`⏳ Memproses ${files.length} foto...`);

    try {
      const setSlots = target.side === 'before' ? setBeforeSlots : setAfterSlots;
      const currentArray = target.side === 'before' ? beforeSlots : afterSlots;
      const normalized = Array.from({ length: rows }, (_, idx) => currentArray[idx] || null);

      // Fill clicked slot first, then remaining empty slots in order if user picked multiple photos
      const targetIndices: number[] = [target.index];
      for (let i = 0; i < rows; i++) {
        if (i !== target.index && !normalized[i]) {
          targetIndices.push(i);
        }
      }

      const filesToProcess = files.slice(0, targetIndices.length);
      const processedResults: Array<{ idx: number; slot: LoadedPhotoSlot }> = [];

      for (let i = 0; i < filesToProcess.length; i++) {
        setLoadingMsg(`⏳ Memproses foto (${i + 1}/${filesToProcess.length})...`);
        const processed = await processAndResizeFile(filesToProcess[i]);
        if (processed) {
          processedResults.push({ idx: targetIndices[i], slot: processed });
        }
      }

      // Reset input AFTER processing so iOS Safari temp file handle stays valid
      inputEl.value = '';

      if (processedResults.length === 0) {
        setLoadingMsg('⚠️ Gagal memuat foto. Pastikan format gambar didukung.');
        return;
      }

      setSlots((prev) => {
        const next = Array.from({ length: rows }, (_, idx) => prev[idx] || null);
        processedResults.forEach(({ idx, slot }) => {
          freeSingleSlot(next[idx]);
          next[idx] = slot;
        });
        return next;
      });
      setLoadingMsg(null);
    } finally {
      setIsPickingFile(false);
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
    if (copied) {
      setCopyBtnLabel('✅ Caption Tersalin!');
      window.setTimeout(() => setCopyBtnLabel('📋 Salin Caption'), 2000);
    } else {
      setCopyBtnLabel('⚠️ Gagal Salin');
      window.setTimeout(() => setCopyBtnLabel('📋 Salin Caption'), 2500);
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
      exportCanvas.width = 1;
      exportCanvas.height = 1;
      setExportStatus('idle');
      return;
    }

    const currentAreaStr = tpmArea.trim() || 'TPM';

    exportCanvas.toBlob(
      async (blob) => {
        exportCanvas.width = 1;
        exportCanvas.height = 1;

        try {
          if (!blob) {
            setExportStatus('idle');
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
              setExportStatus('idle');
              return;
            } catch (err) {
              if (err instanceof Error && err.name === 'AbortError') {
                setExportStatus('idle');
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
          setExportStatus('done');
          window.setTimeout(() => setExportStatus('idle'), 2500);
        } catch {
          setExportStatus('idle');
        }
      },
      'image/jpeg',
      0.95
    );
  };

  const rowValues = [row1, row2, row3];
  const displayAreaStamp = tpmArea.trim() || 'TPM UREA 1B';

  return (
    <>
      {/* Panel Kontrol Ringkas */}
      <div className="w-full overflow-hidden rounded-xl bg-[#1e1e1e] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.3)] sm:p-5">
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            <label
              htmlFor="tpmDateInput"
              className="text-[0.82rem] font-semibold text-[#aaaaaa]"
            >
              Tanggal
            </label>
            <input
              type="date"
              id="tpmDateInput"
              value={tpmDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="tpm-input"
            />
          </div>

          <div className="flex w-full min-w-0 flex-col gap-1.5">
            <label
              htmlFor="tpmShiftInput"
              className="text-[0.82rem] font-semibold text-[#aaaaaa]"
            >
              Shift
            </label>
            <select
              id="tpmShiftInput"
              value={tpmShift}
              onChange={(e) => handleShiftChange(e.target.value as ShiftName)}
              className="tpm-select"
            >
              <option value="PAGI">☀️ PAGI</option>
              <option value="SORE">🌤️ SORE</option>
              <option value="MALAM">🌙 MALAM</option>
            </select>
          </div>

          <div className="col-span-full flex w-full min-w-0 flex-col gap-1.5">
            <label
              htmlFor="tpmAreaInput"
              className="text-[0.82rem] font-semibold text-[#aaaaaa]"
            >
              Area / Alat TPM
            </label>
            <input
              type="text"
              id="tpmAreaInput"
              value={tpmArea}
              onChange={(e) => setTpmArea(e.target.value)}
              placeholder="Otomatis atau isi manual..."
              className="tpm-input"
            />
            {isOffDay && (
              <span className="text-[0.8rem] font-medium text-[#ff9500]">
                ⚠️ Tanggal 31 jadwal rutin libur TPM
              </span>
            )}
          </div>

          {/* Pilihan Ukuran Grid */}
          <div className="col-span-full flex w-full min-w-0 flex-col gap-1.5">
            <label className="text-[0.82rem] font-semibold text-[#aaaaaa]">Ukuran Grid</label>
            <div className="grid w-full grid-cols-3 gap-2">
              {(
                [
                  { grid: '2x1', rowsCount: 1, sub: '2 Foto' },
                  { grid: '2x2', rowsCount: 2, sub: '4 Foto' },
                  { grid: '2x3', rowsCount: 3, sub: '6 Foto' },
                ] as const
              ).map((item) => {
                const active = gridType === item.grid;
                return (
                  <button
                    key={item.grid}
                    type="button"
                    onClick={() => handleGridSelect(item.grid)}
                    className={`flex cursor-pointer flex-col items-center justify-between gap-1.5 rounded-[10px] border-[1.5px] px-2 py-2.5 transition active:scale-[0.97] ${
                      active
                        ? 'border-[#007aff] bg-[#1a2736] text-white'
                        : 'border-[#3a3a3a] bg-[#252525] text-[#ccc]'
                    }`}
                  >
                    <div
                      className={`grid h-9 w-8 grid-cols-2 gap-[2.5px] rounded-[4px] border p-[2.5px] ${
                        active
                          ? 'border-[#64b5f6] bg-[#101b27]'
                          : 'border-[#444] bg-[#181818]'
                      }`}
                      style={{ gridTemplateRows: `repeat(${item.rowsCount}, 1fr)` }}
                    >
                      {Array.from({ length: item.rowsCount * 2 }).map((_, idx) => (
                        <span
                          key={idx}
                          className={`block rounded-[1.5px] ${
                            active ? 'bg-[#007aff]' : 'bg-[#555]'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[0.86rem] font-bold">{item.grid}</span>
                      <span
                        className={`text-[0.68rem] ${
                          active ? 'text-[#8ab4f8]' : 'text-[#aaaaaa]'
                        }`}
                      >
                        ({item.sub})
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Keterangan Kegiatan Model Lama (Datalist Autocomplete) */}
          <div className="col-span-full mt-1 flex items-center justify-between gap-2 border-b border-[#333] pb-1.5">
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

          <div className="col-span-full flex w-full min-w-0 flex-col gap-1">
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
          </div>

          {rows >= 2 && (
            <div className="col-span-full flex w-full min-w-0 flex-col gap-1">
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
            </div>
          )}

          {rows >= 3 && (
            <div className="col-span-full flex w-full min-w-0 flex-col gap-1">
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
            </div>
          )}

          {/* Pratinjau Caption WhatsApp */}
          <div className="col-span-full flex w-full min-w-0 flex-col gap-1.5 pt-1">
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
        </div>
      </div>

      {/* Hidden File Picker untuk Tap Langsung Grid */}
      <input
        ref={slotPickerRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSlotFileChange}
        className="hidden"
      />

      {/* Instagram-Style Interactive Live Preview Grid */}
      <div className="mb-2 flex w-full flex-col items-center gap-3 overflow-hidden rounded-xl bg-[#1e1e1e] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.3)] sm:p-5">
        <div className="flex w-full items-center justify-between text-[0.85rem]">
          <span className="font-bold text-[#007aff]">📸 Tap Grid untuk Isi Foto</span>
          <span className="text-[0.75rem] text-[#aaaaaa]">
            Before {beforeCountNum}/{rows} • After {afterCountNum}/{rows}
          </span>
        </div>

        {loadingMsg && (
          <div className="w-full rounded-lg border border-[#2b4c70] bg-[#1a2736] px-3 py-2 text-center text-xs font-semibold text-[#8ab4f8]">
            {loadingMsg}
          </div>
        )}

        {/* Frame Kolase Live Preview (Anti-Overflow) */}
        <div className="w-full max-w-full overflow-hidden rounded-lg border border-[#2f2f2f] bg-black p-2 sm:p-3">
          {/* Header Frame: BEFORE | AFTER */}
          <div className="grid w-full grid-cols-2 gap-1.5 pb-2 text-center sm:gap-2">
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

        {/* Tombol Reset & Ekspor */}
        <div className="flex w-full flex-col gap-2">
          {hasPhotos && (
            <button
              type="button"
              onClick={handleResetAllPhotos}
              className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#ff453a]/40 bg-[#ff453a]/12 px-3 py-2 text-[0.85rem] font-semibold text-[#ff6961] transition active:scale-[0.98] active:bg-[#ff453a]/22"
            >
              🗑️ Reset Semua Foto
            </button>
          )}

          <button
            type="button"
            disabled={!hasPhotos || exportStatus === 'exporting'}
            onClick={handleExportCollage}
            className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#007aff] px-5 py-3.5 text-base font-bold text-white transition hover:opacity-92 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#444] disabled:text-[#888]"
          >
            {exportStatus === 'exporting' ? (
              <>
                <span className="spinner" /> Menyiapkan gambar...
              </>
            ) : exportStatus === 'done' ? (
              '✅ Gambar Diunduh & Caption Tersalin!'
            ) : (
              '🚀 Kirim ke WhatsApp'
            )}
          </button>
        </div>
      </div>
    </>
  );
};
