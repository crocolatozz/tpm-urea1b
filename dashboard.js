const tpmDate = document.getElementById('tpmDate');
const scheduleTitle = document.getElementById('scheduleTitle');
const tpmList = document.getElementById('tpmList');

const today = getLocalTodayStr();
tpmDate.value = today;

function loadSchedule(dateStr) {
  const isToday = dateStr === getLocalTodayStr();
  scheduleTitle.textContent = isToday ? "Jadwal TPM Hari Ini" : `Jadwal TPM (${formatDateIndo(dateStr)})`;
  
  const tasks = getScheduleForDate(dateStr);
  renderTasks(tasks, dateStr, isToday);
}

function renderTasks(tasks, dateStr, isToday) {
  tpmList.innerHTML = '';

  if (tasks.length === 0) {
    tpmList.innerHTML = `<p style="text-align:center; color:#888; padding: 20px 0;">Belum ada jadwal di tanggal ini.</p>`;
    return;
  }

  const activeShift = isToday ? getCurrentActiveShift() : null;

  tasks.forEach((task) => {
    const isCurrentShift = isToday && !task.isOff && task.shift === activeShift;
    const item = document.createElement('div');
    item.className = `tpm-item ${task.isOff ? 'off-day' : 'clickable'} ${isCurrentShift ? 'active-shift' : ''}`;

    const activeBadgeHTML = isCurrentShift ? `<span class="active-badge">● SHIFT AKTIF</span>` : '';
    const actionHintHTML = !task.isOff ? `<span class="tpm-action-hint">Buat Kolase ➔</span>` : '';
    const subtextHTML = task.subtext ? `<div class="tpm-subtext">${task.subtext}</div>` : '';

    item.innerHTML = `
      <div class="tpm-item-top">
        <span class="shift-tag">
          ${task.shift === 'INFO' ? 'STATUS' : 'SHIFT ' + task.shift}
          ${activeBadgeHTML}
        </span>
        ${actionHintHTML}
      </div>
      <div class="tpm-title">${task.text}</div>
      ${subtextHTML}
    `;

    if (!task.isOff) {
      item.addEventListener('click', () => {
        const params = new URLSearchParams({
          date: dateStr,
          shift: task.shift,
          area: task.text
        });
        window.location.href = `kolase.html?${params.toString()}`;
      });
    }

    tpmList.appendChild(item);
  });
}

tpmDate.addEventListener('change', (e) => loadSchedule(e.target.value));
loadSchedule(today);
initGuideModal();

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration error:', err));
  });
}

// Logika Smart Install PWA
let deferredPrompt;
const installAppBtn = document.getElementById('installAppBtn');
const iosInstallModal = document.getElementById('iosInstallModal');
const closeIosModalBtn = document.getElementById('closeIosModalBtn');

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

if (!isStandalone && isIOS && installAppBtn) {
  installAppBtn.style.display = 'flex';
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installAppBtn && !isStandalone) {
    installAppBtn.style.display = 'flex';
  }
});

if (installAppBtn) {
  installAppBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installAppBtn.style.display = 'none';
      }
      deferredPrompt = null;
    } else if (isIOS && iosInstallModal) {
      iosInstallModal.style.display = 'flex';
    }
  });
}

if (closeIosModalBtn && iosInstallModal) {
  closeIosModalBtn.addEventListener('click', () => {
    iosInstallModal.style.display = 'none';
  });
  iosInstallModal.addEventListener('click', (e) => {
    if (e.target === iosInstallModal) {
      iosInstallModal.style.display = 'none';
    }
  });
}

window.addEventListener('appinstalled', () => {
  if (installAppBtn) installAppBtn.style.display = 'none';
  deferredPrompt = null;
});
