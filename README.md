# Circus Racing

Plateforme de gestion de course en temps réel et d'overlays de streaming pour les événements **Star Citizen**. Un serveur Node.js centralise l'état de la course, le distribue via Socket.IO aux overlays OBS, et expose une API REST pilotée par le dashboard admin.

---

## Structure du repo

```
circus-racing/
├── server/                  ← Serveur Node.js (API REST + Socket.IO + Dashboard + Pilot app)
│   ├── src/                 ← Code TypeScript compilé (API, moteur de course, DB, socket)
│   ├── dashboard/           ← Interface admin (HTML/JS vanilla)
│   ├── pilot-app/           ← Interface pilote (inscription, profil, config OCR)
│   ├── overlays/            ← Browser sources OBS (leaderboard, race-alert)
│   └── shared/              ← Nav commune dashboard/pilot-app
├── monitor/                 ← Client OCR Windows (.exe) — lit les coords Star Citizen
├── scripts/                 ← Seed, reset DB, simulation de courses
├── docs/                    ← Spécifications
├── .github/workflows/
│   ├── server-docker.yml    ← Build et push de l'image Docker sur changement server/
│   └── monitor-release.yml  ← Build et publication du .exe sur changement monitor/
├── docker-compose.yml
└── .env.example
```

---

## Quick start (Docker)

```bash
cp .env.example .env
# Éditer .env — définir JWT_SECRET et DATABASE_URL
docker compose up -d
```

Serveur disponible sur `http://localhost:3000`.

---

## Dev local

```bash
cd server
npm install
npm run dev:ts
```

---

## Stack technique

| Couche | Techno |
|--------|--------|
| Serveur | Node.js, Express |
| Temps réel | Socket.IO |
| Base de données | SQLite via Drizzle ORM |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Frontend | HTML/CSS/JS vanilla, Material Web Components |
| Overlays | HTML/CSS/JS léger (browser source OBS) |
| OCR client | Python (PyInstaller → .exe Windows) |
| CI/CD | GitHub Actions |

---

## Comptes et rôles

### Premier démarrage

La base de données est vide. Lancer le script de seed pour créer des données de test (pilotes, teams, courses) :

```bash
cd scripts
node seed.js
```

Le script affiche les `displayName` et mots de passe de tous les pilotes créés. Le premier pilote est `ADMIN`.

Pour repartir de zéro :

```bash
node reset.js
```

### Rôles

| Rôle | Accès |
|------|-------|
| `ADMIN` | Tout + gestion des rôles utilisateurs (promouvoir/rétrograder) |
| `MODERATOR` | Tout sauf gestion des rôles |
| `PILOT` | Pilot app uniquement (profil, inscriptions, config OCR) |

Le login se fait par `displayName` + `password` (pas d'email). Si un pilote perd son mot de passe, un admin/modo le réinitialise via le dashboard.

---

## Utilisation — Workflow typique

1. **Créer les entités** dans le dashboard : teams, vehicles, controls, circuits (racetracks)
2. **Créer une course** : nom, mode de tracking (MANUEL ou AUTO), circuit, session, météo, type de départ, mode (tours ou temps)
3. **Ouvrir les inscriptions** → la course passe en `SCHEDULED`
4. **Les pilotes s'inscrivent** via la pilot-app (`/pilot-app/`)
5. **Valider les inscriptions** dans le dashboard, ordonner la grille
6. **Ajouter les overlays dans OBS** :
   - Leaderboard : `http://localhost:3000/overlays/leaderboard/`
   - Race alert : `http://localhost:3000/overlays/race-alert/`
7. **Charger la course** (`Load`) → les pilotes apparaissent dans les overlays
8. **Lancer le countdown** puis **Start race**
9. En mode MANUEL : incrémenter les tours, ajuster les positions, marquer les DNF
10. En mode AUTO : les monitors OCR des pilotes poussent leurs positions, le moteur calcule tout automatiquement
11. **Finish** → résultats persistés, leaderboard figé

---

## Monitor OCR

Les pilotes téléchargent le `.exe` Windows depuis [GitHub Releases](https://github.com/Kehnte/circus-racing/releases) et leur `config.cfg` pré-rempli depuis leur page profil.

Le monitor lit les coordonnées du joueur dans Star Citizen et les envoie au serveur toutes les ~2 secondes via un token unique (1 token = 1 pilote).

Voir [`monitor/`](monitor/) pour les instructions de build.

---

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3000` | Port d'écoute du serveur |
| `DATABASE_URL` | `file:./db/circus.db` | Chemin du fichier SQLite |
| `JWT_SECRET` | *(obligatoire)* | Clé de signature des tokens JWT — générer avec `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `DNF_BUFFER_RADIUS` | `500` | Rayon (unités Star Citizen) du buffer géographique DNF en mode AUTO. Peut être surchargé par circuit. |
| `OCR_POLL_MS` | `2000` | Intervalle entre les pushs de position du monitor OCR (ms) |

---

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/kehnte)
