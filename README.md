# ⚙️ Dashboard & Kolase Foto TPM Urea 1B

[![Live App](https://img.shields.io/badge/Live_App-GitHub_Pages-10b981?style=flat-square&logo=github)](https://crocolatozz.github.io/tpm-urea1b/)
![Version](https://img.shields.io/badge/version-2.10.4-0ea5e9?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-Ready-6366f1?style=flat-square)
![React](https://img.shields.io/badge/React-TypeScript-3b82f6?style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06b6d4?style=flat-square)

Aplikasi **Progressive Web App** berbasis *mobile-first* untuk membantu operator lapangan memantau jadwal **Total Productive Maintenance** pada unit Urea 1B sekaligus menyusun dokumentasi kolase foto **Before & After** yang siap dibagikan dalam hitungan detik.

🔗 **Buka Aplikasi:** [crocolatozz.github.io/tpm-urea1b](https://crocolatozz.github.io/tpm-urea1b/)

---

## ✨ Fitur Utama

- **Jadwal TPM Interaktif:** Pencarian cepat berdasarkan Tag Equipment dengan input kapital otomatis, dilengkapi fitur ketuk kartu jadwal untuk mengisi otomatis Tanggal, Shift, dan kode alat ke halaman kolase.
- **Kolase Foto Before & After:** Mendukung pilihan tata letak grid standar `2×3` sebagai bawaan utama, serta opsi `2×2` dan `2×1` sesuai kebutuhan dokumentasi lapangan.
- **Editor & Manajemen Slot Foto:** Dilengkapi fitur *crop*, rotasi, *zoom*, tukar posisi foto dengan *drag-and-drop*, serta penyimpanan sementara otomatis agar data foto dan keterangan tetap aman saat browser dimuat ulang.
- **Export JPEG & Generator Laporan WhatsApp:** Merender gambar kolase beresolusi tajam melalui HTML5 Canvas dan menyusun format teks laporan WhatsApp otomatis yang siap salin.
- **Pengalaman Rasa Aplikasi Native:** Navigasi geser antar-tab berbasis *CSS Scroll-Snap* dengan memori posisi *scroll* independen, dukungan instalasi ke layar utama ponsel Android maupun iOS, serta pembaruan versi otomatis lewat Service Worker.

---

## 🚀 Alur Penggunaan Cepat

1. **Pilih Jadwal atau Isi Manual:** Cari dan ketuk kartu alat pada tab **Jadwal TPM**, atau buka kunci input di tab **Kolase Foto** untuk laporan temuan di luar jadwal.
2. **Unggah & Atur Foto:** Masukkan foto **Before** dan **After**, sesuaikan sudut atau *crop* foto bila perlu, lalu isi keterangan singkat kegiatan di tiap baris.
3. **Export & Kirim:** Unduh hasil kolase dalam format JPEG dan salin teks laporan yang otomatis terbentuk untuk dikirim ke grup koordinasi.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS
- **Image Rendering:** HTML5 Canvas API
- **Offline & Update:** PWA Service Worker

---

## 💻 Menjalankan Secara Lokal

```bash
# 1. Clone repositori ini
git clone [https://github.com/crocolatozz/tpm-urea1b.git](https://github.com/crocolatozz/tpm-urea1b.git)

# 2. Masuk ke direktori project
cd tpm-urea1b

# 3. Install dependensi
npm install

# 4. Jalankan server development
npm run dev
