import React, { useMemo } from 'react';
import changelogRaw from '../../CHANGELOG.md?raw';
import { APP_VERSION } from '../data/tpmData';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
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
          className="rounded bg-[#2c2c2c] px-1 py-0.5 font-mono text-[0.76rem] text-[#8ab4f8]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const releases = useMemo(() => parseChangelogMarkdown(changelogRaw), []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/82 p-4 backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-pop flex max-h-[88dvh] w-full max-w-[460px] flex-col rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
        <div className="mb-3.5 flex shrink-0 items-center justify-between border-b border-[#333] pb-2.5">
          <div>
            <h3 className="text-[1.05rem] font-bold text-[#007aff]">📜 Riwayat Pembaruan</h3>
            <p className="text-[0.74rem] text-[#9a9a9a]">Versi aktif: v{APP_VERSION}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup riwayat pembaruan"
            className="flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-full border border-[#444] bg-[#2c2c2c] text-base text-[#ccc]"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1 text-left">
          {releases.map((rel, idx) => (
            <div
              key={rel.versionLine}
              className={`rounded-xl border p-3.5 ${
                idx === 0
                  ? 'border-[#007aff]/45 bg-[#172230]'
                  : 'border-[#303030] bg-[#242424]'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                <span className="text-[0.9rem] font-bold text-white">v{rel.versionLine}</span>
                {idx === 0 && (
                  <span className="rounded-full bg-[#34c759]/20 px-2 py-0.5 text-[0.65rem] font-bold text-[#4cd964]">
                    TERBARU
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {rel.sections.map((sec) => (
                  <div key={sec.heading}>
                    <h4 className="mb-1 text-[0.76rem] font-bold uppercase tracking-wide text-[#8ab4f8]">
                      {sec.heading}
                    </h4>
                    <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[0.8rem] leading-[1.45] text-[#d6d6d6]">
                      {sec.items.map((item, i) => (
                        <li key={i}>{renderFormattedText(item)}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex w-full shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-[#007aff] px-4 py-2.5 text-[0.9rem] font-bold text-white transition hover:opacity-92 active:scale-[0.98]"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};
