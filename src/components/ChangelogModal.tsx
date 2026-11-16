import React, { useEffect, useMemo, useState } from 'react';
import changelogRaw from '../../CHANGELOG.md?raw';
import { APP_VERSION } from '../data/tpmData';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { IconChevronDown, IconHistory, IconSync } from './Icons';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckUpdate: () => void;
  isCheckingUpdate: boolean;
}

interface ChangelogSection {
  heading: string;
  items: string[];
}

interface ChangelogRelease {
  versionLine: string;
  sections: ChangelogSection[];
}

function parseChangelogMarkdown(raw: string): ChangelogRelease[] {
  const lines = raw.split(/\r?\n/);
  const releases: ChangelogRelease[] = [];
  let currentRelease: ChangelogRelease | null = null;
  let currentSection: ChangelogSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('## ')) {
      currentRelease = {
        versionLine: line.replace(/^##\s+/, '').replace(/[\[\]]/g, ''),
        sections: [],
      };
      releases.push(currentRelease);
      currentSection = null;
      continue;
    }

    if (line.startsWith('### ') && currentRelease) {
      currentSection = {
        heading: line.replace(/^###\s+/, ''),
        items: [],
      };
      currentRelease.sections.push(currentSection);
      continue;
    }

    if (line.startsWith('- ') && currentRelease) {
      if (!currentSection) {
        currentSection = { heading: 'Perubahan', items: [] };
        currentRelease.sections.push(currentSection);
      }
      currentSection.items.push(line.replace(/^-\s+/, ''));
    }
  }

  return releases;
}

function renderFormattedText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-sky-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  isOpen,
  onClose,
  onCheckUpdate,
  isCheckingUpdate,
}) => {
  const releases = useMemo(() => parseChangelogMarkdown(changelogRaw), []);
  const latestVersionLine = releases[0]?.versionLine || '';

  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() =>
    latestVersionLine ? { [latestVersionLine]: true } : {}
  );

  useEffect(() => {
    if (isOpen && latestVersionLine) {
      setExpandedMap({ [latestVersionLine]: true });
    }
  }, [isOpen, latestVersionLine]);

  const toggleVersion = (versionLine: string) => {
    setExpandedMap((prev) => ({
      ...prev,
      [versionLine]: !prev[versionLine],
    }));
  };

  useModalScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex touch-none items-center justify-center overscroll-contain bg-slate-950/82 p-4 backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-pop flex max-h-[88dvh] w-full max-w-[460px] flex-col overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_10px_30px_rgba(2,6,23,0.75)]">
        <div className="mb-3.5 flex shrink-0 items-center justify-between border-b border-slate-800 pb-2.5">
          <div>
            <h3 className="flex items-center gap-2 text-[17px] font-bold text-white">
              <IconHistory className="h-5 w-5 text-sky-400" /> Riwayat Pembaruan
            </h3>
            <p className="mt-0.5 text-xs text-slate-300">
              Versi aktif:{' '}
              <span className="font-mono font-semibold text-sky-300">v{APP_VERSION}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={isCheckingUpdate}
            onClick={onCheckUpdate}
            aria-label="Cek Update"
            title="Cek Update"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-500/15 text-emerald-300 backdrop-blur-sm transition hover:bg-emerald-500/25 active:scale-95 disabled:cursor-wait disabled:opacity-80"
          >
            <IconSync
              className={`h-5 w-5 ${isCheckingUpdate ? 'animate-[spin_0.65s_linear_infinite]' : ''}`}
            />
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 text-left">
          {releases.map((rel, idx) => {
            const isExpanded = Boolean(expandedMap[rel.versionLine]);
            const isLatest = idx === 0;

            return (
              <div
                key={rel.versionLine}
                className={`overflow-hidden rounded-xl border transition-colors ${
                  isLatest
                    ? 'border-sky-500/45 bg-sky-950/35'
                    : 'border-slate-700/80 bg-slate-800/70'
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleVersion(rel.versionLine)}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-3 text-left transition active:bg-white/5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-[14px] font-bold text-white">
                      v{rel.versionLine}
                    </span>
                    {isLatest && (
                      <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                        TERBARU
                      </span>
                    )}
                  </div>
                  <IconChevronDown
                    className={`h-4 w-4 text-slate-300 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="space-y-2.5 border-t border-slate-700/60 px-3.5 pt-2.5 pb-3.5">
                    {rel.sections.map((sec) => (
                      <div key={sec.heading}>
                        <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-sky-300">
                          {sec.heading}
                        </h4>
                        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[13px] leading-[1.5] text-slate-200">
                          {sec.items.map((item, i) => (
                            <li key={i}>{renderFormattedText(item)}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex w-full shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-sky-600 px-4 py-2.5 text-[14px] font-bold text-white transition hover:bg-sky-500 active:scale-[0.98]"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};
