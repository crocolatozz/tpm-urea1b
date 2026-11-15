# Changelog

Semua perubahan penting pada aplikasi **Dashboard & Kolase Foto TPM Urea 1B** dicatat di file ini mengikuti standar [Semantic Versioning](https://semver.org/).

## [2.6.0] - 2026-11-15

### Ditambahkan
- **Standardisasi Ikon Vektor `1em` (`Icons.tsx`):** Menambahkan pustaka ikon inline SVG garis bersih (`w-[1em] h-[1em]`) termasuk ikon cuaca shift (`Sun` `text-amber-400`, `CloudSun` `text-orange-400`, `Moon` `text-indigo-300`), pesawat kertas `45°` pada tombol Kirim ke WhatsApp, ikon `Copy` pada Salin Caption, serta bingkai panah tukar pada tombol `Ganti Foto`.
- **Modal Konfirmasi Pasca-Kirim WA (`KolaseView.tsx`, `App.tsx`):** Menampilkan dialog konfirmasi terkunci (*no backdrop dismiss*) langsung setelah proses share/unduh berjalan (`Ya, Update` untuk mempertahankan status **Terlapor** dan mengosongkan foto + caption sambil menjaga Tag Equipment; `Batal` untuk *rollback* status ke kondisi sebelumnya tanpa menghapus foto/caption).

### Diubah
- **Optimistic Status Update Pasca-Kirim (`KolaseView.tsx`, `App.tsx`):** Status alat langsung diperbarui menjadi **Terlapor** (lokal & Firestore) seketika saat share WhatsApp berjalan tanpa menunggu `visibilitychange`, dan dibatalkan otomatis bila Share Sheet HP dibatalkan (`AbortError`).
- **Sinkronisasi Reset Caption Saat Pindah Tab (`KolaseView.tsx`, `tpmData.ts`, `App.tsx`):** Input Caption Baris 1–3 tidak lagi disimpan ke `localStorage` atau `App.tsx` sehingga otomatis ikut kosong saat operator berpindah tab, sementara Tag Equipment tetap dipertahankan.
- **Peningkatan Visual Modal & Tombol (`PhotoEditorModal.tsx`, `ChangelogModal.tsx`):** Menyesuaikan tombol `Reset` menjadi merah kalem transparan (`rose-500/15`), `Batal` abu-abu gelap (`slate-700`), dan memastikan ikon putar pada tombol bundar hijau Cek Update berputar simetris minimal `600ms`.
- **Pembaruan Panduan & Sinkronisasi Versi `2.6.0`:** Memperbarui **Tab `2. Grid Kolase`** pada `GuideModal.tsx` serta menyelaraskan `APP_VERSION`, `package.json`, `public/version.json`, dan `vite.config.js` ke `2.6.0`.

### Diperbaiki
- **Konsistensi UI Bebas Emoji/Simbol Teks Kasar:** Mengganti seluruh simbol teks (`✕`, `↻`, `+`, `✓`, `⚠️`, `ℹ️`) dan emoji UI di komponen antarmuka dengan SVG `1em`, dengan tetap mempertahankan karakter emoji murni pada generator pesan WhatsApp.

## [2.5.0] - 2026-11-15

### Ditambahkan
- **Editor Foto Lokal 100% Offline (`PhotoEditorModal.tsx`, `imageCollage.ts`, `react-easy-crop`):** Mengetuk foto yang sudah terpasang di grid kolase kini membuka modal **Atur Foto** dengan kontrol geser posisi, *pinch-zoom* + slider zoom (`1x–3x`), rotasi kelipatan `90°`, tombol `Reset`, serta tombol `🖼️ Ganti Foto`.
- **Tombol Bundar Hijau Cek Update Manual (`ChangelogModal.tsx`, `App.tsx`):** Mengganti tombol `✕` di pojok kanan atas modal Riwayat Pembaruan dengan tombol bundar hijau berikon panah melingkar (`Cek Update`) lengkap dengan animasi putar dan toast status hasil pengecekan (versi baru, sudah terbaru, atau mode offline).
- **Pembersihan Memori Riwayat Lama (`App.tsx`):** Menghapus otomatis sisa key riwayat caption lama (`tpm_overlay_history_v1`) dari `localStorage` saat aplikasi dimuat.

### Diubah
- **Manajemen Kualitas Gambar Sumber (`imageCollage.ts`, `KolaseView.tsx`):** Menyimpan kanvas sumber hasil decode awal (`max 1200px`) pada setiap slot agar pengeditan crop/rotasi ulang dapat dilakukan berkali-kali tanpa menurunkan ketajaman gambar, sambil mempertahankan metadata `fileSize` dan `lastModified`.
- **Gatekeeper Pop-Up Update Ketat (`useAppUpdater.ts`, `App.tsx`):** Mengunci pop-up konfirmasi update agar hanya muncul saat aplikasi pertama kali dibuka (*cold load*) atau ketika tombol bundar hijau **Cek Update** ditekan (menonaktifkan pemicu otomatis background seperti `visibilitychange`).
- **Input Keterangan Manual (`KolaseView.tsx`):** Menyederhanakan input Baris 1–3 menjadi isian manual dengan `autoComplete="off"` dan teks `placeholder` contoh saja.
- **Pembaruan Panduan Aplikasi (`GuideModal.tsx`):** Memperbarui panduan **2. Grid Kolase** (fitur Atur Foto, deteksi foto kembar, isian manual Baris 1–3) dan **3. Install App** (cara cek update manual lewat tombol bundar hijau).
- **Sinkronisasi Versi `2.5.0`:** Memperbarui `APP_VERSION`, `package.json`, `public/version.json`, dan manifest `vite.config.js` ke versi `2.5.0`.

### Dihapus
- **Fitur Saran Teks & Riwayat Caption (`KolaseView.tsx`, `tpmData.ts`):** Menghapus total `<datalist id="overlayHistoryList">`, `getContextualOverlaySuggestions()`, daftar saran caption bawaan, serta seluruh logic baca/simpan riwayat keterangan ke `localStorage`.

## [2.4.0] - 2026-11-15

### Ditambahkan
- **Deteksi Foto Kembar / Duplikat (`KolaseView.tsx`, `imageCollage.ts`):** Menyimpan metadata ringan `size` dan `lastModified` tiap slot foto untuk mendeteksi jika foto identik sudah terpasang di slot lain (aman terhadap penamaan seragam `image.jpg` di Safari iOS), lalu menampilkan toast peringatan kuning tanpa memblokir input foto.
- **Saran Keterangan Pintar Kontekstual (`tpmData.ts`, `KolaseView.tsx`):** Memprioritaskan saran perawatan otomatis berdasarkan awalan/kode Tag Equipment aktif (Pompa `GA-`/`PUMP`, Exchanger `EA-`/`EC-`, Vessel/Tower `DA-`/`FA-`) dengan tetap menyertakan saran umum TPM Urea di bagian bawah.
- **Accordion Riwayat Pembaruan (`ChangelogModal.tsx`):** Tiap blok versi pada modal Riwayat Pembaruan kini berbentuk accordion; versi terbaru (`2.4.0`) terbuka otomatis, sedangkan versi lama terlipat rapi dan dapat diketuk untuk membuka rinciannya.

### Diubah
- **Anti-Layout Shift & Smart Delay Toast Loading Foto (`KolaseView.tsx`):** Mengganti banner inline `"Memproses foto..."` di atas grid dengan floating toast kuning (`⏳ Memuat foto...`) berjeda **150ms** agar bebas kedipan (*anti-flicker*) pada decode cepat dan menjaga posisi grid tidak bergeser.
- **Sentralisasi Manajemen Floating Toast (`KolaseView.tsx`):** Menggabungkan seluruh toast (loading 150ms, peringatan foto kembar, multi-foto iOS, dan validasi keterangan kosong) dalam satu state terpusat dengan cleanup timeout `useRef`.
- **Sinkronisasi Versi `2.4.0`:** Memperbarui `APP_VERSION`, `package.json`, `public/version.json`, dan manifest `vite.config.js` ke versi `2.4.0`.

### Diperbaiki
- **Audit & Pembersihan Kode Mati (`tpmData.ts`, `index.css`, `KolaseView.tsx`):** Menghapus fungsi/helper mati (`getCurrentActiveShift`), rule CSS input date lama yang sudah digantikan overlay rata tengah, serta menyederhanakan inisialisasi state duplikat di `KolaseView.tsx`.

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
