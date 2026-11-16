import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-400/45 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-amber-300 shadow-lg backdrop-blur-sm"
    >
      <span className="h-2 w-2 rounded-full bg-amber-400" />
      Mode Offline — Jadwal &amp; Kolase tetap aktif
    </div>
  );
};
