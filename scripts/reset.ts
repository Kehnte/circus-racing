#!/usr/bin/env npx tsx
// reset.ts — Delete the SQLite database and re-run seed.ts.
// Destructive — all existing data is lost.
// Usage: npx tsx scripts/reset.ts [--base-url http://localhost:3000]

import * as path from 'path';
import * as fs from 'fs';
import { execSync, spawn } from 'child_process';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(path.join(__dirname, '../server/node_modules/dotenv')).config({
    path: path.join(__dirname, '../server/.env'),
  });
} catch {}

const SERVER_DIR = path.join(__dirname, '../server');
const DB_URL  = process.env['DATABASE_URL'] ?? 'file:./db/circus.db';
const DB_PATH = DB_URL.startsWith('file:')
  ? path.resolve(SERVER_DIR, DB_URL.slice(5))
  : null;

const baseUrlIdx = process.argv.indexOf('--base-url');
const BASE_URL   = baseUrlIdx !== -1 ? process.argv[baseUrlIdx + 1] : 'http://localhost:3000';
const HEALTH_URL = `${BASE_URL}/health`;

console.log('\n⚠️  RESET — all data will be deleted.\n');
if (DB_PATH) {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log(`🗑️  Database deleted: ${DB_PATH}`);
  } else {
    console.log(`ℹ️  No existing database: ${DB_PATH}`);
  }
  for (const ext of ['-wal', '-shm']) {
    const p = DB_PATH + ext;
    if (fs.existsSync(p)) { fs.unlinkSync(p); }
  }
}

// Recreate schema
console.log('\n📐 Recreating schema (drizzle-kit push)...');
try {
  execSync('npm run db:push', { cwd: SERVER_DIR, stdio: 'inherit' });
} catch {
  console.error('❌ drizzle-kit push failed. Check your config.');
  process.exit(1);
}

async function isServerReady(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(childProc: ReturnType<typeof spawn> | null, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerReady()) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  if (childProc) childProc.kill();
  return false;
}

(async () => {
  let serverChild: ReturnType<typeof spawn> | null = null;
  const alreadyRunning = await isServerReady();

  if (alreadyRunning) {
    console.log('\n🟢 Server already running — seeding directly.\n');
  } else {
    console.log('\n🚀 Starting server...\n');
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
      console.error('❌ Server did not start within 30 seconds.');
      process.exit(1);
    }
    console.log('\n✅ Server ready.\n');
  }

  // Run seed
  console.log('🌱 Running seed...\n');
  const seedArgs = process.argv.slice(2).join(' ');
  try {
    execSync(`npx tsx "${path.join(__dirname, 'seed.ts')}" ${seedArgs}`, {
      stdio: 'inherit',
    });
  } catch {
    console.error('❌ Seed failed.');
    process.exit(1);
  }
})();
