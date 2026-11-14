import React from 'react';
import { APP_VERSION } from '../data/tpmData';
import type { UpdateModalState } from '../hooks/useAppUpdater';

interface ForceUpdateModalProps {
  modalState: UpdateModalState;
  isUpdating: boolean;
  errorMsg: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({
  modalState,
  isUpdating,
  errorMsg,
  onConfirm,
  onDismiss,
}) => {
  if (modalState.mode === 'closed') return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/82 p-4 backdrop-blur-[4px]">
      <div className="modal-pop max-h-[90dvh] w-full max-w-[440px] overflow-y-auto rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
        <div className="mb-3.5 flex items-center justify-between border-b border-[#333] pb-2.5">
          <h3 className="text-[1.05rem] font-bold text-[#007aff]">
            🚀 Pembaruan Aplikasi Tersedia
          </h3>
        </div>

        <div>
          <div className="mb-3.5 flex items-center justify-around gap-2.5 rounded-xl border border-[#363636] bg-[#252525] p-3.5 text-center">
            <div className="flex flex-col gap-1">
              <span className="text-[0.74rem] uppercase tracking-[0.4px] text-[#aaaaaa]">
                Versi Saat Ini
              </span>
              <span className="text-[1.1rem] font-extrabold text-[#ff9500]">
                v{APP_VERSION}
              </span>
            </div>
            <span className="text-[1.2rem] font-bold text-[#8ab4f8]">➔</span>
            <div className="flex flex-col gap-1">
              <span className="text-[0.74rem] uppercase tracking-[0.4px] text-[#aaaaaa]">
                Versi Terbaru
              </span>
              <span className="text-[1.1rem] font-extrabold text-[#34c759]">
                v{modalState.remoteVersion}
              </span>
            </div>
          </div>

          <p className="mb-3.5 text-center text-[0.88rem] leading-normal text-[#d8d8d8]">
            {modalState.releaseNotes ||
              'Versi baru aplikasi TPM Urea 1B sudah siap. Perbarui sekarang agar fitur dan jadwal selalu akurat.'}
          </p>

          {errorMsg && (
            <div className="mb-3.5 rounded-lg border border-[#ff9500]/35 bg-[#ff9500]/12 px-3 py-2.5 text-left text-[0.8rem] leading-[1.45] text-[#ffb340]">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={isUpdating}
              onClick={onConfirm}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#007aff] px-5 py-3.5 text-base font-bold text-white transition hover:opacity-92 disabled:cursor-not-allowed disabled:bg-[#444] disabled:text-[#888]"
            >
              {isUpdating ? (
                <>
                  <span className="spinner" /> Memperbarui aplikasi...
                </>
              ) : errorMsg ? (
                '🔄 Coba Lagi'
              ) : (
                '🔄 Update Sekarang'
              )}
            </button>

            {!isUpdating && (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#444] bg-[#2e2e2e] px-3 py-2.5 text-[0.85rem] font-semibold text-white transition hover:opacity-92 active:scale-[0.97] active:bg-[#3a3a3a]"
              >
                {errorMsg ? 'Tutup' : 'Nanti Saja'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
