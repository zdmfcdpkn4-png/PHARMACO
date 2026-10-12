// Introduction animée de PHARMACO : une vidéo de 42 s montée avec HyperFrames
// à partir de visuels et d'une musique générés avec FLORA (source :
// docs/intro/). Composant : components/IntroOuverture.jsx.
//
// Quand : à la première ouverture du site sur chaque appareil, puis à la
// demande (« Revoir l'intro » : rail latéral sur ordinateur, feuille « Profil »
// sur téléphone). Le passage est retenu sur l'appareil, qu'elle ait été vue
// jusqu'au bout ou passée.
// Jamais d'elle-même si l'appareil demande moins d'animations.

const CLE_VUE = 'pharmaco_intro_vue';

// Stockage indisponible (navigation privée stricte) : on la considère vue,
// plutôt que de la rejouer à chaque ouverture.
export function introDejaVue() {
  try {
    return localStorage.getItem(CLE_VUE) !== null;
  } catch {
    return true;
  }
}

export function marquerIntroVue() {
  try {
    localStorage.setItem(CLE_VUE, new Date().toISOString());
  } catch {
    /* stockage indisponible : rien à retenir */
  }
}

export function mouvementReduit() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// Joue-t-elle à l'ouverture du site ?
export function introAuLancement() {
  return !introDejaVue() && !mouvementReduit();
}

// Deux montages : 16:9 pour les écrans plus larges que hauts, 9:16 sinon
// (téléphone en portrait). Choisi une fois, à l'ouverture de l'intro.
export function sourceIntro() {
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  const base = import.meta.env.BASE_URL || '/';
  return `${base}intro/${portrait ? 'intro-portrait' : 'intro-paysage'}.mp4`;
}
