#!/usr/bin/env node
// simulate-manual.js — Simule une course MANUEL complète via l'API REST.
// Nécessite le serveur démarré et une DB seedée (scripts/seed.js).
//
// Usage :
//   node scripts/simulate-manual.js              # mode rapide (tout enchaîné)
//   node scripts/simulate-manual.js --interactive # pause entre chaque action
//   node scripts/simulate-manual.js --base-url http://localhost:3000

'use strict';

const BASE_URL = (() => {
  const i = process.argv.indexOf('--base-url');
  return i !== -1 ? process.argv[i + 1] : 'http://localhost:3000';
})();
const INTERACTIVE = process.argv.includes('--interactive');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function step(label, fn) {
  process.stdout.write(`  → ${label}... `);
  const result = await fn();
  console.log('✓');
  if (INTERACTIVE) await sleep(1500);
  return result;
}

function log(msg) { console.log(`\n${msg}`); }

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

async function simulate() {
  log('🏁 Simulation course MANUEL');
  console.log(`   Serveur : ${BASE_URL}`);
  console.log(`   Mode    : ${INTERACTIVE ? 'interactif' : 'rapide'}\n`);

  // --- 1. Login admin ---
  log('1. Authentification admin');
  const loginRes = await step('Login', () =>
    api('POST', '/api/auth/login', { email: 'admin@circus.local', password: 'admin123' })
  );
  const jwt = loginRes.token; // response: { token (JWT), ocrToken, pilot }

  // --- 2. Find MANUAL race ---
  log('2. Sélection de la course MANUEL');
  const races = await step('GET /api/races', () => api('GET', '/api/races', null, jwt));
  const race = races.find(r => r.trackingMode === 'manual');
  if (!race) throw new Error('Aucune course MANUEL trouvée. Lancez seed.js d\'abord.');
  console.log(`   Course : "${race.name}" [${race.id}]`);

  // --- 3. Open registrations ---
  log('3. Ouverture des inscriptions');
  if (race.status === 'PENDING') {
    await step('open-registrations', () =>
      api('POST', `/api/races/${race.id}/open-registrations`, null, jwt)
    );
  }

  // --- 4. Register & validate 6 pilots ---
  log('4. Inscriptions et validations');
  const allPilots = await api('GET', '/api/pilots', null, jwt);
  const pilots = allPilots.filter(p => p.role !== 'ADMIN').slice(0, 6);

  for (const p of pilots) {
    const pilotLogin = await api('POST', '/api/auth/login', {
      displayName: p.displayName, password: 'pilot123',
    });
    await step(`Register ${p.displayName}`, () =>
      api('POST', `/api/races/${race.id}/entries`, null, pilotLogin.jwt)
    );
  }

  // Get entries and validate each
  const entries = await api('GET', `/api/races/${race.id}/entries`, null, jwt);
  const pendingEntries = entries.filter(e => e.status === 'PENDING');
  for (const e of pendingEntries) {
    await step(`Validate ${e.pilot?.displayName}`, () =>
      api('PATCH', `/api/races/${race.id}/entries/${e.id}/validate`, null, jwt)
    );
  }

  // --- 5. Load + set grid order ---
  log('5. Chargement du contexte + ordre de grille');
  await step('Load race', () => api('POST', `/api/races/${race.id}/load`, null, jwt));

  const validatedEntries = (await api('GET', `/api/races/${race.id}/entries`, null, jwt))
    .filter(e => e.status === 'VALIDATED')
    .sort((a, b) => (a.gridPosition ?? 99) - (b.gridPosition ?? 99));

  await step('Set grid order', () =>
    api('POST', `/api/race-events/races/${race.id}/grid-order`, {
      pilotIds: validatedEntries.map(e => e.pilotId),
    }, jwt)
  );

  // --- 6. Countdown + Start ---
  log('6. Countdown + Départ');
  await step('Countdown 5s', () =>
    api('POST', `/api/race-events/races/${race.id}/countdown`, { seconds: 5 }, jwt)
  );
  if (INTERACTIVE) await sleep(3000);
  await step('Countdown stop', () =>
    api('POST', `/api/race-events/races/${race.id}/countdown-stop`, null, jwt)
  );
  await step('Start race', () => api('POST', `/api/races/${race.id}/start`, null, jwt));

  // --- 7. Simulate laps ---
  log('7. Simulation des tours');
  const LAP_COUNT = 3;
  const pilotIds = validatedEntries.map(e => e.pilotId);

  // Each pilot has a different "pace" (ms per lap)
  const paces = [8000, 8400, 8800, 9200, 9600, 10000];

  // Track accumulated time per pilot to simulate staggered finishes
  const nextLapTime = pilotIds.map((_, i) => paces[i]);
  const lapsDone = new Array(pilotIds.length).fill(0);
  const dnfPilot = pilotIds[4]; // 5th pilot will DNF at lap 2

  const simStart = Date.now();

  for (let tick = 0; tick < 200; tick++) {
    const elapsed = Date.now() - simStart;
    let allDone = true;

    for (let i = 0; i < pilotIds.length; i++) {
      const pid = pilotIds[i];
      if (lapsDone[i] >= LAP_COUNT) continue;
      allDone = false;

      if (elapsed >= nextLapTime[i]) {
        // DNF at lap 2 for pilot 5
        if (pid === dnfPilot && lapsDone[i] === 1 && !lapsDone._dnfDone) {
          await step(`DNF ${validatedEntries[i].pilot?.displayName}`, () =>
            api('POST', `/api/race-events/races/${race.id}/manual-dnf`, { pilotId: pid }, jwt)
          );
          lapsDone._dnfDone = true;
          lapsDone[i] = LAP_COUNT; // mark as done
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

    // Simulate pause in the middle (lap 2 of leader)
    if (lapsDone[0] === 2 && !lapsDone._paused) {
      lapsDone._paused = true;
      log('   [Pause de 2 secondes]');
      await step('Pause race', () => api('POST', `/api/races/${race.id}/pause`, null, jwt));
      await sleep(INTERACTIVE ? 3000 : 500);
      await step('Resume race', () => api('POST', `/api/races/${race.id}/resume`, null, jwt));
    }

    await sleep(50);
  }

  // --- 8. Finish ---
  log('8. Fin de course');
  await step('Finish race', () => api('POST', `/api/races/${race.id}/finish`, null, jwt));

  log('✅ Simulation MANUEL terminée avec succès.\n');
}

simulate().catch(err => {
  console.error('\n❌ Simulation échouée:', err.message);
  process.exit(1);
});
