import { useEffect, useRef, useState } from 'react';
import { ChevronRight, History, Loader2, RefreshCw } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { api } from '../api/index.js';
import { horodatage, libelleActivite, quiActivite, quoiActivite } from '../lib/activity.js';

// Traçabilité des modifications d'une tâche : QUI a changé QUOI, et QUAND.
//
// Réservée aux administrateurs (le montage est conditionné côté appelant, et
// la route serveur `GET /tasks/:id/activity` exige `requireAdmin` — le masquage
// d'interface n'est qu'un confort).
//
// REPLIÉE par défaut, et le journal n'est demandé qu'à la première ouverture :
// la fiche de tâche s'ouvre depuis toutes les vues, on ne va pas lui coller un
// appel réseau supplémentaire à chaque fois pour un contenu rarement consulté.
export default function TaskAuditTrail({ taskId }) {
  const [ouvert, setOuvert] = useState(false);
  const [entrees, setEntrees] = useState(null); // null = jamais chargé
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const conteneurRef = useRef(null);

  // La section vit en bas d'une fiche qui défile : dépliée, son contenu naît
  // sous la ligne de flottaison. On l'y ramène — y compris après l'arrivée des
  // entrées, qui font grandir le bloc.
  useEffect(() => {
    if (ouvert) conteneurRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [ouvert, entrees]);

  // Changer de tâche remet la section dans son état initial : replié, vierge.
  useEffect(() => {
    setOuvert(false);
    setEntrees(null);
    setErreur(null);
  }, [taskId]);

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
      setEntrees(await api.getActivity(taskId));
    } catch (e) {
      setErreur(e.message || 'Journal indisponible');
    } finally {
      setChargement(false);
    }
  };

  const basculer = () => {
    const suivant = !ouvert;
    setOuvert(suivant);
    if (suivant && entrees === null && !chargement) charger();
  };

  return (
    <div ref={conteneurRef} className="mt-4 overflow-hidden rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
      >
        <ChevronRight
          size={16}
          className={`shrink-0 text-gray-400 transition-transform ${ouvert ? 'rotate-90' : ''}`}
        />
        <History size={16} className="shrink-0 text-gray-400" />
        <span className="flex-1 truncate font-medium">Traçabilité des modifications</span>
        <span className="shrink-0 rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary">
          Admin
        </span>
      </button>

      {ouvert && (
        <div className="border-t border-gray-100 px-3 py-2">
          {chargement && (
            <p className="flex items-center gap-2 py-4 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Chargement du journal…
            </p>
          )}

          {!chargement && erreur && (
            <div className="py-3 text-sm">
              <p className="text-status-blocked">{erreur}</p>
              <button
                type="button"
                onClick={charger}
                className="mt-2 flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1.5 text-gray-600 hover:border-primary hover:text-primary"
              >
                <RefreshCw size={13} /> Réessayer
              </button>
            </div>
          )}

          {!chargement && !erreur && entrees?.length === 0 && (
            <p className="py-4 text-sm text-gray-400">
              Aucune modification enregistrée depuis la création.
            </p>
          )}

          {!chargement && !erreur && entrees?.length > 0 && (
            <ol className="divide-y divide-gray-50">
              {entrees.map((a) => (
                <li key={a.id} className="flex gap-2.5 py-2.5">
                  <Avatar
                    name={quiActivite(a)}
                    src={a.user?.avatar_url}
                    size={26}
                    ring={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {quoiActivite(a)}
                      </span>
                      <span className="text-xs text-gray-400">{horodatage(a.created_at)}</span>
                    </div>
                    <p className="mt-0.5 break-words text-sm text-gray-700">{libelleActivite(a)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
