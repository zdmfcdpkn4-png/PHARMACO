# PHARMACO

Outil complet de gestion de projet et d'équipe, fortement inspiré de Monday.com.

## Stack
- **Backend** : Node.js (Express) + PostgreSQL
- **Frontend** : React (Vite) + Tailwind CSS + Lucide React *(étape suivante)*

## Structure du dépôt

```
.
├── server/      # API REST Express + PostgreSQL
│   ├── db/      # schema.sql + seed.sql
│   └── src/     # routes, controllers, middleware, db
└── client/      # application React (Vite) — étape suivante
```

## Démarrage rapide (backend)

```bash
cd server
npm install
cp .env.example .env
npm run db:seed   # schéma + données de démo
npm run dev
```

Voir [`server/README.md`](server/README.md) pour le détail de l'API.

## Feuille de route
- [x] Étape 1 — Base de données (PostgreSQL) + structure API (Express)
- [ ] Étape 2 — Frontend React (Sidebar, BoardHeader, GroupTable, TaskRow, StatusBadge)
- [ ] Étape 3 — Mises à jour optimistes, alertes temps réel
