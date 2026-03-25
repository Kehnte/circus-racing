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
├── docs/                    ← Specifications
├── .github/workflows/
│   ├── server-docker.yml    ← Build & push Docker image on server/ changes
│   └── monitor-release.yml  ← Build & publish .exe on monitor/ changes
├── Dockerfile
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

Server available at `http://localhost:3000`.

---

## Local development

```bash
cd server
npm install
npm run dev:ts
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
| CI/CD | GitHub Actions |

---

## Accounts and roles

### First startup

The database starts empty. Run the seed script to create test data (pilots, teams, races):

```bash
cd scripts
node seed.js
```

The script prints the `displayName` and password for every created pilot. The first pilot is `ADMIN`.

To start from scratch:

```bash
node reset.js
```

### Roles

| Role | Access |
|------|--------|
| `ADMIN` | Everything + user role management (promote/demote) |
| `MODERATOR` | Everything except role management |
| `PILOT` | Dashboard — profile, registrations, OCR config download |

Login uses `displayName` + `password` (no email). If a pilot loses their password, an admin or moderator resets it from the dashboard.

---

## Application URLs

| App | URL |
|-----|-----|
| Dashboard (admin + pilots) | `http://localhost:3000/dashboard/` |
| Leaderboard overlay | `http://localhost:3000/overlays/leaderboard/` |
| Race alert overlay | `http://localhost:3000/overlays/race-alert/` |
| REST API | `http://localhost:3000/api/` |
| Health check | `http://localhost:3000/health` |

---

## Usage — Typical workflow

1. **Create entities** in the dashboard: teams, vehicles, controls, racetracks
2. **Create a race**: name, tracking mode (MANUAL or AUTO), racetrack, session, weather, start type, session mode (laps or timed)
3. **Open registrations** — the race moves to `SCHEDULED`
4. **Pilots register** via the dashboard (`/dashboard/register`)
5. **Validate registrations** in the dashboard, set grid order
6. **Add overlays in OBS**:
   - Leaderboard: `http://localhost:3000/overlays/leaderboard/`
   - Race alert: `http://localhost:3000/overlays/race-alert/`
7. **Load the race** (`Load`) — pilots appear in the overlays
8. **Start countdown** then **Start race**
9. In MANUAL mode: increment laps, adjust positions, mark DNFs
10. In AUTO mode: pilot OCR monitors push positions, the engine computes everything automatically
11. **Finish** — results are persisted, leaderboard is frozen

---

## OCR monitor

Pilots download the Windows `.exe` from [GitHub Releases](https://github.com/Kehnte/circus-racing/releases) and their pre-filled `config.cfg` from their profile page.

The monitor reads player coordinates from Star Citizen and sends them to the server every ~2 seconds using a unique token (1 token = 1 pilot).

See [`monitor/`](monitor/) for build instructions.

---

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/seed.js` | Populate the DB with test data (teams, vehicles, controls, pilots, racetracks, races) |
| `scripts/reset.js` | Reset the database |
| `scripts/simulate-manual.js` | Simulate a race in MANUAL tracking mode |
| `scripts/simulate-auto.js` | Simulate a race in AUTO tracking mode (checkpoint detection) |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server listen port |
| `DATABASE_URL` | `file:./db/circus.db` | SQLite file path |
| `JWT_SECRET` | *(required)* | JWT signing key — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `DNF_BUFFER_RADIUS` | `500` | DNF geographic buffer radius (Star Citizen units) in AUTO mode. Can be overridden per racetrack. |
| `OCR_POLL_MS` | `2000` | Interval between OCR monitor position pushes (ms) |
| `SMTP_HOST` | — | SMTP server host (optional, for future email features) |
| `SMTP_PORT` | — | SMTP server port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | — | Sender address for outgoing emails |

---

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/kehnte)
