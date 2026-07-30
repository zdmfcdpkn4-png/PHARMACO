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
  src/lib/activity.js      # journal d'activité : libellés et horodatages (source unique)
  src/lib/useIsMobile.js   # useIsMobile (quelle interface) + useIsCoarsePointer (cible au doigt)
  src/components/          # ~40 composants (vues + cellules + modales)
  src/App.jsx              # GROS fichier : état global, handlers, rendus desktop ET mobile

server/                    # Express (ESM) + pg — API sous /api, santé : /api/health
  db/schema.sql            # schéma IDEMPOTENT (CREATE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS)
  db/seed.sql              # données de démo
  src/routes/ src/controllers/ src/middleware/ (auth, error, rateLimit)
  src/utils/               # authConfig, password, journal (auteur des entrées d'activité)
```

### Circuit d'intervention (étapes, sous-étapes, sous-sous-étapes)

`intervention_steps` porte l'enchaînement **ordonné** des étapes d'un projet,
sur **trois niveaux** (`parent_id` : étape → sous-étape → sous-sous-étape), et
`task_step_progress` trace leur franchissement (qui, quand). Une tâche pointe
l'étape où elle en est via `tasks.step_id` (idem `sub_tasks.step_id`).

- La hiérarchie est garantie **en base** : la clé étrangère est composite
  (`parent_id, board_id`) → une sous-étape ne peut pas appartenir à un autre
  projet que son étape parente.
- La **profondeur**, elle, n'est pas exprimable en contrainte SQL simple :
  elle est tenue par `steps.controller.js`. `assertParentValide` remonte la
  chaîne d'ancêtres (CTE récursive) et vérifie que le **sous-arbre déplacé**
  tient encore dans la limite ; `reorderSteps` revalide l'arbre entier après
  coup. Les deux détectent aussi les cycles. `mockApi.js` reproduit ces règles
  à l'identique.
- `client/src/lib/steps.js` est la **source unique** de l'ordre de parcours :
  le stepper (`StepProgress.jsx`), le regroupement en accordéon
  (`GroupTable.jsx`) et les compteurs s'en servent tous. `rootStepOf` remonte
  **toute** la chaîne (une sous-sous-étape se regroupe sous son étape racine,
  pas sous sa sous-étape).
- La configuration du circuit vit dans `StepEditor.jsx`, hébergé par
  `RailPanel` — monté dans les **deux** branches d'App.jsx : colonne latérale
  sur ordinateur, superposition plein écran sur mobile (`variante="mobile"`).
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

**Exemple vécu** : les actions de projet (renommer, personnaliser, archiver,
supprimer) ne vivaient que dans le menu de `BoardHeader`, monté uniquement côté
bureau → un projet ne pouvait pas être supprimé depuis un téléphone. Leur
pendant mobile est `ProjectActionsSheet.jsx`, ouvert depuis le titre de
`MobileHeader`. Les gardes des deux menus doivent rester identiques (renommer =
tout éditeur, personnaliser = propriétaire ou admin, archiver/supprimer = admin),
et calées sur le serveur — c'est lui qui tranche.

Autre exemple : `RailPanel` (agents, étiquettes, **circuit d'intervention**)
n'existait que côté bureau — la configuration des étapes était donc
inatteignable depuis un téléphone. Il est désormais monté dans les deux
branches, avec `variante="mobile"` pour le rendu plein écran.

Corollaire : ne **jamais** répondre à une suppression par `window.location.reload()`.
Au redémarrage, l'effet de chargement recrée automatiquement un projet « Suivi »
quand la base est vide (`App.jsx`) : la suppression du dernier projet semblait
donc échouer. Le bon chemin est l'écran « Aucun projet » (`noProjects`), qui
propose d'en recréer un.

### Cible tactile : `useIsCoarsePointer`, pas `useIsMobile`

Deux questions différentes, deux crochets. `useIsMobile()` répond « quelle
interface servir ? » (elle pilote la branche d'App.jsx). `useIsCoarsePointer()`
(même fichier) répond « la cible est-elle atteignable **au doigt** ? » — c'est
le seul média `(pointer: coarse)`, sans seuil de largeur. Une **tablette en
paysage** reçoit l'interface bureau tout en étant pilotée au doigt : elle a
besoin de grandes cibles, pas d'une mise en page mobile.

**Exemple vécu** : le sélecteur d'assignation (`AdminCell`) s'ouvrait en
popover flottant de 224 px, avec des cases à cocher de 16 px, **positionné en
absolu dans un conteneur défilant** (la fiche de tâche) et sans autre retour
que le survol — inutilisable au doigt. Sur pointeur grossier il s'ouvre
désormais en `BottomSheet` : rangées de 48 px, cases de 24 px, retour `active:`.
Le popover bureau est conservé tel quel. Sa fermeture au clic extérieur écoute
`pointerdown` (souris, stylet **et** tactile d'une seule écoute) et non plus
`mousedown`, qui n'est qu'émulé sur tactile.

Règle générale : toute commande interactive doit offrir **44 px** au moins sur
pointeur grossier — au besoin en élargissant la zone de tap sans bouger la mise
en page (`-m-2 p-2`).

### Mises à jour optimistes

Les mutations du tableau passent par le helper `optimistic(mutator, apiCall,
secours)` d'App.jsx : mise à jour immédiate de l'état, appel API ensuite,
retour arrière si échec. **Suivre ce motif pour toute nouvelle mutation** —
ne jamais faire son retour arrière à la main, et ne jamais avaler l'erreur.

- L'instantané est lu depuis `boardRef`, **hors** de l'updater `setState` :
  lire une variable renseignée dans un updater n'est pas fiable (React peut
  différer son exécution, et `<React.StrictMode>` la double en développement).
- Si d'autres mutations ont eu lieu entre-temps, restaurer l'instantané les
  effacerait : le helper recharge alors le projet depuis le serveur.
- `optimisteListe(setEtat, instantane, mutator, apiCall, secours)` fait la même
  chose pour les états de liste hors `board` (raccourcis, équipes…).
- Les messages d'erreur passent par `signalerErreur(e, secours)` : **un seul
  minuteur**, sinon deux erreurs successives s'effacent mutuellement. Ils sont
  rendus par un `BandeauErreur` unique par branche, porteur de `role="alert"`.
- `BandeauErreur` est **flottant** (`fixed`, `z-[80]`). Dans le flux, il était
  recouvert par la fiche de tâche (`z-50`) et par les feuilles inférieures
  (`z-60`) : un échec déclenché depuis la fiche ne laissait **aucune trace à
  l'écran**, la mise à jour optimiste revenait en arrière et l'utilisateur
  concluait que « le bouton ne marche pas ». Tout nouveau calque doit rester
  sous ce niveau.
- `httpApi` traduit l'échec réseau de `fetch` (« Failed to fetch ») en une
  phrase française exploitable : ce message-là finit sous les yeux de
  l'utilisateur.

**Création optimiste** : `handleAddTask` insère la tâche avec un id temporaire
(`tmp-…`) puis le remplace par celui du serveur. Une fiche ouverte **avant** la
réponse pointerait sinon l'id temporaire, et toutes ses actions échoueraient —
scénario courant au doigt, sur une API qui se réveille. `detailTask` et
`drawerTask` sont donc recalés sur la tâche réelle (et refermés si la création
échoue).

### Chargement différé (React.lazy)

Les dix vues secondaires sont chargées à la demande. **Piège** : ne jamais
placer une frontière `<Suspense>` entre un `DragDropContext` et ses
`Droppable`/`Draggable` — `GroupTable` doit donc rester un import **statique**.
`KanbanView` porte son propre `DragDropContext`, entièrement contenu dans son
morceau : son chargement différé est sans risque.

Chaque branche de rendu d'`App.jsx` a **sa propre** frontière `<Suspense>`, dont
le repli est un écran fantôme (`Skeleton.jsx`, gabarit choisi selon l'appareil).

**Piège vécu** : une vue paresseuse rendue HORS de toute frontière lève
« A component suspended while responding to synchronous input » et casse
l'écran au changement d'onglet. C'était le cas de `KanbanView` et
`CalendarView` dans la branche mobile : chaque onglet du tableau mobile porte
désormais sa propre frontière.

## Rôles et sécurité

Trois rôles globaux : `admin`, `member`, `viewer`. Matrice complète :
`docs/ROLES.md`. À retenir :

- **Toute suppression (tâche, sous-item, groupe, projet) = admin uniquement**
  (`canDeleteTask`, `canDeleteGroup` côté UI ; `requireAdmin` côté serveur).
- **L'archivage d'une TÂCHE est ouvert aux éditeurs** (`tasks.archived`, via
  `PATCH /tasks/:id` sous `requireEditor`) : une tâche créée par erreur doit
  pouvoir être rangée sans attendre un administrateur. C'est la seule
  exception ; l'archivage d'un **projet** reste admin, comme sa suppression.
- `viewer` = lecture seule (`canEdit` false côté UI ; `requireEditor` refuse
  ses mutations côté serveur).
- Structure (groupes, colonnes, équipes du projet) : propriétaire du projet ou admin.
- **La traçabilité d'une tâche est réservée aux admins** : `activity_log` est
  une donnée de contrôle, pas de travail (voir la section suivante).
- **La sécurité réelle est côté serveur** (middlewares `requireAuth` sur
  toutes les routes, `requireEditor` sur les mutations, `requireAdmin` sur
  les suppressions/archivage — `server/src/middleware/auth.js`) ; les
  masquages UI ne sont qu'un confort. Toute nouvelle route doit être
  protégée serveur, pas seulement cachée.

### Traçabilité des tâches (`activity_log`)

Qui a changé quoi, et quand. Une entrée par changement significatif ; c'est la
matière de la section repliable **« Traçabilité des modifications »** de la
fiche de tâche (`TaskAuditTrail.jsx`) et de l'onglet « Historique » du tiroir
de discussion (`TaskDrawer.jsx`).

- **Réservée aux administrateurs**, des deux côtés :
  `GET /tasks/:id/activity` est sous `requireAdmin`, et les deux affichages
  sont masqués aux autres. Le tiroir ne **demande** même pas le journal pour un
  non-admin, sinon ouvrir une discussion se solderait par un 403.
- **Repliée par défaut**, et le journal n'est demandé qu'à la première
  ouverture : la fiche s'ouvre depuis toutes les vues, elle n'a pas à porter un
  appel réseau de plus pour un contenu rarement consulté.
- **L'auteur vient du jeton**, pas du corps de la requête : `auteurDe(req,
  actor_id)` (`server/src/utils/journal.js`) préfère `req.user.id` à
  l'`actor_id` envoyé par le client — sans quoi n'importe qui pourrait signer
  une modification du nom d'un autre. Le corps ne sert que de secours pour
  l'outillage sans jeton.
- **On journalise des NOMS, jamais des identifiants** (`nomDe` côté serveur,
  `nomGroupe` / `nomEtape` / `nomEtiquette` côté mock) : la trace doit rester
  lisible après renommage ou suppression de la référence.
- Types couverts : `created`, `name`, `status`, `priority`, `duedate`,
  `start_date`, `admin`, `assignees`, `group`, `step`, `etape_tag`,
  `intervention_tag`, `archived`. **Ajouter un champ modifiable = ajouter son
  entrée**, dans `tasks.controller.js` *et* dans `mockApi.js`, et son libellé
  dans `client/src/lib/activity.js` — source unique des phrases, partagée par
  les deux affichages.

### Accès direct à la base : la RLS n'est pas optionnelle

Un projet Supabase publie **automatiquement** une API REST (PostgREST) sur
`https://<ref>.supabase.co/rest/v1/`, ouverte avec la clé `anon` — clé
**publique par conception**. Sans *Row-Level Security*, cette API donne un
accès complet en lecture **et en écriture** à toutes les tables de `public`,
en court-circuitant l'API Express et tous ses contrôles de rôles.
`users.password_hash` comprise.

Le dernier bloc de `server/db/schema.sql` verrouille cela, et **doit rester
le dernier** (il balaie les tables créées plus haut) :

1. `ENABLE ROW LEVEL SECURITY` sur **toutes** les tables de `public`, sans
   aucune politique → tout est refusé par défaut. Le propriétaire des tables
   (le rôle qui exécute la migration, donc celui de l'API) n'y est pas soumis
   tant que `FORCE ROW LEVEL SECURITY` n'est pas posé : **aucun impact
   fonctionnel**. Vérifié avec un propriétaire non-superutilisateur.
2. Retrait de tous les droits de `anon` et `authenticated` (ceinture et
   bretelles ; ces rôles n'existent pas sur une base locale, le bloc les
   ignore alors).

**Toute nouvelle table hérite du verrou** au redémarrage suivant de l'API.
Ne jamais créer de politique RLS « pour faire marcher quelque chose » : le
client ne parle jamais à Supabase directement, tout passe par l'API Express.

Authentification : jetons HMAC signés avec `AUTH_SECRET`
(`server/src/utils/authConfig.js`). **En production, le serveur refuse de
démarrer sans `AUTH_SECRET`** (échappatoire explicite : `ALLOW_INSECURE_AUTH=true`).
Les deux routes où un mot de passe peut être deviné (`/auth/login` et
`/auth/change-password`) sont limitées en débit par
`server/src/middleware/rateLimit.js` : 8 échecs par compte et 40 par adresse IP
sur 10 minutes, puis `429` + `Retry-After`. **Seuls les échecs sont comptés**,
donc l'usage normal n'est jamais ralenti. Compteurs en mémoire : ils repartent
à zéro au redémarrage et ne sont pas partagés entre instances — c'est un
ralentisseur, assumé comme tel. `app.set('trust proxy', 1)` est indispensable :
sans lui, `req.ip` vaut l'adresse du proxy Render et tout le monde partage le
même compteur.

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
