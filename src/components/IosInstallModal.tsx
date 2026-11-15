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
      className="fixed inset-0 z-[9999] flex touch-none items-center justify-center overscroll-contain bg-black/82 p-[18px] backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-pop w-full max-w-[440px] overscroll-contain rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
        <div className="mb-3.5 flex items-center justify-between border-b border-[#333] pb-2.5">
          <h3 className="text-[1.05rem] font-bold text-[#007aff]">
            Cara Install di iPhone / iPad
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup petunjuk install iOS"
            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border border-[#444] bg-[#2c2c2c] text-base text-[#ccc]"
          >
            <IconClose />
          </button>
        </div>

        <ol className="mb-[18px] list-decimal pl-5 text-[0.9rem] leading-[1.6] text-[#ddd]">
          <li className="mb-2">
            Tap tombol{' '}
            <strong className="inline-flex items-center gap-1">
              Share <IconShareIos className="text-[#64b5f6]" />
            </strong>{' '}
            di bagian bawah Safari.
          </li>
          <li className="mb-2">
            Scroll ke bawah lalu pilih{' '}
            <strong className="inline-flex items-center gap-1">
              &quot;Tambah ke Layar Utama&quot; <IconPlusSquare className="text-[#64b5f6]" />
            </strong>
            .
          </li>
          <li className="mb-2">
            Tap <strong>&quot;Tambah&quot;</strong> di pojok kanan atas.
          </li>
        </ol>
      </div>
    </div>
  );
};
