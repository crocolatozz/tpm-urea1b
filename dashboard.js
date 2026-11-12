const tpmDate = document.getElementById('tpmDate');
const scheduleTitle = document.getElementById('scheduleTitle');
const tpmList = document.getElementById('tpmList');

const today = new Date().toISOString().split('T')[0];
tpmDate.value = today;

function loadSchedule(dateStr) {
  const isToday = dateStr === today;
  scheduleTitle.textContent = isToday ? "Jadwal TPM Hari Ini" : `Jadwal TPM (${formatDateIndo(dateStr)})`;
  
  const tasks = getScheduleForDate(dateStr);
  renderTasks(tasks);
}

function renderTasks(tasks) {
  tpmList.innerHTML = '';

  if (tasks.length === 0) {
    tpmList.innerHTML = `<p style="text-align:center; color:#888; padding: 20px 0;">Belum ada jadwal di tanggal ini.</p>`;
    return;
  }

  tasks.forEach((task) => {
    const item = document.createElement('div');
    item.className = `tpm-item ${task.isOff ? 'off-day' : ''}`;
    item.innerHTML = `
      <span class="shift-tag">${task.shift === 'INFO' ? 'STATUS' : 'SHIFT ' + task.shift}</span>
      <div class="tpm-title">${task.text}</div>
    `;
    tpmList.appendChild(item);
  });
}

tpmDate.addEventListener('change', (e) => loadSchedule(e.target.value));
loadSchedule(today);

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

if (!isStandalone) {
  if (isIOS) {
    if (installAppBtn) installAppBtn.style.display = 'flex';
  }
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
    } else if (isIOS) {
      if (iosInstallModal) iosInstallModal.style.display = 'flex';
    } else {
      alert('Aplikasi sudah terpasang atau browser Anda tidak mendukung instalasi otomatis.');
    }
  });
}

if (closeIosModalBtn && iosInstallModal) {
  closeIosModalBtn.addEventListener('click', () => {
    iosInstallModal.style.display = 'none';
  });
}

window.addEventListener('appinstalled', () => {
  if (installAppBtn) installAppBtn.style.display = 'none';
  deferredPrompt = null;
});
