#!/usr/bin/env node
// simulate-auto.js — Simulate an AUTO race by sending fake OCR positions.
// Each pilot is interpolated between racetrack checkpoints.
// One pilot deviates from the track to trigger a WARNING_DNF.
//
// Usage:
//   node scripts/simulate-auto.js              # fast mode
//   node scripts/simulate-auto.js --interactive # pause between actions
//   node scripts/simulate-auto.js --base-url http://localhost:3000

'use strict';

const BASE_URL = (() => {
  const i = process.argv.indexOf('--base-url');
  return i !== -1 ? process.argv[i + 1] : 'http://localhost:3000';
})();
const INTERACTIVE = process.argv.includes('--interactive');
const OCR_INTERVAL_MS = 2000; // interval between OCR position pushes

// Helpers

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
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
  return ct.includes('application/json') ? res.json() : null;
}

async function pushOcrPosition(token, x, y, z) {
  const res = await fetch(`${BASE_URL}/api/ocr/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-token': token },
    body: JSON.stringify({ x, y, z }),
  });
  return res.ok;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function step(label, fn) {
  process.stdout.write(`  → ${label}... `);
  const result = await fn();
  console.log('✓');
  if (INTERACTIVE) await sleep(1500);
  return result;
}

function log(msg) { console.log(`\n${msg}`); }

// Interpolate between two 3D points: t in [0,1]
function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// Simulation

async function simulate() {
  log('🏁 AUTO race simulation');
  console.log(`   Server : ${BASE_URL}`);
  console.log(`   Mode   : ${INTERACTIVE ? 'interactive' : 'fast'}\n`);

  // 1. Login admin
  log('1. Admin authentication');
  const loginRes = await step('Login', () =>
    api('POST', '/api/auth/login', { displayName: 'Admin', password: 'admin123' })
  );
  const jwt = loginRes.jwt;

  // 2. Find AUTO race
  log('2. Selecting AUTO race');
  const races = await api('GET', '/api/races', null, jwt);
  const race = races.find(r => r.trackingMode === 'auto');
  if (!race) throw new Error('No AUTO race found. Run seed.js first.');
  console.log(`   Race   : "${race.name}" [${race.id}]`);

  // 3. Fetch racetrack checkpoints
  const trackData = await api('GET', `/api/racetracks/${race.racetrackId}`, null, jwt);
  const checkpoints = trackData.checkpoints;
  console.log(`   Track  : "${trackData.name}" (${checkpoints.length} checkpoints)`);

  // 4. Open, register, validate
  log('3. Registrations');
  if (race.status === 'PENDING') {
    await step('open-registrations', () =>
      api('POST', `/api/races/${race.id}/open-registrations`, null, jwt)
    );
  }

  const allPilots = await api('GET', '/api/pilots', null, jwt);
  const pilots = allPilots.filter(p => p.role !== 'ADMIN').slice(0, 5);

  for (const p of pilots) {
    const pilotLogin = await api('POST', '/api/auth/login', {
      displayName: p.displayName, password: 'pilot123',
    });
    await step(`Register ${p.displayName}`, () =>
      api('POST', `/api/races/${race.id}/entries`, null, pilotLogin.jwt)
    );
  }

  const entries = await api('GET', `/api/races/${race.id}/entries`, null, jwt);
  for (const e of entries.filter(e => e.status === 'PENDING')) {
    await step(`Validate ${e.pilot?.displayName}`, () =>
      api('PATCH', `/api/races/${race.id}/entries/${e.id}/validate`, null, jwt)
    );
  }

  // 5. Get OCR tokens for each pilot
  log('4. Fetching OCR tokens');
  const pilotTokenMap = {}; // pilotId → ocrToken
  for (const p of pilots) {
    const pilotLogin = await api('POST', '/api/auth/login', {
      displayName: p.displayName, password: 'pilot123',
    });
    const me = await api('GET', '/api/pilots/me', null, pilotLogin.jwt);
    pilotTokenMap[p.id] = me.token;
    console.log(`  ✓ ${p.displayName} token: ${me.token.slice(0, 8)}...`);
  }

  // 6. Load + start
  log('5. Loading + starting');
  await step('Load race', () => api('POST', `/api/races/${race.id}/load`, null, jwt));
  await step('Start race', () => api('POST', `/api/races/${race.id}/start`, null, jwt));

  // 7. Simulate OCR positions
  log('6. Simulation positions OCR\n');

  const LAP_COUNT = race.lapCount ?? 3;
  const cpLen = checkpoints.length;

  // Each pilot: { id, token, speed, lapsDone, cpIdx, progress, deviated }
  const pilotStates = pilots.map((p, i) => ({
    id: p.id,
    name: p.displayName,
    token: pilotTokenMap[p.id],
    speed: 0.08 + i * 0.01, // progress per tick through segment
    lapsDone: 0,
    cpIdx: 0,       // next checkpoint index
    progress: 0,    // progress 0–1 between prev and next CP
    deviated: false,
    dnfSent: false,
  }));

  // Pilot index 3 will deviate on lap 2
  const DEVIATE_PILOT_IDX = 3;

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

      let pos;

      // Deviate on lap 2 for designated pilot
      if (
        pilotStates.indexOf(ps) === DEVIATE_PILOT_IDX &&
        ps.lapsDone === 1 &&
        !ps.deviated &&
        ps.progress > 0.5
      ) {
        ps.deviated = true;
        // Push far off-track position
        pos = [
          nextPos[0] + 2000,
          nextPos[1] + 500,
          nextPos[2] + 2000,
        ];
        console.log(`  ⚠️  ${ps.name} deviates from track (tick ${tick})`);

        await pushOcrPosition(ps.token, pos[0], pos[1], pos[2]);
        await sleep(OCR_INTERVAL_MS);

        // Admin ignores DNF warning after a short wait
        if (!ps.dnfSent) {
          ps.dnfSent = true;
          await sleep(OCR_INTERVAL_MS);
          try {
            await step(`Admin ignore DNF warning for ${ps.name}`, () =>
              api('POST', `/api/race-events/races/${race.id}/ignore-dnf/${ps.id}`, null, jwt)
            );
          } catch {
            // May not have triggered yet, skip
          }
          ps.deviated = false;
          ps.progress = 0.5; // reset to back on track
        }
        continue;
      }

      if (ps.progress >= 1) {
        ps.progress = 0;
        ps.cpIdx = (ps.cpIdx + 1) % cpLen;

        // Completed a full lap when wrapping past checkpoint 0
        if (ps.cpIdx === 0) {
          ps.lapsDone++;
          console.log(`  🏎  ${ps.name.padEnd(12)} — Lap ${ps.lapsDone}/${LAP_COUNT} completed`);
        }
      }

      pos = lerp3(prevPos, nextPos, ps.progress);
      await pushOcrPosition(ps.token, pos[0], pos[1], pos[2]);
    }

    if (allDone) break;
    await sleep(OCR_INTERVAL_MS);
  }

  // 8. Finish
  log('7. Race finish');
  await step('Finish race', () => api('POST', `/api/races/${race.id}/finish`, null, jwt));

  log('✅ AUTO simulation completed successfully.\n');
}

simulate().catch(err => {
  console.error('\n❌ Simulation failed:', err.message);
  process.exit(1);
});
