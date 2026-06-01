# Charte graphique — PHARMACO

Identité visuelle dérivée du logo floral « pharmacotechnie ».

## Logo
- Marque florale : couronne de pétales colorés autour d'un **« P »** violet.
- Composant réutilisable : `client/src/components/Logo.jsx`
  - `<Logo size={40} />` — marque seule
  - `<Logo size={72} withRing />` — avec l'anneau orange (page de connexion)
- Utilisé sur la page de connexion et dans la barre latérale.

## Palette de couleurs

| Rôle | Nom Tailwind | Hex | Usage |
| --- | --- | --- | --- |
| Violet profond | `primary` / `brand.purple` | `#3b1f7a` | Couleur principale, boutons, « P » |
| Violet (hover) | `primary.hover` | `#2e1860` | Survol des boutons |
| Violet clair | `primary.light` | `#ece6f6` | Fonds d'accent |
| Orange | `brand.orange` | `#e8722e` | Accents, anneau du logo, statut « En cours » |
| Jaune | `brand.yellow` | `#f2c94c` | Pétales, accents secondaires |
| Lilas | `brand.lilac` | `#d9a7e0` | Pétales, accents doux |
| Fond | `canvas` | `#faf7fb` | Fond d'application (lilas très clair) |

### Statuts de tâche
| Statut | Couleur | Hex |
| --- | --- | --- |
| À faire | gris | `#c4c4c4` |
| En cours | orange (marque) | `#e8722e` |
| Fait | vert | `#00c875` |
| Bloqué | rouge | `#e2445c` |

## Typographie
- Police : **Figtree**, repli `Roboto`, `system-ui`, `Segoe UI`, sans-serif.
- Titres : `font-bold`, le titre PHARMACO en `text-primary` (violet).

## Configuration
Les couleurs sont définies dans `client/tailwind.config.js` (clé `theme.extend.colors`)
et utilisables via les classes Tailwind : `bg-primary`, `text-brand-orange`,
`bg-brand-yellow`, `text-status-blocked`, etc.
