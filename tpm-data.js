// Versi Aplikasi Aktif
const APP_VERSION = '1.1.0';

// Master Database Rotasi 15 Hari TPM Urea 1B
const masterTPMUrea1B = {
  1:  { PAGI: "GA122", SORE: "GA123 & GB801", MALAM: "GB701" },
  2:  { PAGI: "GA101A", SORE: "GA103", MALAM: "GA104" },
  3:  { PAGI: "GA101B", SORE: "GA105", MALAM: "GA106" },
  4:  { PAGI: "GA102A", SORE: "GA107", MALAM: "GA109" },
  5:  { PAGI: "GA102B", SORE: "GA110", MALAM: "GA121" },
  6:  { PAGI: "GT 101", SORE: "GA201", MALAM: "GA204" },
  7:  { PAGI: "GB101LP", SORE: "GA401", MALAM: "GA402" },
  8:  { PAGI: "GB101HP", SORE: "GA403", MALAM: "GA404" },
  9:  { PAGI: "IA301", SORE: "GA405", MALAM: "GB 301" },
  10: { PAGI: "JW301", SORE: "GB302", MALAM: "GA301" },
  11: { PAGI: "JD301", SORE: "GA302", MALAM: "GA303" },
  12: { PAGI: "FD304", SORE: "GA501", MALAM: "GA502" },
  13: { PAGI: "FD305", SORE: "GA503", MALAM: "GA 504 & 704" },
  14: { PAGI: "GA 101A OIL", SORE: "GA 101B OIL", MALAM: "GA801 & GA803" },
  15: { PAGI: "GA 102A OIL", SORE: "GA 102B OIL", MALAM: "FLARE" }
};

const SHIFT_TIME_RANGES = {
  PAGI: "07:00 – 15:00",
  SORE: "15:00 – 23:00",
  MALAM: "23:00 – 07:00"
};

function getCycleDayForDate(dateStr) {
  if (!dateStr) return null;
  const dayOfMonth = parseInt(dateStr.split('-')[2], 10);
  if (!dayOfMonth || dayOfMonth === 31) return null;
  return ((dayOfMonth - 1) % 15) + 1;
}

function getScheduleForDate(dateStr) {
  if (!dateStr) return [];
  const dayOfMonth = parseInt(dateStr.split('-')[2], 10);
  
  if (dayOfMonth === 31) {
    return [{
      shift: "INFO",
      text: "TIDAK ADA KEGIATAN",
      subtext: "🏖️ Libur rutin tiap tanggal 31",
      isOff: true
    }];
  }

  const cycleDay = ((dayOfMonth - 1) % 15) + 1;
  const dayData = masterTPMUrea1B[cycleDay];

  if (!dayData) return [];

  return [
    { shift: "PAGI", text: dayData.PAGI },
    { shift: "SORE", text: dayData.SORE },
    { shift: "MALAM", text: dayData.MALAM }
  ];
}

// Cari tanggal terdekat (hari ini hingga +45 hari) untuk siklus hari ke-X
function getNextDateForCycleDay(cycleDay) {
  const now = new Date();
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  const baseDate = now.getDate();

  for (let offset = 0; offset <= 45; offset++) {
    const candidate = new Date(baseYear, baseMonth, baseDate + offset);
    const dom = candidate.getDate();
    if (dom === 31) continue;
    const cDay = ((dom - 1) % 15) + 1;
    if (cDay === cycleDay) {
      const y = candidate.getFullYear();
      const m = String(candidate.getMonth() + 1).padStart(2, '0');
      const d = String(dom).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return getLocalTodayStr();
}

function formatDateIndo(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// Gunakan Waktu Lokal HP (Anti-Bug Mundur Tanggal Jam 00:00 - 06:59 WIB)
function getLocalTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getOffsetDateStr(offsetDays) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Auto-Deteksi Shift Aktif Berdasarkan Jam HP
function getCurrentActiveShift() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return "PAGI";
  if (hour >= 15 && hour < 23) return "SORE";
  return "MALAM";
}

// Log Status Laporan Terkirim (localStorage)
const REPORTED_LOG_KEY = 'tpm_reported_log_v1';

function getReportedLog() {
  try {
    const raw = localStorage.getItem(REPORTED_LOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function markShiftAsReported(dateStr, shift, area) {
  if (!dateStr || !shift) return;
  const log = getReportedLog();
  log[`${dateStr}_${shift}`] = {
    area: area || '-',
    ts: Date.now()
  };

  // Bersihkan entri lebih dari 60 hari agar storage tetap ringan
  const cutoff = Date.now() - (60 * 24 * 60 * 60 * 1000);
  Object.keys(log).forEach((k) => {
    if (log[k] && log[k].ts && log[k].ts < cutoff) {
      delete log[k];
    }
  });

  try {
    localStorage.setItem(REPORTED_LOG_KEY, JSON.stringify(log));
  } catch (e) {}
}

function isShiftReported(dateStr, shift) {
  const log = getReportedLog();
  return Boolean(log[`${dateStr}_${shift}`]);
}

// Logika Pop-Up Modal Panduan Interaktif 3 Langkah
function initGuideModal() {
  const openBtn = document.getElementById('openGuideBtn');
  const modal = document.getElementById('guideModal');
  const closeX = document.getElementById('closeGuideModalBtn');
  const prevBtn = document.getElementById('guidePrevBtn');
  const nextBtn = document.getElementById('guideNextBtn');
  const tabs = document.querySelectorAll('.guide-tab');
  const panels = document.querySelectorAll('.guide-step-panel');

  if (!openBtn || !modal) return;

  let currentStep = 1;
  const totalSteps = panels.length;

  function renderStep(step) {
    currentStep = step;
    tabs.forEach(t => {
      t.classList.toggle('active', parseInt(t.dataset.step, 10) === step);
    });
    panels.forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.step, 10) === step);
    });

    if (prevBtn) {
      prevBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
    }
    if (nextBtn) {
      nextBtn.textContent = step === totalSteps ? 'Selesai ✓' : 'Lanjut ➔';
    }
  }

  openBtn.addEventListener('click', () => {
    renderStep(1);
    modal.style.display = 'flex';
  });

  if (closeX) {
    closeX.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      renderStep(parseInt(tab.dataset.step, 10));
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentStep > 1) renderStep(currentStep - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentStep < totalSteps) {
        renderStep(currentStep + 1);
      } else {
        modal.style.display = 'none';
      }
    });
  }
}

// =========================================================================
// SISTEM FORCE UPDATE PWA (1X CEK SAAT AWAL BUKA APLIKASI + ANTI-LOOP CDN)
// =========================================================================
function compareSemver(localVer, remoteVer) {
  const a = String(localVer).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const b = String(remoteVer).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const numA = a[i] || 0;
    const numB = b[i] || 0;
    if (numB > numA) return 1;  // Ada versi baru
    if (numB < numA) return -1;
  }
  return 0;
}

function injectUpdateModalIfNeeded() {
  if (document.getElementById('forceUpdateModal')) return;

  const modalHTML = `
    <div id="forceUpdateModal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="updateModalTitle">🚀 Pembaruan Aplikasi Tersedia</h3>
        </div>
        <div id="updatePromptBody">
          <div class="update-version-box">
            <div class="update-ver-col">
              <span class="update-ver-label">Versi Saat Ini</span>
              <span class="update-ver-val old" id="currentVerText">v${APP_VERSION}</span>
            </div>
            <span class="update-arrow">➔</span>
            <div class="update-ver-col">
              <span class="update-ver-label">Versi Terbaru</span>
              <span class="update-ver-val new" id="latestVerText">v-</span>
            </div>
          </div>
          <p class="update-desc" id="updateDescText">
            Versi baru aplikasi TPM Urea 1B sudah siap. Perbarui sekarang agar fitur dan jadwal selalu akurat.
          </p>
          <div id="updateCdnWarning" class="update-warning-note" style="display: none;"></div>
          <div class="update-actions">
            <button type="button" id="confirmUpdateBtn" class="btn">🔄 Update Sekarang</button>
            <button type="button" id="skipUpdateBtn" class="btn-secondary" style="display: none;">Nanti Saja</button>
          </div>
        </div>

        <div id="updateSuccessBody" class="update-success-body" style="display: none;">
          <span class="update-success-icon">✅</span>
          <div class="update-success-title" id="updateSuccessTitle">Aplikasi sudah berhasil diperbarui!</div>
          <p class="update-success-sub" id="updateSuccessSub">Saat ini kamu menggunakan versi terbaru (v${APP_VERSION}).</p>
          <button type="button" id="closeSuccessUpdateBtn" class="btn">OK</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function showUpdateSuccessModal(newVersion) {
  injectUpdateModalIfNeeded();
  const modal = document.getElementById('forceUpdateModal');
  const title = document.getElementById('updateModalTitle');
  const promptBody = document.getElementById('updatePromptBody');
  const successBody = document.getElementById('updateSuccessBody');
  const successTitle = document.getElementById('updateSuccessTitle');
  const successSub = document.getElementById('updateSuccessSub');
  const okBtn = document.getElementById('closeSuccessUpdateBtn');

  title.textContent = '🎉 Pembaruan Selesai';
  promptBody.style.display = 'none';
  successBody.style.display = 'block';
  successTitle.textContent = 'Aplikasi sudah berhasil diperbarui';
  successSub.textContent = `Versi terbaru v${newVersion} sudah aktif dan siap digunakan.`;
  modal.style.display = 'flex';

  okBtn.onclick = () => {
    modal.style.display = 'none';
  };
}

function showForceUpdateModal(remoteVersion, releaseNotes, isRetryLoop) {
  injectUpdateModalIfNeeded();
  const modal = document.getElementById('forceUpdateModal');
  const title = document.getElementById('updateModalTitle');
  const promptBody = document.getElementById('updatePromptBody');
  const successBody = document.getElementById('updateSuccessBody');
  const currentVerText = document.getElementById('currentVerText');
  const latestVerText = document.getElementById('latestVerText');
  const descText = document.getElementById('updateDescText');
  const cdnWarning = document.getElementById('updateCdnWarning');
  const updateBtn = document.getElementById('confirmUpdateBtn');
  const skipBtn = document.getElementById('skipUpdateBtn');

  title.textContent = '🚀 Pembaruan Aplikasi Tersedia';
  promptBody.style.display = 'block';
  successBody.style.display = 'none';

  currentVerText.textContent = `v${APP_VERSION}`;
  latestVerText.textContent = `v${remoteVersion}`;

  if (releaseNotes) {
    descText.textContent = releaseNotes;
  }

  // Pengaman Anti-Loop CDN GitHub Pages
  if (isRetryLoop) {
    cdnWarning.style.display = 'block';
    cdnWarning.textContent = '⚠️ Server GitHub Pages masih menyebarkan file baru (butuh 1–3 menit). Kamu bisa lanjut bekerja dulu atau coba muat ulang.';
    skipBtn.style.display = 'inline-flex';
    updateBtn.innerHTML = '🔄 Coba Muat Ulang';
  } else {
    cdnWarning.style.display = 'none';
    skipBtn.style.display = 'none';
    updateBtn.innerHTML = '🔄 Update Sekarang';
  }

  modal.style.display = 'flex';

  skipBtn.onclick = () => {
    sessionStorage.removeItem('tpm_updating_to');
    sessionStorage.removeItem('tpm_update_attempts');
    modal.style.display = 'none';
  };

  updateBtn.onclick = async () => {
    updateBtn.disabled = true;
    skipBtn.style.display = 'none';
    cdnWarning.style.display = 'none';
    updateBtn.innerHTML = '<span class="spinner"></span> Memperbarui aplikasi...';

    const prevAttempts = parseInt(sessionStorage.getItem('tpm_update_attempts') || '0', 10);
    sessionStorage.setItem('tpm_updating_to', remoteVersion);
    sessionStorage.setItem('tpm_update_attempts', String(prevAttempts + 1));

    // Timeout 8 detik jika koneksi di area pabrik mendadak terputus
    const timeoutId = setTimeout(() => {
      updateBtn.disabled = false;
      updateBtn.innerHTML = '🔄 Coba Lagi';
      cdnWarning.style.display = 'block';
      cdnWarning.textContent = '📶 Sinyal lemah atau koneksi terputus. Kamu tetap bisa menutup jendela ini dan pakai versi offline yang ada.';
      skipBtn.textContent = 'Tutup';
      skipBtn.style.display = 'inline-flex';
    }, 8000);

    try {
      // 1. Paksa cek & update Service Worker jika tersedia
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update().catch(() => {});
        }
      }

      // 2. Hapus paksa semua cache lama di browser (penting untuk Safari iOS)
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      // 3. Beri jeda singkat agar animasi spinner terlihat mulus sebelum reload
      setTimeout(() => {
        clearTimeout(timeoutId);
        window.location.reload();
      }, 900);
    } catch (err) {
      clearTimeout(timeoutId);
      updateBtn.disabled = false;
      updateBtn.innerHTML = '🔄 Coba Lagi';
      cdnWarning.style.display = 'block';
      cdnWarning.textContent = '📶 Gagal memuat pembaruan. Silakan tutup dan coba lagi nanti.';
      skipBtn.textContent = 'Tutup';
      skipBtn.style.display = 'inline-flex';
    }
  };
}

async function initAppVersionCheck() {
  // 1. Cek apakah baru saja selesai melakukan proses reload update
  const pendingTargetVer = sessionStorage.getItem('tpm_updating_to');
  const attempts = parseInt(sessionStorage.getItem('tpm_update_attempts') || '0', 10);

  if (pendingTargetVer) {
    if (compareSemver(APP_VERSION, pendingTargetVer) <= 0) {
      // Berhasil naik ke versi terbaru!
      sessionStorage.removeItem('tpm_updating_to');
      sessionStorage.removeItem('tpm_update_attempts');
      sessionStorage.setItem('tpm_startup_checked', '1');
      showUpdateSuccessModal(APP_VERSION);
      return;
    } else if (attempts >= 1) {
      // Reload sudah berjalan namun CDN GitHub Pages masih menyajikan file lama
      sessionStorage.setItem('tpm_startup_checked', '1');
      showForceUpdateModal(pendingTargetVer, null, true);
      return;
    }
  }

  // 2. Pastikan pengecekan hanya berjalan 1x saat awal buka aplikasi (per sesi)
  if (sessionStorage.getItem('tpm_startup_checked') === '1') {
    return;
  }
  sessionStorage.setItem('tpm_startup_checked', '1');

  // 3. Fetch version.json jalur network-only dengan batas waktu 5 detik
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`./version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) return;
    const data = await res.json();
    if (!data || data.offline || !data.version) return;

    if (compareSemver(APP_VERSION, data.version) > 0) {
      showForceUpdateModal(data.version, data.notes || '', false);
    }
  } catch (err) {
    // Offline atau jaringan pabrik tidak stabil -> lewati diam-diam tanpa ganggu user
  }
}


// =========================================================================
// PROTEKSI ANTI-ZOOM & ANTI-SELECT-TEXT NATIVE APP FEEL (iOS & ANDROID)
// =========================================================================
(function initNativeAppTouchGuard() {
  // Cegah pinch-zoom di Safari iOS
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((evtName) => {
    document.addEventListener(evtName, (e) => {
      e.preventDefault();
    }, { passive: false });
  });

  // Cegah multi-touch zoom 2 jari
  document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // Cegah double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
      }
    }
    lastTouchEnd = now;
  }, { passive: false });

  // Cegah menu konteks tahan layar (kecuali saat edit teks di kolom input)
  document.addEventListener('contextmenu', (e) => {
    const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
    const type = e.target && e.target.type ? e.target.type.toLowerCase() : '';
    if ((tag === 'INPUT' && type === 'text') || tag === 'TEXTAREA') {
      return;
    }
    e.preventDefault();
  });
})();
