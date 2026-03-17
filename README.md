# 🏁 Circus Racing

Real-time race management and streaming overlay platform for **Star Citizen** events.

---

## Repo structure

```
circus-racing/
├── server/          ← Node.js / Express / Socket.IO / Drizzle ORM
├── monitor/         ← Python OCR client (Windows .exe)
├── docs/            ← Specifications
├── .github/workflows/
│   ├── server-docker.yml    ← builds & pushes Docker image on server/ changes
│   └── monitor-release.yml  ← builds & publishes .exe on monitor/ changes
├── docker-compose.yml
└── .env.example
```

---

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and DATABASE_URL
docker compose up -d
```

Server available at `http://localhost:3000`.

---

## Dev local

```bash
cd server
npm install
npm run dev:ts
```

---

## Monitor OCR

Pilots download the Windows `.exe` from [GitHub Releases](https://github.com/Kehnte/circus-racing/releases) and their pre-filled `config.cfg` from their profile page.

See [`monitor/`](monitor/) for build instructions.

---

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/kehnte)
