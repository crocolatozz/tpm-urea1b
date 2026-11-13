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

function getScheduleForDate(dateStr) {
  if (!dateStr) return [];
  const dayOfMonth = parseInt(dateStr.split('-')[2], 10);
  
  if (dayOfMonth === 31) {
    return [{ shift: "INFO", text: "TIDAK ADA KEGIATAN", isOff: true }];
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

// Auto-Deteksi Shift Aktif Berdasarkan Jam HP
function getCurrentActiveShift() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return "PAGI";
  if (hour >= 15 && hour < 23) return "SORE";
  return "MALAM";
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
