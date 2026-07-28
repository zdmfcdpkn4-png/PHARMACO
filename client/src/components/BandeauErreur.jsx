import { X } from 'lucide-react';

// Bandeau d'erreur transitoire, rendu UNE SEULE FOIS par branche de rendu.
//
// `role="alert"` + `aria-live="assertive"` : le message est annoncé par les
// lecteurs d'écran dès son insertion — l'ancien bandeau était un simple div,
// donc totalement muet.
//
// Aucun style nouveau : les classes sont reprises telles quelles du bandeau
// qu'il remplace.
export default function BandeauErreur({ message, onFermer }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="no-print flex items-center gap-2 bg-red-50 px-4 py-2 text-sm text-status-blocked md:px-6"
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
