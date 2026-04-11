// ocrWorker.ts — Web Worker: crops HUD zone, preprocesses with OpenCV, runs tesseract.js, returns parsed position.

import { createWorker as createTesseractWorker } from 'tesseract.js';
import cv from '@techstark/opencv-js';

// Reference capture zone from monitor/main.py: (left, top, width, height) at 2560×1440
const REF_RES = { w: 2560, h: 1440 };
const REF_ZONE = { left: 2231, top: 45, width: 329, height: 11 };

// Mirrors POS_PATTERN in monitor/main.py — 4+ decimals, truncated to 4 in cleanNumber
const POS_PATTERN = /(-?\d+\.\d{4,})\s*[kK]m\s*(-?\d+\.\d{4,})\s*[kK]m\s*(-?\d+\.\d{4,})\s*[kK]m/;

function cleanNumber(raw: string): number {
  let s = raw.replace(',', '.');
  s = s.replace(/[oO]/g, '0').replace(/[lI]/g, '1').replace(/[Ss]/g, '5').replace(/[B]/g, '8').replace(/[G}]/g, '9');
  s = s.replace(/[^\d.+-]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 5);
  return parseFloat(s);
}

function parsePos(text: string): { x: number; y: number; z: number } | null {
  const match = POS_PATTERN.exec(text);
  if (!match) return null;
  const x = cleanNumber(match[1]) * 1000;
  const y = cleanNumber(match[2]) * 1000;
  const z = cleanNumber(match[3]) * 1000;
  if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
  return { x: Math.round(x), y: Math.round(y), z: Math.round(z) };
}

// Crop zone scaled to actual frame size, preprocess with OpenCV, return processed ImageData and a Blob URL for Tesseract
async function processFrame(frame: ImageData, imgW: number, imgH: number): Promise<{ imageData: ImageData; blob: Blob }> {
  const sx = imgW / REF_RES.w;
  const sy = imgH / REF_RES.h;
  const zone = {
    left:   Math.round(REF_ZONE.left   * sx),
    top:    Math.round(REF_ZONE.top    * sy),
    width:  Math.round(REF_ZONE.width  * sx),
    height: Math.round(REF_ZONE.height * sy),
  };

  // Crop zone from full frame ImageData
  const cropCanvas = new OffscreenCanvas(zone.width, zone.height);
  const cropCtx = cropCanvas.getContext('2d')!;
  const fullCanvas = new OffscreenCanvas(imgW, imgH);
  const fullCtx = fullCanvas.getContext('2d')!;
  fullCtx.putImageData(frame, 0, 0);
  cropCtx.drawImage(fullCanvas, zone.left, zone.top, zone.width, zone.height, 0, 0, zone.width, zone.height);

  // OpenCV preprocessing: grayscale → resize ×3 → GaussianBlur → threshold Otsu → normalize polarity
  const cropImageData = cropCtx.getImageData(0, 0, zone.width, zone.height);
  const src = cv.matFromImageData(cropImageData);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  const resized = new cv.Mat();
  cv.resize(gray, resized, new cv.Size(zone.width * 3, zone.height * 3), 0, 0, cv.INTER_CUBIC);

  const blurred = new cv.Mat();
  cv.GaussianBlur(resized, blurred, new cv.Size(3, 3), 0);

  const thresh = new cv.Mat();
  cv.threshold(blurred, thresh, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

  const out = new cv.Mat();
  const meanVal = cv.mean(thresh);
  if (meanVal[0] < 128) {
    cv.bitwise_not(thresh, out);
  } else {
    thresh.copyTo(out);
  }

  // Extract ImageData from Mat without cv.imshow (not available in Web Worker)
  const outRgba = new cv.Mat();
  cv.cvtColor(out, outRgba, cv.COLOR_GRAY2RGBA);
  const outImageData = new ImageData(new Uint8ClampedArray(outRgba.data), out.cols, out.rows);

  src.delete(); gray.delete(); resized.delete(); blurred.delete(); thresh.delete(); out.delete(); outRgba.delete();

  // Convert to Blob via OffscreenCanvas so Tesseract can read it
  const offscreen = new OffscreenCanvas(outImageData.width, outImageData.height);
  offscreen.getContext('2d')!.putImageData(outImageData, 0, 0);
  const blob = await offscreen.convertToBlob({ type: 'image/png' });

  return { imageData: outImageData, blob };
}

export type WorkerInMessage =
  | { type: 'init' }
  | { type: 'frame'; imageData: ImageData; width: number; height: number };

export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'result'; position: { x: number; y: number; z: number } | null; rawText: string; processedImageData: ImageData };

let tesseract: Awaited<ReturnType<typeof createTesseractWorker>> | null = null;
let cvReady = false;

async function init() {
  // Wait for OpenCV WASM
  await new Promise<void>((resolve) => {
    if ((cv as unknown as { Mat?: unknown }).Mat) { resolve(); return; }
    (cv as unknown as { onRuntimeInitialized: () => void }).onRuntimeInitialized = resolve;
  });
  cvReady = true;

  tesseract = await createTesseractWorker('eng');
  await tesseract.setParameters({
    tessedit_char_whitelist: '0123456789.km-RootPs: ',
    tessedit_pageseg_mode: '7' as Parameters<typeof tesseract.setParameters>[0]['tessedit_pageseg_mode'],
    tessedit_ocr_engine_mode: '1' as Parameters<typeof tesseract.setParameters>[0]['tessedit_ocr_engine_mode'],
  });

  self.postMessage({ type: 'ready' } satisfies WorkerOutMessage);
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    await init();
    return;
  }

  if (msg.type === 'frame') {
    if (!tesseract || !cvReady) return;
    const { imageData: processedImageData, blob } = await processFrame(msg.imageData, msg.width, msg.height);
    const { data } = await tesseract.recognize(blob);
    const position = parsePos(data.text);
    self.postMessage(
      { type: 'result', position, rawText: data.text, processedImageData } satisfies WorkerOutMessage,
      { transfer: [processedImageData.data.buffer] },
    );
  }
};
