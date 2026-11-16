import React from 'react';
import { IconAlertTriangle, IconSync } from './Icons';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('App ErrorBoundary caught:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] w-full max-w-[460px] flex-col items-center justify-center gap-3 self-center rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-white shadow-xl">
          <IconAlertTriangle className="h-8 w-8 text-amber-400" />
          <h2 className="text-lg font-bold text-rose-400">Terjadi Kesalahan Tampilan</h2>
          <p className="text-xs break-words text-slate-300">
            {this.state.message || 'Gagal memuat komponen aplikasi.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-500 active:scale-95"
          >
            <IconSync className="h-4 w-4" /> Muat Ulang Halaman
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
