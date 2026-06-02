# Retravailler l'apparence (design) sans casser le fonctionnel

Ce guide explique comment modifier l'**apparence** de PHARMACO (couleurs,
typographie, arrondis, styles) — y compris via un outil de design externe — puis
réimporter les changements dans Claude Code **sans impact fonctionnel**.

## 1. La source unique du thème : `client/design.tokens.js`

Tout le thème visuel (couleurs de marque CHD, statuts, fond, police) est
centralisé dans **`client/design.tokens.js`**. Ce fichier est consommé par
`client/tailwind.config.js`. **Modifier les valeurs ici re-thème toute l'app**,
sans toucher à la logique : les noms de classes (`bg-primary`, `text-brand-rose`,
`bg-status-done`, …) restent identiques.

```js
// extrait
export const colors = {
  canvas: '#eef4f8',
  primary: { DEFAULT: '#005586', hover: '#00415f', light: '#e1edf3' },
  brand:   { blue:'#005586', rose:'#e82a63', teal:'#46b4b3', yellow:'#f4c137' },
  status:  { progress:'#f4c137', done:'#46b4b3', blocked:'#e82a63', todo:'#9aadbd' },
};
```

**Couleurs des statuts / priorités** : les pastilles utilisent en plus une
couleur de texte (pour rester lisibles, ex. texte foncé sur jaune). Elle est
définie dans `client/src/lib/constants.js` → `STATUS_META` / `PRIORITY_META`
(`bg` + `text`). À ajuster en cohérence si vous changez les couleurs de statut.

## 2. Périmètre « sûr » (aucune conséquence fonctionnelle)

Vous pouvez éditer librement :

- `client/design.tokens.js` — couleurs, police.
- `client/tailwind.config.js` — rayons, ombres, espacements (extension du thème).
- `client/src/index.css` — styles globaux, variables CSS, fond.
- Les **classes utilitaires Tailwind** dans les composants `.jsx` (couleurs,
  marges, tailles, ombres, rayons) : purement visuel.
- Les icônes `lucide-react` (remplacer une icône par une autre).
- `client/src/components/Logo.jsx` et les avatars
  (`PharmacoAvatar.jsx`, palettes/`AVATAR_PRESETS`).

À **ne pas** modifier si l'on veut préserver le fonctionnel :

- la logique JS (hooks `useState/useEffect`, handlers `on*`, appels `api.*`) ;
- les props passées aux composants et leurs noms ;
- les fichiers `client/src/api/*`, `server/*` ;
- les `key`, `id`, conditions de rendu, structure des données.

> Règle simple : **changer du style = OK ; changer du comportement = à éviter.**

## 3. Workflow recommandé avec un outil de design

1. **Exporter la référence visuelle** : lancez l'app (`npm run dev` dans
   `client/`) et capturez les écrans clés (tableau, vue d'ensemble, vue agent,
   Kanban, Gantt, annuaire). Servez-vous-en comme base de maquette.
2. **Concevoir** dans l'outil de design en repartant des jetons ci-dessus
   (palette CHD, police Figtree, arrondis `rounded-lg/xl/2xl`).
3. **Réimporter** : reportez les nouvelles valeurs dans
   `client/design.tokens.js` (et au besoin `tailwind.config.js` /
   `index.css`). Évitez de toucher au JSX fonctionnel ; limitez-vous aux
   classes de style.
4. **Vérifier** : `npm run build` dans `client/` doit passer, puis contrôle
   visuel. Aucune route ni appel API ne doit changer.

## 4. Inventaire des composants d'UI (pour la maquette)

| Zone | Fichier |
|---|---|
| Double barre latérale (rail projets + panneau) | `src/components/Sidebar.jsx` |
| En-tête du tableau (titre, filtres, export, menu projet) | `src/components/BoardHeader.jsx` |
| Tableau (groupes, lignes, colonnes redimensionnables) | `src/components/GroupTable.jsx`, `TaskRow.jsx`, `SubtaskList.jsx` |
| Pastilles statut / priorité | `src/components/StatusBadge.jsx`, `PriorityBadge.jsx` |
| Avatars (initiales / motifs) | `src/components/Avatar.jsx`, `PharmacoAvatar.jsx` |
| Vue d'ensemble (cartes projets repliables) | `src/components/OverviewView.jsx` |
| Vue agent | `src/components/AgentView.jsx` |
| Kanban / Calendrier / Gantt / Planning | `KanbanView.jsx`, `CalendarView.jsx`, `GanttChartView.jsx`, `DynamicTimeView.jsx` |
| Modales (tâche, projet, agent) | `TaskDrawer.jsx`, `TaskDetailPanel.jsx`, `ProjectModal.jsx`, `UserDirectory.jsx` |
| Mobile | `MobileBoard.jsx`, `MobileHeader.jsx`, `MobileNav.jsx`, `BottomSheet.jsx` |
| Logo | `src/components/Logo.jsx` |

## 5. Palette de référence (CHD)

| Rôle | Hex |
|---|---|
| Bleu (principal) | `#005586` |
| Rose | `#E82A63` |
| Teal (accent) | `#46B4B3` |
| Jaune (accent) | `#F4C137` |
| Fond | `#EEF4F8` |

Police : **Figtree** (repli : Roboto, system-ui).
