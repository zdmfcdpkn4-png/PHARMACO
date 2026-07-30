# Répartition des droits par rôle

Trois rôles globaux : **Observateur** (`viewer`), **Membre** (`member`),
**Admin** (`admin`). Certaines actions de structure dépendent aussi du
**propriétaire** du projet (`created_by`).

| Action | Observateur | Membre | Admin |
|---|:---:|:---:|:---:|
| Consulter les projets, tâches et toutes les vues | ✅ | ✅ | ✅ |
| Consulter la vue d'ensemble | ✅ | ✅ | ✅ |
| Modifier une tâche (statut, priorité, échéance, assignation, étiquettes) | ❌ | ✅ | ✅ |
| Créer des tâches / sous-tâches | ❌ | ✅ | ✅ |
| Commenter / envoyer des messages (ciblés, prioritaires) | ❌ | ✅ | ✅ |
| Créer un projet | ❌ | ✅ | ✅ |
| Personnaliser un projet (nom, couleur, vignette) | ❌ | ✅ ¹ | ✅ |
| Associer des équipes à un projet | ❌ | ✅ ¹ | ✅ |
| Créer des groupes / colonnes personnalisées | ❌ | ✅ ¹ | ✅ |
| Archiver / restaurer une **tâche** | ❌ | ✅ ³ | ✅ |
| **Supprimer une tâche** | ❌ | ❌ | ✅ |
| **Supprimer un groupe** | ❌ | ❌ | ✅ |
| **Archiver un projet** | ❌ | ❌ | ✅ |
| **Supprimer un projet** | ❌ | ❌ | ✅ |
| Restaurer un projet archivé | ❌ | ❌ | ✅ ² |
| **Consulter la traçabilité d'une tâche** (qui / quoi / quand) | ❌ | ❌ | ✅ ⁴ |
| Gérer les agents (annuaire : créer, modifier, mot de passe, supprimer) | ❌ | ❌ | ✅ |
| Gérer les équipes (créer, renommer, supprimer, membres) | ❌ | ❌ | ✅ |

¹ Réservé au **propriétaire du projet** (celui qui l'a créé) ou à un **admin**.
² La restauration est proposée à tous depuis la liste des archivés ; la
  suppression définitive depuis cette liste reste réservée aux admins.
³ Volontairement ouvert aux éditeurs (`tasks.archived`, via `PATCH /tasks/:id`
  sous `requireEditor`) : une tâche créée par erreur doit pouvoir être rangée
  sans attendre un administrateur. Rien n'est perdu — la tâche reste en base
  et se retrouve avec « Afficher les archivées ». La **suppression**, elle,
  reste admin. À ne pas confondre avec l'archivage d'un **projet**, admin.
⁴ `GET /tasks/:id/activity` sous `requireAdmin`. C'est une donnée de
  **contrôle**, pas de travail : elle dit qui a fait quoi. Les **deux**
  affichages qui la lisent suivent la règle — la section « Traçabilité des
  modifications » de la fiche de tâche et l'onglet « Historique » du tiroir de
  discussion sont l'un et l'autre masqués aux non-admins. Le tiroir ne demande
  même pas le journal dans ce cas, pour ne pas se solder par un 403.

## Où c'est appliqué

- **Frontend** (`client/src/App.jsx`) : `isAdmin`, `isViewer`, `canEdit`,
  `canManageBoard` (propriétaire ou admin), `canDeleteTask` (= admin),
  `canDeleteGroup` (= admin).
- **Backend** (autorité) — middlewares de `server/src/middleware/auth.js` :
  - `requireAuth` : **toutes** les routes de l'API (hors `/auth/login`,
    `/auth/change-password` — authentifié par le mot de passe actuel — et
    `/api/health`) exigent un jeton valide (expiration : 30 jours,
    `AUTH_TOKEN_TTL_DAYS`).
  - `requireEditor` : toutes les mutations (POST/PATCH/PUT) refusent les
    observateurs (`viewer` = lecture seule).
  - `requireAdmin` : suppressions de tâche / sous-item / groupe / projet /
    **étape du circuit**, archivage d'un projet, `POST /auth/set-password`,
    gestion `users` / `teams`, **lecture du journal d'activité**
    (`GET /tasks/:id/activity`).
  - Cas particuliers : `PUT /boards/:id/teams` vérifie propriétaire-ou-admin ;
    alertes et raccourcis sont cloisonnés à l'utilisateur authentifié.

### Circuit d'intervention (étape / sous-étape / sous-sous-étape)

| Route | Droit |
|---|---|
| `GET /boards/:boardId/steps` | authentifié |
| `POST /boards/:boardId/steps` | `requireEditor` |
| `PATCH /boards/steps/:id` | `requireEditor` |
| `PUT /boards/steps/reorder` | `requireEditor` |
| `POST /boards/steps/progress` (franchissement) | `requireEditor` |
| `DELETE /boards/steps/:id` | **`requireAdmin`** |

Le circuit compte **trois niveaux** au plus. La profondeur et l'absence de
cycle sont vérifiées par le contrôleur (`assertParentValide` à la création et
au re-parentage, revalidation de l'arbre entier après un réordonnancement) :
un lot invalide est refusé en bloc, la transaction est annulée.

Supprimer une étape retire en cascade **toute sa descendance** et les
franchissements associés, et détache les tâches concernées (leur `step_id`
repasse à `NULL`).

> La sécurité réelle est imposée côté serveur (middlewares ci-dessus). Les
> masquages côté interface ne sont qu'un confort d'usage.

## Mots de passe

- Chacun peut changer **son propre** mot de passe via
  `POST /auth/change-password` (e-mail + mot de passe actuel + nouveau,
  8 caractères minimum).
- Une réinitialisation par un admin (`POST /auth/set-password`, ou via
  l'annuaire) **impose un changement à la prochaine connexion**
  (`users.must_change_password`) ; idem pour la première connexion d'un
  compte créé sans mot de passe (mot de passe par défaut accepté une fois,
  changement immédiat exigé) et pour le compte admin amorcé en production.
