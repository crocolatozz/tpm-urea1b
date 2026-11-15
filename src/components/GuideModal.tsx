import React, { useEffect, useState } from 'react';
import { APP_VERSION } from '../data/tpmData';
import {
  IconArrowLeft,
  IconArrowRight,
  IconBookOpen,
  IconCalendar,
  IconCamera,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconDownload,
  IconImageSwap,
  IconPlusSquare,
  IconRotateCw,
  IconSend,
  IconShareIos,
} from './Icons';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOTAL_STEPS = 3;

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/82 p-4 backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-pop max-h-[90dvh] w-full max-w-[440px] overflow-y-auto rounded-[16px] border border-[#383838] bg-[#1e1e1e] p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
        <div className="mb-3.5 flex items-center justify-between border-b border-[#333] pb-2.5">
          <h3 className="flex items-center gap-1.5 text-[1.05rem] font-bold text-[#007aff]">
            <IconBookOpen /> Panduan Aplikasi (v{APP_VERSION})
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

        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {[
            { step: 1, label: '1. Cek Jadwal' },
            { step: 2, label: '2. Grid Kolase' },
            { step: 3, label: '3. Install App' },
          ].map((tab) => {
            const active = currentStep === tab.step;
            return (
              <button
                key={tab.step}
                type="button"
                onClick={() => setCurrentStep(tab.step)}
                className={`cursor-pointer whitespace-nowrap rounded-lg border px-1.5 py-2 text-center text-[0.74rem] font-bold transition ${
                  active
                    ? 'border-[#007aff] bg-[#1a2736] text-white'
                    : 'border-[#3a3a3a] bg-[#282828] text-[#aaa]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="h-[275px] overflow-y-auto pr-0.5 text-[0.86rem] leading-[1.55] text-[#e0e0e0]">
          {currentStep === 1 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[0.96rem] font-bold text-white">
                <IconCalendar className="text-[#8ab4f8]" /> Cek Jadwal &amp; Cari Alat
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  Tap kotak tanggal untuk memilih lewat kalender, tekan panah{' '}
                  <strong className="inline-flex items-center">
                    <IconChevronLeft />
                  </strong>{' '}
                  dan{' '}
                  <strong className="inline-flex items-center">
                    <IconChevronRight />
                  </strong>{' '}
                  untuk geser harian, atau ketik di <strong>Cari Alat</strong> untuk melihat jadwal
                  rotasi 15 hari.
                </li>
                <li>
                  Badge <strong>SHIFT AKTIF</strong> menandakan shift berjalan (termasuk shift
                  malam lintas hari jam 00:00–06:59). Status{' '}
                  <strong className="inline-flex items-center gap-0.5 text-[#8cc8ff]">
                    <IconCheck /> DILAPORKAN
                  </strong>{' '}
                  otomatis tersinkron ke semua HP operator lain dan bisa di-tap untuk reset bila
                  perlu.
                </li>
                <li>
                  Tap kartu jadwal (
                  <strong className="inline-flex items-center gap-1">
                    Buat Kolase <IconArrowRight />
                  </strong>
                  ) untuk langsung mengisi tanggal, shift, dan nama equipment ke halaman Kolase.
                </li>
              </ul>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[0.96rem] font-bold text-white">
                <IconCamera className="text-[#8ab4f8]" /> Susun Grid Kolase
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  Pilih ukuran grid (<strong>2x1</strong>, <strong>2x2</strong>, atau{' '}
                  <strong>2x3</strong>) lalu <strong>tap kotak slot (+)</strong> untuk memasukkan
                  foto. Tap foto terpasang untuk membuka <strong>Atur Foto</strong> (crop 1:1,
                  pinch-zoom, putar{' '}
                  <strong className="inline-flex items-center gap-0.5">
                    <IconRotateCw /> 90°
                  </strong>
                  , atau{' '}
                  <strong className="inline-flex items-center gap-0.5">
                    <IconImageSwap /> Ganti Foto
                  </strong>
                  ). Tap{' '}
                  <strong className="inline-flex items-center">
                    <IconClose />
                  </strong>{' '}
                  di pojok foto untuk menghapusnya.
                </li>
                <li>
                  Isi keterangan kegiatan secara manual di <strong>Baris 1–3</strong> (minimal 1
                  baris), lalu tekan tombol hijau{' '}
                  <strong className="inline-flex items-center gap-1 text-[#4cd964]">
                    <IconSend /> Kirim ke WhatsApp
                  </strong>{' '}
                  dan pilih grup WA tujuan.
                </li>
                <li>
                  Setelah kirim ke WhatsApp, pop-up konfirmasi akan muncul otomatis: pilih{' '}
                  <strong className="text-[#4cd964]">Ya, Update</strong> untuk menjaga status{' '}
                  <strong>Terlapor</strong> serta membersihkan foto &amp; caption, atau pilih{' '}
                  <strong>Batal</strong> jika pengiriman gagal untuk membatalkan status dan
                  mengirim ulang tanpa mengisi dari awal.
                </li>
              </ul>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[0.96rem] font-bold text-white">
                <IconDownload className="text-[#8ab4f8]" /> Install App &amp; Mode Offline
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  <strong>Android (Chrome / Samsung Browser):</strong> Tap tombol biru{' '}
                  <strong className="inline-flex items-center gap-1">
                    <IconDownload /> Install Aplikasi
                  </strong>{' '}
                  atau buka menu browser <IconArrowRight className="text-[#8ab4f8]" /> pilih{' '}
                  <strong>Install app / Tambahkan ke layar utama</strong>. Jika muncul peringatan
                  Play Protect di Samsung Browser, pilih{' '}
                  <strong>Install anyway / Tetap install</strong>.
                </li>
                <li>
                  <strong>iPhone (Safari):</strong> Tap ikon{' '}
                  <strong className="inline-flex items-center gap-1">
                    Share <IconShareIos className="text-[#64b5f6]" />
                  </strong>{' '}
                  <IconArrowRight className="text-[#8ab4f8]" /> pilih{' '}
                  <strong className="inline-flex items-center gap-1">
                    Tambah ke Layar Utama <IconPlusSquare className="text-[#64b5f6]" />
                  </strong>
                  .
                </li>
                <li>
                  <strong>Cek Update Manual &amp; Offline:</strong> Ketuk badge{' '}
                  <strong>Versi</strong> di footer <IconArrowRight className="text-[#8ab4f8]" />{' '}
                  ketuk <strong>tombol bundar hijau</strong> di pojok kanan atas modal untuk mengecek
                  versi baru. Mode offline tetap aman bekerja dan status{' '}
                  <strong className="inline-flex items-center gap-0.5">
                    <IconCheck /> DILAPORKAN
                  </strong>{' '}
                  otomatis tersinkron saat sinyal kembali.
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2.5 border-t border-[#333] pt-3">
          <button
            type="button"
            onClick={() => {
              if (currentStep > 1) setCurrentStep(currentStep - 1);
            }}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#444] bg-[#2e2e2e] px-3 py-2.5 text-[0.85rem] font-semibold text-white transition active:scale-[0.97] active:bg-[#3a3a3a] ${
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
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 bg-[#007aff] px-3.5 py-2.5 text-[0.9rem] font-bold text-white transition hover:opacity-92 active:scale-[0.97]"
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
