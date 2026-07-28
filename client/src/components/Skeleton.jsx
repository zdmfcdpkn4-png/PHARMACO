import useIsMobile from '../lib/useIsMobile.js';

// Écrans fantômes affichés pendant un chargement, pour éviter le saut de mise
// en page et donner une impression de rapidité.
//
// Contrainte assumée : ces composants n'introduisent AUCUNE couleur ni aucun
// rayon nouveau — uniquement des utilitaires déjà employés ailleurs dans
// l'application (bg-gray-200, bg-white, border-gray-200, rounded, rounded-lg).
// La pulsation est neutralisée automatiquement pour les personnes ayant
// demandé un mouvement réduit (voir index.css).

// Brique de base : un bloc gris pulsant.
export function Squelette({ className = '' }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

// Gabarit d'écran complet.
//   variant = 'table'  -> lignes pleine largeur (gabarit bureau)
//   variant = 'cards'  -> cartes empilées (gabarit mobile)
//   variant = 'auto'   -> suit le type d'appareil courant
export function SqueletteVue({ variant = 'auto', rows = 6 }) {
  const isMobile = useIsMobile();
  const gabarit = variant === 'auto' ? (isMobile ? 'cards' : 'table') : variant;
  const lignes = Array.from({ length: rows });

  if (gabarit === 'cards') {
    return (
      <div className="flex-1 space-y-2 overflow-hidden bg-canvas px-3 py-3" aria-hidden="true">
        <Squelette className="mb-3 h-5 w-32" />
        {lignes.map((_, i) => (
          <div key={i} className="rounded-xl border-l-4 border-gray-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <Squelette className="h-4 w-1/2" />
              <Squelette className="h-[30px] w-[30px] rounded-full" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Squelette className="h-5 w-20 rounded-full" />
              <Squelette className="h-4 w-12 rounded-full" />
              <Squelette className="ml-auto h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden px-6 py-5" aria-hidden="true">
      <Squelette className="mb-3 h-6 w-40" />
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {/* En-tête de colonnes */}
        <div className="flex items-center gap-4 border-b border-gray-200 px-4 py-3">
          <Squelette className="h-3 w-40" />
          <Squelette className="h-3 w-20" />
          <Squelette className="h-3 w-20" />
          <Squelette className="h-3 w-24" />
          <Squelette className="h-3 w-20" />
        </div>
        {lignes.map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-200 px-4 py-3">
            <Squelette className="h-4 w-40" />
            <Squelette className="h-5 w-16 rounded-full" />
            <Squelette className="h-7 w-7 rounded-full" />
            <Squelette className="h-6 w-24" />
            <Squelette className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Message d'attente accessible, à placer à côté d'un SqueletteVue (qui est
// lui-même aria-hidden : un lecteur d'écran n'a rien à faire des blocs gris).
export function AnnonceChargement({ children = 'Chargement en cours…' }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {children}
    </span>
  );
}
