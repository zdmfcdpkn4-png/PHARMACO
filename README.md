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

## Feuille de route
- [x] Étape 1 — Base de données (PostgreSQL) + structure API (Express)
- [x] Étape 2 — Frontend React (Sidebar, BoardHeader, GroupTable, TaskRow, StatusBadge, GroupSummary)
- [x] Étape 3 — CRUD, mises à jour optimistes, filtres, système d'alertes
