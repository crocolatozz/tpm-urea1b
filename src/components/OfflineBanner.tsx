import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-[#ff9500]/45 bg-[#2a2419]/95 px-3 py-1.5 text-xs font-semibold text-[#ffb340] shadow-lg backdrop-blur-sm"
    >
      <span className="h-2 w-2 rounded-full bg-[#ff9500]" />
      Mode Offline — Jadwal &amp; Kolase tetap aktif
    </div>
  );
};
