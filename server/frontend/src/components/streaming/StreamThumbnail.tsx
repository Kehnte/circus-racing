// StreamThumbnail — WHEP video preview for a single mediamtx stream path.

import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const WEBRTC_PORT = 8889;

function whepUrl(path: string): string {
  return `${window.location.protocol}//${window.location.hostname}:${WEBRTC_PORT}/${path}/whep`;
}

interface Props {
  path: string;
  label: string;
  active: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export default function StreamThumbnail({ path, label, active, selected, onClick }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef    = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!active) {
      pcRef.current?.close();
      pcRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }

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
      const resp = await fetch(whepUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription!.sdp,
      }).catch(() => null);
      if (!resp?.ok) return;
      const answer = await resp.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    })();

    return () => { pc.close(); pcRef.current = null; };
  }, [active, path]);

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        aspectRatio: '16/9',
        bgcolor: 'background.paper',
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        opacity: active ? 1 : 0.4,
        '&:hover': onClick ? { borderColor: 'primary.light' } : {},
      }}
    >
      <Box component="video" ref={videoRef} muted playsInline
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        px: 0.75, py: 0.25, bgcolor: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', gap: 0.5,
      }}>
        {active && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main', flexShrink: 0 }} />}
        <Typography variant="caption" noWrap sx={{ color: '#fff', fontSize: 11 }}>{label}</Typography>
      </Box>
    </Box>
  );
}
