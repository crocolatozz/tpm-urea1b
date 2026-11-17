import React, { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../data/tpmData';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import {
  IconArrowLeft,
  IconArrowRight,
  IconBookOpen,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconDownload,
  IconImageSwap,
  IconLayoutGrid,
  IconLock,
  IconPlusSquare,
  IconRotateCw,
  IconSend,
  IconShareIos,
  IconSmartphone,
  ReportedBadge,
} from './Icons';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOTAL_STEPS = 3;

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex touch-none items-center justify-center overscroll-contain bg-slate-950/82 p-4 backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-pop flex max-h-[90dvh] w-full max-w-[440px] flex-col overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900 p-5 text-white shadow-[0_10px_30px_rgba(2,6,23,0.75)]">
        <div className="mb-3.5 flex shrink-0 items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 className="flex items-center gap-2 text-[17px] font-bold text-white">
            <IconBookOpen className="h-5 w-5 text-sky-400" />
            <span>Panduan Aplikasi</span>
            <span className="rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-xs font-semibold text-sky-300">
              v{APP_VERSION}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigasi Horizontal: Ikon 24px di kiri + Teks 2 baris rata kiri di kanan (tanpa penomoran) */}
        <div className="mb-4 grid shrink-0 grid-cols-3 gap-1.5">
          {[
            {
              step: 1,
              line1: 'Cek',
              line2: 'Jadwal',
              icon: <IconCalendar className="h-6 w-6" />,
            },
            {
              step: 2,
              line1: 'Grid',
              line2: 'Kolase',
              icon: <IconLayoutGrid className="h-6 w-6" />,
            },
            {
              step: 3,
              line1: 'Install',
              line2: 'App',
              icon: <IconSmartphone className="h-6 w-6" />,
            },
          ].map((tab) => {
            const active = currentStep === tab.step;
            return (
              <button
                key={tab.step}
                type="button"
                onClick={() => setCurrentStep(tab.step)}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                  active
                    ? 'border-sky-500/70 bg-sky-950/60 text-white'
                    : 'border-slate-700/80 bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className={`shrink-0 ${active ? 'text-sky-400' : 'text-slate-400'}`}>
                  {tab.icon}
                </span>
                <span className="flex flex-col text-left text-xs font-bold leading-tight">
                  <span>{tab.line1}</span>
                  <span>{tab.line2}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          ref={contentRef}
          className="h-[275px] overflow-y-auto overscroll-contain pr-0.5 text-[14px] leading-[1.55] text-slate-200"
        >
          {currentStep === 1 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-white sm:text-base">
                <IconCalendar className="h-5 w-5 text-sky-400" /> Cek Jadwal &amp; Cari Alat
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  Tap <strong className="text-white">Tanggal Jadwal</strong> untuk memilih lewat
                  kalender, tekan panah{' '}
                  <strong className="inline-flex items-center text-white">
                    <IconChevronLeft className="h-3.5 w-3.5" />
                  </strong>{' '}
                  dan{' '}
                  <strong className="inline-flex items-center text-white">
                    <IconChevronRight className="h-3.5 w-3.5" />
                  </strong>{' '}
                  untuk geser harian, atau ketik di{' '}
                  <strong className="text-white">Cari Alat / Area</strong> untuk mencari jadwal
                  alat tertentu.
                </li>
                <li>
                  Badge <strong className="text-emerald-400">● AKTIF</strong> menandakan shift yang
                  sedang berjalan (termasuk pergantian shift malam lintas hari). Tap pil{' '}
                  <strong className="text-sky-400">Siklus</strong> untuk melihat info rotasi 15 hari.
                </li>
                <li>
                  Ikon centang bulat <ReportedBadge size="sm" className="align-[-0.25em]" /> di
                  sebelah nama equipment otomatis tersinkron ke semua HP operator lain dan bisa
                  di-tap untuk melihat info sinkronisasi atau membatalkan/reset tanda.
                </li>
                <li>
                  Tap <strong className="text-white">kartu jadwal</strong> untuk mengisi otomatis
                  Tanggal, Shift, dan Tag Equipment lalu bergeser mulus ke panel{' '}
                  <strong className="text-white">Kolase Foto</strong>.
                </li>
                <li>
                  Usap layar ke kiri/kanan dari posisi mana saja untuk berpindah antar-panel{' '}
                  <strong className="text-white">Jadwal TPM</strong> dan{' '}
                  <strong className="text-white">Kolase Foto</strong> tanpa menghapus foto maupun
                  keterangan.
                </li>
              </ul>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-white sm:text-base">
                <IconLayoutGrid className="h-5 w-5 text-sky-400" /> Susun Grid Kolase
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  <strong className="text-white">Data Laporan</strong> terkunci otomatis agar sesuai
                  jadwal; ketuk tombol{' '}
                  <strong className="inline-flex items-center gap-1 text-sky-400">
                    <IconLock className="h-3.5 w-3.5" /> Locked
                  </strong>{' '}
                  di pojok kanan atas bila perlu mengubah ke mode input manual.
                </li>
                <li>
                  Pilih layout (<strong className="text-white">2x1</strong>,{' '}
                  <strong className="text-white">2x2</strong>, atau{' '}
                  <strong className="text-white">2x3</strong>), lalu tap kotak kosong (
                  <strong className="inline-flex items-center text-sky-400">
                    <IconPlusSquare className="h-3.5 w-3.5" />
                  </strong>
                  ) untuk memilih <strong className="text-white">banyak foto sekaligus</strong>{' '}
                  (<em>multi-select</em>) yang otomatis terisi berurutan mengikuti nomor watermark{' '}
                  <strong className="text-white">1–6</strong>.
                </li>
                <li>
                  Untuk menukar posisi foto antar-slot,{' '}
                  <strong className="text-white">tekan-tahan lalu geser (drag)</strong> foto ke
                  kotak tujuan mana saja; atau tap foto untuk membuka{' '}
                  <strong className="text-white">Atur Foto</strong> (crop 1:1, putar{' '}
                  <strong className="inline-flex items-center gap-1 text-white">
                    <IconRotateCw className="h-3.5 w-3.5 text-sky-400" /> 90°
                  </strong>
                  , atau{' '}
                  <strong className="inline-flex items-center gap-1 text-white">
                    <IconImageSwap className="h-3.5 w-3.5 text-sky-400" /> Ganti Foto
                  </strong>
                  ).
                </li>
                <li>
                  Isi keterangan kegiatan sesuai jumlah baris layout (maksimal 30 karakter per
                  baris), lalu tekan{' '}
                  <strong className="inline-flex items-center gap-1 text-emerald-400">
                    <IconSend className="h-3.5 w-3.5" /> Kirim ke WhatsApp
                  </strong>{' '}
                  untuk otomatis menandai jadwal terkait dengan{' '}
                  <ReportedBadge size="sm" className="align-[-0.25em]" />.
                </li>
                <li>
                  Setelah proses kirim selesai, konfirmasi akan muncul: pilih{' '}
                  <strong className="text-emerald-400">Ya, Update</strong> untuk menjaga status{' '}
                  <ReportedBadge size="sm" className="align-[-0.25em]" /> dan membersihkan foto
                  &amp; caption, atau pilih <strong className="text-white">Batal</strong> jika
                  pengiriman gagal.
                </li>
              </ul>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-white sm:text-base">
                <IconSmartphone className="h-5 w-5 text-sky-400" /> Install App &amp; Sinkronisasi
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  <strong className="text-white">Android (Chrome / Samsung Browser):</strong> Tap
                  tombol{' '}
                  <strong className="inline-flex items-center gap-1 text-sky-400">
                    <IconDownload className="h-3.5 w-3.5" /> Install Aplikasi
                  </strong>{' '}
                  atau buka menu browser{' '}
                  <strong className="inline-flex items-center text-sky-400">
                    <IconArrowRight className="h-3.5 w-3.5" />
                  </strong>{' '}
                  pilih <strong className="text-white">Install app / Tambahkan ke layar utama</strong>.
                  Jika muncul peringatan Play Protect di Samsung Browser, pilih{' '}
                  <strong className="text-white">Install anyway / Tetap install</strong>.
                </li>
                <li>
                  <strong className="text-white">iPhone (Safari):</strong> Tap ikon{' '}
                  <strong className="inline-flex items-center gap-1 text-sky-400">
                    Share <IconShareIos className="h-3.5 w-3.5" />
                  </strong>{' '}
                  <strong className="inline-flex items-center text-sky-400">
                    <IconArrowRight className="h-3.5 w-3.5" />
                  </strong>{' '}
                  pilih{' '}
                  <strong className="inline-flex items-center gap-1 text-white">
                    Tambah ke Layar Utama{' '}
                    <IconPlusSquare className="h-3.5 w-3.5 text-sky-400" />
                  </strong>
                  .
                </li>
                <li>
                  <strong className="text-white">Koneksi Internet &amp; Sinkronisasi:</strong>{' '}
                  Pastikan perangkat terhubung ke internet agar status{' '}
                  <ReportedBadge size="sm" className="align-[-0.25em]" /> tersinkron secara{' '}
                  <em>real-time</em> ke semua HP operator lain.
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="mt-4 flex shrink-0 gap-2.5 border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => {
              if (currentStep > 1) setCurrentStep(currentStep - 1);
            }}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-[0.97] ${
              currentStep === 1 ? 'invisible' : 'visible'
            }`}
          >
            <IconArrowLeft className="h-4 w-4" /> Sebelumnya
          </button>

          <button
            type="button"
            onClick={() => {
              if (currentStep < TOTAL_STEPS) {
                setCurrentStep(currentStep + 1);
              } else {
                onClose();
              }
            }}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 bg-sky-600 px-3.5 py-2.5 text-[14px] font-bold text-white transition hover:bg-sky-500 active:scale-[0.97]"
          >
            {currentStep === TOTAL_STEPS ? (
              <>
                Selesai <IconCheck className="h-4 w-4" />
              </>
            ) : (
              <>
                Lanjut <IconArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
