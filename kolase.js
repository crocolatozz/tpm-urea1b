const tpmDateInput = document.getElementById('tpmDateInput');
const tpmShiftInput = document.getElementById('tpmShiftInput');
const tpmAreaInput = document.getElementById('tpmAreaInput');
const captionPreview = document.getElementById('captionPreview');
const copyCaptionBtn = document.getElementById('copyCaptionBtn');

const gridTypeInput = document.getElementById('gridType');
const beforeInput = document.getElementById('beforeInput');
const afterInput = document.getElementById('afterInput');
const beforeCount = document.getElementById('beforeCount');
const afterCount = document.getElementById('afterCount');
const beforeLabel = document.getElementById('beforeLabel');
const afterLabel = document.getElementById('afterLabel');

const appTitle = document.getElementById('appTitle');
const row1Group = document.getElementById('row1Group');
const row2Group = document.getElementById('row2Group');
const row3Group = document.getElementById('row3Group');

const leftHeaderInput = document.getElementById('leftHeaderText');
const rightHeaderInput = document.getElementById('rightHeaderText');
const row1Input = document.getElementById('row1Text');
const row2Input = document.getElementById('row2Text');
const row3Input = document.getElementById('row3Text');
const bgColorInput = document.getElementById('bgColor');
const textColorInput = document.getElementById('textColor');
const gapSizeInput = document.getElementById('gapSize');
const aspectRatioInput = document.getElementById('aspectRatio');
const canvas = document.getElementById('collageCanvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');

let loadedBeforeImages = [];
let loadedAfterImages = [];

const todayStr = new Date().toISOString().split('T')[0];
tpmDateInput.value = todayStr;

function updateAutoAreaName() {
  const dateVal = tpmDateInput.value;
  if (!dateVal) return;
  const dayOfMonth = parseInt(dateVal.split('-')[2], 10);
  
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
  const dateVal = tpmDateInput.value;
  if (!dateVal) return "";
  const dateFormatted = formatDateIndo(dateVal);
  const shiftVal = tpmShiftInput.value;
  const areaName = tpmAreaInput.value.trim() || "-";

  // Format bold 2 baris pertama WhatsApp (*teks*) + "SHIFT"
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
    caption += `\n\n` + bullets.join('\n');
  }

  return caption;
}

function updateCaption() {
  captionPreview.textContent = generateCaptionText();
}

tpmDateInput.addEventListener('change', updateAutoAreaName);
tpmShiftInput.addEventListener('change', updateAutoAreaName);
tpmAreaInput.addEventListener('input', updateCaption);

copyCaptionBtn.addEventListener('click', () => {
  const captionText = generateCaptionText();
  navigator.clipboard.writeText(captionText).then(() => {
    copyCaptionBtn.textContent = "✓ Teks Caption Tersalin!";
    setTimeout(() => copyCaptionBtn.textContent = "📋 Salin Teks Caption", 2000);
  });
});

function freeImages(imgArray) {
  imgArray.forEach(img => {
    if (img && typeof img.close === 'function') {
      img.close();
    }
  });
}

function getSelectedRows() {
  return parseInt(gridTypeInput.value.split('x')[1], 10);
}

function updateGridUI() {
  const rows = getSelectedRows();
  appTitle.textContent = "Kolase Foto TPM";
  beforeLabel.textContent = `Foto BEFORE (Kolom Kiri - Max ${rows})`;
  afterLabel.textContent = `Foto AFTER (Kolom Kanan - Max ${rows})`;

  row2Group.style.display = rows >= 2 ? 'flex' : 'none';
  row3Group.style.display = rows >= 3 ? 'flex' : 'none';

  updateCaption();

  if (beforeInput.files.length > 0) {
    readImages(beforeInput, beforeCount, (images) => {
      freeImages(loadedBeforeImages);
      loadedBeforeImages = images;
      updateStateAndGenerate();
    });
  }

  if (afterInput.files.length > 0) {
    readImages(afterInput, afterCount, (images) => {
      freeImages(loadedAfterImages);
      loadedAfterImages = images;
      updateStateAndGenerate();
    });
  }

  if (loadedBeforeImages.length > 0 || loadedAfterImages.length > 0) {
    generateCollage();
  }
}

gridTypeInput.addEventListener('change', updateGridUI);

[leftHeaderInput, rightHeaderInput, row1Input, row2Input, row3Input, bgColorInput, textColorInput, gapSizeInput, aspectRatioInput].forEach(element => {
  element.addEventListener('input', () => {
    updateCaption();
    if (loadedBeforeImages.length > 0 || loadedAfterImages.length > 0) generateCollage();
  });
});

async function processAndResizeFile(file) {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, {
        resizeWidth: 1200,
        resizeQuality: 'low'
      });
      return bitmap;
    } catch (err) {
      console.warn("createImageBitmap gagal, beralih ke FileReader fallback", err);
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function readImages(inputElement, statusElement, callback) {
  const files = Array.from(inputElement.files);
  
  if (files.length === 0) {
    statusElement.textContent = "Belum ada foto dipilih";
    callback([]);
    return;
  }

  const maxRows = getSelectedRows();
  const filesToProcess = files.slice(0, maxRows);

  let limitWarning = "";
  if (files.length > maxRows) {
    limitWarning = ` (Dipilih ${files.length}, hanya ${maxRows} foto pertama yang dipakai)`;
  }

  statusElement.textContent = "Memproses foto (0/" + filesToProcess.length + ")...";

  const validImages = [];
  for (let i = 0; i < filesToProcess.length; i++) {
    statusElement.textContent = `Memproses foto (${i + 1}/${filesToProcess.length})...`;
    const img = await processAndResizeFile(filesToProcess[i]);
    if (img) validImages.push(img);
  }

  if (validImages.length === 0) {
    statusElement.textContent = "Gagal memuat foto.";
  } else {
    statusElement.textContent = `${validImages.length} foto dimuat${limitWarning}`;
  }
  callback(validImages);
}

beforeInput.addEventListener('change', () => {
  readImages(beforeInput, beforeCount, (images) => {
    freeImages(loadedBeforeImages);
    loadedBeforeImages = images;
    updateStateAndGenerate();
  });
});

afterInput.addEventListener('change', () => {
  readImages(afterInput, afterCount, (images) => {
    freeImages(loadedAfterImages);
    loadedAfterImages = images;
    updateStateAndGenerate();
  });
});

function updateStateAndGenerate() {
  if (loadedBeforeImages.length > 0 || loadedAfterImages.length > 0) {
    downloadBtn.disabled = false;
    generateCollage();
  } else {
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

    // Render Teks Overlay
    const rawRowTexts = [
      row1Input ? row1Input.value : '',
      row2Input ? row2Input.value : '',
      row3Input ? row3Input.value : ''
    ];
    
    const rowTexts = rawRowTexts.slice(0, rows);

    rowTexts.forEach((text, r) => {
      if (!text || !text.trim()) return;

      const centerX = canvasWidth / 2;
      const rowBottomY = startY + (r + 1) * cellHeight + r * gap;
      const textY = rowBottomY - 60;

      ctx.save();
      ctx.font = 'bold 60px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const metrics = ctx.measureText(text);
      const padX = 32;
      const padY = 16;
      const bgW = metrics.width + (padX * 2);
      const bgH = 68 + (padY * 2);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      drawRoundedRect(ctx, centerX - (bgW / 2), textY - (bgH / 2), bgW, bgH, 20);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, centerX, textY);
      ctx.restore();
    });
  } catch (err) {
    console.error("Gagal generate kolase:", err);
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

updateAutoAreaName();
updateGridUI();
