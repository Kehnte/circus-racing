// ProgramView — renders the director layout: single, side-by-side, quad, or pip.
// All slots use object-fit:cover in a 16/9 container — no black bars.

import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export type LayoutMode = 'single' | 'side-by-side' | 'quad' | 'pip';

export interface SlotSource {
  type: 'pilot' | 'camera';
  id: string;
}

const WEBRTC_PORT = 8889;

function whepUrl(source: SlotSource): string {
  const prefix = source.type === 'pilot' ? 'pilots' : 'cameras';
  return `${window.location.protocol}//${window.location.hostname}:${WEBRTC_PORT}/${prefix}/${source.id}/whep`;
}

function StreamSlot({ source, label }: { source: SlotSource | null; label?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef    = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    pcRef.current?.close();
    pcRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (!source) return;

    const pc = new RTCPeerConnection({ iceServers: [] });
    pcRef.current = pc;

    const stream = new MediaStream();
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => { /* autoplay blocked */ });
    }

    pc.ontrack = (e) => stream.addTrack(e.track);
    pc.addTransceiver('video', { direction: 'recvonly' });

    void (async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') resolve();
        });
      });
      const resp = await fetch(whepUrl(source), {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription!.sdp,
      }).catch(() => null);
      if (!resp?.ok) return;
      const answer = await resp.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    })();

    return () => { pc.close(); pcRef.current = null; };
  }, [source?.type, source?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', bgcolor: '#111' }}>
      <Box component="video" ref={videoRef} muted playsInline
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {!source && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" color="text.disabled">empty</Typography>
        </Box>
      )}
      {label && (
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 1, py: 0.5, bgcolor: 'rgba(0,0,0,0.5)' }}>
          <Typography variant="caption" sx={{ color: '#fff', fontSize: 11 }}>{label}</Typography>
        </Box>
      )}
    </Box>
  );
}

interface ProgramViewProps {
  mode: LayoutMode;
  slots: (SlotSource | null)[];
  labels?: (string | undefined)[];
  fullscreen?: boolean;
}

export default function ProgramView({ mode, slots, labels = [], fullscreen = false }: ProgramViewProps) {
  const container = (children: React.ReactNode) => (
    <Box sx={{
      width: '100%',
      aspectRatio: fullscreen ? undefined : '16/9',
      height: fullscreen ? '100%' : undefined,
      bgcolor: '#000',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {children}
    </Box>
  );

  if (mode === 'single') {
    return container(<StreamSlot source={slots[0] ?? null} label={labels[0]} />);
  }

  if (mode === 'side-by-side') {
    return container(
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
        <StreamSlot source={slots[0] ?? null} label={labels[0]} />
        <StreamSlot source={slots[1] ?? null} label={labels[1]} />
      </Box>
    );
  }

  if (mode === 'quad') {
    return container(
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: '100%' }}>
        {[0, 1, 2, 3].map((i) => <StreamSlot key={i} source={slots[i] ?? null} label={labels[i]} />)}
      </Box>
    );
  }

  // pip: main + small overlay bottom-right (25% width)
  return container(
    <>
      <StreamSlot source={slots[0] ?? null} label={labels[0]} />
      <Box sx={{
        position: 'absolute', bottom: '3%', right: '3%',
        width: '25%', aspectRatio: '16/9',
        border: '2px solid rgba(255,255,255,0.3)',
        overflow: 'hidden', borderRadius: 0.5,
      }}>
        <StreamSlot source={slots[1] ?? null} label={labels[1]} />
      </Box>
    </>
  );
}
