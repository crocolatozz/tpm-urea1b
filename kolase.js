const tpmDateInput = document.getElementById('tpmDateInput');
const tpmShiftInput = document.getElementById('tpmShiftInput');
const tpmAreaInput = document.getElementById('tpmAreaInput');
const offDayWarning = document.getElementById('offDayWarning');
const captionPreview = document.getElementById('captionPreview');
const copyCaptionBtn = document.getElementById('copyCaptionBtn');

const gridOptions = document.querySelectorAll('.grid-option');
const beforeInput = document.getElementById('beforeInput');
const afterInput = document.getElementById('afterInput');
const singleSlotInput = document.getElementById('singleSlotInput');
const slotManagerGrid = document.getElementById('slotManagerGrid');
const beforeCount = document.getElementById('beforeCount');
const afterCount = document.getElementById('afterCount');
const beforeTip = document.getElementById('beforeTip');
const afterTip = document.getElementById('afterTip');
const beforeLabel = document.getElementById('beforeLabel');
const afterLabel = document.getElementById('afterLabel');

const photoActionsGrid = document.getElementById('photoActionsGrid');
const swapBeforeAfterBtn = document.getElementById('swapBeforeAfterBtn');
const swapRow12Btn = document.getElementById('swapRow12Btn');
const swapRow23Btn = document.getElementById('swapRow23Btn');
const resetPhotosBtn = document.getElementById('resetPhotosBtn');

const clearActivityTextsBtn = document.getElementById('clearActivityTextsBtn');
const presetChips = document.querySelectorAll('.preset-chip');
const row1Group = document.getElementById('row1Group');
const row2Group = document.getElementById('row2Group');
const row3Group = document.getElementById('row3Group');

const leftHeaderInput = document.getElementById('leftHeaderText');
const rightHeaderInput = document.getElementById('rightHeaderText');
const row1Input = document.getElementById('row1Text');
const row2Input = document.getElementById('row2Text');
const row3Input = document.getElementById('row3Text');
const overlayHistoryList = document.getElementById('overlayHistoryList');

const bgColorInput = document.getElementById('bgColor');
const textColorInput = document.getElementById('textColor');
const gapSizeInput = document.getElementById('gapSize');
const aspectRatioInput = document.getElementById('aspectRatio');
const stampMetaSelect = document.getElementById('stampMetaSelect');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const canvas = document.getElementById('collageCanvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');

let selectedGridType = '2x3';
let loadedBeforeImages = [];
let loadedAfterImages = [];
let isProcessingBefore = false;
let isProcessingAfter = false;
let isProcessingSingleSlot = false;
let pendingSingleSlotTarget = null; // { side: 'before' | 'after', index: number }
let lastFocusedRowInput = null;
let isExporting = false;

// Simpan & Muat Preferensi Tampilan & Draft Teks (localStorage)
const PREFS_STORAGE_KEY = 'tpm_kolase_prefs_v1';

function loadSavedPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return;
    const prefs = JSON.parse(raw);
    if (prefs.grid && ['2x1', '2x2', '2x3'].includes(prefs.grid)) {
      selectedGridType = prefs.grid;
      gridOptions.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.grid === selectedGridType);
      });
    }
    if (typeof prefs.row1 === 'string') row1Input.value = prefs.row1;
    if (typeof prefs.row2 === 'string') row2Input.value = prefs.row2;
    if (typeof prefs.row3 === 'string') row3Input.value = prefs.row3;
    if (typeof prefs.leftHeader === 'string' && prefs.leftHeader.trim()) leftHeaderInput.value = prefs.leftHeader;
    if (typeof prefs.rightHeader === 'string' && prefs.rightHeader.trim()) rightHeaderInput.value = prefs.rightHeader;
    if (typeof prefs.bgColor === 'string') bgColorInput.value = prefs.bgColor;
    if (typeof prefs.textColor === 'string') textColorInput.value = prefs.textColor;
    if (typeof prefs.gapSize === 'string') gapSizeInput.value = prefs.gapSize;
    if (typeof prefs.aspectRatio === 'string') aspectRatioInput.value = prefs.aspectRatio;
    if (stampMetaSelect && typeof prefs.stampMeta === 'string') stampMetaSelect.value = prefs.stampMeta;
  } catch (e) {}
}

function savePreferences() {
  try {
    const prefs = {
      grid: selectedGridType,
      row1: row1Input.value,
      row2: row2Input.value,
      row3: row3Input.value,
      leftHeader: leftHeaderInput.value,
      rightHeader: rightHeaderInput.value,
      bgColor: bgColorInput.value,
      textColor: textColorInput.value,
      gapSize: gapSizeInput.value,
      aspectRatio: aspectRatioInput.value,
      stampMeta: stampMetaSelect ? stampMetaSelect.value : 'off'
    };
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {}
}

// Riwayat Saran Kegiatan (localStorage)
const HISTORY_STORAGE_KEY = 'tpm_overlay_history_v1';
const DEFAULT_OVERLAY_SUGGESTIONS = [
  "Regreasing BV",
  "Cleaning baseplate pompa",
  "Cleaning instrumentasi",
  "Cleaning area & grating",
  "Pengecekan level & kondisi oli",
  "Cleaning body motor & coupling"
];

function loadOverlayHistory() {
  let saved = [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {
    saved = [];
  }
  const combined = [...new Set([...saved, ...DEFAULT_OVERLAY_SUGGESTIONS])].slice(0, 20);
  if (overlayHistoryList) {
    overlayHistoryList.innerHTML = '';
    combined.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      overlayHistoryList.appendChild(opt);
    });
  }
}

function saveOverlayHistory() {
  const currentTexts = [row1Input.value, row2Input.value, row3Input.value]
    .map(t => t.trim())
    .filter(t => t.length >= 3);

  if (currentTexts.length === 0) return;

  let saved = [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {
    saved = [];
  }

  const updated = [...new Set([...currentTexts, ...saved])].slice(0, 20);
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}
  loadOverlayHistory();
}

// Cek Parameter URL (Jika dibuka dari klik kartu Jadwal di Dashboard)
const urlParams = new URLSearchParams(window.location.search);
const paramDate = urlParams.get('date');
const paramShift = urlParams.get('shift');
const paramArea = urlParams.get('area');

const initialDateStr = (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) ? paramDate : getLocalTodayStr();
tpmDateInput.value = initialDateStr;
tpmDateInput.setAttribute('value', initialDateStr);

if (paramShift && ['PAGI', 'SORE', 'MALAM'].includes(paramShift)) {
  tpmShiftInput.value = paramShift;
} else {
  tpmShiftInput.value = getCurrentActiveShift();
}

function getEffectiveDateStr() {
  if (!tpmDateInput.value) {
    const fallback = getLocalTodayStr();
    tpmDateInput.value = fallback;
    tpmDateInput.setAttribute('value', fallback);
  }
  return tpmDateInput.value;
}

function checkOffDayIndicator(dateVal) {
  if (!offDayWarning || !dateVal) return;
  const dayOfMonth = parseInt(dateVal.split('-')[2], 10);
  if (dayOfMonth === 31) {
    offDayWarning.style.display = 'block';
  } else {
    offDayWarning.style.display = 'none';
  }
}

function updateAutoAreaName() {
  const dateVal = getEffectiveDateStr();
  const dayOfMonth = parseInt(dateVal.split('-')[2], 10);
  checkOffDayIndicator(dateVal);

  if (dayOfMonth === 31) {
    tpmAreaInput.value = "TIDAK ADA KEGIATAN";
  } else {
    const cycleDay = ((dayOfMonth - 1) % 15) + 1;
    const shiftVal = tpmShiftInput.value;

    if (masterTPMUrea1B[cycleDay] && masterTPMUrea1B[cycleDay][shiftVal]) {
      tpmAreaInput.value = masterTPMUrea1B[cycleDay][shiftVal];
    }
  }
  updateCaption();
  if (countValidImages(loadedBeforeImages) > 0 || countValidImages(loadedAfterImages) > 0) {
    generateCollage();
  }
}

function generateCaptionText() {
  const dateVal = getEffectiveDateStr();
  const dateFormatted = formatDateIndo(dateVal);
  const shiftVal = tpmShiftInput.value || getCurrentActiveShift();
  const areaName = tpmAreaInput.value.trim() || "-";

  // Format bold 2 baris pertama WhatsApp (*teks*) + "SHIFT" + simbol "~"
  const lines = [
    `*TPM ${areaName}*`,
    `*SHIFT ${shiftVal} ~ ${dateFormatted}*`
  ];

  const rows = getSelectedRows();
  const overlayInputs = [row1Input, row2Input, row3Input];

  // Bullet list resmi WhatsApp (- spasi)
  const bullets = [];
  for (let i = 0; i < rows; i++) {
    const text = overlayInputs[i] ? overlayInputs[i].value.trim() : "";
    if (text) {
      bullets.push(`- ${text}`);
    }
  }

  if (bullets.length > 0) {
    lines.push("", ...bullets);
  }

  return lines.join("\n");
}

function updateCaption() {
  if (captionPreview) {
    captionPreview.textContent = generateCaptionText();
  }
}

tpmDateInput.addEventListener('change', updateAutoAreaName);
tpmShiftInput.addEventListener('change', updateAutoAreaName);
tpmAreaInput.addEventListener('input', () => {
  updateCaption();
  if (countValidImages(loadedBeforeImages) > 0 || countValidImages(loadedAfterImages) > 0) {
    generateCollage();
  }
});

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return fallbackCopyText(text);
    }
  }
  return fallbackCopyText(text);
}

copyCaptionBtn.addEventListener('click', async () => {
  saveOverlayHistory();
  savePreferences();
  const captionText = generateCaptionText();
  const copied = await copyTextToClipboard(captionText);
  if (copied) {
    copyCaptionBtn.textContent = "✅ Caption Tersalin!";
    setTimeout(() => { copyCaptionBtn.textContent = "📋 Salin Caption"; }, 2000);
  } else {
    copyCaptionBtn.textContent = "⚠️ Gagal Salin Otomatis";
    setTimeout(() => { copyCaptionBtn.textContent = "📋 Salin Caption"; }, 2500);
  }
});

function freeSingleImage(img) {
  if (!img) return;
  if (typeof img.close === 'function') {
    try { img.close(); } catch (e) {}
  }
  if (img instanceof HTMLCanvasElement) {
    img.width = 1;
    img.height = 1;
  }
}

function freeImages(imgArray) {
  imgArray.forEach(freeSingleImage);
}

function getSelectedRows() {
  return parseInt(selectedGridType.split('x')[1], 10);
}

function countValidImages(arr) {
  return arr.filter(Boolean).length;
}

// Render Pratinjau & Tombol Kontrol Per Slot (Before 1..N & After 1..N)
function renderSlotManager() {
  if (!slotManagerGrid) return;
  const rows = getSelectedRows();
  slotManagerGrid.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    const pairDiv = document.createElement('div');
    pairDiv.className = 'slot-row-pair';

    [
      { side: 'before', label: `Before #${r + 1}`, img: loadedBeforeImages[r] },
      { side: 'after', label: `After #${r + 1}`, img: loadedAfterImages[r] }
    ].forEach((slotInfo) => {
      if (slotInfo.img) {
        const card = document.createElement('div');
        card.className = 'slot-card';

        const thumb = document.createElement('img');
        thumb.className = 'slot-thumb';
        thumb.alt = slotInfo.label;
        try {
          thumb.src = slotInfo.img.toDataURL('image/jpeg', 0.65);
        } catch (e) {}

        const meta = document.createElement('div');
        meta.className = 'slot-meta';

        const lbl = document.createElement('span');
        lbl.className = 'slot-label';
        lbl.textContent = slotInfo.label;

        const sub = document.createElement('span');
        sub.className = 'slot-sub';
        sub.textContent = 'Terisi';

        meta.appendChild(lbl);
        meta.appendChild(sub);

        const btns = document.createElement('div');
        btns.className = 'slot-btns';

        const replaceBtn = document.createElement('button');
        replaceBtn.type = 'button';
        replaceBtn.className = 'slot-mini-btn';
        replaceBtn.title = `Ganti ${slotInfo.label}`;
        replaceBtn.textContent = '↻';
        replaceBtn.addEventListener('click', () => {
          triggerSingleSlotPicker(slotInfo.side, r);
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'slot-mini-btn danger';
        delBtn.title = `Hapus ${slotInfo.label}`;
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', () => {
          removeSingleSlot(slotInfo.side, r);
        });

        btns.appendChild(replaceBtn);
        btns.appendChild(delBtn);

        card.appendChild(thumb);
        card.appendChild(meta);
        card.appendChild(btns);
        pairDiv.appendChild(card);
      } else {
        const emptyCard = document.createElement('button');
        emptyCard.type = 'button';
        emptyCard.className = 'slot-card empty';
        emptyCard.textContent = `+ ${slotInfo.label}`;
        emptyCard.addEventListener('click', () => {
          triggerSingleSlotPicker(slotInfo.side, r);
        });
        pairDiv.appendChild(emptyCard);
      }
    });

    slotManagerGrid.appendChild(pairDiv);
  }
}

function triggerSingleSlotPicker(side, index) {
  if (isProcessingSingleSlot || !singleSlotInput) return;
  pendingSingleSlotTarget = { side, index };
  singleSlotInput.click();
}

function removeSingleSlot(side, index) {
  if (side === 'before') {
    freeSingleImage(loadedBeforeImages[index]);
    loadedBeforeImages[index] = null;
  } else {
    freeSingleImage(loadedAfterImages[index]);
    loadedAfterImages[index] = null;
  }
  refreshPhotoStatusHints();
  updateStateAndGenerate();
}

if (singleSlotInput) {
  singleSlotInput.addEventListener('change', async () => {
    if (isProcessingSingleSlot) return;
    const files = Array.from(singleSlotInput.files || []);
    const target = pendingSingleSlotTarget;
    pendingSingleSlotTarget = null;

    if (files.length === 0 || !target) {
      singleSlotInput.value = '';
      return;
    }

    isProcessingSingleSlot = true;
    const statusEl = target.side === 'before' ? beforeCount : afterCount;
    statusEl.textContent = `⏳ Memuat slot #${target.index + 1}...`;

    try {
      const processed = await processAndResizeFile(files[0]);
      singleSlotInput.value = '';
      if (!processed) {
        refreshPhotoStatusHints();
        statusEl.textContent = "⚠️ Gagal memuat foto slot";
        return;
      }

      if (target.side === 'before') {
        freeSingleImage(loadedBeforeImages[target.index]);
        loadedBeforeImages[target.index] = processed;
      } else {
        freeSingleImage(loadedAfterImages[target.index]);
        loadedAfterImages[target.index] = processed;
      }

      refreshPhotoStatusHints();
      updateStateAndGenerate();
    } finally {
      isProcessingSingleSlot = false;
    }
  });
}

function refreshPhotoStatusHints() {
  const maxRows = getSelectedRows();
  const bCount = countValidImages(loadedBeforeImages);
  const aCount = countValidImages(loadedAfterImages);

  beforeCount.textContent = bCount > 0 ? `${bCount}/${maxRows} foto dimuat` : "Belum ada foto dipilih";
  afterCount.textContent = aCount > 0 ? `${aCount}/${maxRows} foto dimuat` : "Belum ada foto dipilih";

  if (beforeTip) {
    if (maxRows > 1 && bCount === 0) {
      beforeTip.textContent = `💡 Bisa langsung pilih/centang ${maxRows} foto sekaligus`;
      beforeTip.style.display = 'block';
    } else if (bCount > 0 && bCount < maxRows) {
      const rem = maxRows - bCount;
      beforeTip.textContent = `💡 Bisa tambah ${rem} foto lagi (mengisi slot kosong)`;
      beforeTip.style.display = 'block';
    } else {
      beforeTip.style.display = 'none';
    }
  }

  if (afterTip) {
    if (maxRows > 1 && aCount === 0) {
      afterTip.textContent = `💡 Bisa langsung pilih/centang ${maxRows} foto sekaligus`;
      afterTip.style.display = 'block';
    } else if (aCount > 0 && aCount < maxRows) {
      const rem = maxRows - aCount;
      afterTip.textContent = `💡 Bisa tambah ${rem} foto lagi (mengisi slot kosong)`;
      afterTip.style.display = 'block';
    } else {
      afterTip.style.display = 'none';
    }
  }

  renderSlotManager();
}

function updateGridUI() {
  const rows = getSelectedRows();
  beforeLabel.textContent = rows === 1
    ? "Foto BEFORE (Pilih 1 Foto)"
    : `Foto BEFORE (Pilih ${rows} Foto Sekaligus)`;
  afterLabel.textContent = rows === 1
    ? "Foto AFTER (Pilih 1 Foto)"
    : `Foto AFTER (Pilih ${rows} Foto Sekaligus)`;

  row2Group.style.display = rows >= 2 ? 'flex' : 'none';
  row3Group.style.display = rows >= 3 ? 'flex' : 'none';

  if (swapRow12Btn) swapRow12Btn.style.display = rows >= 2 ? 'flex' : 'none';
  if (swapRow23Btn) swapRow23Btn.style.display = rows >= 3 ? 'flex' : 'none';

  // Trim foto berlebih jika user menurunkan ukuran grid (misal 2x3 -> 2x2)
  if (loadedBeforeImages.length > rows) {
    freeImages(loadedBeforeImages.slice(rows));
    loadedBeforeImages = loadedBeforeImages.slice(0, rows);
  }
  if (loadedAfterImages.length > rows) {
    freeImages(loadedAfterImages.slice(rows));
    loadedAfterImages = loadedAfterImages.slice(0, rows);
  }

  refreshPhotoStatusHints();
  updateCaption();
  savePreferences();
  updateStateAndGenerate();
}

gridOptions.forEach(optionBtn => {
  optionBtn.addEventListener('click', () => {
    const newGrid = optionBtn.dataset.grid;
    if (!newGrid || newGrid === selectedGridType) return;
    selectedGridType = newGrid;
    gridOptions.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.grid === selectedGridType);
    });
    updateGridUI();
  });
});

// Track fokus input baris agar chip saran bisa langsung mengisi input aktif atau baris kosong berikutnya
[row1Input, row2Input, row3Input].forEach((inp) => {
  inp.addEventListener('focus', () => {
    lastFocusedRowInput = inp;
  });
  inp.addEventListener('blur', () => {
    saveOverlayHistory();
    savePreferences();
  });
});

presetChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const presetText = chip.dataset.text || '';
    if (!presetText) return;

    const rows = getSelectedRows();
    const activeInputs = [row1Input, row2Input, row3Input].slice(0, rows);

    let targetInput = null;
    if (lastFocusedRowInput && activeInputs.includes(lastFocusedRowInput) && !lastFocusedRowInput.value.trim()) {
      targetInput = lastFocusedRowInput;
    } else {
      targetInput = activeInputs.find(inp => !inp.value.trim()) || activeInputs[activeInputs.length - 1];
    }

    if (targetInput) {
      targetInput.value = presetText;
      savePreferences();
      updateCaption();
      if (countValidImages(loadedBeforeImages) > 0 || countValidImages(loadedAfterImages) > 0) {
        generateCollage();
      }
    }
  });
});

if (clearActivityTextsBtn) {
  clearActivityTextsBtn.addEventListener('click', () => {
    row1Input.value = '';
    row2Input.value = '';
    row3Input.value = '';
    savePreferences();
    updateCaption();
    if (countValidImages(loadedBeforeImages) > 0 || countValidImages(loadedAfterImages) > 0) {
      generateCollage();
    }
  });
}

const liveControls = [
  leftHeaderInput, rightHeaderInput,
  row1Input, row2Input, row3Input,
  bgColorInput, textColorInput, gapSizeInput, aspectRatioInput
];
if (stampMetaSelect) liveControls.push(stampMetaSelect);

liveControls.forEach(element => {
  element.addEventListener('input', () => {
    updateCaption();
    savePreferences();
    if (countValidImages(loadedBeforeImages) > 0 || countValidImages(loadedAfterImages) > 0) {
      generateCollage();
    }
  });
});

// Tombol Tukar Before & After
if (swapBeforeAfterBtn) {
  swapBeforeAfterBtn.addEventListener('click', () => {
    if (countValidImages(loadedBeforeImages) === 0 && countValidImages(loadedAfterImages) === 0) return;
    const temp = loadedBeforeImages;
    loadedBeforeImages = loadedAfterImages;
    loadedAfterImages = temp;
    refreshPhotoStatusHints();
    updateStateAndGenerate();
  });
}

// Helper Tukar Baris (Foto Before, Foto After, dan Teks Kegiatan ikut tertukar)
function swapRowIndices(idxA, idxB, inputA, inputB) {
  const tempBefore = loadedBeforeImages[idxA] || null;
  loadedBeforeImages[idxA] = loadedBeforeImages[idxB] || null;
  loadedBeforeImages[idxB] = tempBefore;

  const tempAfter = loadedAfterImages[idxA] || null;
  loadedAfterImages[idxA] = loadedAfterImages[idxB] || null;
  loadedAfterImages[idxB] = tempAfter;

  const tempText = inputA.value;
  inputA.value = inputB.value;
  inputB.value = tempText;

  savePreferences();
  refreshPhotoStatusHints();
  updateCaption();
  if (countValidImages(loadedBeforeImages) > 0 || countValidImages(loadedAfterImages) > 0) {
    generateCollage();
  }
}

if (swapRow12Btn) {
  swapRow12Btn.addEventListener('click', () => swapRowIndices(0, 1, row1Input, row2Input));
}

if (swapRow23Btn) {
  swapRow23Btn.addEventListener('click', () => swapRowIndices(1, 2, row2Input, row3Input));
}

// Tombol Reset Foto
if (resetPhotosBtn) {
  resetPhotosBtn.addEventListener('click', () => {
    freeImages(loadedBeforeImages);
    freeImages(loadedAfterImages);
    loadedBeforeImages = [];
    loadedAfterImages = [];
    beforeInput.value = '';
    afterInput.value = '';
    refreshPhotoStatusHints();
    updateStateAndGenerate();
  });
}

// Helper resize gambar yang sudah berhasil di-load ke offscreen canvas
function resizeImageToOffscreenCanvas(img) {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) return null;

  const MAX_DIM = 1200;
  let targetW = srcW;
  let targetH = srcH;

  if (srcW > MAX_DIM || srcH > MAX_DIM) {
    if (srcW >= srcH) {
      targetW = MAX_DIM;
      targetH = Math.round((srcH * MAX_DIM) / srcW);
    } else {
      targetH = MAX_DIM;
      targetW = Math.round((srcW * MAX_DIM) / srcH);
    }
  }

  const offCanvas = document.createElement('canvas');
  offCanvas.width = targetW;
  offCanvas.height = targetH;
  const offCtx = offCanvas.getContext('2d');
  offCtx.drawImage(img, 0, 0, targetW, targetH);
  return offCanvas;
}

// Jalur cadangan FileReader jika ObjectURL gagal di galeri iCloud / Android tertentu
function loadViaFileReader(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          if (typeof img.decode === 'function') {
            await img.decode().catch(() => {});
          }
          resolve(resizeImageToOffscreenCanvas(img));
        } catch (err) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// Muat foto dengan jalur ganda (ObjectURL utama + FileReader fallback otomatis)
function processAndResizeFile(file) {
  return new Promise((resolve) => {
    let objectUrl = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (e) {
      loadViaFileReader(file).then(resolve);
      return;
    }

    const img = new Image();
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode().catch(() => {});
        }
        const resultCanvas = resizeImageToOffscreenCanvas(img);
        URL.revokeObjectURL(objectUrl);
        if (resultCanvas) {
          resolve(resultCanvas);
        } else {
          loadViaFileReader(file).then(resolve);
        }
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        loadViaFileReader(file).then(resolve);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      loadViaFileReader(file).then(resolve);
    };

    img.src = objectUrl;
  });
}

// Baca foto dengan mode SMART SLOT FILL (mengisi slot kosong berurutan tanpa menimpa foto lama)
async function appendSelectedImages(inputElement, statusElement, currentArray, setArrayCallback) {
  const files = Array.from(inputElement.files || []);
  if (files.length === 0) return;

  const maxRows = getSelectedRows();
  const normalized = Array.from({ length: maxRows }, (_, idx) => currentArray[idx] || null);
  const emptyIndices = [];
  for (let i = 0; i < maxRows; i++) {
    if (!normalized[i]) emptyIndices.push(i);
  }

  const willReplaceAll = emptyIndices.length === 0;
  const availableSlots = willReplaceAll ? maxRows : emptyIndices.length;
  const filesToProcess = files.slice(0, availableSlots);

  let limitWarning = "";
  if (files.length > availableSlots) {
    limitWarning = ` (Hanya ${availableSlots} foto diambil sesuai sisa slot)`;
  }

  statusElement.textContent = `⏳ Memproses foto (0/${filesToProcess.length})...`;

  const newlyLoaded = [];
  for (let i = 0; i < filesToProcess.length; i++) {
    statusElement.textContent = `⏳ Memproses foto (${i + 1}/${filesToProcess.length})...`;
    const processedImg = await processAndResizeFile(filesToProcess[i]);
    if (processedImg) newlyLoaded.push(processedImg);
  }

  // Reset input SETELAH proses baca file selesai agar izin file sementara di iOS Safari tidak terputus
  inputElement.value = '';

  if (newlyLoaded.length === 0) {
    refreshPhotoStatusHints();
    statusElement.textContent = "⚠️ Gagal memuat foto (format tidak didukung atau file rusak)";
    return;
  }

  let updatedSlots;
  if (willReplaceAll) {
    freeImages(normalized);
    updatedSlots = Array.from({ length: maxRows }, (_, idx) => newlyLoaded[idx] || null);
  } else {
    updatedSlots = [...normalized];
    newlyLoaded.forEach((imgObj, i) => {
      const targetIdx = emptyIndices[i];
      if (targetIdx !== undefined) {
        updatedSlots[targetIdx] = imgObj;
      }
    });
  }

  setArrayCallback(updatedSlots);
  refreshPhotoStatusHints();

  if (limitWarning) {
    const validTotal = countValidImages(updatedSlots);
    statusElement.textContent = `${validTotal}/${maxRows} foto dimuat${limitWarning}`;
  }

  updateStateAndGenerate();
}

beforeInput.addEventListener('change', async () => {
  if (isProcessingBefore) return;
  isProcessingBefore = true;
  try {
    await appendSelectedImages(beforeInput, beforeCount, loadedBeforeImages, (updated) => {
      loadedBeforeImages = updated;
    });
  } finally {
    isProcessingBefore = false;
  }
});

afterInput.addEventListener('change', async () => {
  if (isProcessingAfter) return;
  isProcessingAfter = true;
  try {
    await appendSelectedImages(afterInput, afterCount, loadedAfterImages, (updated) => {
      loadedAfterImages = updated;
    });
  } finally {
    isProcessingAfter = false;
  }
});

function updateStateAndGenerate() {
  const hasPhotos = countValidImages(loadedBeforeImages) > 0 || countValidImages(loadedAfterImages) > 0;
  if (hasPhotos) {
    if (previewPlaceholder) {
      previewPlaceholder.style.display = 'none';
      previewPlaceholder.textContent = '🖼️ Pratinjau kolase otomatis muncul di sini setelah foto dipilih';
    }
    canvas.style.display = 'block';
    if (photoActionsGrid) photoActionsGrid.style.display = 'grid';
    downloadBtn.disabled = false;
    generateCollage();
  } else {
    if (canvas.width > 0 && canvas.height > 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.display = 'none';
    if (photoActionsGrid) photoActionsGrid.style.display = 'none';
    if (previewPlaceholder) {
      previewPlaceholder.textContent = '🖼️ Pratinjau kolase otomatis muncul di sini setelah foto dipilih';
      previewPlaceholder.style.display = 'block';
    }
    downloadBtn.disabled = true;
  }
}

function generateCollage() {
  try {
    const rows = getSelectedRows();
    const cellWidth = 800;
    const ratio = parseFloat(aspectRatioInput.value);
    const cellHeight = Math.round(cellWidth * ratio);

    const gap = parseInt(gapSizeInput.value, 10);
    const headerHeight = 200;
    const padding = gap;

    const canvasWidth = (cellWidth * 2) + (gap) + (padding * 2);
    const canvasHeight = headerHeight + (cellHeight * rows) + (gap * (rows - 1)) + (padding * 2);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Background
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Header Utama
    ctx.fillStyle = textColorInput.value;
    ctx.font = 'bold 80px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const leftColCenterX = padding + (cellWidth / 2);
    const rightColCenterX = padding + cellWidth + gap + (cellWidth / 2);
    const headerCenterY = padding + (headerHeight / 2);

    ctx.fillText(leftHeaderInput.value, leftColCenterX, headerCenterY);
    ctx.fillText(rightHeaderInput.value, rightColCenterX, headerCenterY);

    // Opsional: Stamp Metadata Area, Shift & Tanggal di Sudut Kanan Atas Header
    if (stampMetaSelect && stampMetaSelect.value === 'on') {
      const areaLabel = (tpmAreaInput.value || '').trim();
      const shiftLabel = tpmShiftInput.value || '';
      const dateLabel = formatDateIndo(getEffectiveDateStr());
      const stampText = `${areaLabel} • ${shiftLabel} • ${dateLabel}`;

      ctx.save();
      ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(stampText, canvasWidth - Math.max(padding, 20), Math.max(padding, 16));
      ctx.restore();
    }

    // Render Foto
    const startY = padding + headerHeight;

    for (let r = 0; r < rows; r++) {
      const y = startY + r * (cellHeight + gap);

      if (loadedBeforeImages[r]) {
        const xLeft = padding;
        drawImageCover(ctx, loadedBeforeImages[r], xLeft, y, cellWidth, cellHeight);
      }

      if (loadedAfterImages[r]) {
        const xRight = padding + cellWidth + gap;
        drawImageCover(ctx, loadedAfterImages[r], xRight, y, cellWidth, cellHeight);
      }
    }

    // Render Teks Overlay dengan Auto-Scale Font
    const rawRowTexts = [
      row1Input ? row1Input.value : '',
      row2Input ? row2Input.value : '',
      row3Input ? row3Input.value : ''
    ];

    const rowTexts = rawRowTexts.slice(0, rows);
    const maxPillWidth = canvasWidth - (padding * 2) - 48;

    rowTexts.forEach((rawText, r) => {
      const text = rawText ? rawText.trim() : '';
      if (!text) return;

      const centerX = canvasWidth / 2;
      const rowBottomY = startY + (r + 1) * cellHeight + r * gap;

      ctx.save();
      let fontSize = 60;
      const minFontSize = 24;
      const padX = 32;
      const padY = 16;

      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      let metrics = ctx.measureText(text);

      while ((metrics.width + padX * 2) > maxPillWidth && fontSize > minFontSize) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        metrics = ctx.measureText(text);
      }

      const bgW = Math.min(metrics.width + (padX * 2), maxPillWidth);
      const bgH = Math.round(fontSize * 1.15) + (padY * 2);
      const textY = rowBottomY - (bgH / 2) - 24;
      const cornerRadius = Math.min(20, Math.round(bgH / 3));

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      drawRoundedRect(ctx, centerX - (bgW / 2), textY - (bgH / 2), bgW, bgH, cornerRadius);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, centerX, textY, maxPillWidth - (padX * 2));
      ctx.restore();
    });
  } catch (err) {
    console.error("Gagal generate kolase:", err);
    if (previewPlaceholder) {
      previewPlaceholder.textContent = "⚠️ Terjadi kendala saat membuat pratinjau gambar. Silakan coba pilih ulang foto.";
      previewPlaceholder.style.display = 'block';
    }
  }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawImageCover(ctx, img, x, y, w, h) {
  if (!img || !img.width || !img.height) return;
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sx, sy, sw, sh;

  if (imgRatio > targetRatio) {
    sh = img.height;
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = img.width / targetRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

downloadBtn.addEventListener('click', () => {
  if (isExporting) return;
  isExporting = true;
  const defaultBtnHTML = downloadBtn.innerHTML;
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = '<span class="spinner"></span> Menyiapkan gambar...';

  saveOverlayHistory();
  savePreferences();

  const currentDateStr = getEffectiveDateStr();
  const currentShiftStr = tpmShiftInput.value || getCurrentActiveShift();
  const currentAreaStr = tpmAreaInput.value.trim() || "TPM";

  canvas.toBlob(async (blob) => {
    try {
      if (!blob) return;

      const areaNameClean = currentAreaStr.replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `Kolase_${areaNameClean}_${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      const captionText = generateCaptionText();

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `TPM ${currentAreaStr}`,
            text: captionText
          });
          markShiftAsReported(currentDateStr, currentShiftStr, currentAreaStr);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      // Fallback PC/Desktop: Unduh file JPG sekaligus salin caption otomatis ke clipboard
      await copyTextToClipboard(captionText);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      markShiftAsReported(currentDateStr, currentShiftStr, currentAreaStr);

      downloadBtn.innerHTML = "✅ Gambar Diunduh & Caption Tersalin!";
      setTimeout(() => {
        downloadBtn.innerHTML = defaultBtnHTML;
      }, 2500);
      return;
    } finally {
      isExporting = false;
      downloadBtn.disabled = false;
      if (downloadBtn.innerHTML.includes('Menyiapkan gambar')) {
        downloadBtn.innerHTML = defaultBtnHTML;
      }
    }
  }, 'image/jpeg', 0.95);
});

// Inisialisasi Awal
loadSavedPreferences();
if (paramArea) {
  tpmAreaInput.value = paramArea;
  checkOffDayIndicator(tpmDateInput.value);
  updateCaption();
} else {
  updateAutoAreaName();
}
loadOverlayHistory();
updateGridUI();
initGuideModal();
initAppVersionCheck();
