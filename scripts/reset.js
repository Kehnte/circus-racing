#!/usr/bin/env node
// reset.js — Supprime la base de données SQLite et relance seed.js.
// Destructif — toutes les données existantes sont perdues.
// Usage : node scripts/reset.js [--base-url http://localhost:3000]

'use strict';

const path = require('path');
const fs   = require('fs');
const { execSync, spawn } = require('child_process');
try { require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') }); } catch {}

const SERVER_DIR = path.join(__dirname, '../server');
const DB_URL  = process.env.DATABASE_URL ?? 'file:./db/circus.db';
const DB_PATH = DB_URL.startsWith('file:')
  ? path.resolve(SERVER_DIR, DB_URL.slice(5))
  : null;

// Parse --base-url from args (forwarded to seed)
const baseUrlIdx = process.argv.indexOf('--base-url');
const BASE_URL   = baseUrlIdx !== -1 ? process.argv[baseUrlIdx + 1] : 'http://localhost:3000';
const HEALTH_URL = `${BASE_URL}/health`;

console.log('\n⚠️  RESET — toutes les données vont être supprimées.\n');

// ---------------------------------------------------------------------------
// 1. Delete DB file
// ---------------------------------------------------------------------------
if (DB_PATH) {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log(`🗑️  Base supprimée : ${DB_PATH}`);
  } else {
    console.log(`ℹ️  Pas de base existante : ${DB_PATH}`);
  }
  for (const ext of ['-wal', '-shm']) {
    const p = DB_PATH + ext;
    if (fs.existsSync(p)) { fs.unlinkSync(p); }
  }
}

// ---------------------------------------------------------------------------
// 2. Recreate schema
// ---------------------------------------------------------------------------
console.log('\n📐 Recréation du schéma (drizzle-kit push)...');
try {
  execSync('npm run db:push', { cwd: SERVER_DIR, stdio: 'inherit' });
} catch {
  console.error('❌ drizzle-kit push a échoué. Vérifiez la config.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Start server (unless already running)
// ---------------------------------------------------------------------------
async function isServerReady() {
  try {
    const res = await fetch(HEALTH_URL);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(childProc, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerReady()) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  if (childProc) childProc.kill();
  return false;
}

(async () => {
  let serverChild = null;
  const alreadyRunning = await isServerReady();

  if (alreadyRunning) {
    console.log('\n🟢 Serveur déjà actif — seed direct.\n');
  } else {
    console.log('\n🚀 Démarrage du serveur...\n');
    serverChild = spawn('npm', ['run', 'dev:ts'], {
      cwd: SERVER_DIR,
      stdio: 'inherit',
      detached: true,
      shell: true,
      windowsHide: true,
    });
    serverChild.unref();

    const ready = await waitForServer(serverChild);
    if (!ready) {
      console.error('❌ Le serveur n\'a pas démarré dans les 30 secondes.');
      process.exit(1);
    }
    console.log('\n✅ Serveur prêt.\n');
  }

  // -------------------------------------------------------------------------
  // 4. Run seed
  // -------------------------------------------------------------------------
  console.log('🌱 Lancement du seed...\n');
  const seedArgs = process.argv.slice(2).join(' ');
  try {
    execSync(`node "${path.join(__dirname, 'seed.js')}" ${seedArgs}`, {
      stdio: 'inherit',
    });
  } catch {
    console.error('❌ Seed a échoué.');
    process.exit(1);
  }
})();
