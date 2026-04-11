# Circus Racing

Real-time race management platform and streaming overlays for **Star Citizen** events. A Node.js server centralizes race state, broadcasts it via Socket.IO to OBS overlays, and exposes a REST API driven by the admin dashboard.

---

## Repository structure

```
circus-racing/
├── server/                  ← Node.js server (REST API + Socket.IO + Dashboard)
│   ├── src/                 ← TypeScript source (API, race engine, DB, socket)
│   ├── frontend/            ← React + Vite + MUI dashboard (admin + pilot interface)
│   ├── overlays/            ← OBS browser sources (leaderboard, race-alert)
│   └── shared/              ← Shared assets
├── monitor/                 ← Windows OCR client (.exe) — reads Star Citizen coordinates
├── scripts/                 ← Seed, reset DB, race simulations
├── .github/workflows/
│   ├── server-docker.yml    ← Build & push Docker image on server/ changes
│   └── monitor-release.yml  ← Build & publish .exe on monitor/ changes
├── docker-compose.yml
└── .env.example
```

---

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET at minimum
docker compose up -d
```

Server available at `http://localhost:1959`.

---

## Local development

```bash
cd server
npm install
npm run dev
```

Other useful scripts:

```bash
npm run build        # Compile TypeScript to dist/
npm run db:push      # Push schema changes to SQLite
npm run db:studio    # Open Drizzle Studio (DB browser)
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Server | Node.js, Express |
| Real-time | Socket.IO |
| Database | SQLite via Drizzle ORM |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Frontend | React, Vite, MUI (Material UI) |
| Overlays | Lightweight HTML/CSS/JS (OBS browser source) |
| OCR client | Python (PyInstaller → Windows .exe) |
| CI/CD | GitHub Actions → ghcr.io |

---

## Accounts and roles

### First startup

The database starts empty. The **first account created becomes ADMIN** automatically (via the sign-up page or the seed script).

To populate the DB with test data (pilots, teams, vehicles, racetracks, races):

```bash
cd scripts
npx tsx seed.ts
```

The script prints the `displayName` and password for every created pilot.

To reset the database:

```bash
npx tsx reset.ts
```

### Roles

| Role | Access |
|------|--------|
| `ADMIN` | Full access — roster management, race management, role assignment, DB reset |
| `MODERATOR` | Race management, roster management — cannot manage roles or reset DB |
| `PILOT` | Profile page, race registration, OCR token |

Login uses `displayName` + `password`. If a pilot loses their password, an admin resets it from the Pilots list — this invalidates their current session and forces re-login.

---

## Application URLs

| App | URL |
|-----|-----|
| Dashboard | `http://localhost:1959/dashboard/` |
| Leaderboard overlay | `http://localhost:1959/overlays/leaderboard/` |
| Race alert overlay | `http://localhost:1959/overlays/race-alert/` |
| REST API | `http://localhost:1959/api/` |
| Health check | `http://localhost:1959/health` |

### Standalone pop-outs (OBS / second screen)

| View | URL |
|------|-----|
| Race grid only | `http://localhost:1959/dashboard/standalone/dashboard` |
| Telemetry | `http://localhost:1959/dashboard/standalone/telemetry` |
| Open races | `http://localhost:1959/dashboard/standalone/races` |

---

## Usage — Typical workflow

1. **Create entities** in the dashboard: pilots, teams, vehicles, controls, racetracks
2. **Create a race**: name, tracking mode (Manual or Auto/OCR), racetrack, session, weather, start type, session mode (laps or timed)
3. **Open registrations** — the race moves to `SCHEDULED`
4. **Pilots register** from the Profile page
5. **Validate registrations** in the dashboard, set grid positions
6. **Add overlays in OBS**:
   - Leaderboard: `http://localhost:1959/overlays/leaderboard/`
   - Race alert: `http://localhost:1959/overlays/race-alert/`
7. **Load the race** — pilots appear in the overlays
8. **Start countdown** then **Start race**
9. In **Manual** mode: increment laps, adjust positions, mark DNFs
10. In **Auto** mode: pilot OCR monitors push positions automatically
11. **Finish** — results are persisted, leaderboard is frozen

---

## OCR monitor

Pilots download the Windows `.exe` from [GitHub Releases](https://github.com/Kehnte/circus-racing/releases) and their pre-filled `config.cfg` from their profile page.

The monitor reads player coordinates from Star Citizen and sends them to the server every ~2 seconds using a unique per-pilot token.

See [`monitor/README.md`](monitor/README.md) for build instructions.

---

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/seed.ts` | Populate the DB with test data (teams, vehicles, controls, pilots, racetracks, races) |
| `scripts/reset.ts` | Reset the database |
| `scripts/simulate-manual.ts` | Simulate a race in Manual tracking mode |
| `scripts/simulate-auto.ts` | Simulate a race in Auto tracking mode (checkpoint detection) |

Run with `npx tsx <script>` from the `server/` directory.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `1959` | Server listen port |
| `DATABASE_URL` | `file:./db/circus.db` | SQLite file path (use `file:/app/db/circus.db` in Docker) |
| `JWT_SECRET` | *(required)* | JWT signing key — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `OCR_POLL_MS` | `2000` | Interval between OCR monitor position pushes (ms) |

---

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/kehnte)
