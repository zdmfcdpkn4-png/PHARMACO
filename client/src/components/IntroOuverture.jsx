import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { sourceIntro } from '../lib/intro.js';

// Teinte des bords de la vidéo : les bandes ajoutées quand l'écran n'a pas
// les proportions du montage s'y fondent (ce n'est pas une couleur du thème).
const FOND_VIDEO = '#dae3eb';

// Fondu de sortie (ms), commun à la fin naturelle et à « Passer ».
const SORTIE_MS = 450;

// Si rien n'a commencé à jouer au bout de ce délai (réseau très lent), on rend
// la main au site plutôt que de laisser un écran figé.
const FILET_MS = 10_000;

// Introduction plein écran à l'ouverture du site (lib/intro.js dit quand).
//
// - Calque `z-[70]` : au-dessus de l'application, qui se charge dessous, mais
//   SOUS le bandeau d'erreur (`z-[80]`), qui doit rester visible.
// - Son coupé au départ : les navigateurs refusent le son automatique, et la
//   vidéo se comprend sans. Le bouton « Son » le rétablit.
// - Toujours passable : bouton « Passer », touche Échap.
// - Lecture refusée (mode économie d'énergie de l'iPhone, par exemple) : un
//   bouton « Lancer l'intro » apparaît. Vidéo introuvable : l'intro s'efface.
// - Commandes de 44 px au moins, atteignables au doigt.
export default function IntroOuverture({ onFin }) {
  const video = useRef(null);
  const boutonPasser = useRef(null);
  const fin = useRef(onFin);
  fin.current = onFin;
  const termine = useRef(false);
  const aDemarre = useRef(false);

  // Figée au montage : tourner le téléphone pendant l'intro ne la relance pas.
  const [src] = useState(sourceIntro);
  const [son, setSon] = useState(false);
  const [bloquee, setBloquee] = useState(false);
  const [sortie, setSortie] = useState(false);

  const terminer = useCallback(() => {
    if (termine.current) return;
    termine.current = true;
    setSortie(true);
    window.setTimeout(() => fin.current(), SORTIE_MS);
  }, []);

  const lancer = useCallback(() => {
    const v = video.current;
    if (!v) return;
    const essai = v.play();
    if (essai && typeof essai.then === 'function') {
      essai
        .then(() => setBloquee(false))
        .catch((e) => {
          // Lecture automatique refusée : on attend un geste.
          if (e?.name === 'NotAllowedError') setBloquee(true);
          // Vidéo introuvable ou format illisible : on rend la main au site.
          else if (e?.name === 'NotSupportedError') terminer();
        });
    }
  }, [terminer]);

  // Lecture muette dès l'ouverture : c'est la seule autorisée sans geste.
  useEffect(() => {
    if (video.current) video.current.muted = true;
    lancer();
  }, [lancer]);

  // Le focus va au bouton « Passer » ; Échap passe l'intro.
  useEffect(() => {
    boutonPasser.current?.focus({ preventScroll: true });
    const clavier = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        terminer();
      }
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  }, [terminer]);

  // Filet : chargement bloqué → on s'efface (sauf si l'on attend un geste).
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!aDemarre.current && !bloquee) terminer();
    }, FILET_MS);
    return () => window.clearTimeout(t);
  }, [bloquee, terminer]);

  const basculerSon = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setSon(!v.muted);
    // Un geste de l'utilisateur : si la lecture avait été refusée, on relance.
    if (v.paused) lancer();
  };

  const bouton =
    'flex min-h-[44px] items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-semibold text-primary shadow-lg backdrop-blur transition hover:bg-white active:scale-95';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Introduction de PHARMACO"
      className={`no-print fixed inset-0 z-[70] transition-opacity ease-in ${
        sortie ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: FOND_VIDEO, transitionDuration: `${SORTIE_MS}ms` }}
    >
      <video
        ref={video}
        src={src}
        className="h-full w-full object-contain"
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onPlaying={() => {
          aDemarre.current = true;
          setBloquee(false);
        }}
        onEnded={terminer}
        onError={terminer}
      />

      {bloquee && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button type="button" onClick={lancer} className={`${bouton} px-6 text-base`}>
            <Play size={20} /> Lancer l'intro
          </button>
        </div>
      )}

      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <button
          type="button"
          onClick={basculerSon}
          aria-pressed={son}
          aria-label={son ? 'Couper le son' : 'Activer le son'}
          className={bouton}
        >
          {son ? <Volume2 size={18} /> : <VolumeX size={18} />}
          Son
        </button>
        <button ref={boutonPasser} type="button" onClick={terminer} className={bouton}>
          Passer <SkipForward size={18} />
        </button>
      </div>
    </div>
  );
}
