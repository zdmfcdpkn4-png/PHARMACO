# Charte graphique — PHARMACO (charte CHD)

Identité visuelle alignée sur la charte du CHD : **bleu foncé** et **rose** en
couleurs majoritaires, **teal** et **jaune** en accents ponctuels.

## Logo
- Marque florale : couronne de pétales colorés autour d'un **« P »**.
- Composant réutilisable : `client/src/components/Logo.jsx`
  - `<Logo size={40} />` — marque seule
  - `<Logo size={72} withRing />` — avec anneau (page de connexion)
- Déclinaison avatars : `client/src/components/PharmacoAvatar.jsx`
  (couronne de pétales CHD + initiales ou motif pharmacie au centre).

## Palette de couleurs

Source unique : **`client/design.tokens.js`** (consommé par
`client/tailwind.config.js`). Modifier ce fichier re-thème toute l'application.

| Rôle | Nom Tailwind | Hex | Usage |
| --- | --- | --- | --- |
| Bleu CHD | `primary` / `brand.blue` | `#005586` | Couleur principale : boutons, onglets actifs |
| Bleu (hover) | `primary.hover` | `#00415f` | Survol des boutons |
| Bleu clair | `primary.light` | `#e1edf3` | Fonds d'accent |
| Rose CHD | `brand.rose` | `#e82a63` | Urgent, prioritaire, accents forts |
| Teal CHD | `brand.teal` | `#46b4b3` | Accent (statut « Fait ») |
| Jaune CHD | `brand.yellow` | `#f4c137` | Accent (statut « En cours ») |
| Fond | `canvas` | `#eef4f8` | Fond d'application (bleuté très clair) |

Alias rétro-compatibles : `brand.purple` → bleu, `brand.orange` → rose,
`brand.lilac` → teal (anciennes références du logo floral).

### Statuts de tâche
Définis dans `client/src/lib/constants.js` (`STATUS_META`), avec une couleur
de **texte** dédiée pour la lisibilité (texte foncé sur le jaune clair) :

| Statut | Couleur | Hex fond | Texte |
| --- | --- | --- | --- |
| À faire | gris bleuté | `#9aadbd` | blanc |
| En cours | jaune CHD | `#f4c137` | `#4a3a00` (foncé) |
| Fait | teal CHD | `#46b4b3` | blanc |
| Bloqué | rose CHD | `#e82a63` | blanc |

### Priorités (`PRIORITY_META`)
| Priorité | Couleur | Hex |
| --- | --- | --- |
| P1 — Urgent | rose CHD | `#e82a63` |
| P2 — Élevé | jaune CHD | `#f4c137` (texte foncé) |
| P3 — Normal | bleu CHD | `#005586` |

## Typographie
- Police : **Figtree**, repli `Roboto`, `system-ui`, `Segoe UI`, sans-serif.
- Titres : `font-bold` ; éléments actifs en `text-primary` (bleu CHD).

## Configuration
Couleurs et police : `client/design.tokens.js` → classes Tailwind
(`bg-primary`, `text-brand-rose`, `bg-status-done`, …). Pastilles
statut/priorité : toujours utiliser `bg` **et** `text` de `STATUS_META` /
`PRIORITY_META` (jamais `text-white` en dur). Guide de refonte visuelle :
`docs/DESIGN.md`.
