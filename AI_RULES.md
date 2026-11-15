# AI_RULES.md — Panduan Wajib Pengembangan Dashboard & Kolase Foto TPM Urea 1B

Setiap kali diminta mengubah, memperbaiki, atau menambah fitur pada proyek ini, AI WAJIB mematuhi seluruh aturan di bawah ini tanpa terkecuali:

---

## 1. Identitas Aplikasi, Versioning & Footer (DILARANG DIUBAH)
- **Nama Aplikasi:** Dashboard & Kolase Foto TPM Urea 1B.
- **Semantic Versioning:** Gunakan format `MAJOR.MINOR.PATCH` (saat ini `2.3.0`).
  - `PATCH` (`2.3.x`): Perbaikan bug kecil / polesan UI.
  - `MINOR` (`2.x.0`): Penambahan fitur baru atau perubahan logika bisnis.
  - `MAJOR` (`x.0.0`): Perombakan arsitektur besar.
- **Footer Credit Wajib:** Jangan pernah menghapus, menyembunyikan, atau mengubah teks credit footer:
  - Subteks: `Dibuat untuk mempermudah laporan TPM Urea 1B`
  - Credit: `© 2026 — Developed by FIKRI`
  - Badge Versi: `Versi {APP_VERSION}` (dapat diklik untuk membuka modal Riwayat Pembaruan).

---

## 2. Single Source of Truth (`CHANGELOG.md`)
- Setiap kali melakukan perubahan kode, **WAJIB memperbarui `CHANGELOG.md`** di root repository pada bagian paling atas (urutan versi terbaru di atas).
- Gunakan format SemVer + tanggal rilis lokal (`## [X.Y.Z] - YYYY-MM-DD`) dengan kategori `### Ditambahkan`, `### Diperbaiki`, dan `### Diubah` dalam Bahasa Indonesia yang ringkas.
- Nilai konstanta `APP_VERSION` di dalam kode aplikasi **harus selalu 100% sama** dengan versi teratas di `CHANGELOG.md`.
- Modal Riwayat Pembaruan di UI membaca `CHANGELOG.md` langsung saat *build time* (`import changelogRaw from '../CHANGELOG.md?raw'`). **DILARANG** menggunakan `fetch('/CHANGELOG.md')` karena rawan 404 di subpath GitHub Pages dan gagal saat *offline*.
- Pastikan `vite-env.d.ts` selalu mempertahankan `/// <reference types="vite/client" />` agar import `?raw` lolos build TypeScript.

---

## 3. Logika Jadwal Shift & Tanggal Operasional Pabrik
- **Pembagian Jam Shift:**
  - `PAGI`: `07:00 – 14:59`
  - `SORE`: `15:00 – 22:59`
  - `MALAM`: `23:00 – 06:59`
- **Aturan Shift Malam Lintas Hari:** Pada pukul `00:00 – 06:59`, tanggal operasional wajib mundur ke **kemarin (`H-1`)** dengan shift **`MALAM`** (berlaku untuk default tanggal Jadwal, badge `• SHIFT AKTIF`, dan default tanggal/shift Kolase).
- **Anti-Bug Zona Waktu (UTC Trap):**
  - **DILARANG** menggunakan `.toISOString().split('T')[0]` untuk menghitung tanggal operasional (karena jam `00:00–06:59 WIB` akan mundur 2 hari di UTC). Gunakan objek `Date` lokal (`getFullYear()`, `getMonth()`, `getDate()`).
  - **DILARANG** mem-parsing string tanggal dengan `new Date("YYYY-MM-DD")`. Gunakan pemecah string `.split('-')` dan array nama bulan manual Bahasa Indonesia (`Januari`–`Desember`).
- **Format Tampilan Tanggal:**
  - Halaman Jadwal (`ScheduleView.tsx`): Format penuh Bahasa Indonesia rata tengah (`dd month yyyy`, contoh: `15 November 2026`, `whitespace-nowrap`).
  - Halaman Kolase (`KolaseView.tsx`): Format ringkas rata tengah (`DD/MM/YYYY`, contoh: `15/11/2026`).

---

## 4. Aturan UI, Layout & Kompatibilitas Mobile (iOS & Android)
- **Tema Gelap Konsisten:** Pertahankan palet gelap (`#121212` latar utama, `#1e1e1e` kartu terpadu) agar nyaman dipakai di area pabrik maupun malam hari.
- **Perataan Header Kolase:** Input Tanggal, dropdown Shift (`px-8` simetris), dan input Tag Equipment wajib rata tengah (`text-center font-semibold`) baik di iOS Safari maupun Android Chrome/Samsung Internet.
- **Manajemen Foto & Picker:**
  - Gunakan `accept="image/*"` pada input foto (jangan dibatasi ekstensi spesifik agar Samsung Browser tidak melempar ke File Manager).
  - Aktifkan `multiple={isIOS}` khusus perangkat iOS agar tombol *Cancel* galeri terbuka; jika user memilih `> 1` foto, ambil foto terakhir (`files[files.length - 1]`) dan tampilkan *floating toast* peringatan (jangan pakai `window.alert()`).
  - Jangan tampilkan tombol ganti foto (`↻`) di slot terisi; ganti foto cukup tap langsung pada fotonya, dan sisakan tombol hapus (`✕`).
  - Gunakan `createImageBitmap` + `resizeWidth` (dengan fallback `new Image()`) di `imageCollage.ts` agar RAM Safari/Chrome tidak jebol saat memproses 6 foto resolusi tinggi di grid `2x3`.
- **Validasi Kirim WhatsApp:** Minimal 1 baris keterangan kegiatan (Baris 1–3, dicek dengan `.trim()`) wajib diisi sebelum proses kirim WhatsApp dijalankan.

---

## 5. Proteksi PWA Offline & Auto-Update
- Aplikasi wajib tetap berfungsi penuh saat sinyal internet lemah/offline di area pabrik.
- **Anti-Gangguan Saat Kerja:** Jangan memicu auto-reload atau menampilkan pop-up update ketika operator sedang mengisi foto di halaman Kolase (`hasFilledPhotos === true`). Reset flag proteksi tersebut hanya setelah laporan selesai dikirim ke WhatsApp.
- **Disiplin Build:** Jangan menghapus fitur yang sudah berjalan baik tanpa diminta eksplisit, dan pastikan seluruh perubahan bebas error TypeScript/Vite build.
