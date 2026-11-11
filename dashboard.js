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
