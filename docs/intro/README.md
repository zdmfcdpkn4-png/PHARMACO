# Intro animée de PHARMACO

Vidéo de **42 s** jouée à l'ouverture du site : motion design en vue 3D
isométrique, ton décontracté, mascotte **Fiole** (la fiole de l'emblème de la
pharmacotechnie). Deux montages :

| Fichier servi | Format | Pour |
|---|---|---|
| `client/public/intro/intro-paysage.mp4` | 1920 × 1080 | écrans plus larges que hauts |
| `client/public/intro/intro-portrait.mp4` | 1080 × 1920 | téléphone en portrait |

Quand et comment le site la joue (première ouverture, « Revoir l'intro »,
son coupé, « Passer »…) : section « Introduction animée » de
[`CLAUDE.md`](../../CLAUDE.md), code dans `client/src/lib/intro.js` et
`client/src/components/IntroOuverture.jsx`.

Ce dossier en est la **source** : on ne retouche jamais les MP4 à la main, on
modifie la composition et on régénère.

## Le script

| Temps | Acte | À l'écran |
|---|---|---|
| 0 → 4 s | L'unité sort de terre | Tampon du logo de la pharmacotechnie, le décor de l'unité s'élève. |
| 4 → 10,5 s | Le circuit d'une chimio | « Ici, on prépare les chimios. » / « Rien n'est laissé au hasard. » — rail Prescription · Validation · Préparation · Contrôle · Libération ; la poche suit le circuit jusqu'à « → Hôpital de jour », Fiole l'accompagne. |
| 10,5 → 15 s | Ça s'empile | « Et à côté… les projets s'empilent. » — classeurs, post-it, téléphone, bulles « C'est pour quand ? », « Qui s'en charge ? », « On en est où ? ». |
| 15 → 20,5 s | PHARMACO entre en scène | « On respire. » → « PHARMACO met de l'ordre. » — le logo aspire la pile et la range en tableau de suivi. |
| 20,3 → 31 s | Le tour des vues | Kanban « Qui fait quoi. », Gantt « Pour quand. », circuit « Où on en est. », messages « L'urgent passe devant. » |
| 31 → 36 s | Le tableau de bord | « Et un tableau de bord pour piloter. » — indicateurs, anneau des statuts (et barres hebdomadaires en paysage). |
| 36,5 → 42 s | Signature | PHARMACO, « L'équipe et ses projets, en un coup d'œil. », l'équipe salue, le logo de la pharmacotechnie en coin. |

## Fabrication

- **Visuels et sons : FLORA.** Décor isométrique de l'unité, personnages
  (pharmacienne, préparateur, cadre, logisticien), Fiole en six poses,
  accessoires détourés ; musique et bruitages (pop, whoosh, ding, cloche).
- **Montage : HyperFrames.** La vidéo est une page HTML animée par une
  **seule** timeline GSAP, que HyperFrames rend image par image. Les deux
  formats partent de la même source `src/intro.html` ; ce qui diffère est
  choisi par `K(valeurPaysage, valeurPortrait)`.

```
docs/intro/
├── src/intro.html     # LA composition (jetons {{W}}, {{H}}, {{FORMAT}})
├── build.mjs          # génère .rendu/paysage et .rendu/portrait (ignorés par git)
├── rendre.sh          # rendu des deux formats + encodage web → client/public/intro/
├── hyperframes.json
└── assets/            # img (FLORA + logos), audio (FLORA), fonts (Figtree), js (GSAP)
```

## Modifier puis régénérer

```bash
cd docs/intro
node build.mjs                        # prépare .rendu/paysage et .rendu/portrait
cd .rendu/paysage && npm run dev      # aperçu interactif (idem dans .rendu/portrait)

# Contrôler une image précise, dans les DEUX formats :
npx --yes hyperframes@0.8.150 snapshot --at 12.5 .rendu/paysage
npx --yes hyperframes@0.8.150 snapshot --at 12.5 .rendu/portrait

bash rendre.sh                        # ~2 min par format → client/public/intro/*.mp4
```

Puis `npm run build` dans `client/`, vérification dans le navigateur, et commit
des deux MP4 **avec** la source modifiée.

Règles de la composition (sinon le rendu diffère de l'aperçu, ou d'un rendu à
l'autre) :

- **Déterministe** : jamais `Math.random()` ni l'heure courante ; le hasard
  passe par `hasard(n)`, qui rend toujours la même valeur pour le même `n`.
- **Une seule timeline**, en pause, enregistrée en dernier
  (`window.__timelines["main"] = tl`). Une tween qui démarre après une autre
  sur la même propriété prend `immediateRender: false`.
- Ne pas animer avec GSAP une propriété déjà posée par une transformation CSS
  sur le même élément.
- Les titres entrent mot à mot (`titre(...)`) ; un `\n` dans le texte impose le
  retour à la ligne — aucun mot ne doit rester seul sur sa ligne.
- Tout changement se vérifie dans **les deux** formats.

## Ressources et licences

- Police **Figtree** (SIL Open Font License), embarquée : aucun appel réseau
  au rendu.
- **GSAP** (licence standard gratuite de GreenSock/Webflow).
- Logos PHARMACO et pharmacotechnie : identité du service (CHD).
- Visuels, musique et bruitages générés avec FLORA pour ce projet.
