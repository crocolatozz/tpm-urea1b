import React, { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../data/tpmData';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import {
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
  IconArrowLeft,
  IconArrowRight,
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
      className="fixed inset-0 z-[9999] flex touch-none items-center justify-center overscroll-contain bg-black/82 p-4 backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-pop flex max-h-[90dvh] w-full max-w-[440px] flex-col overscroll-contain rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
        <div className="mb-3.5 flex shrink-0 items-center justify-between border-b border-[#333] pb-2.5">
          <h3 className="flex items-center gap-1.5 text-[18px] font-bold text-sky-200">
            <IconBookOpen className="text-sky-400" /> Panduan Aplikasi (v{APP_VERSION})
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-full border border-[#444] bg-[#2c2c2c] text-base text-[#ccc]"
          >
            <IconClose />
          </button>
        </div>

        {/* Tab Navigasi dengan Ikon 20px di Atas Label */}
        <div className="mb-4 grid shrink-0 grid-cols-3 gap-1.5">
          {[
            {
              step: 1,
              label: '1. Cek Jadwal',
              icon: <IconCalendar className="h-5 w-5" />,
            },
            {
              step: 2,
              label: '2. Grid Kolase',
              icon: <IconLayoutGrid className="h-5 w-5" />,
            },
            {
              step: 3,
              label: '3. Install App',
              icon: <IconSmartphone className="h-5 w-5" />,
            },
          ].map((tab) => {
            const active = currentStep === tab.step;
            return (
              <button
                key={tab.step}
                type="button"
                onClick={() => setCurrentStep(tab.step)}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-1.5 py-2 text-center text-[12px] font-bold transition ${
                  active
                    ? 'border-[#007aff] bg-[#1a2736] text-white'
                    : 'border-[#3a3a3a] bg-[#282828] text-[#aaa]'
                }`}
              >
                <span className={active ? 'text-sky-400' : 'text-[#888]'}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div
          ref={contentRef}
          className="h-[275px] overflow-y-auto overscroll-contain pr-0.5 text-[14px] leading-[1.55] text-[#e0e0e0]"
        >
          {currentStep === 1 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[17px] font-semibold text-sky-200">
                <IconCalendar className="text-sky-400" /> Cek Jadwal &amp; Cari Alat
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  Tap kotak tanggal untuk memilih lewat kalender, tekan panah{' '}
                  <strong className="inline-flex items-center">
                    <IconChevronLeft className="inline-block h-[1em] w-[1em] align-[-0.125em]" />
                  </strong>{' '}
                  dan{' '}
                  <strong className="inline-flex items-center">
                    <IconChevronRight className="inline-block h-[1em] w-[1em] align-[-0.125em]" />
                  </strong>{' '}
                  untuk geser harian, atau ketik di <strong>Cari Alat / Area</strong> untuk mencari
                  jadwal alat tertentu.
                </li>
                <li>
                  Badge <strong className="text-emerald-400">SHIFT AKTIF</strong> menandakan shift
                  yang sedang berjalan (termasuk pergantian shift malam lintas hari).
                </li>
                <li>
                  Status{' '}
                  <strong className="inline-flex items-center gap-1 text-sky-400">
                    <IconCheck className="inline-block h-[1em] w-[1em] align-[-0.125em]" />{' '}
                    DILAPORKAN
                  </strong>{' '}
                  otomatis tersinkron ke semua HP operator lain dan bisa di-tap untuk reset bila
                  perlu.
                </li>
                <li>
                  Tap kartu jadwal untuk langsung mengisi tanggal, shift, dan nama equipment ke
                  halaman Kolase untuk mulai menyusun kolase.
                </li>
              </ul>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[17px] font-semibold text-sky-200">
                <IconLayoutGrid className="text-sky-400" /> Susun Grid Kolase
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  <strong>Data Laporan</strong> terkunci otomatis agar sesuai jadwal; ketuk ikon{' '}
                  <strong className="inline-flex items-center gap-1 text-sky-400">
                    <IconLock className="inline-block h-[1em] w-[1em] align-[-0.125em]" /> Gembok
                  </strong>{' '}
                  di pojok kanan atas bila perlu membuka kunci untuk edit manual.
                </li>
                <li>
                  Pilih ukuran grid (<strong>2x1</strong>, <strong>2x2</strong>, atau{' '}
                  <strong>2x3</strong>) lalu <strong>tap kotak slot (+)</strong> untuk memasukkan
                  foto. Tap foto terpasang untuk membuka <strong>Atur Foto</strong> (crop 1:1,
                  pinch-zoom, putar{' '}
                  <strong className="inline-flex items-center gap-1">
                    <IconRotateCw className="inline-block h-[1em] w-[1em] align-[-0.125em]" /> 90°
                  </strong>
                  , atau{' '}
                  <strong className="inline-flex items-center gap-1">
                    <IconImageSwap className="inline-block h-[1em] w-[1em] align-[-0.125em]" />{' '}
                    Ganti Foto
                  </strong>
                  ). Tap{' '}
                  <strong className="inline-flex items-center">
                    <IconClose className="inline-block h-[1em] w-[1em] align-[-0.125em]" />
                  </strong>{' '}
                  di pojok foto untuk menghapusnya.
                </li>
                <li>
                  Isi keterangan kegiatan di <strong>Baris 1–3</strong> (maksimal 30 karakter per
                  baris), lalu tekan tombol hijau{' '}
                  <strong className="inline-flex items-center gap-1 text-emerald-400">
                    <IconSend className="inline-block h-[1em] w-[1em] align-[-0.125em]" /> Kirim ke
                    WhatsApp
                  </strong>{' '}
                  dan pilih grup WA tujuan.
                </li>
                <li>
                  Setelah kirim ke WhatsApp, pop-up konfirmasi akan muncul otomatis: pilih{' '}
                  <strong className="text-emerald-400">Ya, Update</strong> untuk menjaga status{' '}
                  <strong className="inline-flex items-center gap-1 text-sky-400">
                    <IconCheck className="inline-block h-[1em] w-[1em] align-[-0.125em]" />{' '}
                    DILAPORKAN
                  </strong>{' '}
                  serta membersihkan foto &amp; caption, atau pilih <strong>Batal</strong> jika
                  pengiriman gagal untuk mengirim ulang tanpa mengisi dari awal.
                </li>
              </ul>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[17px] font-semibold text-sky-200">
                <IconSmartphone className="text-sky-400" /> Install App &amp; Sinkronisasi
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  <strong>Android (Chrome / Samsung Browser):</strong> Tap tombol biru{' '}
                  <strong className="inline-flex items-center gap-1 text-sky-400">
                    <IconDownload className="inline-block h-[1em] w-[1em] align-[-0.125em]" />{' '}
                    Install Aplikasi
                  </strong>{' '}
                  atau buka menu browser{' '}
                  <IconArrowRight className="inline-block h-[1em] w-[1em] align-[-0.125em] text-[#8ab4f8]" />{' '}
                  pilih <strong>Install app / Tambahkan ke layar utama</strong>. Jika muncul
                  peringatan Play Protect di Samsung Browser, pilih{' '}
                  <strong>Install anyway / Tetap install</strong>.
                </li>
                <li>
                  <strong>iPhone (Safari):</strong> Tap ikon{' '}
                  <strong className="inline-flex items-center gap-1 text-sky-400">
                    Share{' '}
                    <IconShareIos className="inline-block h-[1em] w-[1em] align-[-0.125em]" />
                  </strong>{' '}
                  <IconArrowRight className="inline-block h-[1em] w-[1em] align-[-0.125em] text-[#8ab4f8]" />{' '}
                  pilih{' '}
                  <strong className="inline-flex items-center gap-1 text-sky-400">
                    Tambah ke Layar Utama{' '}
                    <IconPlusSquare className="inline-block h-[1em] w-[1em] align-[-0.125em]" />
                  </strong>
                  .
                </li>
                <li>
                  <strong>Koneksi Internet &amp; Sinkronisasi:</strong> Pastikan perangkat terhubung
                  ke internet agar status{' '}
                  <strong className="inline-flex items-center gap-1 text-sky-400">
                    <IconCheck className="inline-block h-[1em] w-[1em] align-[-0.125em]" />{' '}
                    DILAPORKAN
                  </strong>{' '}
                  tersinkron secara <em>real-time</em> ke semua HP operator lain.
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="mt-4 flex shrink-0 gap-2.5 border-t border-[#333] pt-3">
          <button
            type="button"
            onClick={() => {
              if (currentStep > 1) setCurrentStep(currentStep - 1);
            }}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#444] bg-[#2e2e2e] px-3 py-2.5 text-[14px] font-semibold text-white transition active:scale-[0.97] active:bg-[#3a3a3a] ${
              currentStep === 1 ? 'invisible' : 'visible'
            }`}
          >
            <IconArrowLeft /> Sebelumnya
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
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 bg-[#007aff] px-3.5 py-2.5 text-[14px] font-bold text-white transition hover:opacity-92 active:scale-[0.97]"
          >
            {currentStep === TOTAL_STEPS ? (
              <>
                Selesai <IconCheck />
              </>
            ) : (
              <>
                Lanjut <IconArrowRight />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
