const tpmDateInput = document.getElementById('tpmDateInput');
const tpmShiftInput = document.getElementById('tpmShiftInput');
const tpmAreaInput = document.getElementById('tpmAreaInput');
const offDayWarning = document.getElementById('offDayWarning');
const captionPreview = document.getElementById('captionPreview');
const copyCaptionBtn = document.getElementById('copyCaptionBtn');

const gridOptions = document.querySelectorAll('.grid-option');
const beforeInput = document.getElementById('beforeInput');
const afterInput = document.getElementById('afterInput');
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
const previewPlaceholder = document.getElementById('previewPlaceholder');
const canvas = document.getElementById('collageCanvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');

let selectedGridType = '2x3';
let loadedBeforeImages = [];
let loadedAfterImages = [];

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
}

function generateCaptionText() {
  const dateVal = getEffectiveDateStr();
  const dateFormatted = formatDateIndo(dateVal);
  const shiftVal = tpmShiftInput.value || getCurrentActiveShift();
  const areaName = tpmAreaInput.value.trim() || "-";

  // Format bold 2 baris pertama WhatsApp (*teks*) + "SHIFT" + simbol "~"
  let caption = `*TPM ${areaName}*
*SHIFT ${shiftVal} ~ ${dateFormatted}*`;

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
    caption += `

` + bullets.join('
');
  }

  return caption;
}

function updateCaption() {
  captionPreview.textContent = generateCaptionText();
}

tpmDateInput.addEventListener('change', updateAutoAreaName);
tpmShiftInput.addEventListener('change', updateAutoAreaName);
tpmAreaInput.addEventListener('input', updateCaption);

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

copyCaptionBtn.addEventListener('click', async () => {
  saveOverlayHistory();
  const captionText = generateCaptionText();
  let copied = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(captionText);
      copied = true;
    } catch (e) {
      copied = fallbackCopyText(captionText);
    }
  } else {
    copied = fallbackCopyText(captionText);
  }
  if (copied) {
    copyCaptionBtn.textContent = "✅ Caption Tersalin!";
    setTimeout(() => copyCaptionBtn.textContent = "📋 Salin Caption", 2000);
  } else {
    copyCaptionBtn.textContent = "⚠️ Tahan & Salin Manual";
    setTimeout(() => copyCaptionBtn.textContent = "📋 Salin Caption", 2500);
  }
});

function freeImages(imgArray) {
  imgArray.forEach(img => {
    if (!img) return;
    if (typeof img.close === 'function') {
      try { img.close(); } catch (e) {}
    }
    if (img instanceof HTMLCanvasElement) {
      img.width = 1;
      img.height = 1;
    }
  });
}

function getSelectedRows() {
  return parseInt(selectedGridType.split('x')[1], 10);
}

function countValidImages(arr) {
  return arr.filter(Boolean).length;
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
      beforeTip.textContent = `💡 Bisa tambah ${rem} foto lagi (tidak menimpa foto lama)`;
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
      afterTip.textContent = `💡 Bisa tambah ${rem} foto lagi (tidak menimpa foto lama)`;
      afterTip.style.display = 'block';
    } else {
      afterTip.style.display = 'none';
    }
  }
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

[leftHeaderInput, rightHeaderInput, row1Input, row2Input, row3Input, bgColorInput, textColorInput, gapSizeInput, aspectRatioInput].forEach(element => {
  element.addEventListener('input', () => {
    updateCaption();
    if (countValidImages(loadedBeforeImages) > 0 || countValidImages(loadedAfterImages) > 0) {
      generateCollage();
    }
  });
});

[row1Input, row2Input, row3Input].forEach(input => {
  input.addEventListener('blur', saveOverlayHistory);
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
  const tempBefore = loadedBeforeImages[idxA];
  loadedBeforeImages[idxA] = loadedBeforeImages[idxB];
  loadedBeforeImages[idxB] = tempBefore;

  const tempAfter = loadedAfterImages[idxA];
  loadedAfterImages[idxA] = loadedAfterImages[idxB];
  loadedAfterImages[idxB] = tempAfter;

  const tempText = inputA.value;
  inputA.value = inputB.value;
  inputB.value = tempText;

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

// Muat foto memakai jalur Image standar + resize aman ke offscreen canvas (100% stabil di Safari iOS, Android & PC)
function processAndResizeFile(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }

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

        URL.revokeObjectURL(objectUrl);
        resolve(offCanvas);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    img.src = objectUrl;
  });
}

// Baca foto dengan mode APPEND (nambah ke slot kosong tanpa menimpa foto lama)
async function appendSelectedImages(inputElement, statusElement, currentArray, setArrayCallback) {
  const files = Array.from(inputElement.files || []);
  if (files.length === 0) return;

  const maxRows = getSelectedRows();
  const existingValid = currentArray.filter(Boolean);
  const willReplaceFull = existingValid.length >= maxRows;
  const remainingSlots = willReplaceFull ? maxRows : (maxRows - existingValid.length);
  const filesToProcess = files.slice(0, remainingSlots);

  let limitWarning = "";
  if (files.length > remainingSlots) {
    limitWarning = ` (Hanya ${remainingSlots} foto diambil sesuai sisa slot)`;
  }

  statusElement.textContent = `Memproses foto (0/${filesToProcess.length})...`;

  const newlyLoaded = [];
  for (let i = 0; i < filesToProcess.length; i++) {
    statusElement.textContent = `Memproses foto (${i + 1}/${filesToProcess.length})...`;
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

  let combined;
  if (willReplaceFull) {
    freeImages(existingValid);
    combined = newlyLoaded.slice(0, maxRows);
  } else {
    combined = [...existingValid, ...newlyLoaded].slice(0, maxRows);
  }

  setArrayCallback(combined);
  refreshPhotoStatusHints();

  if (limitWarning) {
    statusElement.textContent = `${combined.length}/${maxRows} foto dimuat${limitWarning}`;
  }

  updateStateAndGenerate();
}

beforeInput.addEventListener('change', () => {
  appendSelectedImages(beforeInput, beforeCount, loadedBeforeImages, (updated) => {
    loadedBeforeImages = updated;
  });
});

afterInput.addEventListener('change', () => {
  appendSelectedImages(afterInput, afterCount, loadedAfterImages, (updated) => {
    loadedAfterImages = updated;
  });
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
  saveOverlayHistory();
  canvas.toBlob(async (blob) => {
    if (!blob) return;

    const areaNameClean = (tpmAreaInput.value || "TPM").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Kolase_${areaNameClean}_${Date.now()}.jpg`;
    const file = new File([blob], filename, { type: 'image/jpeg' });
    const captionText = generateCaptionText();

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `TPM ${tpmAreaInput.value}`,
          text: captionText
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }, 'image/jpeg', 0.95);
});

// Inisialisasi Awal
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
