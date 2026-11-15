import { formatDateIndo } from '../data/tpmData';

export const COLLAGE_CELL_WIDTH = 800;
export const COLLAGE_CELL_HEIGHT = 800;
export const COLLAGE_CELL_ASPECT = COLLAGE_CELL_WIDTH / COLLAGE_CELL_HEIGHT;

export interface CropAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhotoEditParams {
  crop: { x: number; y: number };
  zoom: number;
  rotation: number;
}

export interface LoadedPhotoSlot {
  canvas: HTMLCanvasElement;
  sourceCanvas: HTMLCanvasElement;
  sourceUrl: string;
  previewUrl: string;
  fileSize?: number;
  lastModified?: number;
  editParams?: PhotoEditParams;
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
    slot.canvas.width = 0;
    slot.canvas.height = 0;
  }
  if (slot.sourceCanvas && slot.sourceCanvas !== slot.canvas) {
    slot.sourceCanvas.width = 0;
    slot.sourceCanvas.height = 0;
  }
  slot.previewUrl = '';
  slot.sourceUrl = '';
  slot.fileSize = undefined;
  slot.lastModified = undefined;
  slot.editParams = undefined;
}

export function freeSlotArray(slots: Array<LoadedPhotoSlot | null | undefined>): void {
  slots.forEach(freeSingleSlot);
}

function createThumbnailDataUrl(sourceCanvas: HTMLCanvasElement): string {
  try {
    const thumbMax = 480;
    let thumbW = sourceCanvas.width;
    let thumbH = sourceCanvas.height;
    if (thumbW > thumbMax || thumbH > thumbMax) {
      if (thumbW >= thumbH) {
        thumbW = thumbMax;
        thumbH = Math.round((sourceCanvas.height * thumbMax) / sourceCanvas.width);
      } else {
        thumbH = thumbMax;
        thumbW = Math.round((sourceCanvas.width * thumbMax) / sourceCanvas.height);
      }
    }
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = Math.max(1, thumbW);
    thumbCanvas.height = Math.max(1, thumbH);
    const thumbCtx = thumbCanvas.getContext('2d');
    if (thumbCtx) {
      thumbCtx.drawImage(sourceCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      const url = thumbCanvas.toDataURL('image/jpeg', 0.72);
      thumbCanvas.width = 0;
      thumbCanvas.height = 0;
      return url;
    }
    return sourceCanvas.toDataURL('image/jpeg', 0.65);
  } catch {
    return '';
  }
}

function resizeSourceToOffscreenCanvas(
  source: CanvasImageSource,
  srcW: number,
  srcH: number
): LoadedPhotoSlot | null {
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

  offCtx.drawImage(source, 0, 0, targetW, targetH);

  const previewUrl = createThumbnailDataUrl(offCanvas);
  let sourceUrl = '';
  try {
    sourceUrl = offCanvas.toDataURL('image/jpeg', 0.92);
  } catch {
    sourceUrl = previewUrl;
  }

  return {
    canvas: offCanvas,
    sourceCanvas: offCanvas,
    sourceUrl,
    previewUrl,
  };
}

export function renderEditedSlot(
  slot: LoadedPhotoSlot,
  croppedAreaPixels: CropAreaPixels,
  rotationDeg: number,
  editParams: PhotoEditParams
): LoadedPhotoSlot | null {
  const srcCanvas = slot.sourceCanvas;
  if (!srcCanvas || !srcCanvas.width || !srcCanvas.height) return null;

  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  const normalizedRot = ((rotationDeg % 360) + 360) % 360;
  const rad = (normalizedRot * Math.PI) / 180;

  const rotW = Math.max(
    1,
    Math.round(Math.abs(Math.cos(rad) * srcW) + Math.abs(Math.sin(rad) * srcH))
  );
  const rotH = Math.max(
    1,
    Math.round(Math.abs(Math.sin(rad) * srcW) + Math.abs(Math.cos(rad) * srcH))
  );

  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = rotW;
  rotCanvas.height = rotH;
  const rotCtx = rotCanvas.getContext('2d');
  if (!rotCtx) return null;

  rotCtx.fillStyle = '#000000';
  rotCtx.fillRect(0, 0, rotW, rotH);
  rotCtx.translate(rotW / 2, rotH / 2);
  rotCtx.rotate(rad);
  rotCtx.drawImage(srcCanvas, -srcW / 2, -srcH / 2);

  const safeX = Math.max(0, Math.min(rotW - 1, Math.round(croppedAreaPixels.x)));
  const safeY = Math.max(0, Math.min(rotH - 1, Math.round(croppedAreaPixels.y)));
  const safeW = Math.max(1, Math.min(rotW - safeX, Math.round(croppedAreaPixels.width)));
  const safeH = Math.max(1, Math.min(rotH - safeY, Math.round(croppedAreaPixels.height)));

  const MAX_OUT = 1200;
  let outW = safeW;
  let outH = safeH;
  if (outW > MAX_OUT || outH > MAX_OUT) {
    if (outW >= outH) {
      outW = MAX_OUT;
      outH = Math.max(1, Math.round((safeH * MAX_OUT) / safeW));
    } else {
      outH = MAX_OUT;
      outW = Math.max(1, Math.round((safeW * MAX_OUT) / safeH));
    }
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) {
    rotCanvas.width = 0;
    rotCanvas.height = 0;
    return null;
  }

  outCtx.fillStyle = '#000000';
  outCtx.fillRect(0, 0, outW, outH);
  outCtx.drawImage(rotCanvas, safeX, safeY, safeW, safeH, 0, 0, outW, outH);

  rotCanvas.width = 0;
  rotCanvas.height = 0;

  if (slot.canvas && slot.canvas !== slot.sourceCanvas) {
    slot.canvas.width = 0;
    slot.canvas.height = 0;
  }

  const previewUrl = createThumbnailDataUrl(outCanvas);

  return {
    canvas: outCanvas,
    sourceCanvas: slot.sourceCanvas,
    sourceUrl: slot.sourceUrl,
    previewUrl,
    fileSize: slot.fileSize,
    lastModified: slot.lastModified,
    editParams,
  };
}

function resizeImageToOffscreenCanvas(img: HTMLImageElement): LoadedPhotoSlot | null {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  return resizeSourceToOffscreenCanvas(img, srcW, srcH);
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
      const cleanupImg = () => {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      };
      img.onload = async () => {
        try {
          if (typeof img.decode === 'function') {
            await img.decode().catch(() => {});
          }
          resolve(resizeImageToOffscreenCanvas(img));
        } catch {
          resolve(null);
        } finally {
          cleanupImg();
        }
      };
      img.onerror = () => {
        cleanupImg();
        resolve(null);
      };
      img.src = result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function loadViaObjectUrl(file: File): Promise<LoadedPhotoSlot | null> {
  return new Promise((resolve) => {
    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      loadViaFileReader(file).then(resolve);
      return;
    }

    const img = new Image();
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode().catch(() => {});
        }
        const processed = resizeImageToOffscreenCanvas(img);
        cleanup();
        if (processed) {
          resolve(processed);
        } else {
          loadViaFileReader(file).then(resolve);
        }
      } catch {
        cleanup();
        loadViaFileReader(file).then(resolve);
      }
    };

    img.onerror = () => {
      cleanup();
      loadViaFileReader(file).then(resolve);
    };

    img.src = objectUrl;
  });
}

export async function processAndResizeFile(file: File): Promise<LoadedPhotoSlot | null> {
  let result: LoadedPhotoSlot | null = null;

  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file, {
        resizeWidth: 1200,
        resizeQuality: 'high',
      });
      result = resizeSourceToOffscreenCanvas(bitmap, bitmap.width, bitmap.height);
    } catch {
      // Fallback to new Image() pipeline on browsers without resizeWidth support
    } finally {
      bitmap?.close();
    }
  }

  if (!result) {
    result = await loadViaObjectUrl(file);
  }

  if (result) {
    result.fileSize = file.size;
    result.lastModified = file.lastModified;
  }

  return result;
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

  const cellWidth = COLLAGE_CELL_WIDTH;
  const cellHeight = COLLAGE_CELL_HEIGHT; // 1:1 square Instagram-style grid
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
