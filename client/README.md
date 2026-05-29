# PHARMACO — Frontend (React + Vite)

Interface de gestion de projet fidèle à Monday.com : React + Tailwind CSS + Lucide React.

## Installation

```bash
cd client
npm install
cp .env.example .env
```

## Lancement

```bash
npm run dev      # http://localhost:5173
npm run build    # build de production
npm run preview  # prévisualiser le build
```

## Mode démo vs API réelle

Par défaut l'app tourne en **mode démo** : les données sont en mémoire
(`src/api/mockApi.js`), aucune base de données n'est requise.

Pour brancher le backend Express, éditer `.env` :

```env
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:4000/api
```

## Composants principaux

| Composant      | Rôle                                                                  |
| -------------- | -------------------------------------------------------------------- |
| `Sidebar`      | Navigation (espaces, agents, favoris, contenu)                       |
| `BoardHeader`  | Titre éditable + barre d'outils (ajouter, rechercher, filtrer, trier) |
| `GroupTable`   | Section pliable d'un groupe (en-tête, tâches, résumé)                |
| `TaskRow`      | Ligne de tâche (checkbox, nom éditable, admin, statut, échéance)     |
| `StatusBadge`  | Badge de statut coloré + popover de changement                       |
| `AdminCell`    | Avatar + menu d'assignation                                          |
| `GroupSummary` | Barre de progression au prorata des statuts + plage de dates         |
| `AlertsPanel`  | Cloche de notifications (alertes « Bloqué »)                         |

## Interactivité
- **CRUD** : groupes, tâches, statut, admin, échéance.
- **Mises à jour optimistes** : l'UI réagit immédiatement, rollback si l'API échoue.
- **Filtres** : recherche texte, filtre par personne, filtre par statut.
- **Alertes** : passage au statut « Bloqué » → alerte (serveur en mode API, mémoire en mode démo).
