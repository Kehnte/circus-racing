#!/usr/bin/env npx tsx
// simulate-manual.ts — Simulate a full MANUAL race via the REST API.
// Requires a running server and seeded DB (scripts/seed.ts).
//
// Usage:
//   npx tsx scripts/simulate-manual.ts              # fast mode (all chained)
//   npx tsx scripts/simulate-manual.ts --interactive # pause between each action
//   npx tsx scripts/simulate-manual.ts --base-url http://localhost:3000

import type { Race, Pilot } from '@circus-racing/types';

const BASE_URL = (() => {
  const i = process.argv.indexOf('--base-url');
  return i !== -1 ? process.argv[i + 1] : 'http://localhost:3000';
})();
const INTERACTIVE = process.argv.includes('--interactive');

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

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  process.stdout.write(`  → ${label}... `);
  const result = await fn();
  console.log('✓');
  if (INTERACTIVE) await sleep(1500);
  return result;
}

function log(msg: string): void { console.log(`\n${msg}`); }

async function simulate(): Promise<void> {
  log('🏁 MANUAL race simulation');
  console.log(`   Server : ${BASE_URL}`);
  console.log(`   Mode   : ${INTERACTIVE ? 'interactive' : 'fast'}\n`);

  // 1. Login admin
  log('1. Admin authentication');
  const loginRes = await step('Login', () =>
    api<AuthResponse>('POST', '/api/auth/login', { displayName: 'Kehnte', password: 'kehnteazerty' })
  );
  const jwt = loginRes.token;

  // 2. Find MANUAL race
  log('2. Selecting MANUAL race');
  const races = await step('GET /api/races', () => api<Race[]>('GET', '/api/races', undefined, jwt));
  const race = races.find(r => r.trackingMode === 'manual');
  if (!race) throw new Error('No MANUAL race found. Run seed.ts first.');
  console.log(`   Race : "${race.name}" [${race.id}]`);

  // 3. Open registrations
  log('3. Opening registrations');
  if (race.status === 'PENDING') {
    await step('open-registrations', () =>
      api('POST', `/api/races/${race.id}/open-registrations`, undefined, jwt)
    );
  }

  // 4. Register & validate 6 pilots
  log('4. Registrations and validations');
  const allPilots = await api<Pilot[]>('GET', '/api/pilots', undefined, jwt);
  const pilots = allPilots.filter(p => p.role !== 'ADMIN').slice(0, 6);

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

  // 5. Load + set grid order
  log('5. Loading context + grid order');
  await step('Load race', () => api('POST', `/api/races/${race.id}/load`, undefined, jwt));

  const validatedEntries = (await api<RaceEntry[]>('GET', `/api/races/${race.id}/entries`, undefined, jwt))
    .filter(e => e.status === 'VALIDATED')
    .sort((a, b) => (a.gridPosition ?? 99) - (b.gridPosition ?? 99));

  await step('Set grid order', () =>
    api('POST', `/api/race-events/races/${race.id}/grid-order`, {
      pilotIds: validatedEntries.map(e => e.pilotId),
    }, jwt)
  );

  // 6. Countdown + Start
  log('6. Countdown + Start');
  await step('Countdown 5s', () =>
    api('POST', `/api/race-events/races/${race.id}/countdown`, { seconds: 5 }, jwt)
  );
  if (INTERACTIVE) await sleep(3000);
  await step('Countdown stop', () =>
    api('POST', `/api/race-events/races/${race.id}/countdown-stop`, undefined, jwt)
  );
  await step('Start race', () => api('POST', `/api/races/${race.id}/start`, undefined, jwt));

  // 7. Simulate laps
  log('7. Lap simulation');
  const LAP_COUNT = 3;
  const pilotIds = validatedEntries.map(e => e.pilotId);

  const paces = [8000, 8400, 8800, 9200, 9600, 10000];
  const nextLapTime = pilotIds.map((_, i) => paces[i]);
  const lapsDone: number[] & { _paused?: boolean; _dnfDone?: boolean } = new Array(pilotIds.length).fill(0);
  const dnfPilot = pilotIds[4];

  const simStart = Date.now();

  for (let tick = 0; tick < 200; tick++) {
    const elapsed = Date.now() - simStart;
    let allDone = true;

    for (let i = 0; i < pilotIds.length; i++) {
      const pid = pilotIds[i];
      if (lapsDone[i] >= LAP_COUNT) continue;
      allDone = false;

      if (elapsed >= nextLapTime[i]) {
        if (pid === dnfPilot && lapsDone[i] === 1 && !lapsDone._dnfDone) {
          await step(`DNF ${validatedEntries[i].pilot?.displayName}`, () =>
            api('POST', `/api/race-events/races/${race.id}/manual-dnf`, { pilotId: pid }, jwt)
          );
          lapsDone._dnfDone = true;
          lapsDone[i] = LAP_COUNT;
          continue;
        }

        lapsDone[i]++;
        const name = validatedEntries[i].pilot?.displayName ?? pid;
        await step(`Lap ${lapsDone[i]}/${LAP_COUNT} → ${name}`, () =>
          api('POST', `/api/race-events/races/${race.id}/manual-lap`, {
            pilotId: pid, delta: 1,
          }, jwt)
        );
        nextLapTime[i] += paces[i] + Math.floor(Math.random() * 500 - 250);
      }
    }

    if (allDone) break;

    if (lapsDone[0] === 2 && !lapsDone._paused) {
      lapsDone._paused = true;
      log('   [2-second pause]');
      await step('Pause race', () => api('POST', `/api/races/${race.id}/pause`, undefined, jwt));
      await sleep(INTERACTIVE ? 3000 : 500);
      await step('Resume race', () => api('POST', `/api/races/${race.id}/resume`, undefined, jwt));
    }

    await sleep(50);
  }

  // 8. Finish
  log('8. Race finish');
  await step('Finish race', () => api('POST', `/api/races/${race.id}/finish`, undefined, jwt));

  log('✅ MANUAL simulation completed successfully.\n');
}

simulate().catch((err: Error) => {
  console.error('\n❌ Simulation failed:', err.message);
  process.exit(1);
});
