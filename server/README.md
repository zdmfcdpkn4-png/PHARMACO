# PHARMACO — Backend (API)

API REST Express + PostgreSQL pour l'outil de gestion de projet/équipe (inspiré de Monday.com).

## Prérequis
- Node.js >= 18
- PostgreSQL >= 13

## Installation

```bash
cd server
npm install
cp .env.example .env   # puis adapter les variables
```

## Base de données

Connexion (ordre de priorité) : `SUPABASE_URL` (production — URL *session
pooler* Supabase, SSL auto), sinon `DATABASE_URL`, sinon variables `PG*`.
Déploiement complet : [`../docs/DEPLOY-SUPABASE.md`](../docs/DEPLOY-SUPABASE.md).

```bash
# Crée la base au préalable, ex :
createdb pharmaco

# Applique le schéma seul
npm run db:init

# Applique le schéma + données de démo (board "Suivi")
npm run db:seed
```

Les scripts SQL bruts sont dans `db/schema.sql` et `db/seed.sql`.

## Lancement

```bash
npm run dev    # mode watch
npm start      # production
```

L'API écoute par défaut sur `http://localhost:4000`.

## Modèle de données

| Table          | Description                                                        |
| -------------- | ----------------------------------------------------------------- |
| `users`        | Membres (id, name, email, avatar_url, role)                       |
| `workspaces`   | Espaces de travail                                                 |
| `boards`       | Tableaux d'un workspace                                            |
| `groups`       | Sections pliables d'un board (couleur, position)                   |
| `tasks`        | Tâches d'un groupe (nom, position)                                 |
| `task_columns` | Colonnes d'une tâche : admin assigné, statut (enum), échéance      |
| `alerts`       | Notifications (créées automatiquement sur statut « Bloqué »)      |

Statuts disponibles (`task_status`) : `À faire`, `En cours`, `Fait`, `Bloqué`.

## Endpoints

### Workspaces
- `GET    /api/workspaces`            — liste (avec nb de boards)
- `GET    /api/workspaces/:id`        — détail + boards
- `POST   /api/workspaces`            — créer

### Boards
- `GET    /api/boards?workspace_id=`  — liste
- `GET    /api/boards/:id`            — **tableau complet** (groupes -> tâches -> colonnes)
- `POST   /api/boards`                — créer
- `PATCH  /api/boards/:id`            — renommer / décrire
- `DELETE /api/boards/:id`            — supprimer

### Groups
- `POST   /api/groups`                — créer (position & couleur auto)
- `PATCH  /api/groups/:id`            — modifier (name, color, position)
- `DELETE /api/groups/:id`            — supprimer

### Tasks
- `POST   /api/tasks`                 — créer (crée aussi la ligne `task_columns`)
- `PATCH  /api/tasks/:id`             — modifier (name, status, admin_id, duedate, group_id, position)
- `DELETE /api/tasks/:id`             — supprimer

> Passer une tâche au statut `Bloqué` crée automatiquement une alerte
> de type `blocked` pour l'admin assigné.

### Users
- `GET    /api/users`                 — liste
- `GET    /api/users/:id`             — détail
- `POST   /api/users`                 — créer

### Alerts
- `GET    /api/alerts?user_id=&unread=true` — liste
- `PATCH  /api/alerts/:id/read`             — marquer comme lue
- `POST   /api/alerts/read-all`             — tout marquer comme lu (body: { user_id })

### Auth
- `POST   /api/auth/login`           — connexion (body: { email, password }) → { token, user }
  (le champ `user.must_change_password` impose un changement avant l'accès)
- `POST   /api/auth/change-password` — changer son propre mot de passe
  (body: { email, current_password, new_password }) → { token, user }
- `POST   /api/auth/set-password`    — réinitialiser le mot de passe d'un tiers
  (réservé admin ; impose un changement à la prochaine connexion)

> Compte de démonstration (après `db:seed`, **développement uniquement**) :
> **erwin.raingeard@gmail.com** / **pharmaco123**
> (tous les comptes de démo partagent ce mot de passe).
> En production, le compte admin initial est créé automatiquement au
> démarrage — voir `../docs/DEPLOY-SUPABASE.md` § 4.

### Health
- `GET    /api/health`
