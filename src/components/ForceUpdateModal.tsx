import React from 'react';
import { APP_VERSION } from '../data/tpmData';
import {
  normalizeReleaseNotes,
  type UpdateModalState,
  type UpdatePhase,
} from '../hooks/useAppUpdater';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { IconArrowRight, IconRocket, IconSync, IconWifiOff } from './Icons';

interface ForceUpdateModalProps {
  modalState: UpdateModalState;
  updatePhase: UpdatePhase;
  errorMsg: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({
  modalState,
  updatePhase,
  errorMsg,
  onConfirm,
  onDismiss,
}) => {
  useModalScrollLock(modalState.mode !== 'closed');

  if (modalState.mode === 'closed') return null;

  const isBusy = updatePhase !== 'idle';
  const notesList = Array.isArray(modalState.releaseNotes)
    ? modalState.releaseNotes
    : normalizeReleaseNotes(modalState.releaseNotes);

  return (
    <div className="fixed inset-0 z-[9999] flex touch-none items-center justify-center overscroll-contain bg-slate-950/82 p-4 backdrop-blur-[4px]">
      <div className="modal-pop max-h-[90dvh] w-full max-w-[440px] overflow-y-auto overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_10px_30px_rgba(2,6,23,0.75)]">
        <div className="mb-3.5 flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 className="flex items-center gap-2 text-[17px] font-bold text-white">
            <IconRocket className="h-5 w-5 text-sky-400" /> Pembaruan Aplikasi Tersedia
          </h3>
        </div>

        <div>
          <div className="mb-3.5 flex items-center justify-around gap-2.5 rounded-xl border border-slate-700/80 bg-slate-800/80 p-3.5 text-center">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Versi Saat Ini
              </span>
              <span className="font-mono text-[17px] font-extrabold text-amber-400">
                v{APP_VERSION}
              </span>
            </div>
            <IconArrowRight className="h-5 w-5 text-sky-400" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Versi Terbaru
              </span>
              <span className="font-mono text-[17px] font-extrabold text-emerald-400">
                v{modalState.remoteVersion}
              </span>
            </div>
          </div>

          <div className="mb-3.5 max-h-40 overflow-y-auto rounded-xl border border-slate-700/70 bg-slate-800/60 px-3.5 py-2.5 text-left">
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[13px] leading-[1.5] text-slate-200">
              {notesList.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>

          {errorMsg && (
            <div className="mb-3.5 flex items-start gap-2 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2.5 text-left text-xs leading-[1.5] text-rose-200">
              <IconWifiOff className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={onConfirm}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-sky-600 px-5 py-3.5 text-base font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400"
            >
              {updatePhase === 'reloading' ? (
                <>
                  <span className="spinner" /> Memuat ulang...
                </>
              ) : updatePhase === 'updating' ? (
                <>
                  <span className="spinner" /> Memperbarui...
                </>
              ) : errorMsg ? (
                <>
                  <IconSync className="h-5 w-5" /> Coba Lagi
                </>
              ) : (
                <>
                  <IconSync className="h-5 w-5" /> Update Sekarang
                </>
              )}
            </button>

            {!isBusy && (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-[0.97]"
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
