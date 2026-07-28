# CLAUDE.md

Guide pour travailler sur ce dépôt. En cas de doute, ce fichier fait foi ;
s'il contredit le code, c'est le code qui a raison — signale-le et corrige ici.

## Ce qu'est PHARMACO

Outil de gestion de projet et d'équipe (inspiré de Monday.com) pour un service
de pharmacotechnie hospitalière (CHD). Multi-projets : tableau (colonnes
redimensionnables), Kanban, calendrier, Gantt, planning dynamique, reporting,
vue d'ensemble, vue agent, équipes/annuaire, messages ciblés/prioritaires,
alertes.

**Tout est en français** : interface, commentaires de code, messages de commit,
documentation, messages d'erreur API. Ne pas introduire d'anglais.

## Commandes

```bash
# Frontend (mode démo par défaut : données en mémoire, aucune base requise)
cd client && npm install && npm run dev        # http://localhost:5173
npm run build                                  # build de production (vérifie que ça passe !)

# Backend (nécessite PostgreSQL)
cd server && npm install
cp .env.example .env                           # adapter DATABASE_URL etc.
npm run db:seed                                # schéma + données de démo
npm run dev                                    # http://localhost:4000 (watch)

# Frontend branché sur l'API
cd client && VITE_USE_MOCK=false VITE_API_URL=http://localhost:4000/api npm run dev
```

**Il n'y a pas de suite de tests.** La validation = `npm run build` (client),
`node --check` (fichiers serveur modifiés), et vérification en navigateur
(Playwright ponctuel ou manuel). Ne pas inventer de commande `npm test`.

Comptes de démo (seed et mock, **développement uniquement**) :
`erwin.raingeard@gmail.com` (admin), `alice.martin@example.com`,
`bob.durand@example.com`, `chloe.petit@example.com` (membres) — mot de passe
commun : `pharmaco123` (`DEFAULT_PASSWORD`). **En production**, un amorçage
au démarrage (`server/src/db/bootstrap.js`) purge les comptes de test,
crée/répare le compte admin initial (`ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`)
et impose un changement de mot de passe à la première connexion
(`users.must_change_password`).

## Architecture

```
client/                    # React 18 + Vite 5 + Tailwind 3 + lucide-react
  design.tokens.js         # SOURCE UNIQUE du thème (couleurs, police) — consommé par tailwind.config.js
  src/api/
    index.js               # bascule mock/http via VITE_USE_MOCK (mock par défaut)
    mockApi.js             # implémentation en mémoire (mode démo)
    httpApi.js             # implémentation HTTP (VITE_API_URL, défaut http://localhost:4000/api)
  src/lib/constants.js     # STATUS_META / PRIORITY_META (bg + text), helpers dates, avatars
  src/lib/useColumnWidths.js  # largeurs de colonnes persistées par projet (localStorage)
  src/lib/useViewPreferences.js # préférences d'affichage du tableau (dont groupByStep)
  src/lib/steps.js         # circuit d'intervention : ordre, parenté, avancement
  src/components/          # ~40 composants (vues + cellules + modales)
  src/App.jsx              # GROS fichier : état global, handlers, rendus desktop ET mobile

server/                    # Express (ESM) + pg — API sous /api, santé : /api/health
  db/schema.sql            # schéma IDEMPOTENT (CREATE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS)
  db/seed.sql              # données de démo
  src/routes/ src/controllers/ src/middleware/ (auth, error) src/utils/ (authConfig, password)
```

### Circuit d'intervention (étapes et sous-étapes)

`intervention_steps` porte l'enchaînement **ordonné** des étapes d'un projet,
sur deux niveaux (`parent_id` : étape → sous-étape), et `task_step_progress`
trace leur franchissement (qui, quand). Une tâche pointe l'étape où elle en
est via `tasks.step_id` (idem `sub_tasks.step_id`).

- La hiérarchie est garantie **en base** : la clé étrangère est composite
  (`parent_id, board_id`) → une sous-étape ne peut pas appartenir à un autre
  projet que son étape parente.
- `client/src/lib/steps.js` est la **source unique** de l'ordre de parcours :
  le stepper (`StepProgress.jsx`), le regroupement en accordéon
  (`GroupTable.jsx`) et les compteurs s'en servent tous.
- **Cohabitation** : les étiquettes `project_tags` (colonnes Étape / Type)
  restent en place et fonctionnelles. Le circuit est un **ajout**, pas un
  remplacement. Les étiquettes existantes ont été reprises une seule fois par
  projet comme étapes de niveau 1 (marqueur `boards.steps_seeded_at`,
  correspondance conservée dans `intervention_steps.legacy_tag_id`).
- **Piège** : le mode « Grouper par étape » repartitionne les lignes, donc
  `dragEnabled` le désactive — comme il le fait déjà pour un filtre ou un tri
  (`handleDragEnd` raisonne sur les index de `group.tasks` brut).

### Règle d'or : toute fonctionnalité de données = 4 endroits

1. `server/db/schema.sql` — migration **idempotente** (`ADD COLUMN IF NOT EXISTS`…),
   appliquée automatiquement au démarrage de l'API (`RUN_MIGRATIONS` ≠ `false`).
2. `server/src/controllers/` + `src/routes/` — l'endpoint.
3. `client/src/api/httpApi.js` — l'appel HTTP.
4. `client/src/api/mockApi.js` — le **même comportement en mémoire** (le mode
   démo doit rester fonctionnel à l'identique).

Oublier le mock est le bug le plus fréquent : l'app paraît marcher en local
(mock) et échoue en prod, ou l'inverse.

### App.jsx : desktop ET mobile

`App.jsx` contient **deux rendus** (branche `if (isMobile)` + rendu desktop).
`Sidebar`, `OverviewView`, `TeamsView`… sont instanciés **deux fois**. Toute
nouvelle prop/handler doit être passée **aux deux instances**, sinon la
fonctionnalité manquera sur mobile (ou l'inverse).

Le choix mobile/desktop est fait par `src/lib/useIsMobile.js` selon le
**type d'appareil** (pointeur tactile + petit côté de l'écran), pas la seule
largeur : téléphone → toujours interface mobile (même en paysage) ; tablette
→ mobile en portrait (< 1024 px), bureau en paysage ; ordinateur → mobile
sous 768 px. Ne pas utiliser de `md:hidden`/`lg:hidden` pour masquer un
composant propre à un mode : c'est la branche d'App.jsx qui décide.

### Mises à jour optimistes

Les mutations du tableau passent par le helper `optimistic()` d'App.jsx :
mise à jour immédiate de l'état, appel API ensuite, rollback si échec. Suivre
ce motif pour les nouvelles mutations.

## Rôles et sécurité

Trois rôles globaux : `admin`, `member`, `viewer`. Matrice complète :
`docs/ROLES.md`. À retenir :

- **Toute suppression (tâche, sous-item, groupe, projet) = admin uniquement**
  (`canDeleteTask`, `canDeleteGroup` côté UI ; `requireAdmin` côté serveur).
- `viewer` = lecture seule (`canEdit` false côté UI ; `requireEditor` refuse
  ses mutations côté serveur).
- Structure (groupes, colonnes, équipes du projet) : propriétaire du projet ou admin.
- **La sécurité réelle est côté serveur** (middlewares `requireAuth` sur
  toutes les routes, `requireEditor` sur les mutations, `requireAdmin` sur
  les suppressions/archivage — `server/src/middleware/auth.js`) ; les
  masquages UI ne sont qu'un confort. Toute nouvelle route doit être
  protégée serveur, pas seulement cachée.

Authentification : jetons HMAC signés avec `AUTH_SECRET`
(`server/src/utils/authConfig.js`). **En production, le serveur refuse de
démarrer sans `AUTH_SECRET`** (échappatoire explicite : `ALLOW_INSECURE_AUTH=true`).
`POST /auth/set-password` (réinitialisation d'un tiers) est réservé aux admins
et déclenche `must_change_password` ; `POST /auth/change-password` (son propre
mot de passe, vérifié par l'actuel) est ouvert et lève ce verrou. La page de
connexion enchaîne automatiquement sur l'écran « nouveau mot de passe » quand
le serveur renvoie `must_change_password`.

## Thème et design

- **Charte CHD** : bleu `#005586` + rose `#E82A63` (majoritaires), teal
  `#46B4B3` + jaune `#F4C137` (accents). Fond `#eef4f8`. Police Figtree.
- **Source unique** : `client/design.tokens.js` (consommé par
  `tailwind.config.js`). Pour re-thémer, modifier CE fichier — pas les
  composants. Guide complet : `docs/DESIGN.md`.
- Statuts/priorités : `STATUS_META` / `PRIORITY_META` dans
  `client/src/lib/constants.js` portent `bg` **et** `text` (texte foncé sur le
  jaune clair). Toute pastille doit utiliser les deux — jamais `text-white` en dur.
- Avatars : `Avatar.jsx` rend image, initiales, ou avatar floral généré
  (`PharmacoAvatar.jsx`) selon `avatar_url` (`pharmaco:<palette>` ou
  `pharmaco:<palette>:<icône>`).

## Variables d'environnement

Serveur (`server/.env`, voir `.env.example`) :
- `SUPABASE_URL` (**production** : URL PostgreSQL Supabase en mode
  *session pooler*, prioritaire, SSL auto) ; sinon `DATABASE_URL` ou
  variables `PG*` (dev local). `PGSSL` : `true` (forcer) / `false` (locale) /
  vide (auto : activé avec `SUPABASE_URL` ou si `sslmode=require` dans l'URL).
- `AUTH_SECRET` (**obligatoire en prod**), `CLIENT_ORIGIN` (CORS, défaut `*`),
  `PORT` (défaut 4000), `RUN_MIGRATIONS` (défaut actif), `DEFAULT_PASSWORD`.
- Amorçage production (voir plus haut) : `ADMIN_EMAIL`, `ADMIN_NAME`,
  `ADMIN_INITIAL_PASSWORD`.

Client — **figées AU BUILD** (changer = rebuilder) :
- `VITE_USE_MOCK` (`true` par défaut → mode démo), `VITE_API_URL`.

## Déploiement

Une seule voie documentée — ne pas en inventer d'autres :
**Render (app) + Supabase (base de données)** — guide complet :
`docs/DEPLOY-SUPABASE.md`.
- `render.yaml` : 2 services (`pharmaco-api`, `pharmaco-web`), pas de base
  Render. `AUTH_SECRET` auto-généré.
- La base est un PostgreSQL managé Supabase, atteint via `SUPABASE_URL`
  (URL **session pooler**, seule compatible IPv4 depuis Render). Le schéma
  est appliqué automatiquement au démarrage de l'API (idempotent).

**Branches** : `claude/zen-ritchie-mpOku` est la branche par défaut ; `main`
est maintenue alignée dessus (`git branch -f main <branche> && git push origin main`)
car des déploiements peuvent suivre l'une ou l'autre. Après un push, pousser
**les deux**.

## Pièges connus

- `VITE_API_URL`/`VITE_USE_MOCK` figés au build → « ça marche en local mais
  pas en prod » = souvent un build avec les mauvaises valeurs.
- `PGSSL=false` avec une base hébergée (Supabase, Neon) → échec de connexion ;
  ces bases exigent SSL.
- Supabase : la **connexion directe** (`db.<ref>.supabase.co`) est IPv6-only
  et injoignable depuis Render → toujours utiliser l'URL *session pooler*
  (`*.pooler.supabase.com:5432`, utilisateur `postgres.<ref>`).
- Colonnes du tableau : largeur via `useColumnWidths` — en-tête (`GroupTable`)
  et cellules (`TaskRow`) doivent utiliser la même clé de colonne.
- `getBoards()` masque les projets archivés par défaut
  (`include_archived=true` pour tout avoir).
- Base hébergée : aligner la version du client `pg_dump` sur celle du serveur
  (Render est en PostgreSQL 18).

## Documentation du dépôt

| Fichier | Contenu |
|---|---|
| `docs/ROLES.md` | Matrice des droits admin / membre / observateur |
| `docs/DESIGN.md` | Retravailler l'apparence sans casser le fonctionnel |
| `docs/DEPLOY-SUPABASE.md` | Déploiement Render + Supabase (pas-à-pas, dépannage) |
| `CHARTE_GRAPHIQUE.md` | Charte CHD (palette, logo, typo) |

Quand une évolution rend un de ces fichiers (ou celui-ci) inexact,
**mettre à jour la doc dans le même commit**.
