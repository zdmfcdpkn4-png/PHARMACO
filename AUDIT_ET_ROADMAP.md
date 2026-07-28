# PHARMACO — Audit d'architecture et feuille de route

**Date :** juillet 2026
**Périmètre :** intégralité du dépôt — 41 composants React, 15 contrôleurs, 11 routeurs, 22 tables.
**Référentiel de comparaison :** Monday.com.
**Méthode :** lecture exhaustive du code. Chaque constat est référencé en `fichier:ligne`.

> Ce document est un état des lieux, pas un changement de code. Les chiffres
> ont été mesurés sur le dépôt à la date ci-dessus et deviendront inexacts au
> fur et à mesure des corrections — voir [Suivi du document](#suivi-du-document).

---

## Table des matières

1. [Bilan de l'existant](#1-bilan-de-lexistant)
   - [1.1 Synthèse](#11-synthèse)
   - [1.2 Diagnostic technique](#12-diagnostic-technique)
   - [1.3 Modèle de données](#13-modèle-de-données)
   - [1.4 Efficacité du code](#14-efficacité-du-code)
   - [1.5 Évaluation fonctionnelle face à Monday.com](#15-évaluation-fonctionnelle-face-à-mondaycom)
   - [1.6 Bugs confirmés](#16-bugs-confirmés)
2. [Pistes d'optimisation et fonctionnalités clés](#2-pistes-doptimisation-et-fonctionnalités-clés)
3. [Plan de développement (roadmap)](#3-plan-de-développement-roadmap)

---

# 1. Bilan de l'existant

## 1.1 Synthèse

PHARMACO est un **produit fonctionnel et cohérent**, pas un prototype. Il couvre
un périmètre que beaucoup d'outils internes n'atteignent jamais : neuf vues
métier, un Gantt réellement interactif avec dépendances et détection de cycle
côté serveur, une messagerie ciblée avec suivi lu/non-lu, un mode démo autonome,
une charte graphique appliquée avec discipline, une interface mobile pensée par
type d'appareil, et un déploiement production documenté de bout en bout.

Les fondations sont saines. Les limites tiennent à quatre choix qui étaient
raisonnables au démarrage et qui deviennent contraignants maintenant que l'outil
est en production :

| Choix initial | Bénéfice obtenu | Coût qui apparaît maintenant |
|---|---|---|
| Tout l'état applicatif dans `App.jsx` | Vitesse de développement, zéro cérémonie | 2 164 lignes, 34 `useState`, 66 handlers, re-rendu global à chaque frappe |
| Colonnes métier figées dans le schéma | Requêtes simples, typage SQL réel | Ajouter un statut = 1 migration + ~10 fichiers + 2 déploiements |
| Chargement intégral du projet, jamais rafraîchi | Code trivial, latence nulle en local | Aucune collaboration temps réel, écrasement silencieux entre utilisateurs |
| Filtrage et recherche 100 % côté client | Réactivité immédiate à petite échelle | Plafond de volumétrie ; le navigateur télécharge tout le projet |

Aucun de ces quatre points n'est un défaut de conception : ce sont des dettes
assumées, dont la roadmap propose l'amortissement progressif, sans réécriture.

**Trois constats méritent d'être traités avant tout le reste :**

1. Il n'existe **aucun test automatisé** dans le dépôt, et l'application est en
   production avec de vrais utilisateurs.
2. Deux fonctionnalités sont **devenues inatteignables** depuis l'interface —
   dont la suppression et la recoloration des étiquettes Étape/Type
   (§[1.6](#16-bugs-confirmés)).
3. Une poignée de correctifs de **quelques lignes chacun** débloquent des gains
   disproportionnés : deux imports à rendre dynamiques divisent le bundle par
   ~2,5 ; une `Map` supprime ~9 millions de comparaisons par rendu ; huit `CREATE
   INDEX` suppriment des balayages complets de table.

---

## 1.2 Diagnostic technique

### Stack

| Couche | Technologie | Version | Appréciation |
|---|---|---|---|
| Frontend | React + Vite + Tailwind | 18.3 / 5 / 3 | Moderne, sobre, sans surcouche inutile |
| Icônes | `lucide-react` | 0.441 | 126 icônes distinctes, 38 fichiers, tree-shaking correct |
| Drag & drop | `@hello-pangea/dnd` | 16.6 | Fork maintenu de `react-beautiful-dnd`, bon choix |
| Graphiques | `recharts` | 2.15 | Lourd, chargé au démarrage (§1.4) |
| Export | `jspdf`, `jspdf-autotable`, `html-to-image` | — | Imports dynamiques présents mais **neutralisés** (§1.4) |
| Dates | `date-fns` (locale `fr`) | 3.6 | Excellent choix, tree-shakable |
| Backend | Express (ESM) + `pg` | 4 / — | **Pas d'ORM** : SQL écrit à la main, propre |
| Base | PostgreSQL managé Supabase | 15+ | Session pooler, SSL auto |
| Hébergement | Render (2 services web) | — | `render.yaml` versionné |
| État client | `useState` local dans `App.jsx` | — | Aucune librairie d'état, aucun Context |
| Typage | Aucun | — | Ni TypeScript, ni PropTypes, ni JSDoc, **ni ESLint** |
| Tests | **Aucun** | — | Ni unitaire, ni intégration, ni E2E |

### Volumétrie

```
client/src        12 676 lignes    41 composants   169 useState (tous fichiers)
server/src         2 686 lignes    15 contrôleurs, 11 routeurs, 49 endpoints
server/db/schema.sql  ~480 lignes   24 tables, 5 énumérations, 26 index
```

Les plus gros fichiers concentrent le risque de maintenance :

| Fichier | Lignes | Rôle |
|---|---|---|
| `client/src/App.jsx` | 2 164 | État global, 66 handlers, rendu desktop **et** mobile, export CSV/PDF |
| `client/src/api/mockApi.js` | 1 083 | Réimplémentation complète de l'API en mémoire |
| `client/src/components/Sidebar.jsx` | 623 | Navigation, projets, archives, équipes, raccourcis |
| `client/src/components/GanttChartView.jsx` | 621 | Gantt interactif |
| `client/src/components/OverviewView.jsx` | 583 | Vue d'ensemble multi-projets |
| `client/src/components/ReportingView.jsx` | 534 | 5 graphiques + exports PNG/PDF |

Le composant `Board` d'`App.jsx` fait à lui seul **2 073 lignes** (`App.jsx:92-2164`).

### Ce qui est solide

**1. Aucune injection SQL.** Les dix sites d'interpolation de chaîne dans du SQL
n'interpolent que des **constantes littérales** — jamais de donnée utilisateur.
Les clauses `WHERE` dynamiques construisent les placeholders par index
(`` `workspace_id = $${params.length}` ``, `boards.controller.js:10`), pas par
valeur. Toutes les requêtes sont paramétrées. C'est irréprochable, et c'est à
préserver explicitement lors de l'ajout du tri serveur — la tentation d'interpoler
`req.query.sort` sera forte.

**2. `getBoardFull` est à cardinalité constante.** `boards.controller.js:26-239`
charge un projet complet en **11 à 12 requêtes**, quel que soit le nombre de
tâches — pas de N+1. Le regroupement se fait en mémoire avec des `Map`. C'est le
bon patron, et il est rare.

**3. Le contrat mock / HTTP est réellement tenu.** `client/src/api/index.js`
bascule selon `VITE_USE_MOCK` ; les deux implémentations exposent la même
surface et les mêmes validations, jusqu'aux alertes générées par les mentions
(`mockApi.js:893-947` ≡ `comments.controller.js:168-222`). L'application est
donc **démontrable sans base de données** — un atout réel pour une présentation
en service hospitalier, et une discipline coûteuse qui a été tenue.

**4. La sécurité est côté serveur.** `requireAuth` / `requireEditor` /
`requireAdmin` (`server/src/middleware/auth.js`) protègent réellement les 49
endpoints ; les masquages d'interface ne sont qu'un confort. `asyncHandler` est
appliqué aux 15 contrôleurs sans exception — aucune promesse non capturée. Le
hachage est en scrypt avec comparaison à temps constant (`utils/password.js:20`),
et le serveur **refuse de démarrer en production sans `AUTH_SECRET`**
(`utils/authConfig.js:21-44`).

**5. Les migrations sont idempotentes et automatiques.** Uniquement
`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` et des blocs `DO $$`
gardés par `pg_enum`. Redéployer ne casse jamais la base ; une base neuve se
construit seule — ce qui a permis la mise en production sur Supabase sans étape
manuelle.

**6. Les transactions sont correctement posées** sur les 13 opérations
composites (`createTask`, `updateTask`, `reorderTasks`, `createBoard`,
`setTeamMembers`, `createComment`, `createDependency`…), et les suppressions en
cascade sont déléguées au SGBD via `ON DELETE CASCADE` — donc **atomiques par
construction**. Le patron `unnest()` pour les écritures en masse est déjà
maîtrisé (`tasks.controller.js:337-348`).

**7. Le thème a une source unique.** `client/design.tokens.js` alimente
`tailwind.config.js`. `STATUS_META` / `PRIORITY_META` portent `bg` **et** `text`,
et `textColorFor()` calcule le contraste des couleurs libres.

**8. L'adaptation mobile raisonne par type d'appareil, pas par largeur.**
`useIsMobile.js` combine `pointer: coarse` et le petit côté de l'écran, et le
choix est fait par branchement dans `App.jsx` plutôt que par des `md:hidden`.

**9. Le Gantt est la vue la plus aboutie.** Déplacement et redimensionnement par
*pointer events*, création de dépendances au glisser, flèches SVG cliquables
pour suppression, **décalage en cascade des successeurs côté serveur**
(`tasks.controller.js:73-120`) et **détection de cycle** (`dependencies.controller.js:20-40`).

**10. La documentation fait autorité.** `CLAUDE.md`, `docs/ROLES.md`,
`docs/DESIGN.md`, `docs/DEPLOY-SUPABASE.md` documentent les pièges du dépôt
(variables `VITE_*` figées au build, IPv6-only de la connexion directe Supabase,
duplication desktop/mobile). La règle « une évolution qui rend la doc inexacte
se corrige dans le même commit » est énoncée et suivie.

---

## 1.3 Modèle de données

### Hiérarchie réelle

```
workspaces (schema.sql:68)          ← existe, mais un seul en usage, nom codé en dur
└── boards (:79)                    color, icon, archived, created_by
    ├── groups (:99)                position, color        ← « phase » implicite
    │   └── tasks (:112)            priority, start_date, position, etape_tag_id, intervention_tag_id
    │       ├── task_columns (:131) admin_id, status, duedate      (relation 1-1)
    │       ├── task_assignments (:211)                            (N-N)
    │       ├── custom_values (:182)                               (task_id uniquement)
    │       ├── task_comments (:289) + comment_reads (:306)
    │       └── sub_tasks (:145)    ← parent_task_id → tasks  (PROFONDEUR MAXIMALE)
    │           ├── sub_task_columns (:158)   admin_id, status, duedate — PAS de priority
    │           └── sub_task_assignments (:219)
    ├── custom_categories (:171)    colonnes personnalisées
    ├── project_tags (:192)         tag_type ENUM ('etape' | 'intervention')
    └── project_teams (:279)

Transverse : users, teams, team_members, alerts, sidebar_shortcuts,
             task_dependencies (:318), activity_log (:332)
```

24 tables, 26 index, 5 énumérations, 1 déclencheur (`set_updated_at` sur `task_columns`).

### Correspondance avec le vocabulaire métier demandé

| Concept attendu | Implémentation | Verdict |
|---|---|---|
| Workspace | `workspaces` | ⚠️ table présente, UI mono-espace en dur (`App.jsx:1710`) |
| Board / projet | `boards` | ✅ complet (archivage, couleur, icône, propriétaire) |
| Groupe | `groups` | ✅ ordonné, coloré, repliable |
| Item | `tasks` | ✅ |
| Colonnes | `task_columns` (figées) + `custom_categories`/`custom_values` (libres) | ⚠️ modèle hybride, 4 types |
| **Phase de projet** | assimilée au **groupe** | ⚠️ implicite, sans dates ni jalons |
| **Étape d'intervention** | `intervention_steps` (niveau 1, ordonné) | ✅ **livré** — `project_tags` conservé en cohabitation |
| **Sous-étape / type secondaire** | `intervention_steps` (`parent_id`) | ✅ **livré** — parenté garantie en base (FK composite) |
| Sous-item | `sub_tasks` | ⚠️ un seul niveau, et fortement incomplet (voir plus bas) |

**C'est le point structurant de cet audit.** Les notions d'*étape* et de
*sous-étape d'intervention*, centrales pour la pharmacotechnie, existent comme
**deux étiquettes indépendantes posées à plat** sur une tâche
(`tasks.etape_tag_id`, `tasks.intervention_tag_id`, `schema.sql:203-204`). Rien
n'exprime qu'une sous-étape appartient à une étape, ni que les étapes s'enchaînent
dans un ordre donné (`project_tags` n'a **pas de colonne `position`**), ni qu'une
étape est franchie et par qui. On ne peut donc pas répondre à « où en est la
préparation X dans son circuit ? » autrement qu'en lisant les statuts un par un.

Trois trous d'intégrité s'y ajoutent : rien en base ne garantit qu'une étiquette
pointée par `etape_tag_id` a bien `tag_type = 'etape'`, ni qu'elle appartient au
même projet (`schema.sql:203-206` : simple FK vers `project_tags(id)`). Le
filtrage par famille n'existe **que dans l'UI** (`TaskRow.jsx:215,223`). Un appel
API direct peut poser une étiquette « intervention » d'un autre projet dans la
colonne « Étape ».

### Parité tâche / sous-item — le déséquilibre est massif

| Capacité | Tâche | Sous-item | Référence |
|---|:--:|:--:|---|
| Nom, statut, échéance, assignation multiple, étiquettes | ✅ | ✅ | `SubtaskList.jsx:104-183` |
| **Priorité** | ✅ | ❌ | absente de `sub_task_columns` (`schema.sql:158-165`) |
| **`start_date`** | ✅ | ❌ | `schema.sql:118` vs `:145-151` |
| **Colonnes personnalisées** | ✅ | ❌ | `custom_values.task_id → tasks` (`:182-187`) |
| **Commentaires** | ✅ | ❌ | `task_comments.task_id → tasks` (`:291`) |
| **Journal d'activité** | ✅ | ❌ | `activity_log.task_id → tasks` (`:334`) |
| **Dépendances (Gantt)** | ✅ | ❌ | `task_dependencies → tasks` (`:320-321`) |
| **Présence dans Kanban / Calendrier / Gantt / Planning / Reporting / Charge** | ✅ | ❌ | toutes les vues parcourent `g.tasks` |
| **Réordonnancement** | ✅ | ❌ | `position` existe (`:149`), aucune route `/reorder` |
| Auto-complétion du parent quand tous sont « Fait » | — | ✅ | `subtasks.controller.js:110-127` |

Le sous-item est donc une entité de seconde zone : invisible partout sauf dans la
ligne du tableau, non commentable, non historisée, non planifiable.

### Le modèle hybride de colonnes

**a) Colonnes figées** — huit colonnes réparties sur **deux tables** et codées en
dur dans l'en-tête (`GroupTable.jsx:187-214`) comme dans la ligne
(`TaskRow.jsx:174-227`) : non masquables, non renommables, non réordonnables.

*Remarque sur `task_columns`* : la relation est strictement 1-1
(`task_id ... UNIQUE`, `schema.sql:133`), rien n'y est multi-valué ni historisé.
Elle impose un `INSERT ... ON CONFLICT DO UPDATE` avec drapeaux de présence à
chaque écriture (`tasks.controller.js:233-248`) là où un simple `UPDATE tasks`
suffirait, et elle **fragmente les dates du même objet** — `start_date` dans
`tasks`, `duedate` dans `task_columns`, ce que le code documente lui-même comme
une gêne (`tasks.controller.js:82-85`). Son seul apport propre est le déclencheur
`updated_at`, transposable tel quel. Le nom est de surcroît trompeur : elle ne
contient **aucune** colonne dynamique.

**b) Colonnes personnalisées** — `custom_categories` + `custom_values`, quatre
types proposés (`AddColumnButton.jsx:4-9` : Texte, Statut, Personne, Date).

**Le champ `type` est un indicateur de rendu React, pas un type de donnée :**

- En base, `type VARCHAR(20)` **sans `CHECK`** (`schema.sql:175`) ; le commentaire
  `-- text | status | person | date` est purement documentaire.
- **`setCategoryValue` ne lit jamais le type** (`categories.controller.js:41-53`) :
  il insère `value` en `TEXT` sans cast ni contrôle. On peut écrire `"bonjour"`
  dans une colonne `date` ou `"P4"` dans une colonne `person` — le serveur accepte.
- Une valeur invalide est ensuite **masquée** et non signalée :
  `CustomCell.jsx:16` retombe sur `'À faire'`, `formatShortDate` renvoie `null`
  donc affiche `—`, indiscernable d'un vide.
- Une colonne personnalisée de type `status` **réutilise le jeu global de 4
  statuts** (`StatusBadge.jsx:3,35`) — elle n'a pas ses propres options.
- Le type `person` simule la clé étrangère en JS (`CustomCell.jsx:23`) : **aucune
  FK en base**, donc supprimer un utilisateur laisse un identifiant orphelin.
- Le catalogue de types est **dupliqué à trois endroits sans source commune** :
  `AddColumnButton.jsx:4-9`, `categories.controller.js:4`, `mockApi.js:549`.

Conséquences pratiques : `value TEXT` interdit tout tri numérique correct
(`"10" < "9"`), toute somme ou moyenne en SQL, et la PK `(category_id, task_id)`
**ne fournit aucun index pour un accès par `task_id` seul** (`schema.sql:186`).
S'ajoutent quatre absences : pas de renommage ni de re-typage (aucune route
`PATCH`, `routes/boards.js:31-34` — renommer une colonne impose de la supprimer
et de perdre ses valeurs), pas de réordonnancement, pas d'unicité de nom, et
absence totale hors de la vue Tableau (ni Kanban, ni Gantt, ni mobile, ni exports).

### Rigidité des énumérations — le coût réel d'un nouveau statut

`task_status` vaut `('À faire','En cours','Fait','Bloqué')` (`schema.sql:19`) —
en base, **et de nouveau cinq fois côté client**, avec des ordres divergents :

| Emplacement | Contenu |
|---|---|
| `constants.js:3` | `STATUSES` (ordre A) |
| `constants.js:8-13` | `STATUS_META` |
| `App.jsx:1078` | `STATUS_ORDER` — 3ᵉ définition, **ordre différent** |
| `OverviewView.jsx:24` | `STATUSES` local, **ordre encore différent** |
| `TeamProjectView.jsx:8` | 5ᵉ copie |

**Si le serveur ajoutait « En validation », la valeur serait silencieusement
corrompue à l'affichage :** `STATUS_META['En validation']` étant `undefined`,
`StatusBadge.jsx:9` retombe sur `'À faire'` — **la tâche s'afficherait en gris
« À faire » alors qu'elle est en validation en base**, sans le moindre
avertissement. Elle serait par ailleurs inassignable (le popover ne liste que
`STATUSES`), absente de toutes les statistiques, classée après « Fait » au tri,
et blanche dans les exports PDF.

À quoi s'ajoutent deux contraintes techniques :

- **`ALTER TYPE ... ADD VALUE` est incompatible avec la migration actuelle.**
  `migrate.js:14-17` envoie **tout `schema.sql` en une seule requête**, donc dans
  une transaction implicite unique — et PostgreSQL interdit d'*utiliser* une
  valeur d'enum ajoutée dans la même transaction. Impossible donc d'ajouter puis
  de rétro-remplir dans le même fichier : il faut deux déploiements successifs.
- **C'est irréversible.** PostgreSQL ne sait pas supprimer une valeur d'enum.

**Total : ajouter un statut coûte ~10 fichiers, 1 migration et 2 déploiements,
pour une opération que Monday traite en trois clics utilisateur.** Même analyse
pour `task_priority` (pas de P4/P5) et `tag_type` (ajouter une 3ᵉ famille
d'étiquettes impose six modifications simultanées, dont **deux nouvelles colonnes
FK physiques** sur `tasks` et `sub_tasks`).

### Ce qui est absent du modèle

- **Aucune relation entre tableaux** — et c'est explicite : les dépendances sont
  volontairement bornées à un projet (`dependencies.controller.js:64-68`).
- **Aucune pièce jointe** : ni table, ni middleware d'upload, alors que Supabase
  Storage est déjà disponible.
- **Aucun champ numérique**, aucune formule, aucune checklist légère.
- **Aucune colonne `description`** sur `tasks` (`schema.sql:112-120`).
- **Aucune colonne `completed_at`** — d'où un reporting faux (§1.4).
- **Aucune table de préférences utilisateur** ni de vues enregistrées.
- **Aucune table de permission par projet** : `listBoards` ne filtre pas par accès
  (`boards.controller.js:4-19`) — tout utilisateur authentifié voit tous les projets.
- `activity_log` est alimentée **mais partiellement** et **jamais exposée** en
  dehors du tiroir d'une tâche.

---

## 1.4 Efficacité du code

### Backend

**Le N+1 est réel — mais il est déclenché depuis le client.** `getBoardFull` est
à cardinalité constante (§1.2), en revanche :

```js
// client/src/components/OverviewView.jsx:147-148  (idem AgentView.jsx:29)
const results = await Promise.all(boards.map((b) => loadFull(b.id).catch(() => null)));
```

Ouvrir la vue d'ensemble avec 20 projets déclenche donc **20 × 12 = 240 requêtes
SQL** et rapatrie l'intégralité des tâches, sous-items, assignations, dépendances
et valeurs personnalisées de **tous** les projets… pour n'en calculer que des
compteurs (`OverviewView.jsx:69-78`). Aggravant : `loadFull={(id) => api.getBoard(id)}`
est une **fonction inline recréée à chaque rendu** (`App.jsx:1530`, `:1825`) et
figure dans les dépendances du `useEffect` (`OverviewView.jsx:163`) — risque de
boucle de rechargement.

**Les 11-12 requêtes de `getBoardFull` sont séquentielles**, sans `Promise.all`.
Sur Supabase via le pooler, avec un aller-retour de 30–50 ms depuis Render, cela
représente **350–600 ms de latence réseau incompressible** avant tout traitement.

**Requêtes non bornées :**

| Requête | Ligne | Problème |
|---|---|---|
| `unreadCounts` | `comments.controller.js:104-111` | **Agrégat sur TOUTE la table `task_comments`**, sans filtre de projet ni de tâche, exécuté **à chaque chargement de page** (`App.jsx:174`). Structurellement en balayage complet — aucun index ne peut le sauver, il faut le redessiner |
| Détection de mentions | `comments.controller.js:169` | `SELECT id, name FROM users` **sans `WHERE`** — charge tout l'annuaire, puis boucle JS sur tous les utilisateurs, **pour chaque commentaire posté**, dans une transaction ouverte |
| `cascadeShiftSuccessors` | `tasks.controller.js:73-120` | Récursif, **3 requêtes par successeur**, profondeur ≤ 200 → jusqu'à **~600 requêtes verrouillantes dans une seule transaction**, sans `statement_timeout` ni `lock_timeout`. Un glissement de date sur une longue chaîne Gantt peut bloquer le pool |

**Aucune pagination :** trois `LIMIT` seulement dans tout le backend, tous figés
(`LIMIT 1` technique, `LIMIT 100` sur les alertes, `LIMIT 50` sur les messages).
Aucun `OFFSET`, aucun curseur, aucun paramètre `page`. Douze endpoints de liste
sont concernés, dont les commentaires et le journal d'activité d'une tâche —
lesquels croissent sans borne et ne sont jamais purgés.

**Index manquants — huit sont critiques.** PostgreSQL n'indexe pas
automatiquement la colonne *référençante* d'une clé étrangère : chaque `DELETE`
sur la table parente provoque alors un balayage complet de la table enfant.

| Table / colonnes | Déclencheur |
|---|---|
| `custom_values(task_id)` | PK = `(category_id, task_id)` → `task_id` n'est pas préfixe ; chaque suppression de tâche balaie toute la table |
| `comment_reads(task_id)` | PK = `(user_id, task_id)` → idem |
| `activity_log(user_id)` | FK `SET NULL` non indexée ; supprimer un agent balaie la plus grosse table du système |
| `task_comments(user_id)` | FK `SET NULL`, aussi utilisée dans `IS DISTINCT FROM` |
| `task_assignments(user_id)`, `sub_task_assignments(user_id)`, `team_members(user_id)`, `project_teams(team_id)` | Colonne non préfixe d'un index UNIQUE |
| `tasks(etape_tag_id)`, `tasks(intervention_tag_id)`, idem sur `sub_tasks` | FK `SET NULL` ; supprimer une étiquette balaie `tasks` |

**Et surtout :** `login` filtre sur `WHERE lower(email) = lower($1)`
(`auth.controller.js:23`), alors que l'index est `UNIQUE(email)`
(`schema.sql:52`). **L'index est donc inutilisable : chaque connexion est un
balayage complet de `users`.** Il faut `CREATE UNIQUE INDEX ON users(lower(email))`.

**Validation d'entrée : artisanale, avec une conséquence systématique.** Aucune
bibliothèque (`zod`, `joi`, `express-validator` : absentes de `package.json`).
Seuls trois endroits valident réellement une énumération
(`categories.controller.js:4`, `tags.controller.js:15`, `auth.controller.js:66-75`)
— ce sont les bons exemples à généraliser. Partout ailleurs, une valeur invalide
descend jusqu'à PostgreSQL :

| Champ | Erreur PG | Réponse actuelle |
|---|---|---|
| `status`, `priority`, `role` hors énumération | `22P02` | **HTTP 500** au lieu de 400 |
| `group_id` inexistant | `23503` | **HTTP 500** au lieu de 404 |
| `color` / `icon` trop longs | `22001` | **HTTP 500** au lieu de 400 |
| `items[].id` non numérique | `NaN` dans `$1::int[]` | **HTTP 500** |

Le gestionnaire d'erreurs (`middleware/error.js:8-14`) ne mappe **aucun** code
PostgreSQL (seul `23505` est traité, en double localement dans
`users.controller.js:64` et `:94`) et **renvoie `err.message` tel quel au
client** — exposant en production des messages du type
`insert or update on table "tasks" violates foreign key constraint "tasks_group_id_fkey"`.

Enfin, **aucune limitation de débit sur `/auth/login`** (rien n'empêche une
attaque par force brute), et `morgan('dev')` (`index.js:30`) est un format de
développement, inexploitable en production.

### Frontend

Les mesures sur `client/src/App.jsx` :

| Mesure | Valeur |
|---|---|
| Lignes / composant `Board` | 2 164 / **2 073** |
| `useState` | **34** |
| `useMemo` / `useCallback` / `useEffect` | 3 / 4 / **1** |
| Handlers `const handleX =` | **66** |
| `React.memo` dans tout `client/src/components/` | **0** |
| `structuredClone(board)` complets | **17** |

**Le problème n'est pas seulement l'absence de `React.memo` — c'est le modèle de
données.** Chaque mutation passe par `optimistic()` (`App.jsx:229-248`), qui fait
un `structuredClone` du board entier. Toutes les références d'objet changent donc
à chaque frappe : `group`, `task`, `admin`, `assignees`, `subtasks`… Un
`React.memo` ajouté aujourd'hui serait **inopérant**. Il faut d'abord un état
normalisé et des mises à jour ciblées.

S'y ajoutent des props recréées à chaque rendu : `GroupTable` en reçoit **41**,
`BoardHeader` et `TaskRow` **29**, `Sidebar` **27** ; 12 des 29 props de `TaskRow`
sont des flèches inline (`GroupTable.jsx:270-288`).

**Un calcul quadratique sur chaque cellule personnalisée :**

```js
// client/src/App.jsx:793-796  — recréée à chaque rendu, jamais mémoïsée
const categoryValue = (categoryId, taskId) =>
  (board?.categoryValues || []).find((v) => v.category_id === categoryId && v.task_id === taskId)?.value ?? '';
```

Appelée par cellule (`TaskRow.jsx:238`). Pour 1 000 tâches × 3 colonnes
personnalisées : **≈ 9 millions de comparaisons par rendu**, sur un rendu déjà
déclenché à chaque frappe. Une `Map` indexée dans un `useMemo` ramène cela à O(1).

**Aucune virtualisation.** `GroupTable.jsx:250-309` monte un `<Draggable>` par
tâche ; le comptage des éléments JSX donne **45 à 55 nœuds DOM par ligne**, soit
**45 000 à 55 000 nœuds pour 1 000 tâches**, hors colonnes personnalisées.

**Le découpage de bundle est neutralisé par deux lignes.** Aucun `React.lazy` ni
`Suspense` dans le projet, aucun `manualChunks` dans `vite.config.js`. Chunk
principal : **1 353 982 octets (1,35 Mo)**.

Deux appels utilisent pourtant correctement l'import dynamique (`App.jsx:1202-1203`,
`TeamWorkloadView.jsx:147-148`) — mais `ReportingView.jsx:17-18` importe
**statiquement** `html-to-image` et `jsPDF`, et `ReportingView` est lui-même
importé statiquement par `App.jsx:11`. Vérification sur le bundle : `jsPDF`
apparaît 11 fois et `recharts` 17 fois dans le chunk principal. **Les imports
dynamiques existants ne produisent donc aucun gain** — le module est déjà là.

Neuf vues sont candidates immédiates au `React.lazy` (Reporting, Gantt, Charge,
Planning, Calendrier, Vue d'ensemble, Équipes, Agent, et jusqu'à `Login`).

### Le patron `optimistic()` — bon, avec trois angles morts

Le helper (`App.jsx:229-248`) est le bon modèle et couvre **11 mutations**. Mais :

1. **9 mutations modifient l'état sans rollback**, dont **5 avalent l'erreur en
   silence** : `handleDeleteSubtask` (`App.jsx:744`), `handleDeleteTag` (`:552`),
   `handleDeleteCategory` (`:765`), `handleDeleteDependency` (`:853`),
   `handleDeleteShortcut` (`:306`), plus `handleSetCategoryValue` (`:778`) et le
   renommage de projet (`:1955`). L'utilisateur voit l'opération réussir alors
   qu'elle a pu échouer côté serveur ; l'élément réapparaît au rechargement
   suivant, sans explication.
2. **L'updater est impur** : `snapshot = prev` est un effet de bord dans un
   updater `setState` (`App.jsx:236-237`). `<React.StrictMode>` étant actif
   (`main.jsx:7`), l'updater est **double-invoqué en développement** et le
   snapshot capture alors un état déjà muté.
3. **Le rollback est destructif en concurrence** : deux `optimistic()`
   simultanés capturent chacun leur snapshot ; si le premier échoue après que le
   second a réussi, le rollback du premier **annule aussi la mutation du second**.

**Et surtout, le dernier écrivain gagne, en silence.** Aucun `setInterval`,
aucun `WebSocket`, aucun `EventSource` dans tout le dépôt : le seul chargement
est un `useEffect` au montage (`App.jsx:182-224`). Deux personnes sur le même
projet ne voient **jamais** les modifications de l'autre ; la cloche de
notifications ne s'actualise jamais d'elle-même ; et la seconde écriture écrase
la première sans avertissement. Pour un outil dont la raison d'être est le
travail d'équipe, c'est la lacune fonctionnelle la plus lourde.

Le backend possède pourtant le déclencheur naturel : `LISTEN`/`NOTIFY` est
disponible via `pg`, et le pooler *session* de Supabase le supporte (contrairement
au pooler *transaction*).

### Duplication desktop / mobile

`App.jsx` contient deux rendus : mobile `1346-1704` (359 lignes) et desktop
`1706-2163` (458 lignes), soit **817 lignes de JSX dont ~350 (43 %) sont des
duplications fonctionnelles**. **16 composants sont instanciés deux fois** ;
`TeamsView` par exemple répète 16 props identiques (`App.jsx:1581-1601` et
`1841-1858`).

Conséquence concrète et déjà avérée : le tri (`sortBy`), l'affichage des tâches
terminées (`showDone`) et les exports CSV/PDF/impression sont **inaccessibles sur
mobile** — ils ne sont câblés que dans `BoardHeader`, qui n'existe que côté desktop.

### Typage, tests, accessibilité

- **Aucun typage** : ni TypeScript, ni PropTypes, ni JSDoc — **et aucune
  configuration ESLint**, alors que le code contient 5 directives
  `eslint-disable-next-line` qui ne sont donc appliquées par rien.
- **Aucun test** : aucun fichier `*.test.*`/`*.spec.*`, aucun script `test`,
  aucun framework installé. **12 676 lignes de frontend sans typage statique ni
  test : les deux filets sont absents simultanément.**
- **Accessibilité** : **3 attributs `aria-*` et 1 attribut `role`** sur
  41 composants. Aucun `role="dialog"`, aucun `aria-modal`, aucun focus trap,
  aucune restauration du focus, aucun `tabIndex`. Les popovers de cellule ne se
  ferment qu'à la souris (`mousedown`) — un utilisateur au clavier ne peut pas
  les refermer sans valider une option. `ProjectModal`, une modale bloquante, ne
  se ferme pas avec Échap. Le bandeau d'erreur n'a ni `role="alert"` ni
  `aria-live` : l'échec de synchronisation est **totalement muet** pour un
  lecteur d'écran, d'autant qu'il disparaît après 3 secondes. Pour un
  établissement public de santé, le RGAA est un sujet.

---

## 1.5 Évaluation fonctionnelle face à Monday.com

Notation : ✅ au niveau attendu · 🟡 partiel · ❌ absent

### Flexibilité des données

| Capacité Monday | PHARMACO | Détail |
|---|---|---|
| Statut | 🟡 | Énuméré **global** de 4 valeurs, pas par tableau |
| Date / échéance | ✅ | `duedate` (+ `start_date`, mais sans colonne dans le tableau) |
| Personne | ✅ | Mono (`admin_id`) **et** multi (`task_assignments`) |
| Texte | ✅ | |
| Nombre | ❌ | Stockable en texte, mais tri et somme faux |
| Liste déroulante / multi-choix / case à cocher | ❌ | |
| Fichiers | ❌ | Aucune table, aucun middleware d'upload |
| Formule | ❌ | |
| **Relation entre tableaux / colonne miroir** | ❌ | Refus explicite inter-projets |
| Chronologie en colonne | 🟡 | Dates présentes mais éclatées sur deux tables |
| Étiquettes | 🟡 | 2 familles fixes, mono-valuées, sans ordre |
| Métadonnées dynamiques | 🟡 | 4 types sur ~30, non typées en base |

### Organisation et hiérarchie

| Capacité | PHARMACO | Détail |
|---|---|---|
| Espace de travail | 🟡 | Table présente, UI mono-espace en dur |
| Projets multiples, archivables | ✅ | |
| Groupes | ✅ | Ordonnés, colorés, repliables |
| Items | ✅ | |
| Sous-items | 🟡 | Un niveau, mais très incomplet (voir §1.3) |
| **Étapes ordonnées** | ❌ | Étiquette plate, sans `position` |
| **Sous-étapes rattachées à une étape** | ❌ | Aucun lien de parenté |
| Dépendances entre items | ✅ | Fin→Début uniquement, sans décalage |
| Modèles / duplication de projet | ❌ | |
| Étiquettes partagées entre projets | ❌ | `board_id NOT NULL` : tout est à recréer |
| Permissions par projet | ❌ | Tout utilisateur authentifié voit tous les projets |

### Vues et ergonomie

| Vue | État | Détail |
|---|---|---|
| Tableau / grille | ✅ | Colonnes redimensionnables persistées par projet |
| Kanban | 🟡 | Regroupement **figé sur le statut** ; ordre dans la colonne non persisté ; **aucune édition depuis la carte** (le clic ouvre la discussion) |
| Calendrier | 🟡 | Glisser-déposer OK, mais **vue mensuelle seule**, ne lit que `duedate`, et le « +N autres » n'est pas cliquable |
| Gantt | ✅ | La vue la plus aboutie — mais **sans aucun filtre**, sans garde `canEdit`, sans jalons ni chemin critique, et **les sous-items en sont absents** |
| Planning dynamique | 🟡 | 4 modes, responsive soigné — mais **100 % lecture seule** et une tâche multi-jours n'occupe qu'une colonne |
| Vue d'ensemble multi-projets | ✅ | Au-delà de Monday sur ce point |
| Vue agent | 🟡 | **Strictement lecture seule** ; pas de regroupement temporel ; sous-items assignés invisibles |
| Charge d'équipe | 🟡 | Seuil de saturation **codé en dur à 3 tâches/jour** ; pas de réaffectation au glisser |
| Reporting + exports | 🟡 | 5 graphiques, exports PNG/PDF — mais mono-projet, widgets figés, **et le chiffre « terminées » est faux** |
| Recherche | 🟡 | Sur le **nom de tâche uniquement**, dans le projet courant |
| Filtres multi-critères | 🟡 | Mono-valeur par dimension, **non combinables**, **non persistés**, et **absents des vues Gantt / Planning / Reporting / Charge** |
| Vues enregistrées / partagées | ❌ | Aucune table de préférences serveur |
| Tri par colonne / regroupement dynamique | ❌ | Tri cyclique global uniquement ; les groupes sont des lignes physiques |

**Neuf vues de premier niveau plus trois sous-vues : la couverture est
excellente.** L'écart avec Monday tient à trois choses : la **personnalisation**
(rien n'est mémorisé ni partageable — seules les largeurs de colonnes le sont, en
`localStorage`, donc par navigateur), l'**éditabilité** (quatre vues sur neuf
sont en lecture seule), et la **portée des filtres** (absents de la moitié des vues).

### Automations et connectivité

| Capacité | État | Détail |
|---|---|---|
| Moteur de règles Déclencheur → Action | ❌ | **Trois** automatismes en dur, dans trois contrôleurs, sans abstraction commune |
| Webhooks sortants | ❌ | |
| API publique documentée / clés de service | ❌ | Authentification par compte utilisateur uniquement |
| Prêt pour Make / n8n | ❌ | |
| Notifications e-mail ou push | ❌ | Aucune dépendance mail |
| Journal d'activité | 🟡 | Écrit **partiellement**, exposé uniquement par tâche |

Les trois règles en dur sont : alerte sur statut « Bloqué »
(`tasks.controller.js:40-60`), auto-complétion du parent
(`subtasks.controller.js:110-127`), et décalage en cascade des successeurs
(`tasks.controller.js:73-120`). Aucune n'est configurable, découvrable ni
testable isolément — et la première est **incomplètement câblée** : elle ne se
déclenche pas sur les sous-items, et **ne produit rien si la tâche bloquée n'a pas
de responsable** (`tasks.controller.js:47`), c'est-à-dire précisément le cas où
l'alerte serait la plus utile.

Le schéma en porte la trace : `alert_type` déclare `'assigned'`, `'due_soon'` et
`'info'` (`schema.sql:27`) qui ne sont **jamais produits** — vestiges d'un moteur
de règles envisagé et jamais construit. Aucun ordonnanceur n'existe pour produire
`due_soon`.

### Performance et temps réel

| Capacité | État |
|---|---|
| Mises à jour temps réel | ❌ **Zéro** WebSocket, SSE ou polling |
| Présence / curseurs collaboratifs | ❌ |
| Virtualisation des listes | ❌ |
| Découpage de bundle | ❌ Chunk unique de 1,35 Mo |
| Pagination / filtrage serveur | ❌ |
| Cache client | 🟡 État en mémoire, rechargé intégralement |
| Optimistic UI | 🟡 Bon patron, mais 9 mutations sans rollback |

---

## 1.6 Bugs confirmés

Ces points ne relèvent pas de la roadmap mais de la correction. Ils sont repris
en phase 1.

| # | Bug | Référence | Impact |
|---|---|---|---|
| ~~B1~~ | ~~La suppression des étiquettes Étape/Type est impossible depuis l'interface : `TagConfig` n'existe que dans `RailPanel` en mode `'Agents'`, or `onSelectRail` n'est jamais appelé qu'avec `'Favoris'`.~~ **Corrigé** : entrée de rail « Agents & étiquettes » ajoutée (`Sidebar.jsx`). | `RailPanel.jsx`, `Sidebar.jsx` | ~~fort~~ |
| B2 | **La vue « charge d'équipe » globale est inatteignable** : `setView('workload')` n'est appelé nulle part | `App.jsx:125,1569,1932` | fort |
| B3 | **Création de dépendance en *fire-and-forget*** : appel sans `await` ni `catch`, et handler sans `try/catch`. Un 409 « dépendance circulaire » provoque une *unhandled rejection*, rien n'est signalé, et la flèche optimiste reste affichée | `GanttChartView.jsx:181-183`, `App.jsx:839-851` | fort |
| B4 | **Le « +N autres » du calendrier n'est pas cliquable** : au-delà de 4 tâches, les suivantes sont inaccessibles ce jour-là | `CalendarView.jsx:164-166` | fort |
| B5 | **Corbeille de sous-item visible pour un membre**, alors que le serveur exige `requireAdmin` → 403 systématique | `SubtaskList.jsx:187` vs `routes/subtasks.js:13` | moyen |
| B6 | **Le compteur et le résumé d'un groupe ignorent les filtres** alors que les lignes sont filtrées | `GroupTable.jsx:102-104` vs `:168`, `:350` | moyen |
| B7 | **`GroupSummary` désaligné** : largeurs codées en dur (`w-28/w-32/w-40/w-36`) contre `DEFAULT_COL_WIDTHS` — déjà 4 px d'écart par défaut, rupture totale après redimensionnement | `GroupSummary.jsx:36-76` vs `constants.js:124-133` | moyen |
| B8 | **Chiffre « terminées » faux dans le reporting** : l'échéance sert de proxy de date de complétion (aveu en commentaire), faute de colonne `completed_at` | `ReportingView.jsx:100-127` | fort |
| B9 | **Les co-assignés sont invisibles** dans le filtre « Personne », la charge par membre et la charge d'équipe : tous testent `task.admin` = `assignees[0]` | `App.jsx:1068`, `ReportingView.jsx:89-93`, `TeamWorkloadView.jsx:72` | fort |
| B10 | **Défilements verticaux désynchronisés dans le Gantt** entre le volet des noms (`overflow-hidden`) et la zone des barres (`overflow-auto`) | `GanttChartView.jsx:326` vs `:355` | moyen |
| B11 | **Fuite mémoire** : listener `scroll` ajouté et jamais retiré | `App.jsx:1104-1118` | moyen |
| B12 | **`DELETE /boards/categories/:id` ne vérifie pas le `board_id`** : tout `requireEditor` peut supprimer une colonne de n'importe quel projet par son identifiant | `categories.controller.js:34-38` | moyen |
| B13 | **`target_url` d'un raccourci n'est pas validé** : une URL `javascript:` est acceptée | `shortcuts.controller.js:15` | moyen |
| B14 | **Dérive de charte** : violet hérité `#3b1f7a` dans les en-têtes PDF au lieu du bleu CHD `#005586` | `ReportingView.jsx:195`, `App.jsx:1220,1244`, `TeamWorkloadView.jsx:154,183` | faible |
| B15 | **Prop `onAssign` morte** : déclarée dans `TaskRow` mais jamais transmise à `AdminCell` | `TaskRow.jsx:27` vs `:180-186` | faible |
| B16 | **Un échec de migration ne bloque pas le démarrage** : l'API démarre sur un schéma désynchronisé et échoue ensuite en 500 à l'exécution | `index.js:78-82` | moyen |

---

# 2. Pistes d'optimisation et fonctionnalités clés

Classement par rapport **impact / effort**. L'impact est jugé du point de vue du
service de pharmacotechnie, pas de la complétude théorique.

## 2.1 Impact fort · Effort faible — à faire en premier

| # | Sujet | Pourquoi |
|---|---|---|
| A1 | **Deux imports à rendre dynamiques** dans `ReportingView` | Deux lignes. Débloque tout le découpage de bundle, aujourd'hui neutralisé |
| A2 | **`React.lazy` sur les 9 vues** | Chunk initial de 1,35 Mo à ~500 Ko. Décisif en 4G hospitalière |
| A3 | **Indexer `categoryValue` dans une `Map`** | Supprime ~9 M de comparaisons par rendu |
| A4 | **8 index manquants + index sur `lower(email)`** | Supprime des balayages complets en cascade, et rend l'authentification indexée |
| A5 | **Mapper les codes PostgreSQL en HTTP** | Transforme des 500 opaques en 400/404 lisibles, et cesse d'exposer la structure du schéma |
| A6 | **Rebrancher les deux vues inatteignables** (B1, B2) | Les étiquettes redeviennent supprimables |
| A7 | **Filtres sur Gantt et Planning** | Quatre vues sur neuf ignorent aujourd'hui les filtres |
| A8 | **Clic sur carte Kanban / Calendrier → fiche de tâche** | Rend deux vues éditables au lieu d'ouvrir la discussion |
| A9 | **Ne plus avaler les erreurs** (9 mutations) | Une suppression qui échoue paraît réussir |
| A10 | **Limitation de débit sur `/auth/login`** | Aucune protection contre la force brute |
| A11 | **Ajouter `tasks.description`** | Absence la plus visible de la fiche de tâche |
| A12 | **Exposer `activity_log`** | La table est déjà alimentée et indexée : il ne manque que la lecture |
| A13 | **Compter les co-assignés** (B9) | Trois vues donnent aujourd'hui des chiffres faux |
| A14 | **Colonnes personnalisées et actions groupées sur mobile** | Parité rompue : le mobile ne voit pas les colonnes créées sur ordinateur |
| A15 | **Persistance des filtres et de la vue** | Refaire ses filtres à chaque connexion est le premier irritant quotidien |

## 2.2 Impact fort · Effort moyen

| # | Sujet | Pourquoi |
|---|---|---|
| B1 | **Modéliser les étapes et sous-étapes d'intervention** | Le cœur métier. Aujourd'hui deux étiquettes plates sans ordre ni parenté |
| B2 | **Statuts configurables par tableau** | Sortir de l'énuméré global ; chaque circuit a son vocabulaire |
| B3 | **Endpoint d'agrégats `/api/boards/stats`** | Supprime les 240 requêtes de la vue d'ensemble |
| B4 | **Rafraîchissement collaboratif (SSE)** | Deux personnes s'écrasent mutuellement en silence |
| B5 | **Extraction de l'état hors d'`App.jsx`** | Débloque mémoïsation, tests, et réduit la duplication desktop/mobile |
| B6 | **Nouveaux types de colonnes** + colonnes ombres typées | Rend les colonnes réellement triables et agrégeables |
| B7 | **Validation systématique (Zod)** | Supprime les 500 opaques à la racine |
| B8 | **Pièces jointes (Supabase Storage)** | Protocoles, fiches de fabrication : besoin métier évident, brique déjà payée |
| B9 | **Parité des sous-items** (priorité, commentaires, journal, colonnes) | Le sous-item est aujourd'hui une entité de seconde zone |
| B10 | **Actions groupées sur desktop** | Les cases à cocher n'ont aucun effet aujourd'hui |
| B11 | **Colonne `completed_at`** | Le reporting est actuellement faux (B8) |

## 2.3 Impact moyen · Effort variable

| # | Sujet | Effort |
|---|---|---|
| C1 | Vues enregistrées et partageables (préférences serveur) | Moyen |
| C2 | Tri par colonne et regroupement dynamique | Moyen |
| C3 | Recherche globale multi-projets | Moyen |
| C4 | Édition et suppression de commentaire | Faible |
| C5 | Modèles de projet et duplication | Moyen |
| C6 | Notifications e-mail (échéance, mention, assignation) | Moyen |
| C7 | Fusion de `task_columns` dans `tasks` | Moyen |
| C8 | Accessibilité (focus trap, `aria-*`, fermeture clavier) | Moyen |
| C9 | Permissions par projet | Élevé |
| C10 | TypeScript progressif | Élevé |

## 2.4 Impact fort · Effort élevé — à planifier, pas à improviser

| # | Sujet |
|---|---|
| D1 | **Moteur d'automatisations** (Déclencheur → Condition → Action) |
| D2 | **Webhooks sortants + clés d'API de service** (Make, n8n) |
| D3 | **Relations entre tableaux + colonnes miroir** |
| D4 | **Virtualisation + pagination + filtrage serveur** |
| D5 | Migration du modèle vers `board_columns` + `column_values` |

## 2.5 Ce qu'il ne faut **pas** faire

Un audit utile dit aussi ce qu'il faut laisser tranquille.

- **Ne pas réécrire l'application.** Le socle est bon ; les problèmes sont
  localisés et se traitent par incréments.
- **Ne pas introduire d'ORM.** Le SQL manuel est propre, paramétré, sans
  injection et sans N+1 serveur. Un ORM ajouterait une couche sans résoudre un
  problème réel.
- **Ne pas abandonner le mode mock.** C'est un atout de démonstration
  différenciant. Il coûte cher à maintenir ; le supprimer coûterait plus.
- **Ne plus créer de nouveaux `ENUM` PostgreSQL.** Préférer `VARCHAR + CHECK` :
  seul motif réversible et compatible avec l'application du schéma en une
  transaction unique au démarrage.
- **Ne pas viser la parité Monday.com.** Monday sert des milliers de cas ;
  PHARMACO en sert un, très bien. Les ~26 types de colonnes manquants ne sont pas
  un objectif — cinq ou six bien choisis suffisent.
- **Ne pas migrer vers Next.js / SSR.** Aucun besoin de référencement ni de rendu
  serveur pour un outil interne authentifié.

---

# 3. Plan de développement (roadmap)

Trois phases. Chaque tâche indique les **fichiers clés** et un **niveau de
complexité** (Faible / Moyen / Élevé).

> **Rappel de la règle d'or du dépôt :** toute fonctionnalité de données touche
> **quatre** endroits — `server/db/schema.sql`, le contrôleur + la route,
> `client/src/api/httpApi.js`, et `client/src/api/mockApi.js`. Les tâches
> ci-dessous le supposent acquis et ne le répètent pas à chaque ligne.

---

## Phase 1 — Quick wins et stabilisation

**Objectif :** sécuriser ce qui est en production, corriger les bugs confirmés,
et récolter les gains de performance disproportionnés. Une seule migration, purement
additive.

### 1.1 Mettre en place un filet de tests — complexité **Moyen**

Préalable à tout le reste : sans lui, chaque tâche suivante est un pari.

- **À créer :** `client/vitest.config.js`, `client/src/lib/__tests__/constants.test.js`,
  `client/src/api/__tests__/mockApi.test.js`, `server/test/api.test.js`,
  `server/test/helpers/db.js`, `client/.eslintrc.cjs` (5 directives
  `eslint-disable` existent aujourd'hui sans configuration pour les appliquer)
- **À modifier :** les deux `package.json` (script `test`), `CLAUDE.md` (la
  phrase « il n'y a pas de suite de tests » devient fausse)
- **Contenu minimal :** helpers de `constants.js` ; parité `mockApi`/`httpApi` ;
  le helper `optimistic()` ; `filterFn` et `sortFn` ; côté serveur, le parcours
  d'authentification complet et le refus `requireAdmin` sur une suppression.
- **Cible réaliste :** ~30 tests. Le but n'est pas la couverture, c'est de rendre
  les régressions visibles.

### 1.2 Débloquer le découpage de bundle — complexité **Faible**

Le correctif au meilleur rapport de tout le document.

- **À modifier :** `client/src/components/ReportingView.jsx:17-18` — passer
  `html-to-image` et `jspdf` en `await import(...)` dans les fonctions d'export
  (le patron est déjà utilisé lignes `App.jsx:1202-1203`). **Sans cela, tous les
  imports dynamiques du projet restent sans effet.**
- **Puis :** `client/src/App.jsx` — `React.lazy` sur `ReportingView`,
  `GanttChartView`, `DynamicTimeView`, `TeamWorkloadView`, `CalendarView`,
  `OverviewView`, `AgentView`, `TeamsView`, enveloppés dans un `<Suspense>`.
  Attention : les composants doivent être enveloppés **dans les deux branches**
  de rendu (mobile et desktop).
- **Et :** `client/vite.config.js` — `build.rollupOptions.output.manualChunks`
  pour isoler `recharts` et `jspdf`.
- **Gain attendu :** 1 353 982 o → ~500 Ko.
- **Vérification :** `npm run build`, comparaison de la taille des chunks.

### 1.3 Supprimer le calcul quadratique des colonnes personnalisées — complexité **Faible**

- **À modifier :** `client/src/App.jsx:793-796` — remplacer le `Array.find` par
  une `Map` indexée `` `${category_id}:${task_id}` `` construite dans un
  `useMemo` sur `board.categoryValues`.
- **Gain :** ~9 millions de comparaisons par rendu → O(1) par cellule.

### 1.4 Index manquants — complexité **Faible**

- **À modifier :** `server/db/schema.sql`

  ```sql
  -- Index de clés étrangères manquants (cascades de suppression en balayage complet)
  CREATE INDEX IF NOT EXISTS idx_custom_values_task        ON custom_values(task_id);
  CREATE INDEX IF NOT EXISTS idx_comment_reads_task        ON comment_reads(task_id);
  CREATE INDEX IF NOT EXISTS idx_activity_log_user         ON activity_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_task_comments_user        ON task_comments(user_id);
  CREATE INDEX IF NOT EXISTS idx_task_assignments_user     ON task_assignments(user_id);
  CREATE INDEX IF NOT EXISTS idx_sub_task_assignments_user ON sub_task_assignments(user_id);
  CREATE INDEX IF NOT EXISTS idx_team_members_user         ON team_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_project_teams_team        ON project_teams(team_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_etape_tag           ON tasks(etape_tag_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_intervention_tag    ON tasks(intervention_tag_id);

  -- L'index UNIQUE(email) est inutilisable : login filtre sur lower(email)
  CREATE UNIQUE INDEX IF NOT EXISTS uq_users_lower_email ON users(lower(email));

  -- Tris chauds non couverts
  CREATE INDEX IF NOT EXISTS idx_alerts_user_created  ON alerts(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_task_created ON activity_log(task_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_task_comments_task_created ON task_comments(task_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_tasks_group_position ON tasks(group_id, position);
  ```

- **Note :** la requête `unreadCounts` (`comments.controller.js:104-111`) n'est
  **pas** sauvable par un index — c'est un agrégat sans borne sur toute la table.
  Elle est traitée en 1.10.

### 1.5 Mapper les erreurs PostgreSQL et cesser de fuiter — complexité **Faible**

- **À modifier :** `server/src/middleware/error.js`
  - Ajouter `pgErrorToHttp(err)` : `22P02` → 400, `23503` → 400/404, `22001` → 400,
    `23514` → 400, `23505` → 409 (aujourd'hui traité en double dans
    `users.controller.js:64` et `:94` — à supprimer de là).
  - Ne plus renvoyer `err.message` brut en production : message générique en
    français au client, détail dans les logs.
- **À modifier aussi :** `server/src/index.js:78-82` — un échec de migration doit
  **arrêter le démarrage** en production, pas seulement journaliser (B16).

### 1.6 Rebrancher les vues inatteignables — complexité **Faible**

- **À modifier :** `client/src/components/Sidebar.jsx:284-294` — ajouter une
  entrée de rail « Agents & étiquettes » appelant `onSelectRail('Agents')`, seul
  chemin vers `TagConfig` (B1). Prévoir aussi le rendu de `RailPanel` côté mobile
  (`App.jsx:1413` passe `onSelectRail` sans jamais rendre le panneau).
- **À modifier :** `client/src/components/Sidebar.jsx:342-376` — ajouter l'entrée
  de navigation vers `view = 'workload'` (B2), déjà rendue en `App.jsx:1569` et `:1932`.

### 1.7 Corriger les bugs d'interaction — complexité **Faible**

- `client/src/components/GanttChartView.jsx:181-183` + `client/src/App.jsx:839-851`
  — `await` + `try/catch` sur la création de dépendance ; retirer la flèche
  optimiste et afficher le message du 409 (B3).
- `client/src/components/CalendarView.jsx:164-166` — rendre le « +N autres »
  cliquable (feuille ou popover listant le jour complet) (B4).
- `client/src/components/SubtaskList.jsx:187` — masquer la corbeille si
  `!isAdmin`, pour s'aligner sur `routes/subtasks.js:13` (B5).
- `client/src/components/GroupTable.jsx:168,350` — appliquer `filterFn` au
  compteur et au résumé (B6).
- `client/src/components/GroupSummary.jsx:36-76` — consommer `getColWidth` au
  lieu des largeurs `w-28/w-32/w-40/w-36` (B7).
- `client/src/components/GanttChartView.jsx:326` — synchroniser le défilement
  vertical des deux volets (B10).
- `client/src/App.jsx:1104-1118` — retirer le listener `scroll` au démontage (B11).
- `server/src/controllers/categories.controller.js:34-38` — vérifier le
  `board_id` avant suppression (B12).
- `server/src/controllers/shortcuts.controller.js:15` — n'accepter que
  `http:`/`https:` (B13).
- `client/src/components/ReportingView.jsx:195`, `client/src/App.jsx:1220,1244`,
  `client/src/components/TeamWorkloadView.jsx:154,183` — remplacer `#3b1f7a` par
  `#005586` (B14).
- `client/src/components/TaskRow.jsx:27` — supprimer la prop morte `onAssign` (B15).

### 1.8 Compter les co-assignés — complexité **Faible**

Trois vues affichent aujourd'hui des chiffres faux parce qu'elles ne regardent
que `task.admin` (= `assignees[0]`).

- **À modifier :** `client/src/App.jsx:1068` (filtre « Personne »),
  `client/src/components/ReportingView.jsx:89-93` (charge par membre),
  `client/src/components/TeamWorkloadView.jsx:72` (charge d'équipe) — tester
  `task.assignees?.some((u) => u.id === …)` avec repli sur `admin`.

### 1.9 Filtres et éditabilité des vues — complexité **Faible**

- **À modifier :** `client/src/App.jsx:1870-1892` — transmettre `filterFn` (et
  `canEdit`) à `GanttChartView` et `DynamicTimeView`, et rendre `BoardHeader`
  dans ces vues (A7). Le Gantt laisse aujourd'hui un `viewer` glisser les barres
  avant d'échouer en 403.
- **À modifier :** `client/src/App.jsx:2086` et `:2096` — le clic sur une carte
  Kanban ou Calendrier ouvre `TaskDetailPanel` plutôt que `TaskDrawer` (A8) ;
  garder la bulle de commentaire comme accès explicite à la discussion.
- **À modifier :** `client/src/App.jsx:2087` et `:800-802` — l'ajout rapide
  utilise le groupe et le statut de la colonne visée, et un champ de saisie
  plutôt que `window.prompt`.

### 1.10 Endpoint d'agrégats pour la vue d'ensemble — complexité **Moyen**

Supprime les ~240 requêtes déclenchées à chaque affichage.

- **À créer :** `GET /api/boards/stats` dans
  `server/src/controllers/boards.controller.js` — compteurs par projet (total,
  par statut, P1, en retard) en **une** requête `GROUP BY`.
- **À modifier :** `client/src/components/OverviewView.jsx:147-149` et
  `client/src/components/AgentView.jsx:29` (ne plus charger les projets entiers),
  `client/src/App.jsx:1530,1825` (`loadFull` inline → `useCallback`, pour couper
  le risque de boucle de rechargement).
- **Traiter dans la foulée :** `comments.controller.js:104-111` (`unreadCounts`)
  — restreindre l'agrégat aux projets visibles, et
  `comments.controller.js:169` (détection de mentions) — extraire les `@…` par
  expression régulière puis une seule requête `WHERE lower(name) = ANY($1)` au
  lieu de charger tout l'annuaire à chaque commentaire.

### 1.11 Paralléliser les lectures de `getBoardFull` — complexité **Faible**

- **À modifier :** `server/src/controllers/boards.controller.js:26-239` — après
  la vérification d'existence, regrouper en `Promise.all` les requêtes
  indépendantes (dépendances, catégories, valeurs, étiquettes, équipes,
  assignations, tâches, sous-items) ; seul l'assemblage en mémoire reste ordonné.
- **Gain :** 350–600 ms → ~100 ms.
- **Vigilance :** ~8 requêtes simultanées par requête HTTP — à valider contre la
  taille du pool de connexions Supabase.

### 1.12 Borner `cascadeShiftSuccessors` — complexité **Moyen**

- **À modifier :** `server/src/controllers/tasks.controller.js:73-120` —
  remplacer la récursion (jusqu'à ~600 requêtes verrouillantes dans une seule
  transaction) par une `WITH RECURSIVE` unique.
- **À modifier :** `server/src/db/pool.js:114-127` — poser un `statement_timeout`
  et un `lock_timeout` dans `withTransaction`.

### 1.13 Cesser d'avaler les erreurs — complexité **Faible**

- **À modifier :** `client/src/App.jsx` — faire passer par `optimistic()` les 9
  mutations qui n'ont pas de rollback (`:306`, `:552`, `:570`, `:716`, `:744`,
  `:765`, `:778`, `:853`, `:1955`), et sortir la capture du snapshot de l'updater
  `setState` (`:236-237`) pour supprimer l'impureté sous `StrictMode`.
- **À créer :** `client/src/components/Toast.jsx` — pile de notifications sans
  dépendance, avec `role="alert"` et `aria-live` (le bandeau actuel est muet pour
  un lecteur d'écran).

### 1.14 Limitation de débit sur l'authentification — complexité **Faible**

- **À créer :** `server/src/middleware/rateLimit.js` — compteur en mémoire par
  IP + e-mail, fenêtre glissante, sans dépendance externe.
- **À modifier :** `server/src/routes/auth.js` — appliquer sur `/login`,
  `/change-password`, `/set-password`.
- **Réglage suggéré :** 10 tentatives / 15 min, réponse 429 en français.
- **Limite connue :** compteur par instance ; suffisant pour un service Render
  unique, à revoir en cas de mise à l'échelle horizontale.

### 1.15 Description de tâche et historique — complexité **Faible**

- **À modifier :** `server/db/schema.sql`
  ```sql
  ALTER TABLE tasks     ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE sub_tasks ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE task_columns     ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  ALTER TABLE sub_task_columns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  ```
  `completed_at` corrige le chiffre faux du reporting (B8) : il est renseigné au
  passage à « Fait » et remis à `NULL` sinon.
- **À créer :** `server/src/controllers/activity.controller.js`,
  `server/src/routes/activity.js`
- **À modifier :** `client/src/components/TaskDetailPanel.jsx` (champ description
  + onglet Historique), `client/src/components/ReportingView.jsx:100-127`
  (utiliser `completed_at`), `server/src/controllers/tasks.controller.js:259-277`
  (journaliser aussi les étiquettes, le changement de groupe et les assignations —
  aujourd'hui absents), `server/src/controllers/assignments.controller.js` et
  `subtasks.controller.js` (qui n'écrivent rien dans `activity_log`).
- **Pourquoi c'est peu coûteux :** `activity_log` est déjà alimentée et indexée.

### 1.16 Parité mobile et persistance des filtres — complexité **Faible**

- **À modifier :** `client/src/components/TaskCard.jsx`,
  `client/src/components/MobileBoard.jsx`, `client/src/App.jsx` — brancher
  `categories`, `categoryValues`, `onCreateCategory` et `onSetCategoryValue` sur
  la **branche mobile** (ils ne le sont qu'en desktop, `App.jsx:2043`), et
  exposer le tri, `showDone` et les exports, aujourd'hui câblés dans le seul
  `BoardHeader`.
- **À créer :** `client/src/lib/useViewPreferences.js` — sur le modèle de
  `useColumnWidths.js`, clé par utilisateur **et** par projet, pour `search`, les
  quatre filtres, `showDone`, `sortBy`, `boardView` et `view`.
- **Réserve :** `localStorage` reste lié au navigateur ; la persistance serveur
  arrive en 3.6.

### 1.17 Mémoïsation ciblée — complexité **Moyen**

- **À modifier :** `client/src/components/TaskRow.jsx` (`React.memo` avec
  comparateur explicite), `client/src/components/GroupTable.jsx`,
  `client/src/App.jsx` (passer les handlers en `useCallback` — il n'y en a que 4
  aujourd'hui pour 66 handlers).
- **Attention — ordre impératif :** stabiliser les callbacks **et** cesser de
  cloner tout le board à chaque mutation (`structuredClone`, 17 occurrences).
  Tant que les références d'objet changent intégralement, `React.memo` est
  inopérant. Un gain partiel est atteignable dès la phase 1 ; le gain complet
  dépend de 2.4.
- **Mesure :** React DevTools Profiler, saisie dans la recherche sur 200 tâches,
  avant / après.

**Livrable de la phase 1 :** bundle divisé par ~2,5, requêtes indexées, 16 bugs
corrigés, deux vues rebranchées, erreurs visibles, authentification protégée,
parité mobile rétablie, et un filet de tests en place.

---

## Phase 2 — Structuration et cœur métier

**Objectif :** faire correspondre le modèle de données au métier réel de la
pharmacotechnie, et rendre les colonnes réellement exploitables.

### 2.1 Statuts configurables par tableau — complexité **Moyen**

Placée en tête de phase 2 : meilleur rapport valeur/effort du lot, et elle
supprime au passage les cinq duplications divergentes côté client.

- **À modifier :** `server/db/schema.sql`

  ```sql
  CREATE TABLE IF NOT EXISTS board_statuses (
    id         SERIAL PRIMARY KEY,
    board_id   INTEGER      NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    label      VARCHAR(60)  NOT NULL,
    color      VARCHAR(9)   NOT NULL DEFAULT '#9aadbd',
    text_color VARCHAR(9)   NOT NULL DEFAULT '#ffffff',
    position   INTEGER      NOT NULL DEFAULT 0,
    is_done    BOOLEAN      NOT NULL DEFAULT false,
    is_blocked BOOLEAN      NOT NULL DEFAULT false,
    legacy_key task_status,                    -- pont vers l'énuméré existant
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_board_statuses_label
      ON board_statuses(board_id, lower(label));

  ALTER TABLE task_columns     ADD COLUMN IF NOT EXISTS status_id INTEGER REFERENCES board_statuses(id) ON DELETE SET NULL;
  ALTER TABLE sub_task_columns ADD COLUMN IF NOT EXISTS status_id INTEGER REFERENCES board_statuses(id) ON DELETE SET NULL;
  ```

  Amorcer chaque projet avec les quatre statuts actuels et leurs couleurs de
  charte, puis rétro-remplir `status_id` via `legacy_key` (gardé par
  `WHERE status_id IS NULL`, donc rejouable).

- **Le vrai bénéfice est `is_done` / `is_blocked` :** ces deux drapeaux
  remplacent **toutes** les comparaisons littérales disséminées dans le code —
  `tasks.controller.js:152,252` (`'Bloqué'`), `subtasks.controller.js:114,122-123`
  (`'Fait'`), `App.jsx:1070`, `TaskRow.jsx:197`.
- **À modifier côté client :** `client/src/lib/constants.js` (`STATUS_META`
  devient un **repli**, plus la source de vérité),
  `client/src/components/StatusBadge.jsx`, `client/src/components/KanbanView.jsx`
  (colonnes dérivées des statuts du projet), et **suppression des redéfinitions
  locales** `App.jsx:1078`, `OverviewView.jsx:24`, `TeamProjectView.jsx:8`.
- **À créer :** `client/src/components/StatusEditor.jsx` (configuration par projet).
- **Compatibilité :** conserver `task_columns.status` en double écriture le temps
  de la transition. **Ne pas** faire d'`ALTER TYPE` : c'est irréversible et
  incompatible avec la migration en transaction unique.

### 2.2 Modéliser les étapes et sous-étapes d'intervention — ✅ **LIVRÉ**

Tables `intervention_steps` et `task_step_progress`, reprise idempotente des
étiquettes existantes, endpoints sous `/api/boards/steps`, parité mock/HTTP,
composants `StepProgress.jsx` (stepper) et `StepEditor.jsx` (configuration du
circuit), regroupement en accordéon dans la vue Tableau et sur mobile.

Reste différé : le rattachement des **sous-items** au circuit dans les vues
Kanban / Gantt / Planning, et la suppression de `project_tags` (deux versions
de cohabitation prévues).

<details><summary>Spécification d'origine</summary>

- **À modifier :** `server/db/schema.sql`

  ```sql
  -- Étapes ordonnées d'un circuit d'intervention, par projet
  CREATE TABLE IF NOT EXISTS intervention_steps (
    id          SERIAL PRIMARY KEY,
    board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    parent_id   INTEGER REFERENCES intervention_steps(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    color       TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    is_terminal BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_intervention_steps_board  ON intervention_steps(board_id, position);
  CREATE INDEX IF NOT EXISTS idx_intervention_steps_parent ON intervention_steps(parent_id);

  -- Franchissement d'une étape par une tâche : qui, quand
  CREATE TABLE IF NOT EXISTS task_step_progress (
    id           SERIAL PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    step_id      INTEGER NOT NULL REFERENCES intervention_steps(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ,
    completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note         TEXT,
    UNIQUE (task_id, step_id)
  );
  CREATE INDEX IF NOT EXISTS idx_task_step_progress_task ON task_step_progress(task_id);
  ```

  `parent_id` porte la hiérarchie étape → sous-étape (aujourd'hui inexistante),
  `position` porte l'ordre du circuit (aujourd'hui inexistant), `is_terminal`
  marque la fin de parcours, et `completed_by`/`completed_at` donnent la
  traçabilité attendue en environnement qualité.

- **À créer :** `server/src/controllers/steps.controller.js`,
  `server/src/routes/steps.js`,
  `client/src/components/StepProgressCell.jsx` (indicateur de progression en ligne),
  `client/src/components/StepEditorModal.jsx` (configuration du circuit)
- **À modifier :** `server/src/controllers/boards.controller.js` (`getBoardFull`
  renvoie `steps` et la progression), `client/src/components/TaskDetailPanel.jsx`,
  `GroupTable.jsx`, `TaskRow.jsx`
- **Migration des données :** reprendre les `project_tags` existantes comme
  étapes de niveau 1 (`tag_type = 'etape'`) et de niveau 2
  (`tag_type = 'intervention'`, `parent_id` à renseigner ensuite par le chef de
  projet). **Conserver `etape_tag_id` / `intervention_tag_id` en lecture pendant
  deux versions** — ne pas supprimer `project_tags` dans le même commit.
- **À corriger au passage :** les FK actuelles ne garantissent ni la famille
  (`tag_type`) ni l'appartenance au projet ; le nouveau modèle doit poser ces
  contraintes.

</details>

### 2.3 Enrichir les types de colonnes — complexité **Moyen**

- **À modifier :** `server/db/schema.sql`

  ```sql
  -- Colonnes ombres typées : le tri et l'agrégation redeviennent faisables en SQL
  ALTER TABLE custom_values ADD COLUMN IF NOT EXISTS value_number NUMERIC;
  ALTER TABLE custom_values ADD COLUMN IF NOT EXISTS value_date   DATE;
  ALTER TABLE custom_values ADD COLUMN IF NOT EXISTS value_json   JSONB;
  ALTER TABLE custom_categories ADD COLUMN IF NOT EXISTS options JSONB;
  ```

  `value` (TEXT) reste la source rétrocompatible ; les colonnes typées sont
  renseignées **par le contrôleur** (et non par `GENERATED ... STORED`, dont le
  cast échouerait sur les données héritées non conformes).

- **À modifier :** `client/src/components/AddColumnButton.jsx` (ajouter Nombre,
  Liste déroulante, Case à cocher, Lien), `client/src/components/CustomCell.jsx`,
  `server/src/controllers/categories.controller.js` — qui doit désormais **lire
  le type** et valider la valeur, ce qu'il ne fait pas aujourd'hui.
- **À créer :** `client/src/lib/columnKinds.js` — registre
  `{ kind: { Cell, compare, format, aggregate } }`, source unique remplaçant les
  trois catalogues divergents actuels (`AddColumnButton.jsx:4-9`,
  `categories.controller.js:4`, `mockApi.js:549`). Son `compare` alimente
  `sortFn`, son `aggregate` alimente `GroupSummary` et les exports.
- **À ajouter aussi :** route `PATCH` de catégorie (renommer une colonne impose
  aujourd'hui de la supprimer et de perdre ses valeurs) et réordonnancement.

### 2.4 Extraire l'état hors d'`App.jsx` — complexité **Élevé**

2 164 lignes, 34 `useState`, 66 handlers, deux rendus complets, 17
`structuredClone` : c'est le nœud de la dette, et le préalable à toute
mémoïsation efficace.

- **À créer :** `client/src/state/BoardContext.jsx` (`useReducer`, état
  **normalisé** `tasksById` / `groupsById` pour permettre des mises à jour
  ciblées sans clonage global), `client/src/state/UiContext.jsx` (filtres, vue,
  sélection), `client/src/state/boardReducer.js`,
  `client/src/hooks/useOptimistic.js` (avec sérialisation des mutations
  concurrentes, absente aujourd'hui), `client/src/lib/exports.js` (les ~100
  lignes de CSV/PDF actuellement dans le composant racine),
  `client/src/lib/permissions.js` (la matrice de rôles inline `App.jsx:148-158`)
- **À créer aussi :** `client/src/components/ViewRouter.jsx` et
  `TaskOverlays.jsx` — mutualiser les ~350 lignes de JSX dupliquées entre les
  branches mobile et desktop, et les 16 composants instanciés deux fois.
- **À modifier :** `client/src/App.jsx` (cible : sous 800 lignes), puis
  progressivement `GroupTable` (41 props), `BoardHeader` et `TaskRow` (29),
  `Sidebar` (27) pour qu'ils consomment le contexte.
- **Méthode :** un domaine à la fois — d'abord les filtres (les plus isolés),
  puis le tableau. **Ne pas tout migrer en un commit.**

### 2.5 Parité des sous-items — complexité **Moyen**

Le sous-item est aujourd'hui invisible partout sauf dans la ligne du tableau.

- **À modifier :** `server/db/schema.sql`
  ```sql
  ALTER TABLE sub_task_columns ADD COLUMN IF NOT EXISTS priority task_priority DEFAULT 'P3 - Normal';
  ALTER TABLE sub_tasks        ADD COLUMN IF NOT EXISTS start_date DATE;
  ALTER TABLE task_comments    ADD COLUMN IF NOT EXISTS sub_task_id INTEGER REFERENCES sub_tasks(id) ON DELETE CASCADE;
  ALTER TABLE activity_log     ADD COLUMN IF NOT EXISTS sub_task_id INTEGER REFERENCES sub_tasks(id) ON DELETE CASCADE;
  ```
  (`task_comments.task_id` et `activity_log.task_id` doivent devenir nullables,
  avec un `CHECK` d'exclusivité.)
- **À créer :** route `PUT /api/subtasks/reorder` — `position` existe déjà
  (`schema.sql:149`) mais n'est jamais réécrite après création.
- **À modifier :** `client/src/components/SubtaskList.jsx` (glisser-déposer,
  priorité, largeurs alignées sur `getColWidth`),
  `client/src/components/TaskDetailPanel.jsx` (afficher les sous-items, absents
  aujourd'hui), et les vues Kanban / Gantt / Agent pour les inclure.
- **À corriger :** l'auto-complétion du parent (`subtasks.controller.js:110-127`)
  n'écrit rien dans `activity_log` et n'émet aucune alerte, contrairement aux
  changements de statut manuels.

### 2.6 Actions groupées et ergonomie du tableau — complexité **Moyen**

Les cases à cocher du desktop n'ont aujourd'hui **aucun effet** : `selectedIds`
n'est consommé que pour l'état visuel (`GroupTable.jsx:263`). Le mobile, lui, a
déjà un changement de statut en masse.

- **À créer :** `client/src/components/BulkActionsBar.jsx` (déplacer, assigner,
  changer le statut, supprimer, exporter la sélection),
  `client/src/lib/useSort.js` (tri multi-critères réutilisable)
- **À modifier :** `client/src/components/GroupTable.jsx` (tri par clic sur
  l'en-tête, sens inversable), `client/src/components/KanbanView.jsx`
  (regroupement configurable, persistance de l'ordre dans la colonne —
  `destination.index` est aujourd'hui ignoré), `client/src/App.jsx`
- **Dépend de :** 2.1 (statuts par tableau) et 1.17 (mémoïsation).

### 2.7 Validation systématique — complexité **Moyen**

- **À créer :** `server/src/middleware/validate.js`, `server/src/schemas/` (un
  schéma Zod par endpoint, ~15 fichiers)
- **À modifier :** les 11 routeurs
- **Bénéfice :** supprime à la racine la famille d'erreurs « 500 au lieu de 400 »
  identifiée en §1.4, et sécurise `group_id`, `color`, `icon`, `email`,
  `items[]`, `user_ids[]` et `team_ids[]`, aujourd'hui non typés.

### 2.8 Pièces jointes — complexité **Moyen**

Besoin métier explicite en pharmacotechnie : protocoles, fiches de fabrication,
rapports d'étalonnage, certificats — indissociables de la tâche qu'ils justifient.

- **À modifier :** `server/db/schema.sql`

  ```sql
  CREATE TABLE IF NOT EXISTS attachments (
    id          SERIAL PRIMARY KEY,
    task_id     INTEGER      NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    storage_key TEXT         NOT NULL,
    mime_type   VARCHAR(120),
    size_bytes  BIGINT,
    checksum    VARCHAR(64),          -- SHA-256, traçabilité qualité
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);
  ```

- **À créer :** `server/src/controllers/files.controller.js` (URL signées),
  `server/src/utils/storage.js` (client Supabase Storage),
  `client/src/components/FileUpload.jsx`
- **À modifier :** `client/src/components/TaskDetailPanel.jsx`,
  `server/.env.example` (`SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`),
  `docs/DEPLOY-SUPABASE.md` (création du bucket)
- **Sécurité :** téléversement et téléchargement par URL signées à durée limitée.
  **Ne jamais exposer la clé de service au client.**
- **Mode mock :** `File` en mémoire + URL `blob:`, pour préserver la démo.

**Livrable de la phase 2 :** circuit d'intervention modélisé et tracé, statuts
adaptés à chaque projet, colonnes typées et triables, sous-items de plein
exercice, actions groupées, `App.jsx` sous 800 lignes, documents attachables.

---

## Phase 3 — Fonctionnalités avancées et passage à l'échelle

**Objectif :** ouvrir l'outil vers l'extérieur et tenir la charge.

### 3.1 Temps réel par SSE — complexité **Moyen**

SSE plutôt que WebSocket : unidirectionnel serveur → client, suffisant ici,
traverse les proxys sans configuration, supporté par Render.

- **À créer :** `server/src/routes/events.js`
  (`GET /api/events?board_id=…`, `Content-Type: text/event-stream`),
  `server/src/utils/eventBus.js`, `client/src/hooks/useBoardEvents.js`
- **À modifier :** les contrôleurs de mutation (émission après `COMMIT`),
  `client/src/App.jsx` (application des événements entrants),
  `server/src/index.js`
- **Points de vigilance :**
  - Ne pas réappliquer à l'émetteur ses propres événements (identifiant de client
    en en-tête, comparé à l'émission).
  - Render coupe les connexions inactives : battement de cœur (`: ping`) / 30 s.
  - **Un bus en mémoire ne fonctionne qu'avec une seule instance d'API.** Pour la
    mise à l'échelle horizontale, passer par `LISTEN`/`NOTIFY` PostgreSQL —
    disponible via `pg`, et supporté par le pooler *session* de Supabase (mais
    **pas** par le pooler *transaction*). À noter dans `docs/DEPLOY-SUPABASE.md`.
- **En mode mock :** aucun événement, comportement actuel préservé.

### 3.2 Moteur d'automatisations — complexité **Élevé**

Généralise les trois règles aujourd'hui écrites en dur dans trois contrôleurs.

- **À modifier :** `server/db/schema.sql`

  ```sql
  CREATE TABLE IF NOT EXISTS automations (
    id         SERIAL PRIMARY KEY,
    board_id   INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT true,
    trigger    JSONB   NOT NULL,   -- { type: 'status_change', to_is_blocked: true }
    conditions JSONB   NOT NULL DEFAULT '[]'::jsonb,
    actions    JSONB   NOT NULL,   -- [{ type: 'notify', target: 'assignees' }]
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_automations_board ON automations(board_id);

  CREATE TABLE IF NOT EXISTS automation_runs (
    id            SERIAL PRIMARY KEY,
    automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    task_id       INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    status        TEXT    NOT NULL,
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```

- **À créer :** `server/src/services/automation.js` (évaluation),
  `server/src/services/actions/` (`notify.js`, `changeStatus.js`, `assign.js`,
  `createTask.js`, `webhook.js`),
  `server/src/controllers/automations.controller.js`,
  `server/src/services/scheduler.js` (aucun ordonnanceur n'existe aujourd'hui —
  c'est pourquoi `due_soon` est déclarée et jamais produite),
  `client/src/components/AutomationBuilder.jsx` (composeur « Quand… Alors… »)
- **Déclencheurs de départ :** changement de statut, échéance approchante,
  création d'item, changement d'assigné, franchissement d'étape (s'appuie sur 2.2).
- **Garde-fous indispensables :** détection de récursion (une action qui
  redéclenche son propre déclencheur), plafond d'exécutions par minute et par
  projet, journalisation dans `automation_runs`.
- **Migration :** réimplémenter la règle « Bloqué → alerte » comme automatisation
  par défaut — **en corrigeant au passage ses deux trous** : elle ne se déclenche
  pas sur les sous-items, et ne produit rien si la tâche n'a pas de responsable.

### 3.3 Webhooks et accès API externe — complexité **Élevé**

Ouvre l'intégration Make / n8n.

- **À modifier :** `server/db/schema.sql`

  ```sql
  CREATE TABLE IF NOT EXISTS api_keys (
    id           SERIAL PRIMARY KEY,
    name         TEXT   NOT NULL,
    key_hash     TEXT   NOT NULL UNIQUE,
    scopes       TEXT[] NOT NULL DEFAULT '{read}',
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id         SERIAL PRIMARY KEY,
    board_id   INTEGER REFERENCES boards(id) ON DELETE CASCADE,
    url        TEXT    NOT NULL,
    events     TEXT[]  NOT NULL,
    secret     TEXT    NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```

- **À créer :** `server/src/middleware/apiKey.js` (en-tête `X-API-Key`, hachage
  scrypt comme pour les mots de passe),
  `server/src/services/webhookDispatcher.js` (signature HMAC, réessais avec recul
  exponentiel, désactivation après échecs répétés), `docs/API.md`,
  `client/src/components/ApiKeysPanel.jsx`
- **Sécurité :** clé affichée **une seule fois** à la création, seul le hash est
  stocké ; portées `read`/`write` distinctes ; `last_used_at` journalisé.
- **Attention :** valider l'URL de destination pour éviter les requêtes vers des
  adresses internes (SSRF) — refuser `localhost`, `169.254.169.254` et les plages
  privées.

### 3.4 Filtrage serveur, pagination et virtualisation — complexité **Élevé**

Le serveur ne sait aujourd'hui **ni filtrer, ni trier, ni rechercher** les
tâches : `getBoardFull` n'a qu'un prédicat (`board_id`) et un tri figé.

- **À modifier :** `server/src/controllers/boards.controller.js` (paramètres
  `status`, `assignee`, `priority`, `q`, `limit`, `cursor`),
  `client/src/api/httpApi.js` + `mockApi.js`,
  `client/src/components/GroupTable.jsx`
- **À créer :** `server/src/controllers/search.controller.js`
  (`GET /api/search?q=` transverse — inexistant aujourd'hui, alors que la
  recherche est limitée au nom de tâche du projet courant),
  `client/src/components/VirtualGroupTable.jsx`
- **Dépendance à ajouter :** `@tanstack/react-virtual`
- **Point d'attention majeur :** l'interpolation de `req.query.sort` dans un
  `ORDER BY` créerait la **première** faille d'injection du projet. Liste blanche
  obligatoire dès la conception.
- **Difficulté connue :** la virtualisation cohabite mal avec
  `@hello-pangea/dnd` et avec le scroll horizontal synchronisé
  (`App.jsx:1104-1118`). Arbitrer **avant** de commencer entre « glisser-déposer
  désactivé au-delà de N lignes » et migration vers `dnd-kit`.
- **Seuil :** ne virtualiser qu'au-delà de ~200 lignes affichées.

### 3.5 Relations entre tableaux et colonnes miroir — complexité **Élevé**

- **À modifier :** `server/db/schema.sql`

  ```sql
  CREATE TABLE IF NOT EXISTS item_links (
    id         SERIAL PRIMARY KEY,
    column_id  INTEGER NOT NULL REFERENCES custom_categories(id) ON DELETE CASCADE,
    source_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (column_id, source_id, target_id),
    CHECK (source_id <> target_id)
  );
  CREATE INDEX IF NOT EXISTS idx_item_links_source ON item_links(source_id);
  CREATE INDEX IF NOT EXISTS idx_item_links_target ON item_links(target_id);
  ```

- **À créer :** `client/src/components/LinkedTasksCell.jsx`,
  `client/src/components/TaskPicker.jsx`
- **À modifier :** `AddColumnButton.jsx` (types « Connexion » et « Miroir »),
  `columnKinds.js` (créé en 2.3), `boards.controller.js` (résolution des miroirs
  à la lecture)
- **Point dur :** limiter la profondeur à **un seul saut** (pas de miroir de
  miroir) et refuser les cycles.
- **Cas d'usage métier :** rattacher une déviation ou une CAPA (projet Qualité) à
  l'ordonnancement de production, aujourd'hui impossible — les dépendances sont
  explicitement bornées à un projet.

### 3.6 Vues enregistrées et préférences serveur — complexité **Moyen**

- **À modifier :** `server/db/schema.sql`

  ```sql
  CREATE TABLE IF NOT EXISTS saved_views (
    id         SERIAL PRIMARY KEY,
    board_id   INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    view_type  TEXT    NOT NULL,
    config     JSONB   NOT NULL,       -- filtres, tri, colonnes visibles, largeurs
    is_shared  BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_saved_views_board ON saved_views(board_id);
  ```

- **À créer :** `server/src/controllers/views.controller.js`,
  `client/src/components/SavedViewsBar.jsx`
- **À modifier :** `client/src/lib/useColumnWidths.js` (bascule de `localStorage`
  vers le serveur, avec repli local hors connexion) — les largeurs sont
  aujourd'hui par navigateur, donc perdues au changement de poste.
- **Remplace** la solution locale de 1.16, dont `localStorage` devient le cache.

### 3.7 Notifications e-mail — complexité **Moyen**

- **À créer :** `server/src/services/mailer.js` (Resend ou SMTP),
  `server/src/templates/` (gabarits en français)
- **À modifier :** `server/src/controllers/alerts.controller.js`,
  `server/.env.example`, `docs/DEPLOY-SUPABASE.md`
- **Déclenchement :** échéance à J-1, mention, assignation — s'appuie sur
  l'ordonnanceur créé en 3.2. Préférences par utilisateur
  (`users.email_preferences JSONB`).
- **À prévoir :** file d'attente minimale et regroupement, pour qu'une
  modification en masse ne devienne pas une avalanche de courriels.

### 3.8 Fusion de `task_columns` et typage progressif — complexité **Élevé**

Deux chantiers de fond, à traiter en dernier.

- **Fusion :** `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status/admin_id/duedate/updated_at`
  + rétro-remplissage idempotent + vue de compatibilité, puis retrait de
  `task_columns` et `sub_task_columns`. Gain : −2 tables, −4 chemins d'upsert
  complexes, requêtes Gantt divisées par deux, et fin de la fragmentation
  `start_date` / `duedate`. **À faire avant d'ajouter de nouveaux attributs natifs.**
- **TypeScript :** créer `client/tsconfig.json` (`allowJs: true`,
  `checkJs: false`) et `client/src/types/index.ts` (`Board`, `Group`, `Task`,
  `SubTask`, `User`, `Column`). Convertir fichier par fichier, en commençant par
  `lib/`, `api/`, puis `state/` (créé en 2.4). **`App.jsx` en dernier**, après 2.4.
  Ne jamais convertir globalement en un commit.

**Livrable de la phase 3 :** collaboration en direct, automatisations
configurables sans développement, ouverture aux outils tiers, recherche et
filtrage serveur, et tenue de charge au-delà du millier de tâches.

---

## Récapitulatif par complexité

| Complexité | Tâches |
|---|---|
| **Faible** | 1.2 Bundle · 1.3 `categoryValue` · 1.4 Index · 1.5 Erreurs PG · 1.6 Vues rebranchées · 1.7 Bugs d'interaction · 1.8 Co-assignés · 1.9 Filtres et éditabilité · 1.11 Requêtes parallèles · 1.13 Erreurs visibles · 1.14 Limitation de débit · 1.15 Description et historique · 1.16 Parité mobile |
| **Moyen** | 1.1 Tests · 1.10 Agrégats · 1.12 Cascade Gantt · 1.17 Mémoïsation · 2.1 Statuts par tableau · 2.3 Types de colonnes · 2.5 Parité sous-items · 2.6 Actions groupées · 2.7 Validation · 2.8 Pièces jointes · 3.1 SSE · 3.6 Vues enregistrées · 3.7 Courriels |
| **Élevé** | 2.2 Étapes d'intervention · 2.4 Extraction de l'état · 3.2 Automatisations · 3.3 Webhooks et API · 3.4 Filtrage serveur et virtualisation · 3.5 Relations entre tableaux · 3.8 Fusion et typage |

## Si le temps manque : les six tâches à ne pas sacrifier

1. **1.1 — Tests.** Le projet est en production sans filet.
2. **1.2 — Débloquer le bundle.** Deux lignes à changer, puis du mécanique. Gain
   immédiat pour tous les utilisateurs, décisif sur téléphone.
3. **1.4 + 1.5 — Index et erreurs PostgreSQL.** Une demi-journée chacun ; ils
   suppriment des balayages complets de table et une famille entière de 500.
4. **1.6 + 1.7 — Bugs confirmés.** Deux fonctionnalités sont aujourd'hui
   inatteignables, et le reporting affiche des chiffres faux.
5. **2.2 — Étapes et sous-étapes d'intervention.** C'est le cœur métier, et la
   seule tâche que personne d'autre ne peut spécifier à votre place.
6. **3.1 — Temps réel.** Sans lui, « outil collaboratif » reste un abus de
   langage : deux personnes s'écrasent aujourd'hui en silence.

---

## Suivi du document

Ce rapport reflète l'état du dépôt en juillet 2026. Il devient inexact dès que
les tâches ci-dessus sont réalisées : conformément à la règle du dépôt (« quand
une évolution rend un de ces fichiers inexact, mettre à jour la doc dans le même
commit »), cocher ou retirer ici les tâches livrées, retirer les bugs corrigés de
la §1.6, et corriger les mesures citées en §1.4 après les optimisations de la
phase 1.
