import React, { useEffect, useState } from 'react';
import { APP_VERSION } from '../data/tpmData';

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
          <h3 className="text-[1.05rem] font-bold text-[#007aff]">
            📖 Panduan Aplikasi (v{APP_VERSION})
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-full border border-[#444] bg-[#2c2c2c] text-base text-[#ccc]"
          >
            ✕
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

        <div className="h-[265px] overflow-y-auto pr-0.5 text-[0.86rem] leading-[1.55] text-[#e0e0e0]">
          {currentStep === 1 && (
            <div>
              <h4 className="mb-2 text-[0.96rem] font-bold text-white">
                📅 Cek Jadwal &amp; Cari Alat
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  Tap kotak tanggal untuk memilih lewat kalender, tekan panah{' '}
                  <strong>&lt;</strong> dan <strong>&gt;</strong> untuk geser harian, atau ketik di{' '}
                  <strong>Cari Alat</strong> untuk melihat jadwal rotasi 15 hari.
                </li>
                <li>
                  Badge <strong>● SHIFT AKTIF</strong> menandakan shift berjalan (termasuk shift
                  malam lintas hari jam 00:00–06:59). Status <strong>✓ DILAPORKAN</strong> otomatis
                  tersinkron ke semua HP operator lain dan bisa di-tap untuk reset bila perlu.
                </li>
                <li>
                  Tap kartu jadwal (<strong>Buat Kolase ➔</strong>) untuk langsung mengisi
                  tanggal, shift, dan nama equipment ke halaman Kolase.
                </li>
              </ul>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h4 className="mb-2 text-[0.96rem] font-bold text-white">📸 Susun Grid Kolase</h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  Pilih ukuran grid (<strong>2x1</strong>, <strong>2x2</strong>, atau{' '}
                  <strong>2x3</strong>) lalu <strong>tap kotak slot (+)</strong> pada area Preview
                  untuk memasukkan foto. Jika foto yang sama terpasang di slot lain, peringatan akan
                  muncul otomatis.
                </li>
                <li>
                  <strong>Tap foto yang sudah terpasang</strong> untuk membuka editor{' '}
                  <strong>Atur Foto</strong> (geser crop 1:1, <em>pinch-zoom</em>, putar{' '}
                  <strong>↻ 90°</strong>, atau <strong>🖼️ Ganti Foto</strong>). Tap ikon{' '}
                  <strong>✕</strong> di pojok foto untuk menghapusnya.
                </li>
                <li>
                  Isi keterangan kegiatan secara manual di <strong>Baris 1–3</strong> mengikuti teks
                  contoh (minimal 1 baris), lalu tekan tombol hijau{' '}
                  <strong>🚀 Kirim ke WhatsApp</strong> dan pilih grup WA tujuan.
                </li>
              </ul>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h4 className="mb-2 text-[0.96rem] font-bold text-white">
                📲 Install App &amp; Mode Offline
              </h4>
              <ul className="flex list-disc flex-col gap-2 pl-[18px]">
                <li>
                  <strong>Android (Chrome / Samsung Browser):</strong> Tap tombol biru{' '}
                  <strong>📲 Install Aplikasi</strong> atau buka menu <strong>⋮</strong> ➔ pilih{' '}
                  <strong>Install app / Tambahkan ke layar utama</strong>. Jika muncul peringatan
                  Play Protect di Samsung Browser, pilih{' '}
                  <strong>Install anyway / Tetap install</strong>.
                </li>
                <li>
                  <strong>iPhone (Safari):</strong> Tap ikon <strong>Share 📤</strong> ➔ pilih{' '}
                  <strong>Tambah ke Layar Utama ➕</strong>.
                </li>
                <li>
                  <strong>Cek Update Manual &amp; Offline:</strong> Ketuk badge{' '}
                  <strong>Versi</strong> di footer ➔ ketuk <strong>tombol bundar hijau</strong> di
                  pojok kanan atas modal untuk mengecek versi baru. Mode offline tetap aman bekerja
                  dan status <strong>✓ DILAPORKAN</strong> otomatis tersinkron saat sinyal kembali.
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
            <span className="inline-block -scale-x-100">➔</span> Sebelumnya
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
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#007aff] px-3.5 py-2.5 text-[0.9rem] font-bold text-white transition hover:opacity-92 active:scale-[0.97]"
          >
            {currentStep === TOTAL_STEPS ? 'Selesai ✓' : 'Lanjut ➔'}
          </button>
        </div>
      </div>
    </div>
  );
};
