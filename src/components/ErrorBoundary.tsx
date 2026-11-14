import React from 'react';

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
        <div className="flex min-h-[60vh] w-full max-w-[460px] flex-col items-center justify-center gap-3 self-center rounded-xl border border-[#383838] bg-[#1e1e1e] p-6 text-center text-white shadow-xl">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-lg font-bold text-[#ff6961]">Terjadi Kesalahan Tampilan</h2>
          <p className="text-xs break-words text-[#bdbdbd]">
            {this.state.message || 'Gagal memuat komponen aplikasi.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 cursor-pointer rounded-lg bg-[#007aff] px-5 py-2.5 text-sm font-bold text-white transition active:scale-95"
          >
            🔄 Muat Ulang Halaman
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
