// useWebOCR.ts — manages screen capture via getDisplayMedia, feeds frames to ocrWorker every 2s, sends positions to the API.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkerInMessage, WorkerOutMessage } from '../workers/ocrWorker.ts';

const INTERVAL_MS = 2000;

export type WebOCRStatus = 'idle' | 'initializing' | 'capturing' | 'error';

export interface WebOCRState {
  status: WebOCRStatus;
  lastPosition: { x: number; y: number; z: number } | null;
  lastRawText: string | null;
  lastPreviewUrl: string | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export default function useWebOCR(token: string | null | undefined): WebOCRState {
  const [status, setStatus] = useState<WebOCRStatus>('idle');
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [lastRawText, setLastRawText] = useState<string | null>(null);
  const [lastPreviewUrl, setLastPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef   = useRef<Worker | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workerReady = useRef(false);

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current)   { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (workerRef.current)   { workerRef.current.terminate(); workerRef.current = null; }
    videoRef.current  = null;
    canvasRef.current = null;
    workerReady.current = false;
    setStatus('idle');
  }, []);

  // Clean up on unmount
  useEffect(() => stop, [stop]);

  const sendFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    if (!video || !canvas || !worker || !workerReady.current) return;
    if (video.readyState < 2) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    worker.postMessage({ type: 'frame', imageData, width: w, height: h } satisfies WorkerInMessage, [imageData.data.buffer]);
  }, []);

  const start = useCallback(async () => {
    if (status !== 'idle') return;
    setError(null);
    setStatus('initializing');

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 } });
      streamRef.current = stream;

      // Stop if user closes the share dialog
      stream.getVideoTracks()[0].addEventListener('ended', stop);

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      videoRef.current = video;
      canvasRef.current = document.createElement('canvas');

      const worker = new Worker(new URL('../workers/ocrWorker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
        const msg = e.data;
        if (msg.type === 'ready') {
          workerReady.current = true;
          setStatus('capturing');
          intervalRef.current = setInterval(sendFrame, INTERVAL_MS);
        }
        if (msg.type === 'result') {
          setLastRawText(msg.rawText.trim() || null);
          // Render ImageData to a regular canvas and extract data URL for display
          const canvas = document.createElement('canvas');
          canvas.width  = msg.processedImageData.width;
          canvas.height = msg.processedImageData.height;
          canvas.getContext('2d')!.putImageData(msg.processedImageData, 0, 0);
          setLastPreviewUrl(canvas.toDataURL());
          if (msg.position) {
            setLastPosition(msg.position);
            if (token) {
              void fetch('/api/ocr/position', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-token': token },
                body: JSON.stringify(msg.position),
              });
            }
          }
        }
      };

      worker.onerror = (e) => {
        setError(e.message);
        setStatus('error');
        stop();
      };

      worker.postMessage({ type: 'init' } satisfies WorkerInMessage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStatus('error');
      stop();
    }
  }, [status, token, sendFrame, stop]);

  return { status, lastPosition, lastRawText, lastPreviewUrl, error, start, stop };
}
