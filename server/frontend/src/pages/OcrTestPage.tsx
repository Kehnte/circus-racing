// OcrTestPage — Phase 0/1 PoC: crop HUD zone, preprocess with OpenCV (mirrors main.py), then run tesseract.js OCR.

import { useEffect, useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';
import cv from '@techstark/opencv-js';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PageContainer from '../components/PageContainer.tsx';

// Reference capture zone from monitor/main.py: (left, top, width, height) at 2560×1440
const REF_RES = { w: 2560, h: 1440 };
const REF_ZONE = { left: 2231, top: 45, width: 329, height: 11 };

function getZone(imgW: number, imgH: number) {
  const sx = imgW / REF_RES.w;
  const sy = imgH / REF_RES.h;
  return {
    left:   Math.round(REF_ZONE.left   * sx),
    top:    Math.round(REF_ZONE.top    * sy),
    width:  Math.round(REF_ZONE.width  * sx),
    height: Math.round(REF_ZONE.height * sy),
  };
}

// Crop zone from image onto a canvas, return ImageData
function cropToCanvas(img: HTMLImageElement, zone: ReturnType<typeof getZone>): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width  = zone.width;
  canvas.height = zone.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, zone.left, zone.top, zone.width, zone.height, 0, 0, zone.width, zone.height);
  return canvas;
}

// Preprocess with OpenCV — mirrors main.py: grayscale → resize ×3 → GaussianBlur → threshold Otsu → bitwise_not
// Returns a data URL of the processed image for both display and OCR
function preprocessWithOpenCV(srcCanvas: HTMLCanvasElement): string {
  const src = cv.imread(srcCanvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  const resized = new cv.Mat();
  const dsize = new cv.Size(srcCanvas.width * 3, srcCanvas.height * 3);
  cv.resize(gray, resized, dsize, 0, 0, cv.INTER_CUBIC);

  const blurred = new cv.Mat();
  cv.GaussianBlur(resized, blurred, new cv.Size(3, 3), 0);

  const thresh = new cv.Mat();
  cv.threshold(blurred, thresh, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

  // Ensure black text on white background: if majority of pixels are black, the text is white — invert
  const meanVal = cv.mean(thresh);
  const out = new cv.Mat();
  if (meanVal[0] < 128) {
    cv.bitwise_not(thresh, out);
  } else {
    thresh.copyTo(out);
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width  = out.cols;
  outCanvas.height = out.rows;
  cv.imshow(outCanvas, out);

  src.delete(); gray.delete(); resized.delete(); blurred.delete(); thresh.delete(); out.delete();

  return outCanvas.toDataURL();
}

// Captures 4+ decimal digits then truncates to 4 — absorbs spurious OCR digits like "746.10603" → "746.1060"
const POS_PATTERN = /(-?\d+\.\d{4,})\s*[kK]m\s*(-?\d+\.\d{4,})\s*[kK]m\s*(-?\d+\.\d{4,})\s*[kK]m/;

function cleanNumber(raw: string): number {
  let s = raw.replace(',', '.');
  s = s.replace(/[oO]/g, '0').replace(/[lI]/g, '1').replace(/[Ss]/g, '5').replace(/[B]/g, '8').replace(/[G}]/g, '9');
  s = s.replace(/[^\d.+-]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
  // Truncate to 4 decimal places to drop spurious OCR digits
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 5);
  return parseFloat(s);
}

function parsePos(text: string): [number, number, number] | null {
  const match = POS_PATTERN.exec(text);
  if (!match) return null;
  const x = cleanNumber(match[1]) * 1000;
  const y = cleanNumber(match[2]) * 1000;
  const z = cleanNumber(match[3]) * 1000;
  if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
  // Round to 3 decimal places regardless of how many digits OCR produced
  return [Math.round(x) / 1, Math.round(y) / 1, Math.round(z) / 1];
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
    img.src = url;
  });
}

type RunResult = {
  file: string;
  cropDataUrl: string;
  processedDataUrl: string;
  zone: ReturnType<typeof getZone>;
  imgSize: { w: number; h: number };
  rawText: string;
  parsed: [number, number, number] | null;
  durationMs: number;
};

export default function OcrTestPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cvReady, setCvReady] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    if (cv.Mat) { setCvReady(true); return; }
    cv.onRuntimeInitialized = () => setCvReady(true);
  }, []);

  async function handleFiles(files: FileList) {
    setRunning(true);
    setResults([]);
    const newResults: RunResult[] = [];

    const worker = await createWorker('eng', undefined, {
      logger: (m: { status: string; progress: number }) => {
        setProgress(`${m.status} (${Math.round(m.progress * 100)}%)`);
      },
    });
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.km-RootPs: ',
      tessedit_pageseg_mode: '7' as Parameters<typeof worker.setParameters>[0]['tessedit_pageseg_mode'],
      tessedit_ocr_engine_mode: '1' as Parameters<typeof worker.setParameters>[0]['tessedit_ocr_engine_mode'],
    });

    for (const file of Array.from(files)) {
      const img = await loadImage(file);
      const zone = getZone(img.naturalWidth, img.naturalHeight);

      const cropCanvas = cropToCanvas(img, zone);
      const cropDataUrl = cropCanvas.toDataURL();
      const processedDataUrl = preprocessWithOpenCV(cropCanvas);

      const t0 = performance.now();
      const { data } = await worker.recognize(processedDataUrl);
      const durationMs = Math.round(performance.now() - t0);

      newResults.push({
        file: file.name,
        cropDataUrl,
        processedDataUrl,
        zone,
        imgSize: { w: img.naturalWidth, h: img.naturalHeight },
        rawText: data.text,
        parsed: parsePos(data.text),
        durationMs,
      });
    }

    await worker.terminate();
    setResults(newResults);
    setRunning(false);
    setProgress('');
  }

  return (
    <PageContainer title="OCR Test">
      <Stack spacing={2}>

        <Alert severity={cvReady ? 'success' : 'warning'}>
          {cvReady
            ? 'OpenCV ready. Drop full Star Citizen screenshots (1440p) — zone is cropped, preprocessed, then OCR\'d.'
            : 'Loading OpenCV WASM…'}
        </Alert>

        <Paper elevation={0} sx={{ p: 2 }}>
          <Stack spacing={2}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.length) void handleFiles(e.target.files); }}
            />
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                p: 3,
                textAlign: 'center',
                cursor: cvReady ? 'pointer' : 'not-allowed',
                opacity: cvReady ? 1 : 0.5,
                '&:hover': cvReady ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
              }}
              onClick={() => cvReady && inputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); if (cvReady && e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <Typography variant="body2" color="text.secondary">
                Click or drop full HUD screenshots here (1440p)
              </Typography>
            </Box>

            {running && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <CircularProgress size={18} />
                <Typography variant="caption">{progress || 'Processing…'}</Typography>
              </Stack>
            )}
          </Stack>
        </Paper>

        {results.length > 0 && (
          <Paper elevation={0} sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Results — {results.filter((r) => r.parsed).length}/{results.length} parsed successfully
            </Typography>
            <Stack spacing={3} divider={<Divider />}>
              {results.map((r, i) => (
                <Box key={i}>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{r.file}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.imgSize.w}×{r.imgSize.h} · zone ({r.zone.left},{r.zone.top}) {r.zone.width}×{r.zone.height} · {r.durationMs} ms
                    </Typography>
                  </Box>

                  <Stack spacing={0.5} sx={{ mb: 1, overflow: 'hidden' }}>
                    <Typography variant="caption" color="text.secondary">Raw crop:</Typography>
                    <Box component="img" src={r.cropDataUrl} sx={{ display: 'block', width: '100%', height: 'auto', border: '1px solid', borderColor: 'divider', imageRendering: 'pixelated' }} />
                    <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>After OpenCV (×3):</Typography>
                    <Box component="img" src={r.processedDataUrl} sx={{ display: 'block', width: '100%', height: 'auto', border: '1px solid', borderColor: 'divider' }} />
                  </Stack>

                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>Raw OCR:</Typography>
                  <Paper variant="outlined" sx={{ p: 1, fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', mb: 1 }}>
                    {r.rawText || '(empty)'}
                  </Paper>

                  {r.parsed ? (
                    <Alert severity="success" sx={{ py: 0.5 }}>
                      X: {r.parsed[0]} &nbsp; Y: {r.parsed[1]} &nbsp; Z: {r.parsed[2]}
                    </Alert>
                  ) : (
                    <Alert severity="error" sx={{ py: 0.5 }}>No coordinates found</Alert>
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>
        )}

        {results.length >= 5 && (
          <Alert severity={results.filter((r) => r.parsed).length >= results.length * 0.9 ? 'success' : 'warning'}>
            {results.filter((r) => r.parsed).length >= results.length * 0.9
              ? 'Phase 1 validated — OpenCV preprocessing works. Ready for Phase 3 (Web Worker).'
              : `${results.filter((r) => r.parsed).length}/${results.length} parsed. Check the "After OpenCV" previews for remaining failures.`}
          </Alert>
        )}

      </Stack>
    </PageContainer>
  );
}
