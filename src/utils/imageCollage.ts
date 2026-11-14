import { formatDateIndo } from '../data/tpmData';

export interface LoadedPhotoSlot {
  canvas: HTMLCanvasElement;
  previewUrl: string;
}

export interface CollageExportOptions {
  rows: number;
  beforeSlots: Array<LoadedPhotoSlot | null>;
  afterSlots: Array<LoadedPhotoSlot | null>;
  rowTexts: string[];
  areaName: string;
  shiftName: string;
  dateStr: string;
}

export function freeSingleSlot(slot: LoadedPhotoSlot | null | undefined): void {
  if (!slot) return;
  if (slot.canvas) {
    slot.canvas.width = 1;
    slot.canvas.height = 1;
  }
}

export function freeSlotArray(slots: Array<LoadedPhotoSlot | null | undefined>): void {
  slots.forEach(freeSingleSlot);
}

function resizeImageToOffscreenCanvas(img: HTMLImageElement): LoadedPhotoSlot | null {
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
  if (!offCtx) return null;

  offCtx.drawImage(img, 0, 0, targetW, targetH);

  // Create lightweight thumbnail DataURL for smooth mobile grid preview
  let previewUrl = '';
  try {
    const thumbMax = 480;
    let thumbW = targetW;
    let thumbH = targetH;
    if (targetW > thumbMax || targetH > thumbMax) {
      if (targetW >= targetH) {
        thumbW = thumbMax;
        thumbH = Math.round((targetH * thumbMax) / targetW);
      } else {
        thumbH = thumbMax;
        thumbW = Math.round((targetW * thumbMax) / targetH);
      }
    }
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const thumbCtx = thumbCanvas.getContext('2d');
    if (thumbCtx) {
      thumbCtx.drawImage(offCanvas, 0, 0, thumbW, thumbH);
      previewUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);
      thumbCanvas.width = 1;
      thumbCanvas.height = 1;
    } else {
      previewUrl = offCanvas.toDataURL('image/jpeg', 0.65);
    }
  } catch {
    previewUrl = '';
  }

  return { canvas: offCanvas, previewUrl };
}

function loadViaFileReader(file: File): Promise<LoadedPhotoSlot | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = async () => {
        try {
          if (typeof img.decode === 'function') {
            await img.decode().catch(() => {});
          }
          resolve(resizeImageToOffscreenCanvas(img));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function processAndResizeFile(file: File): Promise<LoadedPhotoSlot | null> {
  return new Promise((resolve) => {
    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      loadViaFileReader(file).then(resolve);
      return;
    }

    const img = new Image();
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode().catch(() => {});
        }
        const processed = resizeImageToOffscreenCanvas(img);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (processed) {
          resolve(processed);
        } else {
          loadViaFileReader(file).then(resolve);
        }
      } catch {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        loadViaFileReader(file).then(resolve);
      }
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      loadViaFileReader(file).then(resolve);
    };

    img.src = objectUrl;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
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

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  imgCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (!imgCanvas || !imgCanvas.width || !imgCanvas.height) return;
  const imgRatio = imgCanvas.width / imgCanvas.height;
  const targetRatio = w / h;
  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;

  if (imgRatio > targetRatio) {
    sh = imgCanvas.height;
    sw = imgCanvas.height * targetRatio;
    sx = (imgCanvas.width - sw) / 2;
    sy = 0;
  } else {
    sw = imgCanvas.width;
    sh = imgCanvas.width / targetRatio;
    sx = 0;
    sy = (imgCanvas.height - sh) / 2;
  }

  ctx.drawImage(imgCanvas, sx, sy, sw, sh, x, y, w, h);
}

export function renderCollageToCanvas(
  canvas: HTMLCanvasElement,
  opts: CollageExportOptions
): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const { rows, beforeSlots, afterSlots, rowTexts, areaName, shiftName, dateStr } = opts;

  const cellWidth = 800;
  const cellHeight = 800; // 1:1 square Instagram-style grid
  const gap = 12;
  const padding = gap;
  const headerHeight = 160;
  const footerHeight = 96; // Dedicated clean bottom frame strip for legible timestamp & area

  const canvasWidth = cellWidth * 2 + gap + padding * 2;
  const canvasHeight =
    headerHeight + cellHeight * rows + gap * (rows - 1) + footerHeight + padding * 2;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Frame Background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Main Column Headers (BEFORE | AFTER)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 76px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const leftColCenterX = padding + cellWidth / 2;
  const rightColCenterX = padding + cellWidth + gap + cellWidth / 2;
  const headerCenterY = padding + headerHeight / 2;

  ctx.fillText('BEFORE', leftColCenterX, headerCenterY);
  ctx.fillText('AFTER', rightColCenterX, headerCenterY);

  // Render Grid Photos
  const startY = padding + headerHeight;

  for (let r = 0; r < rows; r++) {
    const y = startY + r * (cellHeight + gap);

    const beforeSlot = beforeSlots[r];
    if (beforeSlot?.canvas) {
      drawImageCover(ctx, beforeSlot.canvas, padding, y, cellWidth, cellHeight);
    } else {
      ctx.fillStyle = '#141414';
      ctx.fillRect(padding, y, cellWidth, cellHeight);
    }

    const afterSlot = afterSlots[r];
    const xRight = padding + cellWidth + gap;
    if (afterSlot?.canvas) {
      drawImageCover(ctx, afterSlot.canvas, xRight, y, cellWidth, cellHeight);
    } else {
      ctx.fillStyle = '#141414';
      ctx.fillRect(xRight, y, cellWidth, cellHeight);
    }
  }

  // Render Row Text Overlays with Auto-Scaled Pill
  const maxPillWidth = canvasWidth - padding * 2 - 48;
  rowTexts.slice(0, rows).forEach((rawText, r) => {
    const text = rawText ? rawText.trim() : '';
    if (!text) return;

    const centerX = canvasWidth / 2;
    const rowBottomY = startY + (r + 1) * cellHeight + r * gap;

    ctx.save();
    let fontSize = 58;
    const minFontSize = 24;
    const padX = 32;
    const padY = 16;

    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    let metrics = ctx.measureText(text);

    while (metrics.width + padX * 2 > maxPillWidth && fontSize > minFontSize) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      metrics = ctx.measureText(text);
    }

    const bgW = Math.min(metrics.width + padX * 2, maxPillWidth);
    const bgH = Math.round(fontSize * 1.15) + padY * 2;
    const textY = rowBottomY - bgH / 2 - 24;
    const cornerRadius = Math.min(20, Math.round(bgH / 3));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    drawRoundedRect(ctx, centerX - bgW / 2, textY - bgH / 2, bgW, bgH, cornerRadius);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, centerX, textY, maxPillWidth - padX * 2);
    ctx.restore();
  });

  // Redesigned Large & Legible Timestamp Metadata Strip in Bottom Frame
  const areaLabel = areaName.trim() || 'TPM UREA 1B';
  const dateLabel = formatDateIndo(dateStr);
  const stampText = `TPM ${areaLabel}   •   SHIFT ${shiftName}   •   ${dateLabel}`;

  const footerCenterY = startY + rows * cellHeight + (rows - 1) * gap + footerHeight / 2;
  ctx.save();
  let stampFontSize = 40;
  const maxStampWidth = canvasWidth - padding * 2 - 40;
  ctx.font = `700 ${stampFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  while (ctx.measureText(stampText).width > maxStampWidth && stampFontSize > 24) {
    stampFontSize -= 2;
    ctx.font = `700 ${stampFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }
  ctx.fillStyle = '#e5e7eb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stampText, canvasWidth / 2, footerCenterY);
  ctx.restore();

  return true;
}

function fallbackCopyText(text: string): boolean {
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
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopyText(text);
    }
  }
  return fallbackCopyText(text);
}
