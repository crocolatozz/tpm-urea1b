const tpmDate = document.getElementById('tpmDate');
const scheduleTitle = document.getElementById('scheduleTitle');
const cycleDayBadge = document.getElementById('cycleDayBadge');
const tpmList = document.getElementById('tpmList');
const quickDateChips = document.querySelectorAll('.quick-date-chip');
const equipmentSearchInput = document.getElementById('equipmentSearchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

const today = getLocalTodayStr();
tpmDate.value = today;
tpmDate.setAttribute('value', today);

function updateQuickDateActiveState(selectedDateStr) {
  quickDateChips.forEach((chip) => {
    const offset = parseInt(chip.dataset.offset, 10);
    const chipDateStr = getOffsetDateStr(offset);
    chip.classList.toggle('active', chipDateStr === selectedDateStr);
  });
}

function loadSchedule(dateStr) {
  const isToday = dateStr === getLocalTodayStr();
  scheduleTitle.textContent = isToday ? "Jadwal TPM Hari Ini" : `Jadwal TPM (${formatDateIndo(dateStr)})`;

  const cycleDay = getCycleDayForDate(dateStr);
  if (cycleDayBadge) {
    if (cycleDay) {
      cycleDayBadge.style.display = 'inline-block';
      cycleDayBadge.textContent = `Siklus Hari ${cycleDay}/15`;
    } else {
      cycleDayBadge.style.display = 'none';
    }
  }

  updateQuickDateActiveState(dateStr);
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
    const reported = !task.isOff && isShiftReported(dateStr, task.shift);

    const item = document.createElement('div');
    item.className = `tpm-item ${task.isOff ? 'off-day' : 'clickable'} ${isCurrentShift ? 'active-shift' : ''}`;

    const topRow = document.createElement('div');
    topRow.className = 'tpm-item-top';

    const shiftTag = document.createElement('span');
    shiftTag.className = 'shift-tag';
    shiftTag.textContent = task.shift === 'INFO' ? 'STATUS' : `SHIFT ${task.shift}`;

    if (!task.isOff && SHIFT_TIME_RANGES[task.shift]) {
      const hoursSpan = document.createElement('span');
      hoursSpan.className = 'shift-hours';
      hoursSpan.textContent = `(${SHIFT_TIME_RANGES[task.shift]})`;
      shiftTag.appendChild(hoursSpan);
    }

    if (isCurrentShift) {
      const activeBadge = document.createElement('span');
      activeBadge.className = 'active-badge';
      activeBadge.textContent = '● SHIFT AKTIF';
      shiftTag.appendChild(activeBadge);
    }

    if (reported) {
      const repBadge = document.createElement('span');
      repBadge.className = 'reported-badge';
      repBadge.textContent = '✓ DILAPORKAN';
      shiftTag.appendChild(repBadge);
    }

    topRow.appendChild(shiftTag);

    if (!task.isOff) {
      const actionHint = document.createElement('span');
      actionHint.className = 'tpm-action-hint';
      actionHint.textContent = 'Buat Kolase ➔';
      topRow.appendChild(actionHint);
    }

    const titleDiv = document.createElement('div');
    titleDiv.className = 'tpm-title';
    titleDiv.textContent = task.text;

    item.appendChild(topRow);
    item.appendChild(titleDiv);

    if (task.subtext) {
      const subDiv = document.createElement('div');
      subDiv.className = 'tpm-subtext';
      subDiv.textContent = task.subtext;
      item.appendChild(subDiv);
    }

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

function renderEquipmentSearchResults(rawQuery) {
  const query = rawQuery.trim().toUpperCase();
  if (!query) {
    loadSchedule(tpmDate.value || getLocalTodayStr());
    return;
  }

  scheduleTitle.textContent = `Hasil Pencarian: "${rawQuery.trim()}"`;
  if (cycleDayBadge) {
    cycleDayBadge.style.display = 'none';
  }

  const matches = [];
  for (let cycleDay = 1; cycleDay <= 15; cycleDay++) {
    const dayObj = masterTPMUrea1B[cycleDay];
    if (!dayObj) continue;
    ['PAGI', 'SORE', 'MALAM'].forEach((shift) => {
      const areaName = dayObj[shift];
      if (areaName && areaName.toUpperCase().includes(query)) {
        const nextDateStr = getNextDateForCycleDay(cycleDay);
        matches.push({
          cycleDay,
          shift,
          areaName,
          nextDateStr
        });
      }
    });
  }

  tpmList.innerHTML = '';
  if (matches.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.cssText = 'text-align:center; color:#888; padding: 20px 0;';
    emptyMsg.textContent = `Tidak ditemukan alat dengan kata kunci "${rawQuery.trim()}".`;
    tpmList.appendChild(emptyMsg);
    return;
  }

  const todayStr = getLocalTodayStr();
  matches.forEach((m) => {
    const isTodayMatch = m.nextDateStr === todayStr;
    const item = document.createElement('div');
    item.className = `tpm-item clickable ${isTodayMatch ? 'active-shift' : ''}`;

    const topRow = document.createElement('div');
    topRow.className = 'tpm-item-top';

    const shiftTag = document.createElement('span');
    shiftTag.className = 'shift-tag';
    shiftTag.textContent = `SHIFT ${m.shift} • SIKLUS HARI ${m.cycleDay}`;

    if (isTodayMatch) {
      const badge = document.createElement('span');
      badge.className = 'active-badge';
      badge.textContent = '● HARI INI';
      shiftTag.appendChild(badge);
    }

    const actionHint = document.createElement('span');
    actionHint.className = 'tpm-action-hint';
    actionHint.textContent = 'Buat Kolase ➔';

    topRow.appendChild(shiftTag);
    topRow.appendChild(actionHint);

    const titleDiv = document.createElement('div');
    titleDiv.className = 'tpm-title';
    titleDiv.textContent = m.areaName;

    const subDiv = document.createElement('div');
    subDiv.className = 'tpm-subtext';
    subDiv.textContent = isTodayMatch
      ? `📅 Jadwal terdekat: Hari Ini (${formatDateIndo(m.nextDateStr)})`
      : `📅 Jadwal terdekat: ${formatDateIndo(m.nextDateStr)}`;

    item.appendChild(topRow);
    item.appendChild(titleDiv);
    item.appendChild(subDiv);

    item.addEventListener('click', () => {
      const params = new URLSearchParams({
        date: m.nextDateStr,
        shift: m.shift,
        area: m.areaName
      });
      window.location.href = `kolase.html?${params.toString()}`;
    });

    tpmList.appendChild(item);
  });
}

quickDateChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const offset = parseInt(chip.dataset.offset, 10);
    const targetDate = getOffsetDateStr(offset);
    tpmDate.value = targetDate;
    tpmDate.setAttribute('value', targetDate);
    if (equipmentSearchInput && equipmentSearchInput.value.trim()) {
      equipmentSearchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.style.display = 'none';
    }
    loadSchedule(targetDate);
  });
});

if (equipmentSearchInput) {
  equipmentSearchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (clearSearchBtn) {
      clearSearchBtn.style.display = val.trim() ? 'flex' : 'none';
    }
    renderEquipmentSearchResults(val);
  });
}

if (clearSearchBtn && equipmentSearchInput) {
  clearSearchBtn.addEventListener('click', () => {
    equipmentSearchInput.value = '';
    clearSearchBtn.style.display = 'none';
    loadSchedule(tpmDate.value || getLocalTodayStr());
  });
}

tpmDate.addEventListener('change', (e) => {
  if (!e.target.value) {
    e.target.value = getLocalTodayStr();
  }
  if (equipmentSearchInput && equipmentSearchInput.value.trim()) {
    equipmentSearchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
  }
  loadSchedule(e.target.value);
});

loadSchedule(today);
initGuideModal();
initAppVersionCheck();

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

const isIOS = (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && !window.MSStream;
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
