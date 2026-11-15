import React, { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import {
  COLLAGE_CELL_ASPECT,
  renderEditedSlot,
  type CropAreaPixels,
  type LoadedPhotoSlot,
} from '../utils/imageCollage';

interface PhotoEditorModalProps {
  isOpen: boolean;
  slotLabel: string;
  slot: LoadedPhotoSlot | null;
  onSave: (updatedSlot: LoadedPhotoSlot) => void;
  onReplacePhoto: () => void;
  onCancel: () => void;
}

export const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({
  isOpen,
  slotLabel,
  slot,
  onSave,
  onReplacePhoto,
  onCancel,
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropAreaPixels | null>(null);

  useEffect(() => {
    if (!isOpen || !slot) return;
    setCrop(slot.editParams?.crop ?? { x: 0, y: 0 });
    setZoom(slot.editParams?.zoom ?? 1);
    setRotation(slot.editParams?.rotation ?? 0);
    setCroppedAreaPixels(null);
  }, [isOpen, slot]);

  const handleCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels({
      x: pixels.x,
      y: pixels.y,
      width: pixels.width,
      height: pixels.height,
    });
  }, []);

  if (!isOpen || !slot) return null;

  const handleRotate90 = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleSave = () => {
    const fallbackPixels: CropAreaPixels = {
      x: 0,
      y: 0,
      width: rotation % 180 === 0 ? slot.sourceCanvas.width : slot.sourceCanvas.height,
      height: rotation % 180 === 0 ? slot.sourceCanvas.height : slot.sourceCanvas.width,
    };
    const targetPixels = croppedAreaPixels || fallbackPixels;
    const edited = renderEditedSlot(slot, targetPixels, rotation, {
      crop,
      zoom,
      rotation,
    });
    if (edited) {
      onSave(edited);
    } else {
      onCancel();
    }
  };

  return (
    // Backdrop sengaja tidak memiliki onClick dismiss agar geseran jari tidak menutup editor
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-editor-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/88 p-3.5 backdrop-blur-[4px]"
    >
      <div className="modal-pop flex max-h-[92dvh] w-full max-w-[440px] flex-col gap-3.5 rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-4 text-white shadow-[0_12px_36px_rgba(0,0,0,0.75)]">
        {/* Zona 1: Header Atas (Judul di kiri, tombol pil 🖼️ Ganti Foto di kanan — tanpa tombol ✕) */}
        <div className="flex items-center justify-between gap-2 border-b border-[#303030] pb-2.5">
          <h3 id="photo-editor-title" className="truncate text-[0.98rem] font-bold text-white">
            Atur Foto ({slotLabel})
          </h3>
          <button
            type="button"
            onClick={onReplacePhoto}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[#3a4f66] bg-[#1b2938] px-3 py-1.5 text-[0.76rem] font-bold text-[#8ab4f8] transition hover:bg-[#23364b] active:scale-95"
          >
            🖼️ Ganti Foto
          </button>
        </div>

        {/* Zona 2: Kanvas Tengah react-easy-crop (aspek rasio sinkron dari imageCollage.ts 1:1) */}
        <div className="relative h-[290px] w-full overflow-hidden rounded-xl border border-[#2f2f2f] bg-black sm:h-[330px]">
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

        {/* Zona 3: Kontrol Bawah */}
        <div className="flex flex-col gap-3">
          {/* Baris Alat: Slider Zoom tipis (kiri) + Rotate 90° & Reset (kanan) */}
          <div className="flex items-center gap-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#323232] bg-[#252525] px-2.5 py-2">
              <span className="shrink-0 text-[0.72rem] font-semibold text-[#aaa]">Zoom</span>
              <input
                type="range"
                aria-label="Zoom foto"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="h-1.5 w-full min-w-0 cursor-pointer accent-[#007aff]"
              />
              <span className="w-8 shrink-0 text-right font-mono text-[0.7rem] font-semibold text-[#8ab4f8]">
                {zoom.toFixed(1)}x
              </span>
            </div>

            <button
              type="button"
              onClick={handleRotate90}
              className="shrink-0 cursor-pointer rounded-lg border border-[#3a3a3a] bg-[#282828] px-2.5 py-2 text-[0.78rem] font-bold text-white transition hover:bg-[#323232] active:scale-95"
            >
              ↻ 90°
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 cursor-pointer rounded-lg border border-[#3a3a3a] bg-[#282828] px-2.5 py-2 text-[0.78rem] font-semibold text-[#ccc] transition hover:bg-[#323232] active:scale-95"
            >
              Reset
            </button>
          </div>

          {/* Baris Aksi: Batal (abu-abu gelap, kiri) & Simpan (biru solid, kanan) */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-[#444] bg-[#2c2c2c] px-4 py-2.5 text-[0.9rem] font-semibold text-white transition hover:bg-[#353535] active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-[#007aff] px-4 py-2.5 text-[0.9rem] font-bold text-white transition hover:opacity-92 active:scale-[0.98]"
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
