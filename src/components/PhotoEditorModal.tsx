import React, { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import {
  COLLAGE_CELL_ASPECT,
  renderEditedSlot,
  type CropAreaPixels,
  type LoadedPhotoSlot,
} from '../utils/imageCollage';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { IconImageSwap, IconRotateCw } from './Icons';

interface PhotoEditorModalProps {
  isOpen: boolean;
  slotLabel: string;
  slot: LoadedPhotoSlot | null;
  onSave: (updatedSlot: LoadedPhotoSlot) => void;
  onReplacePhoto: () => void;
  onCancel: () => void;
  onError?: (message: string) => void;
}

export const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({
  isOpen,
  slotLabel,
  slot,
  onSave,
  onReplacePhoto,
  onCancel,
  onError,
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropAreaPixels | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !slot) return;
    setCrop(slot.editParams?.crop ?? { x: 0, y: 0 });
    setZoom(slot.editParams?.zoom ?? 1);
    setRotation(slot.editParams?.rotation ?? 0);
    setCroppedAreaPixels(null);
    setIsSaving(false);
  }, [isOpen, slot]);

  const handleCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels({
      x: pixels.x,
      y: pixels.y,
      width: pixels.width,
      height: pixels.height,
    });
  }, []);

  useModalScrollLock(isOpen && slot !== null);

  if (!isOpen || !slot) return null;

  const handleRotate90 = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const fallbackPixels: CropAreaPixels = {
        x: 0,
        y: 0,
        width: rotation % 180 === 0 ? slot.sourceCanvas.width : slot.sourceCanvas.height,
        height: rotation % 180 === 0 ? slot.sourceCanvas.height : slot.sourceCanvas.width,
      };
      const targetPixels = croppedAreaPixels || fallbackPixels;
      const edited = await renderEditedSlot(slot, targetPixels, rotation, {
        crop,
        zoom,
        rotation,
      });
      if (edited) {
        onSave(edited);
      } else {
        onError?.('Gagal menyimpan hasil edit foto.');
        onCancel();
      }
    } catch {
      onError?.('Terjadi kesalahan saat memproses edit foto.');
      onCancel();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-editor-title"
      className="fixed inset-0 z-[9999] flex touch-none items-center justify-center overscroll-contain bg-slate-950/88 p-3.5 backdrop-blur-[4px]"
    >
      <div className="modal-pop flex max-h-[92dvh] w-full max-w-[440px] flex-col gap-3.5 overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-4 text-white shadow-[0_12px_36px_rgba(2,6,23,0.85)]">
        {/* Header Atas */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <h3 id="photo-editor-title" className="truncate text-[15px] font-bold text-white sm:text-base">
            Atur Foto ({slotLabel})
          </h3>
          <button
            type="button"
            onClick={onReplacePhoto}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-300 transition hover:bg-sky-500/25 active:scale-95"
          >
            <IconImageSwap className="h-4 w-4" /> Ganti Foto
          </button>
        </div>

        {/* Kanvas Tengah react-easy-crop */}
        <div className="relative h-[290px] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 sm:h-[330px]">
          <Cropper
            image={slot.sourceUrl || slot.previewUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={COLLAGE_CELL_ASPECT}
            minZoom={1}
            maxZoom={3}
            showGrid={true}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        {/* Kontrol Bawah */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2">
              <span className="shrink-0 text-xs font-semibold text-slate-300">Zoom</span>
              <input
                type="range"
                aria-label="Zoom foto"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="h-1.5 w-full min-w-0 cursor-pointer accent-sky-400"
              />
              <span className="w-8 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-sky-300">
                {zoom.toFixed(1)}x
              </span>
            </div>

            <button
              type="button"
              onClick={handleRotate90}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-[13px] font-bold text-white transition hover:bg-slate-700 active:scale-95"
            >
              <IconRotateCw className="h-4 w-4 text-sky-400" /> 90°
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 cursor-pointer rounded-lg border border-rose-500/35 bg-rose-500/15 px-2.5 py-2 text-[13px] font-semibold text-rose-300 transition hover:bg-rose-500/25 active:scale-95"
            >
              Reset
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={isSaving}
              onClick={onCancel}
              className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-sky-600 px-4 py-2.5 text-[14px] font-bold text-white transition hover:bg-sky-500 active:scale-[0.98] disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <span className="spinner" /> Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
