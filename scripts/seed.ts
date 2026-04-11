#!/usr/bin/env npx tsx
// seed.ts — Pre-fill the DB with a complete test dataset.
// Requires the server to be running (npm run dev:ts in /server).
// Usage: npx tsx scripts/seed.ts [--base-url http://localhost:3000]

import type { Team, Vehicle, Controls, Pilot, Race, Racetrack } from '@circus-racing/types';

const BASE_URL = (() => {
  const i = process.argv.indexOf('--base-url');
  return i !== -1 ? process.argv[i + 1] : 'http://localhost:3000';
})();

// HTTP helpers

interface AuthResponse {
  token: string;
  ocrToken: string;
  pilot: Pilot;
}

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

// Seed data

const TEAMS: Array<Pick<Team, 'name' | 'color' | 'acronym'>> = [
  { name: 'Lisoir Circus',              color: '#FFB74D', acronym: 'CIRC' },
  { name: 'Pico Motors',               color: '#4FC3F7', acronym: 'PICO' },
  { name: 'Finley Aeroview Racing Team', color: '#F06292', acronym: 'FART' },
];

const VEHICLES: Array<Pick<Vehicle, 'type' | 'manufacturer' | 'model'>> = [
  { type: 'ship',  manufacturer: 'Origin Jumpworks', model: 'M50'   },
  { type: 'ship',  manufacturer: 'Mirai',            model: 'Razor' },
  { type: 'ship',  manufacturer: 'Mirai',            model: 'Fury'  },
  { type: 'rover', manufacturer: 'RSI',              model: 'Ursa'  },
  { type: 'bike',  manufacturer: 'Aopao',            model: 'Nox'   },
];

const CONTROLS: Array<Pick<Controls, 'type'>> = [
  { type: 'HOTAS' },
  { type: 'Mouse & Keyboard' },
  { type: 'Gamepad' },
];

interface PilotDef {
  displayName: string;
  password: string;
  country: string;
  teamIdx: number;
  vehicleIdx: number;
  controlsIdx: number;
}

// The FIRST registered pilot automatically becomes ADMIN (see auth.ts)
const PILOTS: PilotDef[] = [
  { displayName: 'Admin',      password: 'admin', country: 'fr', teamIdx: 0, vehicleIdx: 0, controlsIdx: 0 },
  { displayName: 'Neoscris',    password: 'pilot123',     country: 'gb', teamIdx: 0, vehicleIdx: 0, controlsIdx: 0 },
  { displayName: 'Kainan',      password: 'pilot123',     country: 'de', teamIdx: 0, vehicleIdx: 1, controlsIdx: 1 },
  { displayName: 'Heizenberg',  password: 'pilot123',     country: 'gb', teamIdx: 1, vehicleIdx: 1, controlsIdx: 0 },
  { displayName: 'Hugo Lisoir', password: 'pilot123',     country: 'ca', teamIdx: 1, vehicleIdx: 1, controlsIdx: 2 },
  { displayName: 'Balokuclem',  password: 'pilot123',     country: 'au', teamIdx: 2, vehicleIdx: 1, controlsIdx: 1 },
  { displayName: 'Ddurieux',    password: 'pilot123',     country: 'jp', teamIdx: 2, vehicleIdx: 1, controlsIdx: 2 },
  { displayName: 'Lapaixduslip', password: 'pilot123',   country: 'br', teamIdx: 2, vehicleIdx: 1, controlsIdx: 0 },
];

// Test racetrack: simple oval with 6 checkpoints (fictitious coordinates)
const RACETRACK = {
  name: 'The Icebreaker',
  checkpoints: [
    { order: 0, position: [0,    0,   0   ] },
    { order: 1, position: [500,  100, 200 ] },
    { order: 2, position: [1000, 50,  500 ] },
    { order: 3, position: [1200, 0,   800 ] },
    { order: 4, position: [800,  -50, 1000] },
    { order: 5, position: [200,  0,   600 ] },
  ],
};

async function seed(): Promise<void> {
  console.log(`\n🌱 Seeding ${BASE_URL} ...\n`);

  // 1. Register all pilots (first = ADMIN automatically)
  console.log('1. Registering pilots');
  const pilotTokens: Record<string, { jwt: string; ocrToken: string; pilotId: string }> = {};

  for (let i = 0; i < PILOTS.length; i++) {
    const p = PILOTS[i];
    const res = await api<AuthResponse>('POST', '/api/auth/register', {
      displayName: p.displayName,
      password:    p.password,
      country:     p.country,
    });
    pilotTokens[p.displayName] = { jwt: res.token, ocrToken: res.ocrToken, pilotId: res.pilot.id };
    const role = i === 0 ? 'ADMIN' : 'PILOT';
    console.log(`  ✓ [${role.padEnd(9)}] ${p.displayName}`);
  }

  const adminJwt = pilotTokens[PILOTS[0].displayName].jwt;

  // 2. Create teams, vehicles, controls (admin JWT)
  console.log('\n2. Creating entities');

  const teams: Team[] = [];
  for (const t of TEAMS) {
    const created = await api<Team>('POST', '/api/teams', t, adminJwt);
    teams.push(created);
    console.log(`  ✓ Team "${t.name}" [${t.acronym}]`);
  }

  const vehicles: Vehicle[] = [];
  for (const v of VEHICLES) {
    const created = await api<Vehicle>('POST', '/api/vehicles', v, adminJwt);
    vehicles.push(created);
    console.log(`  ✓ Vehicle "${v.manufacturer} ${v.model}"`);
  }

  const controlsList: Controls[] = [];
  for (const c of CONTROLS) {
    const created = await api<Controls>('POST', '/api/controls', c, adminJwt);
    controlsList.push(created);
    console.log(`  ✓ Controls "${c.type}"`);
  }

  // 3. Update pilot profiles (admin patches all via /api/pilots/:id)
  console.log('\n3. Updating pilot profiles');
  for (const p of PILOTS) {
    const { pilotId } = pilotTokens[p.displayName];
    await api('PATCH', `/api/pilots/${pilotId}`, {
      teamId:     teams[p.teamIdx]?.id     ?? null,
      vehicleId:  vehicles[p.vehicleIdx]?.id  ?? null,
      controlsId: controlsList[p.controlsIdx]?.id ?? null,
    }, adminJwt);
    console.log(`  ✓ Profile "${p.displayName}" — ${TEAMS[p.teamIdx].name} / ${VEHICLES[p.vehicleIdx].model}`);
  }

  // 4. Racetrack
  console.log('\n4. Creating racetrack');
  const track = await api<Racetrack>('POST', '/api/racetracks', RACETRACK, adminJwt);
  console.log(`  ✓ "${RACETRACK.name}" (${RACETRACK.checkpoints.length} checkpoints) [${track.id}]`);

  // 5. Races
  console.log('\n5. Creating races');
  const raceManual = await api<Race>('POST', '/api/races', {
    name:         'Rikkord Memorial Raceway',
    trackingMode: 'manual',
    lapCount:     3,
    session:      'Race',
    weather:      'Clear',
    startType:    'Grid Start',
    sessionMode:  'laps',
  }, adminJwt);
  console.log(`  ✓ MANUEL "${raceManual.name}" [${raceManual.id}]`);

  const raceAuto = await api<Race>('POST', '/api/races', {
    name:         'Yadar Valley',
    trackingMode: 'auto',
    racetrackId:  track.id,
    lapCount:     3,
    session:      'Race',
    weather:      'Clear',
    startType:    'Rolling Start',
    sessionMode:  'laps',
  }, adminJwt);
  console.log(`  ✓ AUTO   "${raceAuto.name}" [${raceAuto.id}]`);

  // Summary
  console.log('\n' + '═'.repeat(64));
  console.log('✅ Seed complete!\n');
  console.log('ACCOUNTS (displayName / password):');
  for (let i = 0; i < PILOTS.length; i++) {
    const p = PILOTS[i];
    const role = i === 0 ? 'ADMIN' : 'PILOT';
    console.log(`  [${role.padEnd(9)}] ${p.displayName.padEnd(12)} / ${p.password}`);
  }
  console.log(`\nRACES:`);
  console.log(`  MANUAL : ${raceManual.id}`);
  console.log(`  AUTO   : ${raceAuto.id}`);
  console.log(`\nRACETRACK: ${track.id}`);
  console.log('═'.repeat(64) + '\n');
}

seed().catch((err: Error) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
