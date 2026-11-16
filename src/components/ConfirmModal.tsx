import React from 'react';
import { useModalScrollLock } from '../hooks/useModalScrollLock';

interface ConfirmModalProps {
  isOpen: boolean;
  titleId: string;
  title: React.ReactNode;
  titleToneClass?: string;
  confirmLabel: string;
  confirmTone?: 'sky' | 'rose';
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  titleId,
  title,
  titleToneClass = 'text-white',
  confirmLabel,
  confirmTone = 'sky',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  children,
}) => {
  useModalScrollLock(isOpen);

  if (!isOpen) return null;

  const confirmBtnClass =
    confirmTone === 'rose'
      ? 'border border-rose-500/40 bg-rose-600 text-white hover:bg-rose-500'
      : 'border-0 bg-sky-600 text-white hover:bg-sky-500';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overscroll-contain bg-slate-950/84 p-4 backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal-pop w-full max-w-[380px] overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_12px_34px_rgba(2,6,23,0.8)]">
        <h3
          id={titleId}
          className={`mb-2 flex items-center gap-2 text-base font-bold ${titleToneClass}`}
        >
          {title}
        </h3>
        {children}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg px-3 py-2.5 text-[14px] font-bold transition active:scale-[0.98] ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
