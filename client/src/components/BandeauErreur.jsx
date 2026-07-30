import { X } from 'lucide-react';

// Bandeau d'erreur transitoire, rendu UNE SEULE FOIS par branche de rendu.
//
// `role="alert"` + `aria-live="assertive"` : le message est annoncé par les
// lecteurs d'écran dès son insertion — l'ancien bandeau était un simple div,
// donc totalement muet.
//
// FLOTTANT et au-dessus de tout (`z-[80]`) : dans le flux, il était recouvert
// par la fiche de tâche (aside `z-50`) et par les feuilles inférieures
// (`z-60`). Un échec d'API déclenché depuis la fiche — assigner, changer un
// statut — passait donc totalement inaperçu sur téléphone : l'écran ne
// bougeait pas et rien n'expliquait pourquoi.
export default function BandeauErreur({ message, onFermer }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="no-print fixed inset-x-0 top-0 z-[80] mx-auto flex max-w-2xl items-center gap-2 rounded-b-xl border border-t-0 border-red-200 bg-red-50 px-4 py-2 text-sm text-status-blocked shadow-lg md:px-6"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onFermer}
        title="Masquer ce message"
        className="rounded-md p-1 hover:bg-gray-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
