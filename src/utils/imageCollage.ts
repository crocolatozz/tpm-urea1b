import { formatDateIndo } from '../data/tpmData';

export const COLLAGE_CELL_WIDTH = 800;
const COLLAGE_CELL_HEIGHT = 800;
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

function revokeSlotUrl(url: string | undefined, delayMs = 150): void {
  if (url && url.startsWith('blob:')) {
    const doRevoke = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore revoke errors
      }
    };
    if (delayMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(doRevoke, delayMs);
    } else {
      doRevoke();
    }
  }
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
  const preview = slot.previewUrl;
  const source = slot.sourceUrl;
  slot.previewUrl = '';
  slot.sourceUrl = '';
  slot.fileSize = undefined;
  slot.lastModified = undefined;
  slot.editParams = undefined;
  revokeSlotUrl(preview, 150);
  if (source && source !== preview) {
    revokeSlotUrl(source, 150);
  }
}

export function freeSlotArray(slots: Array<LoadedPhotoSlot | null | undefined>): void {
  slots.forEach(freeSingleSlot);
}

function canvasToObjectUrl(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve('');
            return;
          }
          try {
            resolve(URL.createObjectURL(blob));
          } catch {
            resolve('');
          }
        },
        'image/jpeg',
        quality
      );
    } catch {
      resolve('');
    }
  });
}

async function createThumbnailObjectUrl(sourceCanvas: HTMLCanvasElement): Promise<string> {
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
      const url = await canvasToObjectUrl(thumbCanvas, 0.72);
      thumbCanvas.width = 0;
      thumbCanvas.height = 0;
      return url;
    }
    return await canvasToObjectUrl(sourceCanvas, 0.65);
  } catch {
    return '';
  }
}

async function resizeSourceToOffscreenCanvas(
  source: CanvasImageSource,
  srcW: number,
  srcH: number
): Promise<LoadedPhotoSlot | null> {
  if (!srcW || !srcH) return null;

  const MAX_DIM = 1600;
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

  const [previewUrl, sourceUrl] = await Promise.all([
    createThumbnailObjectUrl(offCanvas),
    canvasToObjectUrl(offCanvas, 0.85),
  ]);

  return {
    canvas: offCanvas,
    sourceCanvas: offCanvas,
    sourceUrl: sourceUrl || previewUrl,
    previewUrl: previewUrl || sourceUrl,
  };
}

export async function renderEditedSlot(
  slot: LoadedPhotoSlot,
  croppedAreaPixels: CropAreaPixels,
  rotationDeg: number,
  editParams: PhotoEditParams
): Promise<LoadedPhotoSlot | null> {
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

  rotCtx.fillStyle = '#0f172a';
  rotCtx.fillRect(0, 0, rotW, rotH);
  rotCtx.translate(rotW / 2, rotH / 2);
  rotCtx.rotate(rad);
  rotCtx.drawImage(srcCanvas, -srcW / 2, -srcH / 2);

  const safeX = Math.max(0, Math.min(rotW - 1, Math.round(croppedAreaPixels.x)));
  const safeY = Math.max(0, Math.min(rotH - 1, Math.round(croppedAreaPixels.y)));
  const safeW = Math.max(1, Math.min(rotW - safeX, Math.round(croppedAreaPixels.width)));
  const safeH = Math.max(1, Math.min(rotH - safeY, Math.round(croppedAreaPixels.height)));

  const MAX_OUT = 1600;
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

  outCtx.fillStyle = '#0f172a';
  outCtx.fillRect(0, 0, outW, outH);
  outCtx.drawImage(rotCanvas, safeX, safeY, safeW, safeH, 0, 0, outW, outH);

  rotCanvas.width = 0;
  rotCanvas.height = 0;

  if (slot.canvas && slot.canvas !== slot.sourceCanvas) {
    slot.canvas.width = 0;
    slot.canvas.height = 0;
  }

  const previewUrl = await createThumbnailObjectUrl(outCanvas);

  return {
    canvas: outCanvas,
    sourceCanvas: slot.sourceCanvas,
    sourceUrl: slot.sourceUrl,
    previewUrl: previewUrl || slot.sourceUrl,
    fileSize: slot.fileSize,
    lastModified: slot.lastModified,
    editParams,
  };
}

function resizeImageToOffscreenCanvas(img: HTMLImageElement): Promise<LoadedPhotoSlot | null> {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  return resizeSourceToOffscreenCanvas(img, srcW, srcH);
}

function loadViaFileReader(file: Blob): Promise<LoadedPhotoSlot | null> {
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
          const resized = await resizeImageToOffscreenCanvas(img);
          resolve(resized);
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

function loadViaObjectUrl(file: Blob): Promise<LoadedPhotoSlot | null> {
  return new Promise((resolve) => {
    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      loadViaFileReader(file).then(resolve);
      return;
    }

    const img = new Image();
    const revokeAndCleanup = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    img.onload = async () => {
      let processed: LoadedPhotoSlot | null = null;
      try {
        if (typeof img.decode === 'function') {
          await img.decode().catch(() => {});
        }
        processed = await resizeImageToOffscreenCanvas(img);
      } catch {
        processed = null;
      } finally {
        revokeAndCleanup();
      }

      if (processed) {
        resolve(processed);
      } else {
        loadViaFileReader(file).then(resolve);
      }
    };

    img.onerror = () => {
      try {
        // Fallback via FileReader below
      } finally {
        revokeAndCleanup();
      }
      loadViaFileReader(file).then(resolve);
    };

    img.src = objectUrl;
  });
}

export function isHeicFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime === 'image/heic-sequence' ||
    mime === 'image/heif-sequence'
  ) {
    return true;
  }
  return /\.(heic|heif)$/i.test(file.name || '');
}

async function convertHeicToJpegBlob(file: File): Promise<Blob | null> {
  try {
    const heicModule = await import('heic2any');
    const heic2any = heicModule.default;
    const output = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    const converted = Array.isArray(output) ? output[0] : output;
    if (converted instanceof Blob && converted.size > 0) {
      return converted;
    }
    return null;
  } catch (err) {
    // Jika Safari/browser sudah menyuplai file readable (ERR_USER), biarkan pipeline native mencoba decode
    const message =
      err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : '';
    if (/already browser readable/i.test(message)) {
      return file;
    }
    return null;
  }
}

export async function processAndResizeFile(file: File): Promise<LoadedPhotoSlot | null> {
  let decodeSource: Blob = file;

  if (isHeicFile(file)) {
    const converted = await convertHeicToJpegBlob(file);
    if (converted) {
      decodeSource = converted;
    }
  }

  let result: LoadedPhotoSlot | null = null;

  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(decodeSource, {
        resizeWidth: 1600,
        resizeQuality: 'high',
      });
      result = await resizeSourceToOffscreenCanvas(bitmap, bitmap.width, bitmap.height);
    } catch {
      // Fallback to new Image() pipeline on browsers without resizeWidth support
    } finally {
      bitmap?.close();
    }
  }

  if (!result) {
    result = await loadViaObjectUrl(decodeSource);
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

const CANVAS_PAD = 24;
const CANVAS_GAP = 18;
const CANVAS_WIDTH_BASE = COLLAGE_CELL_WIDTH * 2 + CANVAS_GAP + CANVAS_PAD * 2; // 1666
const CANVAS_CELL_RADIUS = Math.round(CANVAS_WIDTH_BASE * 0.022); // ~37px (~8px on 365px mobile)
const CANVAS_HAIRLINE_WIDTH = 3;

const CANVAS_SUB_HEADER_TOP_GAP = Math.round(CANVAS_WIDTH_BASE * 0.008); // ~13px
const CANVAS_SUB_HEADER_H = Math.round(CANVAS_WIDTH_BASE * 0.068); // ~113px
const CANVAS_SUB_HEADER_BOTTOM_GAP = Math.round(CANVAS_WIDTH_BASE * 0.017); // ~28px
const CANVAS_SUB_HEADER_FONT = Math.round(CANVAS_WIDTH_BASE * 0.044); // ~73px (4.4cqw)
const CANVAS_HEADER_PILL_PAD_X = Math.round(CANVAS_WIDTH_BASE * 0.032); // ~53px
const CANVAS_HEADER_PILL_PAD_Y = Math.round(CANVAS_WIDTH_BASE * 0.009); // ~15px
const CANVAS_HEADER_DOT_DIA = Math.round(CANVAS_WIDTH_BASE * 0.012); // ~20px
const CANVAS_HEADER_DOT_GAP = Math.round(CANVAS_WIDTH_BASE * 0.011); // ~18px

const CANVAS_FOOTER_TOP_GAP = Math.round(CANVAS_WIDTH_BASE * 0.02); // ~33px
const CANVAS_FOOTER_H = Math.round(CANVAS_WIDTH_BASE * 0.06); // ~100px
const CANVAS_FOOTER_FONT = 46; // ~29.8px pada skala kanvas 1080px (2.761cqw)
const CANVAS_FOOTER_PAD_X = Math.round(CANVAS_WIDTH_BASE * 0.026); // ~43px
const CANVAS_FOOTER_PAD_Y = Math.round(CANVAS_WIDTH_BASE * 0.011); // ~18px

const CANVAS_PILL_FONT = Math.round(CANVAS_WIDTH_BASE * 0.044); // ~73px (4.4cqw, ~10% lebih ramping)
const CANVAS_PILL_PAD_X = Math.round(CANVAS_WIDTH_BASE * 0.03); // ~50px
const CANVAS_PILL_PAD_Y = Math.round(CANVAS_WIDTH_BASE * 0.011); // ~18px
const CANVAS_PILL_BOTTOM = Math.round(CANVAS_WIDTH_BASE * 0.026); // ~43px

export const COLLAGE_PREVIEW_SPEC = {
  paddingCqw: `${((CANVAS_PAD / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  gapCqw: `${((CANVAS_GAP / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  subHeaderTopGapCqw: `${((CANVAS_SUB_HEADER_TOP_GAP / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  subHeaderHeightCqw: `${((CANVAS_SUB_HEADER_H / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  subHeaderBottomGapCqw: `${((CANVAS_SUB_HEADER_BOTTOM_GAP / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  subHeaderFontCqw: `${((CANVAS_SUB_HEADER_FONT / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  headerPillPadXCqw: `${((CANVAS_HEADER_PILL_PAD_X / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  headerPillPadYCqw: `${((CANVAS_HEADER_PILL_PAD_Y / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  headerDotSizeCqw: `${((CANVAS_HEADER_DOT_DIA / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  headerDotGapCqw: `${((CANVAS_HEADER_DOT_GAP / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  footerTopGapCqw: `${((CANVAS_FOOTER_TOP_GAP / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  footerHeightCqw: `${((CANVAS_FOOTER_H / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  footerFontCqw: `${((CANVAS_FOOTER_FONT / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  footerPadXCqw: `${((CANVAS_FOOTER_PAD_X / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  footerPadYCqw: `${((CANVAS_FOOTER_PAD_Y / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  pillFontCqw: `${((CANVAS_PILL_FONT / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  pillPadXCqw: `${((CANVAS_PILL_PAD_X / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
  pillPadYCqw: `${((CANVAS_PILL_PAD_Y / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`,
} as const;

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const ctxWithRoundRect = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, radii?: number) => void;
  };
  if (typeof ctxWithRoundRect.roundRect === 'function') {
    ctx.beginPath();
    ctxWithRoundRect.roundRect(x, y, width, height, radius);
    ctx.closePath();
    return;
  }
  drawRoundedRect(ctx, x, y, width, height, radius);
}

const FONT_COLLAGE_RAJDHANI =
  '"Rajdhani", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

let measureFooterCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureFooterContext(): CanvasRenderingContext2D | null {
  if (measureFooterCtx !== undefined) return measureFooterCtx;
  if (typeof document === 'undefined') {
    measureFooterCtx = null;
    return null;
  }
  const c = document.createElement('canvas');
  measureFooterCtx = c.getContext('2d');
  return measureFooterCtx;
}

function getOpticalBaselineY(
  ctx: CanvasRenderingContext2D,
  sampleText: string,
  centerY: number
): { baseline: CanvasTextBaseline; y: number } {
  const metrics = ctx.measureText(sampleText);
  if (
    typeof metrics.actualBoundingBoxAscent === 'number' &&
    typeof metrics.actualBoundingBoxDescent === 'number' &&
    (metrics.actualBoundingBoxAscent > 0 || metrics.actualBoundingBoxDescent > 0)
  ) {
    return {
      baseline: 'alphabetic',
      y: centerY + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2,
    };
  }
  return { baseline: 'middle', y: centerY };
}

export function computeCaptionPillFontSize(
  pillText: string,
  ctx?: CanvasRenderingContext2D | null
): { fontSize: number; textWidth: number } {
  const measureCtx = ctx ?? getMeasureFooterContext();
  const maxPillWidth = Math.round(CANVAS_WIDTH_BASE * 0.86);
  const targetTextWidth = Math.max(120, maxPillWidth - CANVAS_PILL_PAD_X * 2);
  const minFontSize = 30;
  let fontSize = CANVAS_PILL_FONT;

  if (!measureCtx || !pillText) {
    return { fontSize, textWidth: 0 };
  }

  measureCtx.save();
  measureCtx.font = `700 ${fontSize}px ${FONT_COLLAGE_RAJDHANI}`;
  let width = measureCtx.measureText(pillText).width;
  if (width > targetTextWidth && width > 0) {
    fontSize = Math.max(minFontSize, Math.floor(fontSize * (targetTextWidth / width)));
    measureCtx.font = `700 ${fontSize}px ${FONT_COLLAGE_RAJDHANI}`;
    width = measureCtx.measureText(pillText).width;
    while (width > targetTextWidth && fontSize > minFontSize) {
      fontSize -= 1;
      measureCtx.font = `700 ${fontSize}px ${FONT_COLLAGE_RAJDHANI}`;
      width = measureCtx.measureText(pillText).width;
    }
  }
  measureCtx.restore();

  return { fontSize, textWidth: width };
}

export function computeCaptionPillFontCqw(pillText: string): string {
  const { fontSize } = computeCaptionPillFontSize(pillText);
  return `${((fontSize / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`;
}

export function computeFooterFontSize(
  footerText: string,
  ctx?: CanvasRenderingContext2D | null
): number {
  const measureCtx = ctx ?? getMeasureFooterContext();
  const maxFooterTextWidth = Math.round(CANVAS_WIDTH_BASE * 0.86);
  const minFooterFont = 24;
  let footerFontSize = CANVAS_FOOTER_FONT;

  if (!measureCtx || !footerText) {
    return footerFontSize;
  }

  measureCtx.save();
  measureCtx.font = `600 ${footerFontSize}px ${FONT_COLLAGE_RAJDHANI}`;
  const measuredFooterWidth = measureCtx.measureText(footerText).width;
  if (measuredFooterWidth > maxFooterTextWidth && measuredFooterWidth > 0) {
    footerFontSize = Math.max(
      minFooterFont,
      Math.floor(footerFontSize * (maxFooterTextWidth / measuredFooterWidth))
    );
    measureCtx.font = `600 ${footerFontSize}px ${FONT_COLLAGE_RAJDHANI}`;
    while (
      measureCtx.measureText(footerText).width > maxFooterTextWidth &&
      footerFontSize > minFooterFont
    ) {
      footerFontSize -= 1;
      measureCtx.font = `600 ${footerFontSize}px ${FONT_COLLAGE_RAJDHANI}`;
    }
  }
  measureCtx.restore();

  return footerFontSize;
}

export function computeFooterFontCqw(footerText: string): string {
  const px = computeFooterFontSize(footerText);
  return `${((px / CANVAS_WIDTH_BASE) * 100).toFixed(3)}cqw`;
}

export function renderCollageToCanvas(
  canvas: HTMLCanvasElement,
  opts: CollageExportOptions
): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const { rows, beforeSlots, afterSlots, rowTexts, areaName, shiftName, dateStr } = opts;

  const cellWidth = COLLAGE_CELL_WIDTH;
  const cellHeight = COLLAGE_CELL_HEIGHT;
  const gap = CANVAS_GAP;
  const padding = CANVAS_PAD;
  const subHeaderTopGap = CANVAS_SUB_HEADER_TOP_GAP;
  const subHeaderHeight = CANVAS_SUB_HEADER_H;
  const subHeaderBottomGap = CANVAS_SUB_HEADER_BOTTOM_GAP;
  const footerTopGap = CANVAS_FOOTER_TOP_GAP;
  const footerHeight = CANVAS_FOOTER_H;

  const canvasWidth = cellWidth * 2 + gap + padding * 2;
  const canvasHeight =
    padding +
    subHeaderTopGap +
    subHeaderHeight +
    subHeaderBottomGap +
    cellHeight * rows +
    gap * (rows - 1) +
    footerTopGap +
    footerHeight +
    padding;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Bingkai luar ekspor sudut tegas 90° berwarna Deep Slate (#0F172A)
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 1. Header Pil Kolom: BEFORE (Cyan) | AFTER (Emerald Neon) — Rajdhani 700, Dark-Tinted + Hairline Border
  const ctxWithSpacing = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const leftColCenterX = padding + cellWidth / 2;
  const rightColCenterX = padding + cellWidth + gap + cellWidth / 2;
  const subHeaderCenterY = padding + subHeaderTopGap + subHeaderHeight / 2;

  const drawHeaderPill = (
    label: string,
    colCenterX: number,
    bgColor: string,
    borderColor: string,
    dotColor: string
  ) => {
    ctx.save();
    ctx.font = `700 ${CANVAS_SUB_HEADER_FONT}px ${FONT_COLLAGE_RAJDHANI}`;
    if ('letterSpacing' in ctxWithSpacing) {
      ctxWithSpacing.letterSpacing = `${Math.max(2, Math.round(CANVAS_SUB_HEADER_FONT * 0.08))}px`;
    }
    const textWidth = ctx.measureText(label).width;
    const contentWidth = CANVAS_HEADER_DOT_DIA + CANVAS_HEADER_DOT_GAP + textWidth;
    const pillW = Math.min(cellWidth * 0.9, contentWidth + CANVAS_HEADER_PILL_PAD_X * 2);
    const pillH = Math.min(
      subHeaderHeight,
      Math.round(CANVAS_SUB_HEADER_FONT * 1.1) + CANVAS_HEADER_PILL_PAD_Y * 2
    );
    const pillX = colCenterX - pillW / 2;
    const pillY = subHeaderCenterY - pillH / 2;
    const radius = pillH / 2;

    ctx.fillStyle = bgColor;
    traceRoundedRect(ctx, pillX, pillY, pillW, pillH, radius);
    ctx.fill();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = CANVAS_HAIRLINE_WIDTH;
    traceRoundedRect(ctx, pillX, pillY, pillW, pillH, radius);
    ctx.stroke();

    const contentStartX = colCenterX - contentWidth / 2;
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(
      contentStartX + CANVAS_HEADER_DOT_DIA / 2,
      subHeaderCenterY,
      CANVAS_HEADER_DOT_DIA / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    const { baseline, y } = getOpticalBaselineY(ctx, label, subHeaderCenterY);
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'left';
    ctx.textBaseline = baseline;
    ctx.fillText(label, contentStartX + CANVAS_HEADER_DOT_DIA + CANVAS_HEADER_DOT_GAP, y);
    ctx.restore();
  };

  drawHeaderPill('BEFORE', leftColCenterX, '#0E293D', 'rgba(56, 189, 248, 0.45)', '#38BDF8');
  drawHeaderPill('AFTER', rightColCenterX, '#0B2E2B', 'rgba(52, 211, 153, 0.45)', '#34D399');

  // 2. Grid Foto Before / After (Sudut melengkung proporsional, dibungkus save/restore)
  const startY = padding + subHeaderTopGap + subHeaderHeight + subHeaderBottomGap;

  for (let r = 0; r < rows; r++) {
    const y = startY + r * (cellHeight + gap);

    const beforeSlot = beforeSlots[r];
    ctx.save();
    traceRoundedRect(ctx, padding, y, cellWidth, cellHeight, CANVAS_CELL_RADIUS);
    ctx.clip();
    if (beforeSlot?.canvas) {
      drawImageCover(ctx, beforeSlot.canvas, padding, y, cellWidth, cellHeight);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(padding, y, cellWidth, cellHeight);
    }
    ctx.restore();

    const afterSlot = afterSlots[r];
    const xRight = padding + cellWidth + gap;
    ctx.save();
    traceRoundedRect(ctx, xRight, y, cellWidth, cellHeight, CANVAS_CELL_RADIUS);
    ctx.clip();
    if (afterSlot?.canvas) {
      drawImageCover(ctx, afterSlot.canvas, xRight, y, cellWidth, cellHeight);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(xRight, y, cellWidth, cellHeight);
    }
    ctx.restore();
  }

  // 3. Pil Caption Tengah Tiap Baris (Rajdhani 700, gelap pekat rgba(11,17,32,0.88), border 1px halus, optical vertical center)
  const maxPillWidth = Math.round(canvasWidth * 0.86);
  rowTexts.slice(0, rows).forEach((rawText, r) => {
    const text = rawText ? rawText.trim().slice(0, 30) : '';
    if (!text) return;

    const centerX = canvasWidth / 2;
    const rowBottomY = startY + (r + 1) * cellHeight + r * gap;

    ctx.save();
    const { fontSize, textWidth } = computeCaptionPillFontSize(text, ctx);
    const padX = CANVAS_PILL_PAD_X;
    const padY = CANVAS_PILL_PAD_Y;

    ctx.font = `700 ${fontSize}px ${FONT_COLLAGE_RAJDHANI}`;
    const measuredW = textWidth || ctx.measureText(text).width;

    const bgW = Math.min(measuredW + padX * 2, maxPillWidth);
    const bgH = Math.round(fontSize * 1.12) + padY * 2;
    const pillCenterY = rowBottomY - bgH / 2 - CANVAS_PILL_BOTTOM;
    const cornerRadius = bgH / 2;

    ctx.fillStyle = 'rgba(11, 17, 32, 0.88)';
    traceRoundedRect(ctx, centerX - bgW / 2, pillCenterY - bgH / 2, bgW, bgH, cornerRadius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = CANVAS_HAIRLINE_WIDTH;
    traceRoundedRect(ctx, centerX - bgW / 2, pillCenterY - bgH / 2, bgW, bgH, cornerRadius);
    ctx.stroke();

    const { baseline, y } = getOpticalBaselineY(ctx, text, pillCenterY);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = baseline;
    ctx.fillText(text, centerX, y, maxPillWidth - padX * 2);
    ctx.restore();
  });

  // 4. Pil Footer Kolase: TPM [ALAT] • SHIFT [WAKTU] • [TANGGAL] (Rajdhani 600, #111C2E, border cyan, titik emerald #34D399)
  const areaLabel = areaName.trim() || '-';
  const dateLabel = formatDateIndo(dateStr);
  const seg1 = `TPM ${areaLabel}`;
  const sep = '  •  ';
  const seg2 = `SHIFT ${shiftName}`;
  const seg3 = dateLabel;
  const fullFooterText = `${seg1}${sep}${seg2}${sep}${seg3}`;

  const footerCenterY =
    startY + rows * cellHeight + (rows - 1) * gap + footerTopGap + footerHeight / 2;
  const footerFontSize = computeFooterFontSize(fullFooterText, ctx);
  const maxPillFooterW = Math.round(canvasWidth * 0.94);

  ctx.save();
  ctx.font = `600 ${footerFontSize}px ${FONT_COLLAGE_RAJDHANI}`;
  const wSeg1 = ctx.measureText(seg1).width;
  const wSep = ctx.measureText(sep).width;
  const wSeg2 = ctx.measureText(seg2).width;
  const wSeg3 = ctx.measureText(seg3).width;
  const totalTextW = wSeg1 + wSep + wSeg2 + wSep + wSeg3;

  const pillW = Math.min(totalTextW + CANVAS_FOOTER_PAD_X * 2, maxPillFooterW);
  const pillH = Math.min(
    footerHeight,
    Math.round(footerFontSize * 1.15) + CANVAS_FOOTER_PAD_Y * 2
  );
  const pillX = canvasWidth / 2 - pillW / 2;
  const pillY = footerCenterY - pillH / 2;

  ctx.fillStyle = '#111C2E';
  traceRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
  ctx.lineWidth = CANVAS_HAIRLINE_WIDTH;
  traceRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.stroke();

  const { baseline, y } = getOpticalBaselineY(ctx, fullFooterText, footerCenterY);
  const availableTextW = pillW - CANVAS_FOOTER_PAD_X * 2;
  const scaleX = totalTextW > availableTextW && totalTextW > 0 ? availableTextW / totalTextW : 1;

  ctx.translate(canvasWidth / 2, 0);
  ctx.scale(scaleX, 1);
  let cursorX = -totalTextW / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = baseline;

  const segments: Array<{ text: string; width: number; color: string }> = [
    { text: seg1, width: wSeg1, color: '#F8FAFC' },
    { text: sep, width: wSep, color: '#34D399' },
    { text: seg2, width: wSeg2, color: '#F8FAFC' },
    { text: sep, width: wSep, color: '#34D399' },
    { text: seg3, width: wSeg3, color: '#F8FAFC' },
  ];

  segments.forEach((seg) => {
    ctx.fillStyle = seg.color;
    ctx.fillText(seg.text, cursorX, y);
    cursorX += seg.width;
  });

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

export function collectSlotBlobUrls(slots: Array<LoadedPhotoSlot | null>): string[] {
  const urls: string[] = [];
  slots.forEach((slot) => {
    if (!slot) return;
    if (slot.previewUrl && slot.previewUrl.startsWith('blob:')) {
      urls.push(slot.previewUrl);
    }
    if (slot.sourceUrl && slot.sourceUrl.startsWith('blob:')) {
      urls.push(slot.sourceUrl);
    }
  });
  return urls;
}

export function disposeSlotCanvases(slot: LoadedPhotoSlot | null | undefined): void {
  if (!slot) return;
  if (slot.canvas) {
    slot.canvas.width = 0;
    slot.canvas.height = 0;
  }
  if (slot.sourceCanvas && slot.sourceCanvas !== slot.canvas) {
    slot.sourceCanvas.width = 0;
    slot.sourceCanvas.height = 0;
  }
}

export function formatFileSizeCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export async function createSyntheticContrastFile(
  slotIdx: number,
  color: string,
  striped = false
): Promise<File | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (striped) {
      const stripeW = 90;
      for (let x = 0; x < 1080; x += stripeW) {
        ctx.fillStyle = Math.floor(x / stripeW) % 2 === 0 ? '#0F172A' : '#F8FAFC';
        ctx.fillRect(x, 0, stripeW, 1080);
      }
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1080, 1080);
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
    });
    if (!blob) return null;
    return new File([blob], `synthetic_slot_${slotIdx + 1}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now() + slotIdx,
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

