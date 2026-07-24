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
| **Supprimer une tâche** | ❌ | ❌ | ✅ |
| **Supprimer un groupe** | ❌ | ❌ | ✅ |
| **Archiver un projet** | ❌ | ❌ | ✅ |
| **Supprimer un projet** | ❌ | ❌ | ✅ |
| Restaurer un projet archivé | ❌ | ❌ | ✅ ² |
| Gérer les agents (annuaire : créer, modifier, mot de passe, supprimer) | ❌ | ❌ | ✅ |
| Gérer les équipes (créer, renommer, supprimer, membres) | ❌ | ❌ | ✅ |

¹ Réservé au **propriétaire du projet** (celui qui l'a créé) ou à un **admin**.
² La restauration est proposée à tous depuis la liste des archivés ; la
  suppression définitive depuis cette liste reste réservée aux admins.

## Où c'est appliqué

- **Frontend** (`client/src/App.jsx`) : `isAdmin`, `isViewer`, `canEdit`,
  `canManageBoard` (propriétaire ou admin), `canDeleteTask` (= admin),
  `canDeleteGroup` (= admin).
- **Backend** (autorité) — middlewares de `server/src/middleware/auth.js` :
  - `requireAuth` : **toutes** les routes de l'API (hors `/auth/login` et
    `/api/health`) exigent un jeton valide (expiration : 30 jours,
    `AUTH_TOKEN_TTL_DAYS`).
  - `requireEditor` : toutes les mutations (POST/PATCH/PUT) refusent les
    observateurs (`viewer` = lecture seule).
  - `requireAdmin` : suppressions de tâche / sous-item / groupe / projet,
    archivage d'un projet, `POST /auth/set-password`, gestion `users` /
    `teams`.
  - Cas particuliers : `PUT /boards/:id/teams` vérifie propriétaire-ou-admin ;
    alertes et raccourcis sont cloisonnés à l'utilisateur authentifié.

> La sécurité réelle est imposée côté serveur (middlewares ci-dessus). Les
> masquages côté interface ne sont qu'un confort d'usage.
