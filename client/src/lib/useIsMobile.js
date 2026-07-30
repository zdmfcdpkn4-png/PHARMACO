import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Détection du type d'appareil (téléphone / tablette / ordinateur).
//
// La largeur seule ne suffit pas : un iPhone en paysage fait ~850-930 px et
// un iPad en portrait 768-834 px — tous deux passeraient en interface bureau
// avec un simple seuil à 768 px, alors que ce sont des écrans tactiles.
//
// Règles :
//  - « phone »   : écran tactile dont le PETIT côté < 600 px (portrait ou
//                  paysage : un téléphone reste un téléphone) ;
//  - « tablet »  : écran tactile dont le petit côté >= 600 px (iPad…) ;
//  - « desktop » : pointeur fin (souris / trackpad).
// ---------------------------------------------------------------------------
export function getDeviceType() {
  if (typeof window === 'undefined') return 'desktop';
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (!coarse) return 'desktop';
  const small = Math.min(window.innerWidth, window.innerHeight);
  return small < 600 ? 'phone' : 'tablet';
}

// L'interface MOBILE (cartes, navigation basse) est servie :
//  - toujours sur téléphone (portrait comme paysage) ;
//  - sur tablette tant que la largeur est < 1024 px (portrait) — en paysage
//    (>= 1024 px), l'interface bureau est confortable au doigt ;
//  - sur ordinateur quand la fenêtre est étroite (< breakpoint, défaut 768 px).
function computeIsMobile(breakpoint) {
  if (typeof window === 'undefined') return false;
  const device = getDeviceType();
  if (device === 'phone') return true;
  if (device === 'tablet') return window.innerWidth < 1024;
  return window.innerWidth < breakpoint;
}

// Pointeur grossier (doigt / stylet) — indépendant de la largeur d'écran.
//
// À utiliser quand la question est « la cible est-elle atteignable au doigt ? »
// plutôt que « quelle interface servir ? » : une tablette en paysage reçoit
// l'interface bureau (useIsMobile = false) alors qu'on y navigue au doigt, et
// une case à cocher de 16 px y est tout aussi manquable que sur un téléphone.
export function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return coarse;
}

export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => computeIsMobile(breakpoint));

  useEffect(() => {
    const update = () => setIsMobile(computeIsMobile(breakpoint));
    update();
    // resize couvre aussi les rotations ; le media query « pointer » change
    // par exemple quand une souris est branchée sur une tablette.
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const mq = window.matchMedia('(pointer: coarse)');
    mq.addEventListener('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      mq.removeEventListener('change', update);
    };
  }, [breakpoint]);

  return isMobile;
}
