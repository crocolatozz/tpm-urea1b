import React from 'react';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { IconClose, IconPlusSquare, IconShareIos } from './Icons';

interface IosInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IosInstallModal: React.FC<IosInstallModalProps> = ({ isOpen, onClose }) => {
  useModalScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex touch-none items-center justify-center overscroll-contain bg-slate-950/82 p-[18px] backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-pop w-full max-w-[440px] overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_10px_30px_rgba(2,6,23,0.75)]">
        <div className="mb-3.5 flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 className="text-[17px] font-bold text-white">Cara Install di iPhone / iPad</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup petunjuk install iOS"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <ol className="mb-4 list-decimal pl-5 text-[14px] leading-[1.6] text-slate-200">
          <li className="mb-2">
            Tap tombol{' '}
            <strong className="inline-flex items-center gap-1 text-white">
              Share <IconShareIos className="h-4 w-4 text-sky-400" />
            </strong>{' '}
            di bagian bawah Safari.
          </li>
          <li className="mb-2">
            Scroll ke bawah lalu pilih{' '}
            <strong className="inline-flex items-center gap-1 text-white">
              &quot;Tambah ke Layar Utama&quot; <IconPlusSquare className="h-4 w-4 text-sky-400" />
            </strong>
            .
          </li>
          <li className="mb-2">
            Tap <strong className="text-white">&quot;Tambah&quot;</strong> di pojok kanan atas.
          </li>
        </ol>
      </div>
    </div>
  );
};
