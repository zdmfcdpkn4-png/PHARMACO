# PHARMACO

Outil complet de gestion de projet et d'équipe, fortement inspiré de Monday.com.

## Stack
- **Backend** : Node.js (Express) + PostgreSQL
- **Frontend** : React (Vite) + Tailwind CSS + Lucide React

## Structure du dépôt

```
.
├── server/      # API REST Express + PostgreSQL
│   ├── db/      # schema.sql + seed.sql
│   └── src/     # routes, controllers, middleware, db
└── client/      # application React (Vite) + Tailwind + Lucide
```

## Démarrage rapide

### Frontend seul (mode démo, sans base de données)

```bash
cd client
npm install
npm run dev   # http://localhost:5173 — données en mémoire
```

### Stack complète (avec PostgreSQL)

```bash
# 1) Backend
cd server
npm install
cp .env.example .env      # adapter la connexion PostgreSQL
npm run db:seed           # schéma + données de démo
npm run dev               # http://localhost:4000

# 2) Frontend branché sur l'API
cd ../client
npm install
cp .env.example .env      # mettre VITE_USE_MOCK=false
npm run dev
```

Voir [`server/README.md`](server/README.md) et [`client/README.md`](client/README.md) pour le détail.

## Fonctionnalités

- Multi-projets : tableau (colonnes redimensionnables), Kanban, calendrier,
  Gantt, planning dynamique, reporting, vue d'ensemble (cartes repliables).
- Projets personnalisables (couleur + vignette), archivage et suppression.
- Équipes & annuaire des agents, vue agent (tâches affectées par priorité),
  avatars personnalisés (initiales ou motifs, charte CHD).
- Discussions par tâche : @mentions, messages **ciblés** et **prioritaires**
  remontés sur la vue d'ensemble + cloche de notifications.
- Rôles admin / membre / observateur (suppression réservée aux admins) —
  matrice : [`docs/ROLES.md`](docs/ROLES.md).
- Authentification par jetons signés (`AUTH_SECRET` obligatoire en production).

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — guide de travail sur le dépôt (architecture, règles, pièges)
- [`CHARTE_GRAPHIQUE.md`](CHARTE_GRAPHIQUE.md) — palette CHD, statuts, typographie
- [`docs/DESIGN.md`](docs/DESIGN.md) — retravailler l'apparence sans casser le fonctionnel
- [`docs/DEPLOY-RASPBERRYPI.md`](docs/DEPLOY-RASPBERRYPI.md) & [`docs/INSTALL-PI.txt`](docs/INSTALL-PI.txt) — auto-hébergement
- `render.yaml` (Render) & `docker-compose.yml` (Docker) — autres déploiements
