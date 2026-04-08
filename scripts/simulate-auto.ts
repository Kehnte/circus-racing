#!/usr/bin/env npx tsx
// simulate-auto.ts — Simulate an AUTO race by sending fake OCR positions.
// Each pilot is interpolated between racetrack checkpoints.
//
// Usage:
//   npx tsx scripts/simulate-auto.ts              # fast mode
//   npx tsx scripts/simulate-auto.ts --interactive # pause between actions
//   npx tsx scripts/simulate-auto.ts --base-url http://localhost:3000

import type { Race, Pilot, Racetrack, Checkpoint } from '@circus-racing/types';

const BASE_URL = (() => {
  const i = process.argv.indexOf('--base-url');
  return i !== -1 ? process.argv[i + 1] : 'http://localhost:3000';
})();
const INTERACTIVE = process.argv.includes('--interactive');
const OCR_INTERVAL_MS = 2000;

interface AuthResponse { token: string; }
interface RaceEntry { id: string; status: string; pilotId: string; pilot?: { displayName: string }; }
interface PilotMe { token: string; }

async function api<T = unknown>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? res.json() : null) as Promise<T>;
}

async function pushOcrPosition(token: string, x: number, y: number, z: number): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/ocr/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-token': token },
    body: JSON.stringify({ x, y, z }),
  });
  return res.ok;
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  process.stdout.write(`  → ${label}... `);
  const result = await fn();
  console.log('✓');
  if (INTERACTIVE) await sleep(1500);
  return result;
}

function log(msg: string): void { console.log(`\n${msg}`); }

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

interface PilotSimState {
  id: string;
  name: string;
  token: string;
  speed: number;
  lapsDone: number;
  cpIdx: number;
  progress: number;
}

async function simulate(): Promise<void> {
  log('🏁 AUTO race simulation');
  console.log(`   Server : ${BASE_URL}`);
  console.log(`   Mode   : ${INTERACTIVE ? 'interactive' : 'fast'}\n`);

  // 1. Login admin
  log('1. Admin authentication');
  const loginRes = await step('Login', () =>
    api<AuthResponse>('POST', '/api/auth/login', { displayName: 'Kehnte', password: 'kehnteazerty' })
  );
  const jwt = loginRes.token;

  // 2. Find AUTO race
  log('2. Selecting AUTO race');
  const races = await api<Race[]>('GET', '/api/races', undefined, jwt);
  const race = races.find(r => r.trackingMode === 'auto');
  if (!race) throw new Error('No AUTO race found. Run seed.ts first.');
  console.log(`   Race   : "${race.name}" [${race.id}]`);

  // 3. Fetch racetrack checkpoints
  const trackData = await api<Racetrack>('GET', `/api/racetracks/${race.racetrackId}`, undefined, jwt);
  const checkpoints: Checkpoint[] = trackData.checkpoints;
  console.log(`   Track  : "${trackData.name}" (${checkpoints.length} checkpoints)`);

  // 4. Open, register, validate
  log('3. Registrations');
  if (race.status === 'PENDING') {
    await step('open-registrations', () =>
      api('POST', `/api/races/${race.id}/open-registrations`, undefined, jwt)
    );
  }

  const allPilots = await api<Pilot[]>('GET', '/api/pilots', undefined, jwt);
  const pilots = allPilots.filter(p => p.role !== 'ADMIN').slice(0, 5);

  for (const p of pilots) {
    const pilotLogin = await api<AuthResponse>('POST', '/api/auth/login', {
      displayName: p.displayName, password: 'pilot123',
    });
    await step(`Register ${p.displayName}`, () =>
      api('POST', `/api/races/${race.id}/entries`, undefined, pilotLogin.token)
    );
  }

  const entries = await api<RaceEntry[]>('GET', `/api/races/${race.id}/entries`, undefined, jwt);
  for (const e of entries.filter(e => e.status === 'PENDING')) {
    await step(`Validate ${e.pilot?.displayName}`, () =>
      api('PATCH', `/api/races/${race.id}/entries/${e.id}/validate`, undefined, jwt)
    );
  }

  // 5. Get OCR tokens for each pilot
  log('4. Fetching OCR tokens');
  const pilotTokenMap: Record<string, string> = {};
  for (const p of pilots) {
    const pilotLogin = await api<AuthResponse>('POST', '/api/auth/login', {
      displayName: p.displayName, password: 'pilot123',
    });
    const me = await api<PilotMe>('GET', '/api/pilots/me', undefined, pilotLogin.token);
    pilotTokenMap[p.id] = me.token;
    console.log(`  ✓ ${p.displayName} token: ${me.token.slice(0, 8)}...`);
  }

  // 6. Load + start
  log('5. Loading + starting');
  await step('Load race', () => api('POST', `/api/races/${race.id}/load`, undefined, jwt));
  await step('Start race', () => api('POST', `/api/races/${race.id}/start`, undefined, jwt));

  // 7. Simulate OCR positions
  log('6. Simulating OCR positions\n');

  const LAP_COUNT = race.lapCount ?? 3;
  const cpLen = checkpoints.length;

  const pilotStates: PilotSimState[] = pilots.map((p, i) => ({
    id: p.id,
    name: p.displayName,
    token: pilotTokenMap[p.id],
    speed: 0.08 + i * 0.01,
    lapsDone: 0,
    cpIdx: 0,
    progress: 0,
  }));

  let tick = 0;
  while (tick < 2000) {
    tick++;
    let allDone = true;

    for (const ps of pilotStates) {
      if (ps.lapsDone >= LAP_COUNT) continue;
      allDone = false;

      const prevCpIdx = (ps.cpIdx - 1 + cpLen) % cpLen;
      const nextCpIdx = ps.cpIdx % cpLen;
      const prevPos = checkpoints[prevCpIdx].position;
      const nextPos = checkpoints[nextCpIdx].position;

      ps.progress += ps.speed;

      if (ps.progress >= 1) {
        ps.progress = 0;
        ps.cpIdx = (ps.cpIdx + 1) % cpLen;

        if (ps.cpIdx === 0) {
          ps.lapsDone++;
          console.log(`  🏎  ${ps.name.padEnd(12)} — Lap ${ps.lapsDone}/${LAP_COUNT} completed`);
        }
      }

      const pos = lerp3(prevPos, nextPos, ps.progress);
      await pushOcrPosition(ps.token, pos[0], pos[1], pos[2]);
    }

    if (allDone) break;
    await sleep(OCR_INTERVAL_MS);
  }

  // 8. Finish
  log('7. Race finish');
  await step('Finish race', () => api('POST', `/api/races/${race.id}/finish`, undefined, jwt));

  log('✅ AUTO simulation completed successfully.\n');
}

simulate().catch((err: Error) => {
  console.error('\n❌ Simulation failed:', err.message);
  process.exit(1);
});
