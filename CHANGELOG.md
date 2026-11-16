# Changelog

Semua perubahan penting pada aplikasi **Dashboard & Kolase Foto TPM Urea 1B** dicatat di file ini mengikuti standar [Semantic Versioning](https://semver.org/).

## [2.10.3] - 2026-11-17

### Ditambahkan
- **Kartu Wadah Grid Foto Kolase (`KolaseView.tsx`, `imageCollage.ts`):** Membungkus seluruh grid foto *Before & After* ke dalam kartu wadah gelap (`#0F172A`) berbingkai tipis dengan padding dalam ramping di atas latar poster `#080C14` agar terpisah rapi dari header dan footer tanpa perlu garis pemisah horizontal, sekaligus mengkalibrasi ulang batas lebar otomatis pil caption agar teks panjang tetap pas di dalam sel foto.

### Diubah
- **Penyempurnaan Header `BEFORE` & `AFTER` (`KolaseView.tsx`, `imageCollage.ts`):** Menghapus simbol titik pada pil header, memperbesar ukuran font `Rajdhani` Bold secara proporsional dengan padding atas-bawah yang seimbang, serta menampilkan aksen teks biru cyan (`#38BDF8`) untuk `BEFORE` dan hijau emerald neon (`#34D399`) untuk `AFTER`.
- **Pembaruan Pil Footer Kolase & Proporsi Jarak (`KolaseView.tsx`, `imageCollage.ts`):** Membalik skema warna pil footer menjadi latar *dark emerald* (`#0B2E2B`) dengan teks **Hijau Emerald Neon (`#34D399`)** dan titik pemisah biru cyan (`#38BDF8`), menaikkan tipis ukuran font serta padding pil agar lebih tegas dan proporsional, serta menyeimbangkan margin luar atas dan bawah poster.
- **Sinkronisasi Versi Patch `2.10.3` (`package.json`, `tpmData.ts`, `version.json`, `vite.config.js`, `GuideModal.tsx`):** Menyelaraskan versi aplikasi, badge Panduan Aplikasi, metadata `version.json`, serta `cacheId` Service Worker ke `v2.10.3`.

## [2.10.2] - 2026-11-17

### Diubah
- **Penyeragaman Tipografi `Rajdhani` pada Kolase & Pembersihan `Barlow Condensed` (`index.html`, `index.css`, `KolaseView.tsx`, `imageCollage.ts`):** Mengganti seluruh teks pada **Preview** maupun **Export JPEG** kolase (`BEFORE`, `AFTER`, pil caption foto, dan pil footer) menggunakan font `Rajdhani` (`600`/`700`), mengkalibrasi ukuran font dan pengaman `ctx.measureText()` agar 30 karakter caption serta 45 karakter footer tetap muat 1 baris utuh, dan menghapus import/utilitas `Barlow Condensed`.
- **Desain Pil Kolase Dark-Tinted + Hairline Border & Perataan Vertikal Optis (`KolaseView.tsx`, `imageCollage.ts`):** Mengubah header `BEFORE` (biru cyan `#38BDF8`, `#0E293D`) dan `AFTER` (emerald neon `#34D399`, `#0B2E2B`), pil caption foto (`rgba(11, 17, 32, 0.88)`), serta pil footer (`#111C2E` dengan titik pemisah `#34D399`) bergaya *dark-tinted* bertepi `1px` halus lengkap dengan kalibrasi posisi vertikal optis agar teks presisi di tengah pil.
- **Penyeragaman Kartu Ringkasan Pop-up Laporan (`DashboardView.tsx`, `KolaseView.tsx`):** Menyamakan format `SHIFT PAGI`/`SORE`/`MALAM` lengkap dengan ikon cuaca shift, jarak vertikal baris yang lebih lega, dan gaya badge pil *dark-tinted* (`Pukul HH:MM` bernuansa cyan dan ukuran file bernuansa emerald) di modal **Kolase TPM Berhasil Dibuat!** dan **Status Dilaporkan**.
- **Penyederhanaan Teks Panduan & Sinkronisasi Versi `2.10.2` (`GuideModal.tsx`, `package.json`, `tpmData.ts`, `version.json`, `vite.config.js`):** Menghapus keterangan teknis konversi `.heic` pada Tab 2 Panduan Aplikasi serta menyelaraskan versi aplikasi dan `cacheId` Service Worker ke `v2.10.2`.

## [2.10.1] - 2026-11-17

### Diperbaiki
- **Pembaruan PWA 1x Klik Anti-Flicker (`useAppUpdater.ts`, `ForceUpdateModal.tsx`, `vite.config.js`):** Menahan reload hingga Service Worker baru resmi mengambil alih kontrol halaman (`controllerchange` + `clientsClaim: true`), mengirim sinyal `SKIP_WAITING` ke worker yang menunggu/baru selesai diinstal, memastikan `version.json` selalu `NetworkOnly` & anti-cache, serta menyediakan *fallback* pembersihan cache (`3500ms`) dan status tombol **`Memperbarui...`** → **`Memuat ulang...`**.

### Ditambahkan
- **Transisi Halus `fade-in` & `fade-out` `250ms` (`App.tsx`, `index.css`):** Menambahkan animasi masuk cepat (`appFadeIn` `250ms ease-out`) sejak *cold start* maupun setelah *reload*, serta efek meredup (`fade-out` `250ms`) sebelum halaman dimuat ulang agar transisi pembaruan terasa mulus tanpa kedip.
- **Validasi Status Update + Pengaman 30 Detik (`App.tsx`, `useAppUpdater.ts`):** Memverifikasi perubahan versi secara nyata via `sessionStorage` dengan batas waktu kedaluwarsa `30 detik` untuk menampilkan **Toast Hijau** saat versi berhasil diperbarui, atau **Toast Merah** bila pembaruan gagal karena koneksi maupun gagal memuat *bundle* baru.

### Diubah
- **Sinkronisasi Versi Patch `2.10.1` (`package.json`, `tpmData.ts`, `version.json`, `vite.config.js`, `GuideModal.tsx`):** Menyelaraskan versi aplikasi, badge Panduan Aplikasi, metadata `version.json`, serta `cacheId` Service Worker ke `v2.10.1`.

## [2.10.0] - 2026-11-16

### Ditambahkan
- **Drag-and-Drop Tukar Posisi Bebas Antar-Slot (`KolaseView.tsx`, `App.tsx`):** Operator kini dapat menekan-tahan singkat (~200ms) lalu menggeser (*drag*) foto ke kotak slot tujuan mana saja (`1–6`, kosong maupun terisi) untuk menukar posisi secara langsung lengkap dengan pratinjau melayang, sorotan border cyan pada slot tujuan, serta penguncian otomatis *swipe* tab dan *scroll* selama proses geser berlangsung.

### Diubah
- **Preview Kolase Lebih Bersih & Auto-Scale Watermark `1–6` (`KolaseView.tsx`):** Menghapus tombol tukar `⇄` di tengah kolom *Before–After* sehingga tampilan **Preview** 100% bersih identik dengan hasil ekspor JPEG, serta mengonversi kotak slot kosong menjadi CSS Container Query (`@container`) dengan watermark angka `text-[62cqw]` (`Barlow Condensed`) agar proporsional di semua ukuran layar HP maupun desktop.
- **Pembaruan Redaksi Panduan & Sinkronisasi Versi `2.10.0` (`GuideModal.tsx`, `package.json`, `tpmData.ts`, `version.json`, `vite.config.js`):** Memperbarui isi Tab 2 **Grid Kolase** pada Panduan Aplikasi untuk menjelaskan *multi-select* foto, konversi `.heic`, serta gestur tekan-tahan & geser (*drag*) antar-slot, dan menyelaraskan versi serta `cacheId` Service Worker ke `v2.10.0`.

## [2.9.0] - 2026-11-16

### Ditambahkan
- **Multi-Select Galeri & Konversi Otomatis `.heic`/`.heif` (`KolaseView.tsx`, `imageCollage.ts`):** Ketuk kotak kosong (`+`) kini mendukung pemilihan banyak foto sekaligus yang otomatis mengisi slot-slot kosong berikutnya secara berurutan (dengan pengaman toast jika jumlah foto melebihi sisa slot). Dilengkapi konversi otomatis foto `.heic`/`.heif` (*lazy-load* `heic2any`) dan pemrosesan berurutan beresolusi maksimal `1600px` agar tetap ringan di HP.
- **Watermark Nomor Urut Slot `1–6` (`KolaseView.tsx`):** Kotak foto kosong di Preview kini menampilkan angka urutan slot (`1–6`) transparan (`Barlow Condensed`) di belakang ikon `+` dan menyembunyikan teks `Before/After 1–3`, serta menampilkan indikator *loading* pada slot yang sedang diproses.
- **Navigasi *Swipe* Antar-Tab & Memori Posisi *Scroll* (`App.tsx`):** Kini dapat menggeser kiri/kanan pada area konten utama untuk berpindah antar tab **Jadwal TPM** dan **Kolase Foto** lengkap dengan pengaman anti-bentrok (*scroll* vertikal, *horizontal scroll*, modal terbuka, dan anti-zoom) serta penyimpanan posisi *scroll* independen per tab.

### Diubah
- **Peningkatan Tampilan Input Tag Equipment & Sinkronisasi Versi `2.9.0` (`KolaseView.tsx`, `package.json`, `tpmData.ts`, `version.json`, `vite.config.js`, `GuideModal.tsx`):** Memperbesar font input **Tag Equipment / Area** menjadi `20px` (`text-xl font-bold tracking-wider`) agar seimbang dengan **Tanggal** dan **Shift**, serta menyelaraskan versi aplikasi dan `cacheId` Service Worker ke `v2.9.0`.

## [2.8.5] - 2026-11-16

### Ditambahkan
- **Indikator Ukuran File Ekspor (`KolaseView.tsx`, `imageCollage.ts`):** Menampilkan ukuran file JPEG hasil render kolase (misalnya `340 KB`) di dalam modal konfirmasi **Kolase TPM Berhasil Dibuat!** setelah menekan **Kirim ke WhatsApp**.

### Diperbaiki
- **Persistensi Foto & Keterangan Lintas Tab (`App.tsx`, `KolaseView.tsx`):** Mempertahankan seluruh slot foto dan teks keterangan kegiatan agar tidak ter-reset saat berpindah dari tab **Kolase Foto** ke **Jadwal TPM** lalu kembali lagi, tanpa mencabut `ObjectURL` secara prematur. Mengetuk kartu jadwal kini hanya memperbarui Tanggal, Shift, Tag Equipment, dan status `Locked`.
- **Timeout Cadangan 3 Detik Updater PWA (`useAppUpdater.ts`):** Menambahkan batas tunggu maksimal `3000ms` sebagai pengaman cadangan di samping mekanisme `controllerchange` + jeda stabilisasi `500ms` agar aplikasi tetap me-reload 1 kali dan tombol **Update** tidak pernah macet.

### Diubah
- **Penyempurnaan Redaksi Panduan & Sinkronisasi Versi `2.8.5` (`GuideModal.tsx`, `package.json`, `tpmData.ts`, `version.json`, `vite.config.js`):** Memperbarui poin Tab 1, Tab 2 (`"Setelah proses kirim selesai..."`), dan Tab 3 (`"Tap tombol Install Aplikasi"`) pada Panduan Aplikasi serta menyelaraskan seluruh versi & `cacheId` Service Worker ke `v2.8.5`.

## [2.8.4] - 2026-11-16

### Diperbaiki
- **Pembaruan PWA Sekali Klik (`useAppUpdater.ts`):** Menunggu sinyal `controllerchange` Service Worker disertai jeda stabilisasi pembersihan cache (`500ms`) dan pengaman *single reload* agar tombol **Update** langsung menuntaskan pembaruan dalam 1x klik, serta memberi jeda awal `2 detik` saat aplikasi dibuka dan *cache-bypass* ketat pada `version.json`.
- **Pembersihan Memori `ObjectURL` Anti-Kedip (`KolaseView.tsx`, `imageCollage.ts`):** Memindahkan pencabutan `URL.revokeObjectURL()` ke tahap pasca-render (*post-commit effect*) agar slot foto tidak pernah berkedip gambar rusak saat foto diedit, ditukar, atau dihapus.
- **Penanganan Error Menyeluruh & Toast 3 Varian (`App.tsx`, `KolaseView.tsx`, `DashboardView.tsx`, `PhotoEditorModal.tsx`, `shiftReportSync.ts`):** Menyeragamkan toast menjadi 3 varian berikon SVG (**Sukses**, **Peringatan**, **Error**) dan menghubungkannya ke seluruh kegagalan decode foto, simpan editor foto, render kanvas/unduh kolase, salin caption, serta kegagalan sinkronisasi Firestore.

### Diubah
- **Skala Otomatis Footer Kolase 1:1 (`KolaseView.tsx`, `imageCollage.ts`):** Menghapus pemotongan teks elipsis (`...`) pada footer Preview dan memakai fungsi kalkulasi skala font yang sama persis dengan kanvas ekspor (`90%` lebar kanvas) sehingga tag equipment panjang tampil 1:1 antara layar Preview dan file JPEG.
- **Sinkronisasi Versi `2.8.4` (`package.json`, `tpmData.ts`, `version.json`, `vite.config.js`):** Menaikkan versi aplikasi serta `cacheId` Service Worker ke `v2.8.4`.

## [2.8.3] - 2026-11-16

### Diubah
- **Header Kolase `7.4cqw` & Padding Simetris (`KolaseView.tsx`, `imageCollage.ts`):** Memperbesar teks header **`BEFORE`** dan **`AFTER`** menjadi `7.4cqw` (`Barlow Condensed` `700`, putih `#FFFFFF`) dengan ruang napas atas dan bawah yang seimbang terhadap footer antara Preview dan hasil ekspor JPEG.
- **Pulihkan Batas 30 Karakter & Saran `Cleaning instrumentasi` (`KolaseView.tsx`, `imageCollage.ts`):** Mengembalikan batas input keterangan kegiatan ke `30` karakter per baris beserta placeholder Baris 2 `"Misal: Cleaning instrumentasi"` dan pengaman `ctx.measureText()` pada `85%` lebar kanvas agar kapsul keterangan tidak terpotong di sisi bingkai.
- **Standarisasi Ikon Centang Biru Terlapor & Hijau Sukses (`Icons.tsx`, `DashboardView.tsx`, `KolaseView.tsx`, `GuideModal.tsx`):** Menyeragamkan komponen ikon centang bulat biru (`ReportedBadge`) khusus status jadwal terlapor di kartu jadwal, pop-up status, modal pasca-kirim WA, dan panduan, serta mempertahankan centang hijau khusus status proses berhasil.
- **Polesan Panduan Aplikasi (`GuideModal.tsx`):** Menyelaraskan batas `30` karakter per baris, menyeragamkan seluruh ikon inline ke SVG `14px` (`w-3.5 h-3.5`), menebalkan khusus nama elemen UI, dan menstandarkan warna aksen semantik.

### Diperbaiki
- **Efisiensi Memori Foto via `Blob` + `ObjectURL` (`imageCollage.ts`, `PhotoEditorModal.tsx`):** Mengganti penyimpanan ganda Base64 (`toDataURL`) dengan `Blob` + `URL.createObjectURL()` disertai `URL.revokeObjectURL()` ketat saat edit, hapus slot, reset, maupun unmount untuk mencegah lonjakan RAM di HP/iOS.
- **Blokir Bar Autofill Android & Optimasi Kuota (`DashboardView.tsx`, `KolaseView.tsx`, `firebase.ts`):** Menambahkan atribut anti-autofill (`data-form-type="other"`, `data-lpignore="true"`, dan `id`/`name` netral) pada seluruh kolom input, mengoptimalkan pengecekan interval shift agar hanya me-render ulang saat terjadi transisi shift/hari, serta menghapus pembacaan uji koneksi Firestore saat startup untuk menghemat kuota baca.

## [2.8.2] - 2026-11-16

### Diperbaiki
- **Ukuran Global Seluruh Ikon SVG (`Icons.tsx`, `App.tsx`, `DashboardView.tsx`, `KolaseView.tsx`, semua Modal):** Menambahkan atribut default `width="20" height="20"` dan fallback `w-5 h-5` di seluruh ikon SVG, serta mengunci ukuran presisi per lokasi (`w-6 h-6` ikon `+` slot foto, `w-5 h-5` ikon header kartu/navigasi/gembok `Locked`/`Unlocked` dan panah kanan jadwal `>` `strokeWidth={4}`, `w-3.5 h-3.5` ikon sampah mini di dalam tombol `w-7 h-7`, `w-[22px] h-[22px]` ikon toast warning, serta `w-4 h-4` ikon close `X`).

### Diubah
- **Footer Kolase Lebih Besar & Lega (`KolaseView.tsx`, `imageCollage.ts`):** Mempertahankan latar bingkai `#0F172A`, menaikkan ukuran teks footer menjadi `4.5cqw` (`Barlow Condensed` `700`, putih `#FFFFFF`), melebarkan spasi pemisah `•` (3 spasi), menambah ruang napas vertikal di atas dan bawah footer, serta menambahkan pengaman `ctx.measureText()` agar skala font otomatis mengecil bila melebihi `90%` lebar kanvas.
- **Sinkronisasi Versi & Pembersihan Dead Code (`package.json`, `tpmData.ts`, `version.json`, `vite.config.js`, `index.css`):** Menaikkan versi & `cacheId` Service Worker ke `v2.8.2`, menghapus aturan CSS `.tpm-select` dan variabel `:root` yang tidak terpakai, serta membersihkan ekspor internal yang tidak dipanggil sambil menjaga mekanisme `URL.revokeObjectURL()` tetap utuh.

## [2.8.1] - 2026-11-15

### Diubah
- **Font `Rajdhani` & Kolase Monokrom Putih `Barlow Condensed` (`index.html`, `index.css`, `imageCollage.ts`, `DashboardView.tsx`, `KolaseView.tsx`):** Mengganti `Space Grotesk` dengan `Rajdhani` (`700`) khusus tag equipment pada kartu jadwal dan kotak input alat, serta menerapkan `Barlow Condensed` (`700`) berwarna putih solid (`#FFFFFF`) secara seragam untuk seluruh teks kolase Preview & Export JPEG (`6.2cqw` header `BEFORE`/`AFTER`, `4.9cqw` kapsul keterangan, dan `3.8cqw` footer 1 baris).
- **Sinkronisasi Cache Offline & Versi `2.8.1` (`package.json`, `tpmData.ts`, `version.json`, `vite.config.js`):** Menaikkan versi aplikasi serta `cacheId` Service Worker ke `v2.8.1` dan meng-cache font `Rajdhani` & `Barlow Condensed` untuk akses offline di area pabrik.
- **Label `SHIFT` & Posisi Ikon Centang Bulat `[✓]` (`DashboardView.tsx`, `GuideModal.tsx`):** Mengembalikan label lengkap **`SHIFT PAGI`**, **`SHIFT SORE`**, dan **`SHIFT MALAM`** pada kartu jadwal, menempelkan ikon centang bulat `[✓]` (`bg-sky-500/15 border-sky-500/40 text-sky-400`) langsung di sebelah kanan nama equipment (`inline-flex`), dan menyelaraskan ilustrasi serta keterangan di `GuideModal.tsx`.
- **Konsistensi Header Utama & Kontrol `Locked`/`Unlocked` (`App.tsx`, `KolaseView.tsx`):** Menyeragamkan judul header **`Dashboard TPM Urea 1B`** dan subjudul **`Monitoring Jadwal & Pembuatan Kolase Foto`** di semua tab, mengubah label gembok menjadi **`Locked`** / **`Unlocked`**, serta memindahkan penjelasan mode input manual ke pop-up konfirmasi buka kunci agar header kartu tetap lega.
- **Standarisasi Toast Warning & Ikon SVG Hapus/Close (`App.tsx`, `KolaseView.tsx`, `Icons.tsx`):** Menyeragamkan toast peringatan rata kiri dengan ikon `22px` (`z-[10050]`), mengganti tombol hapus per-slot foto menjadi ikon SVG tempat sampah mini (`w-3.5 h-3.5`, `text-rose-300`), dan menyeragamkan seluruh ikon tutup/clear dengan SVG close (`strokeWidth={2.5}`).

## [2.8.0] - 2026-11-15

### Ditambahkan
- **Tipografi Industrial & Cache Offline Google Fonts (`index.html`, `index.css`, `vite.config.js`):** Memuat font utama global `Plus Jakarta Sans` (`400–800`), `Space Grotesk` (`700`) khusus tag equipment, `tabular-nums` pada jam/tanggal/counter, serta caching offline `fonts.googleapis.com` & `fonts.gstatic.com` di Service Worker (`v2.8.0`).
- **Tombol Tukar Cepat Per Baris (`⇄`) & Pop-up Interaktif (`KolaseView.tsx`, `DashboardView.tsx`):** Menambahkan tombol bulat `⇄` di tengah garis pemisah pasangan *Before – After* untuk menukar foto kiri-kanan pada baris terkait (tidak ikut ter-render saat ekspor), pop-up informasi rotasi saat pil `Siklus` di-tap, serta pop-up info sinkronisasi & reset saat ikon centang bulat `[✓]` di-tap.
- **Pengaman Konfirmasi & Auto-Tandai `[✓]` (`KolaseView.tsx`):** Menambahkan modal konfirmasi sebelum mengosongkan keterangan (`Bersihkan`) dan menghapus grid (`Reset Semua Foto`), serta pencocokan otomatis tag equipment & shift saat `Kirim ke WhatsApp` ditekan untuk menandai jadwal hari aktif (`[✓]`) dengan notifikasi *"Jadwal otomatis ditandai ✓"*.

### Diubah
- **Harmonisasi Palet Industrial Slate & Subjudul Putih (`App.tsx`, `DashboardView.tsx`, `KolaseView.tsx`, `ChangelogModal.tsx`, semua Modal):** Menyeragamkan seluruh kartu, modal, dan kontrol form ke palet `slate`/`sky`/`emerald`/`amber`/`rose`, mengubah subjudul section menjadi putih bersih (`text-white font-bold`) berikon `text-sky-400`, menyematkan gaya *Soft Emerald Glass* pada tombol **Cek Update**, serta menstandarkan label (`13px`), teks pendukung (`≥12px`), dan kontras placeholder (`text-slate-400`).
- **Redesain Kartu Jadwal & Tab Modal Panduan (`DashboardView.tsx`, `GuideModal.tsx`):** Mempertebal ikon panah kanan menjadi `strokeWidth={4}`, memindahkan jam shift (`12px`) ke bawah judul shift (`15px`), meringkas pil `● SHIFT AKTIF` menjadi `● AKTIF`, mengganti pil teks dilaporkan menjadi ikon centang bulat `[✓]`, dan menata tab `GuideModal` secara horizontal dengan ikon `24px` + teks 2 baris tanpa penomoran.
- **Kolase 1:1 Bingkai Deep Slate 90° & Batas 25 Karakter (`imageCollage.ts`, `KolaseView.tsx`):** Mengubah bingkai luar ekspor JPEG menjadi sudut tegas `90°` warna `#0F172A`, sudut slot `8px` proporsional dengan `save()`/`restore()` per sel, proporsi `cqw` (`6.0cqw` header, `4.9cqw` kapsul Deep Slate, `3.6cqw` footer 1 baris `TPM [TAG] • SHIFT • TANGGAL`), menunggu kesiapan font sebelum ekspor, auto-kompresi `1200px` kualitas `0.85` dengan pembersihan `URL.revokeObjectURL` di `finally`, baris keterangan dinamis sesuai grid (`1/2/3` baris, max `25` karakter + counter warna bertingkat), tombol bulat `Bersihkan` & `Salin Caption`, serta tombol gembok ringkas `Terkunci` / `Ubah`.

### Diperbaiki
- **Pengaman Scroll Lock Per-Instance (`useModalScrollLock.ts`):** Mengganti counter angka dengan pelacakan `Set<symbol>` per instance dan pembersihan otomatis saat unmount agar scroll halaman utama tidak pernah macet saat membuka atau menutup modal bertumpuk.

## [2.7.0] - 2026-11-15

### Ditambahkan
- **Gembok Pengunci Data Laporan & Ikon Kalender (`KolaseView.tsx`, `Icons.tsx`):** Menambahkan header `[Dokumen] Data Laporan` lengkap dengan tombol gembok pengunci default, modal konfirmasi `Batal` / `Buka Kunci`, badge `Mode Manual`, *auto-lock* saat pindah tab/pilih jadwal baru/tekan `Kirim ke WhatsApp`, serta ikon SVG kalender (`text-sky-400`) di field Tanggal.
- **Penyimpanan Permanen 6 Slot Foto & Batas 30 Karakter (`KolaseView.tsx`):** Menjaga keutuhan 6 slot foto (`index 0–5`) saat berpindah mode grid (`2x1`/`2x2`/`2x3`), menambahkan `maxLength={30}` + penghitung `0/30`–`30/30`, serta placeholder baru di kolom Baris 1–3.
- **Global Modal Scroll Lock & Storage Version Guard (`useModalScrollLock.ts`, `tpmData.ts`):** Mengunci scroll latar belakang memakai *reference counter* (`overflow-hidden`, `touch-none`, `overscroll-contain`) pada seluruh modal termasuk modal bertumpuk, serta menambahkan pengecekan `STORAGE_VERSION` dan validasi defensif `localStorage` agar anti-crash saat transisi versi.

### Diubah
- **Tata Letak Kolase Split Atas–Bawah Identik 1:1 (`KolaseView.tsx`, `imageCollage.ts`):** Menempatkan `TPM [TAG EQUIPMENT]` (dengan auto-scale *maxWidth*) di header paling atas, sub-header `BEFORE` | `AFTER`, grid foto bersudut membulat `roundRect()` dengan kapsul keterangan di tepi bawah-tengah baris, serta footer `SHIFT [PAGI/SORE/MALAM] • [DD/MM/YYYY]`, dengan rasio `cqw` 1:1 antara Preview dan hasil Canvas Export.
- **Feedback Tombol `Salin Caption` & `Bersihkan` (`KolaseView.tsx`):** Tombol `Salin Caption` berubah hijau sukses (`✓ Tersalin!`) selama 2 detik saat disalin, dan tombol `Bersihkan` beraksen rose lembut yang berubah merah tegas (`✓ Dibersihkan!`) selama 2 detik saat ditekan.
- **Redesain Dashboard, Navigasi Atas & Tipografi 4-Tingkat (`DashboardView.tsx`, `App.tsx`, `index.css`):** Memusatkan tab navigasi atas, menyeragamkan subjudul Level 2 (`text-sky-200` + ikon `text-sky-400`), menata `Tanggal Jadwal` & `Cari Alat / Area` responsif 2 kolom, menyederhanakan subjudul `Jadwal TPM Hari Ini` / `Daftar Jadwal TPM`, memperbarui placeholder menjadi `Misal: GA101, FLARE...`, merancang ulang kartu jadwal 2-baris simetris dengan panah lebar penuh, serta menerapkan hierarki tipografi 4-tingkat (`16px` anti-zoom iOS) dan atribut anti-autofill Android.
- **Pembaruan Modal Panduan & Sinkronisasi Versi `2.7.0` (`GuideModal.tsx`, `package.json`, `version.json`, `vite.config.js`):** Menambahkan ikon `20px` di atas tab panduan, auto-reset scroll saat membuka/pindah tab, menyelaraskan poin panduan Tab 1–3, serta memperbarui seluruh indikator versi ke `2.7.0`.

## [2.6.1] - 2026-11-15

### Diperbaiki
- **Sinkronisasi State Tanggal & Shift Kolase (`KolaseView.tsx`, `App.tsx`):** Menjadikan Tanggal, Shift, dan Tag Equipment satu sumber state (*single source of truth*) agar perubahan Tanggal atau Shift langsung memperbarui tampilan UI, filter Tag Equipment, kotak Preview, dan teks Caption WhatsApp secara *real-time* tanpa tertimpa state lama.
- **Proporsi Canvas Kolase Identik 1:1 dengan Preview (`imageCollage.ts`):** Menyesuaikan tinggi bar header (`cellWidth * 0.115`), font header (`cellWidth * 0.052` dengan *letter-spacing*), tinggi bar footer (`cellWidth * 0.10`), font footer (`cellWidth * 0.041` dengan pengaman otomatis pada `92%` lebar kanvas), serta padding/jarak antar-sel (`cellWidth * 0.012`), dengan mempertahankan gaya dan posisi kapsul keterangan tengah.

### Diubah
- **Custom Dropdown Shift dengan Ikon Cuaca (`KolaseView.tsx`, `Icons.tsx`):** Mengganti `<select>` bawaan pada pemilih Shift menjadi dropdown kustom bergaya *dark mode* dengan ikon SVG cuaca `1em` (`Sun` `text-amber-400`, `CloudSun` `text-orange-400`, `Moon` `text-indigo-300`) yang menempel rapat di sisi kiri teks Shift.
- **Polesan Visual & Konsistensi UI (`KolaseView.tsx`, `Icons.tsx`, `DashboardView.tsx`):** Menambahkan ikon SVG sapu (`IconBroom`) pada tombol **Bersihkan**, menyamakan header **Caption WhatsApp** menjadi biru, membulatkan sudut foto terisi (`overflow-hidden rounded-lg`), memperkalem tombol hapus slot (`bg-slate-950/80` + aksen `rose`), mengubah tombol aktif **Kirim ke WhatsApp** menjadi emerald berteks putih (`bg-emerald-600 text-white`), serta meringkas placeholder pencarian alat menjadi `Cari alat (GA101, FLARE)...`.
- **Penyelarasan Panduan Aplikasi (`GuideModal.tsx`):** Menyeragamkan label **`Cari Alat / Area`**, badge **`SHIFT AKTIF`** & **`Ya, Update`** hijau (`text-emerald-400`), badge **`DILAPORKAN`** dengan ikon centang `1em`, **`Buat Kolase`**, serta **`Install Aplikasi`** biru (`text-sky-400`), dengan presisi ukuran inline SVG `w-[1em] h-[1em] align-[-0.125em]`.

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
