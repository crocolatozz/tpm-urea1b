import React from 'react';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import {
  IconAlertTriangle,
  IconClose,
  IconCloudOff,
  IconFlaskConical,
  IconImage,
  IconRocket,
  IconTrash,
} from './Icons';

interface DeveloperModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAutoFillExtreme: () => void;
  onTestToasts: () => void;
  onSimulatePwaUpdate: () => void;
  onCleanupAndExit: () => void;
}

export const DeveloperModeModal: React.FC<DeveloperModeModalProps> = ({
  isOpen,
  onClose,
  onAutoFillExtreme,
  onTestToasts,
  onSimulatePwaUpdate,
  onCleanupAndExit,
}) => {
  useModalScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-mode-title"
      className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overscroll-contain bg-slate-950/85 p-4 backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-pop w-full max-w-[420px] overscroll-contain rounded-2xl border border-amber-500/40 bg-slate-900 p-5 text-white shadow-[0_12px_36px_rgba(2,6,23,0.85)]">
        <div className="mb-3.5 flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <h3
            id="dev-mode-title"
            className="flex items-center gap-2 text-[17px] font-bold text-amber-300"
          >
            <IconFlaskConical className="h-5 w-5 text-amber-400" />
            <span>Developer Mode</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Developer Mode"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-amber-500/35 bg-[#0F172A] px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <IconCloudOff className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Firestore Sync: OFF</span>
          </div>
          <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
            Lokal Aman
          </span>
        </div>

        <p className="mb-3.5 text-xs leading-relaxed text-slate-300">
          Mode pengujian terisolasi aktif. Semua tulis/hapus ke Firestore &amp; localStorage diblokir
          sementara agar data produksi operator tetap bersih.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onAutoFillExtreme}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3.5 py-3 text-left transition hover:bg-sky-500/25 active:scale-[0.98]"
          >
            <IconImage className="h-5 w-5 shrink-0 text-sky-400" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-white">Auto-Fill Uji Ekstrem</div>
              <div className="text-xs text-slate-300">
                Grid 2x3, 6 foto kontras 1080px, tag panjang &amp; 30 karakter A-Z/0-9
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onTestToasts}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-3 text-left transition hover:bg-amber-500/25 active:scale-[0.98]"
          >
            <IconAlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-white">
                Tes Toast (Warning, Error &amp; Sukses)
              </div>
              <div className="text-xs text-slate-300">
                Putar berurutan 3 varian notifikasi toast SVG untuk inspeksi visual
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onSimulatePwaUpdate}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-3 text-left transition hover:bg-emerald-500/25 active:scale-[0.98]"
          >
            <IconRocket className="h-5 w-5 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-white">Simulasi Pop-up Update PWA</div>
              <div className="text-xs text-slate-300">
                Tampilkan modal pembaruan aplikasi tanpa memuat ulang
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onCleanupAndExit}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-3 text-left transition hover:bg-rose-500/25 active:scale-[0.98]"
          >
            <IconTrash className="h-5 w-5 shrink-0 text-rose-400" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-rose-200">Bersihkan Dummy &amp; Keluar</div>
              <div className="text-xs text-rose-300/80">
                Hapus foto &amp; status simulasi, lalu muat ulang data asli Firestore
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
