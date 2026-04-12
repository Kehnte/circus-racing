// useWhipStream — Captures a display/window via getDisplayMedia and publishes via WebRTC WHIP to mediamtx.
// Quality is capped at 1080p max; maxFps and maxResolution come from stream settings.

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';

export type WhipStatus = 'idle' | 'requesting' | 'connecting' | 'live' | 'error';

const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '480p':  { width: 854,  height: 480  },
  '720p':  { width: 1280, height: 720  },
  '1080p': { width: 1920, height: 1080 },
};

const WEBRTC_PORT = 8889;

function whipUrl(pilotId: string): string {
  return `${window.location.protocol}//${window.location.hostname}:${WEBRTC_PORT}/pilots/${pilotId}/whip`;
}

function decodePilotId(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    return (payload.id as string) ?? null;
  } catch { return null; }
}

export function useWhipStream(maxResolution = '1080p', maxFps = 30) {
  const { token } = useAuth();
  const pilotId = decodePilotId(token);
  const [status, setStatus] = useState<WhipStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const pcRef     = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const etagRef   = useRef<string | null>(null);

  const res = RESOLUTION_MAP[maxResolution] ?? RESOLUTION_MAP['1080p'];

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (pcRef.current) {
      if (etagRef.current && pilotId) {
        fetch(whipUrl(pilotId), {
          method: 'DELETE',
          headers: { 'ETag': etagRef.current },
        }).catch(() => { /* best-effort */ });
      }
      pcRef.current.close();
      pcRef.current = null;
    }
    etagRef.current = null;
    setStatus('idle');
    setError(null);
  }, [pilotId]);

  const start = useCallback(async () => {
    if (!pilotId) return;
    setError(null);
    setStatus('requesting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width:     { max: res.width  },
          height:    { max: res.height },
          frameRate: { max: maxFps     },
        },
        audio: false,
      });
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
      return;
    }

    streamRef.current = stream;
    setStatus('connecting');

    const pc = new RTCPeerConnection({ iceServers: [] });
    pcRef.current = pc;

    for (const track of stream.getTracks()) pc.addTrack(track, stream);

    // Stop if the user ends the screen share via browser UI
    stream.getVideoTracks()[0]?.addEventListener('ended', () => stop());

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') resolve();
        });
      });

      const resp = await fetch(whipUrl(pilotId), {
        method:  'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body:    pc.localDescription!.sdp,
      });

      if (!resp.ok) throw new Error(`WHIP error ${resp.status}`);

      etagRef.current = resp.headers.get('ETag');
      const answer = await resp.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
      setStatus('live');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
      stop();
    }
  }, [pilotId, res.width, res.height, maxFps, stop]);

  return { status, error, start, stop };
}
