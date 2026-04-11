#!/usr/bin/env npx tsx
// simulate-auto.ts — Simulate a full AUTO race by pushing fake OCR positions.
// Requires a running server with at least one AUTO race, a racetrack with checkpoints, and pilots in the DB.
//
// Usage:
//   npx tsx scripts/simulate-auto.ts
//   npx tsx scripts/simulate-auto.ts --interactive
//   npx tsx scripts/simulate-auto.ts --base-url http://localhost:1959
//   npx tsx scripts/simulate-auto.ts --countdown 10
//   npx tsx scripts/simulate-auto.ts --admin Kehnte --password mypassword

import type { Race, Racetrack, Checkpoint } from '@circus-racing/types';

const BASE_URL = (() => {
  const i = process.argv.indexOf('--base-url');
  return i !== -1 ? process.argv[i + 1] : 'http://localhost:1959';
})();
const INTERACTIVE = process.argv.includes('--interactive');
const COUNTDOWN = (() => {
  const i = process.argv.indexOf('--countdown');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : 5;
})();
const ADMIN_NAME = (() => {
  const i = process.argv.indexOf('--admin');
  return i !== -1 ? process.argv[i + 1] : 'Kehnte';
})();
const ADMIN_PASS = (() => {
  const i = process.argv.indexOf('--password');
  return i !== -1 ? process.argv[i + 1] : 'kehnteazerty';
})();

const OCR_INTERVAL_MS = 2000;

interface AuthResponse { token: string; }
interface RaceEntry { id: string; status: string; pilotId: string; pilot?: { displayName: string }; gridPosition?: number; }

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

async function pushOcrPosition(ocrToken: string, x: number, y: number, z: number): Promise<void> {
  await fetch(`${BASE_URL}/api/ocr/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-token': ocrToken },
    body: JSON.stringify({ x, y, z }),
  });
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
  ocrToken: string;
  speed: number;
  lapsDone: number;
  cpIdx: number;
  progress: number;
}

async function simulate(): Promise<void> {
  log('🏁 AUTO race simulation');
  console.log(`   Server    : ${BASE_URL}`);
  console.log(`   Mode      : ${INTERACTIVE ? 'interactive' : 'fast'}`);
  console.log(`   Countdown : ${COUNTDOWN}s\n`);

  // 1. Login admin
  log('1. Admin authentication');
  const loginRes = await step(`Login as ${ADMIN_NAME}`, () =>
    api<AuthResponse>('POST', '/api/auth/login', { displayName: ADMIN_NAME, password: ADMIN_PASS })
  );
  const jwt = loginRes.token;

  // 2. Find an AUTO race (PENDING or SCHEDULED)
  log('2. Selecting AUTO race');
  const races = await step('GET /api/races', () => api<Race[]>('GET', '/api/races', undefined, jwt));
  const race = races.find(r => r.trackingMode === 'auto' && (r.status === 'PENDING' || r.status === 'SCHEDULED'));
  if (!race) throw new Error('No available AUTO race found (PENDING or SCHEDULED).');
  console.log(`   Race     : "${race.name}" [${race.id}]`);
  console.log(`   Laps     : ${race.lapCount}`);
  console.log(`   Session  : ${race.session}`);

  // 3. Fetch racetrack checkpoints
  log('3. Fetching racetrack checkpoints');
  const trackData = await step(`GET /api/racetracks/${race.racetrackId}`, () =>
    api<Racetrack>('GET', `/api/racetracks/${race.racetrackId}`, undefined, jwt)
  );
  const checkpoints: Checkpoint[] = trackData.checkpoints;
  if (checkpoints.length < 2) throw new Error('Racetrack needs at least 2 checkpoints.');
  console.log(`   Track    : "${trackData.name}" (${checkpoints.length} checkpoints)`);

  // 4. Open registrations if needed
  log('4. Opening registrations');
  if (race.status === 'PENDING') {
    await step('open-registrations', () =>
      api('POST', `/api/races/${race.id}/open-registrations`, undefined, jwt)
    );
  } else {
    console.log('  → Already open ✓');
  }

  // 5. Add pilots as validated entries (admin direct add — no pilot logins needed)
  log('5. Adding pilots as validated entries');
  const allPilots = await api<PilotWithToken[]>('GET', '/api/pilots', undefined, jwt);
  if (allPilots.length === 0) throw new Error('No pilots in DB. Run seed.ts first.');

  const pilotSubset = allPilots.slice(0, 5);
  for (const p of pilotSubset) {
    await step(`Add ${p.displayName}`, () =>
      api('POST', `/api/races/${race.id}/entries/admin`, { pilotId: p.id }, jwt)
    );
  }

  // 6. Load + set grid order
  log('6. Loading context + grid order');
  await step('Load race', () => api('POST', `/api/races/${race.id}/load`, undefined, jwt));

  const validatedEntries = (await api<RaceEntry[]>('GET', `/api/races/${race.id}/entries`, undefined, jwt))
    .filter(e => e.status === 'VALIDATED')
    .sort((a, b) => (a.gridPosition ?? 99) - (b.gridPosition ?? 99));

  await step('Set grid order', () =>
    api('POST', `/api/race-events/races/${race.id}/grid-order`, {
      pilotIds: validatedEntries.map(e => e.pilotId),
    }, jwt)
  );

  // 7. Countdown + Start
  log(`7. Countdown (${COUNTDOWN}s) + Start`);
  await step(`Countdown ${COUNTDOWN}s`, () =>
    api('POST', `/api/race-events/races/${race.id}/countdown`, { seconds: COUNTDOWN }, jwt)
  );
  if (INTERACTIVE) await sleep(Math.min(COUNTDOWN * 1000, 3000));
  await step('Countdown stop', () =>
    api('POST', `/api/race-events/races/${race.id}/countdown-stop`, undefined, jwt)
  );
  await step('Start race', () => api('POST', `/api/races/${race.id}/start`, undefined, jwt));

  // 8. Simulate OCR positions — interpolate pilots between checkpoints
  log('8. OCR position simulation\n');

  const LAP_COUNT = race.lapCount;
  const cpLen = checkpoints.length;

  const pilotStates: PilotSimState[] = pilotSubset.map((p, i) => ({
    id: p.id,
    name: p.displayName,
    ocrToken: p.token,
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
          console.log(`  ✓ ${ps.name.padEnd(16)} — Lap ${ps.lapsDone}/${LAP_COUNT}`);
        }
      }

      const pos = lerp3(prevPos, nextPos, ps.progress);
      await pushOcrPosition(ps.ocrToken, pos[0], pos[1], pos[2]);
    }

    if (allDone) break;
    await sleep(OCR_INTERVAL_MS);
  }

  // 9. Finish
  log('9. Race finish');
  await step('Finish race', () => api('POST', `/api/races/${race.id}/finish`, undefined, jwt));

  log('✅ AUTO simulation completed successfully.\n');
}

simulate().catch((err: Error) => {
  console.error('\n❌ Simulation failed:', err.message);
  process.exit(1);
});
