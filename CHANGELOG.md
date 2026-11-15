# Changelog

Semua perubahan penting pada aplikasi **Dashboard & Kolase Foto TPM Urea 1B** dicatat di file ini mengikuti standar [Semantic Versioning](https://semver.org/).

## [2.3.0] - 2026-11-15

### Ditambahkan
- **Modal Riwayat Pembaruan (`CHANGELOG.md`):** Badge versi di footer kini dapat diketuk untuk membuka modal riwayat pembaruan yang membaca langsung isi `CHANGELOG.md` secara offline-safe.
- **Helper Shift Operasional Lintas Hari (`getOperationalShiftInfo`):** Penentuan tanggal operasional dan shift aktif kini terpusat menggunakan waktu lokal perangkat (jam `00:00–06:59` otomatis memakai tanggal kemarin `H-1` dengan `SHIFT MALAM`).
- **Validasi Keterangan Wajib & Floating Toast:** Tombol `🚀 Kirim ke WhatsApp` kini memvalidasi minimal 1 baris keterangan kegiatan sudah terisi, dan menampilkan floating toast peringatan bila kosong.
- **Dukungan Picker `multiple` Khusus iOS:** Perangkat iPhone/iPad secara otomatis menggunakan `multiple` dengan proteksi memilih foto terakhir yang diklik serta toast peringatan saat lebih dari 1 foto dipilih, sedangkan Android tetap single-select.

### Diubah
- **Format Tanggal Indonesia & Rata Tengah Kontrol:** Halaman Jadwal menampilkan tanggal penuh (`15 November 2026`) rata tengah di atas pemilih tanggal, sedangkan halaman Kolase menyeragamkan seluruh kontrol atas rata tengah (tanggal `DD/MM/YYYY`, dropdown shift simetris, dan input equipment `font-semibold`).
- **Penyederhanaan Slot Foto Kolase:** Menghapus tombol redundan ganti foto (`↻`) pada pojok foto; pengguna cukup tap langsung pada foto untuk mengganti atau tekan `✕` untuk menghapus.
- **Reset Otomatis Proteksi Update:** Status penahan pop-up update (`hasFilledPhotos`) otomatis di-reset menjadi `false` setelah laporan selesai dikirim ke WhatsApp.
- **Optimasi Memori Decode Foto (`imageCollage.ts`):** Menggunakan `createImageBitmap` dengan downscale langsung saat decode foto (dengan fallback `new Image()`) serta pembersihan buffer segera untuk menjaga penggunaan RAM tetap ringan di iOS Safari dan Android Chrome.
- **Pembaruan Panduan Aplikasi (`v2.3.0`):** Judul versi dinamis mengikuti `APP_VERSION`, label tab ke-3 diperbaiki menjadi `3. Install App` (`whitespace-nowrap`), dan seluruh instruksi disesuaikan dengan alur terbaru termasuk instalasi Samsung Browser & Chrome.

## [2.2.1] - 2026-11-14

### Diperbaiki
- **Proteksi Pop-Up Update Saat Memilih Foto:** State penundaan update (`Nanti Saja`) dipertahankan selama sesi aktif berlangsung dan hanya di-reset saat *cold start*, disertai proteksi penahan modal selama ada foto belum terkirim di grid kolase.
- **Throttle Pengecekan Versi 60 Detik:** Menambahkan *cooldown* 60 detik pada event `visibilitychange` agar pengecekan `version.json` tidak membebani jaringan di area pabrik.
- **Tampilan Catatan Rilis Bullet List:** Mengubah format catatan rilis `version.json` menjadi array `string[]` dengan normalisasi anti-crash dan container scrollable `max-h-40`.
