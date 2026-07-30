import { useEffect, useRef, useState } from 'react';
import { UserCircle2, Check, X } from 'lucide-react';
import Avatar from './Avatar.jsx';
import BottomSheet from './BottomSheet.jsx';
import { useIsCoarsePointer } from '../lib/useIsMobile.js';

// Pile d'avatars qui s'écartent légèrement au survol.
export function AvatarStack({ people = [], size = 28, max = 4 }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex -space-x-2 transition-all hover:space-x-1">
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} src={p.avatar_url} size={size} ring />
      ))}
      {extra > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-600 ring-2 ring-white"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

// Une ligne « membre » du sélecteur : case à cocher + avatar + nom.
// `tactile` agrandit la rangée et la case pour qu'elles soient atteignables
// au doigt (44 px minimum, recommandation des guides mobiles).
function LigneMembre({ user, checked, multi, tactile, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={`flex w-full items-center gap-3 rounded-md text-left transition hover:bg-gray-100 active:bg-gray-200 ${
        tactile ? 'min-h-[48px] px-3 py-2 text-base' : 'px-2 py-1.5 text-sm'
      }`}
    >
      {multi && (
        <span
          className={`flex shrink-0 items-center justify-center rounded border ${
            tactile ? 'h-6 w-6' : 'h-4 w-4'
          } ${checked ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}
        >
          {checked && <Check size={tactile ? 16 : 12} />}
        </span>
      )}
      <Avatar name={user.name} src={user.avatar_url} size={tactile ? 30 : 24} ring={false} />
      <span className="flex-1 truncate text-gray-700">{user.name}</span>
      {!multi && checked && <Check size={tactile ? 18 : 14} className="text-primary" />}
    </button>
  );
}

// Cellule d'assignation : pile d'avatars + sélection multiple (checkboxes).
// Accepte `assignees` (tableau) ou rétro-compat `admin` (unique).
// `readOnly` : affiche les avatars sans permettre de modifier l'assignation.
//
// Sur appareil tactile, le sélecteur s'ouvre en FEUILLE INFÉRIEURE plutôt qu'en
// popover flottant : le popover mesure 224 px de large avec des cases de 16 px,
// il est positionné en absolu DANS un conteneur défilant (la fiche de tâche) et
// n'a que des retours de survol — trois raisons de rater sa cible au doigt.
// La feuille est le motif mobile du dépôt (statut, filtres, actions de projet).
export default function AdminCell({ admin, assignees, users, onAssign, onSetAssignees, readOnly = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const tactile = useIsCoarsePointer();

  // Liste effective des assignés
  const people = assignees && assignees.length ? assignees : admin ? [admin] : [];
  const selectedIds = new Set(people.map((p) => p.id));

  useEffect(() => {
    // Feuille inférieure : elle a son propre voile de fermeture.
    if (!open || tactile) return;
    // `pointerdown` couvre souris, stylet ET tactile d'une seule écoute ;
    // `mousedown` n'est qu'émulé sur tactile, et pas par tous les navigateurs.
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, tactile]);

  // Bascule un membre. Si onSetAssignees fourni -> multi, sinon -> simple (legacy).
  const toggle = (userId) => {
    if (onSetAssignees) {
      const next = new Set(selectedIds);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      onSetAssignees([...next]);
    } else {
      onAssign?.(selectedIds.has(userId) ? null : userId);
      setOpen(false);
    }
  };

  const toutRetirer = () => {
    if (onSetAssignees) onSetAssignees([]);
    else onAssign?.(null);
    setOpen(false);
  };

  const titre = people.length
    ? people.map((p) => p.name).join(', ')
    : readOnly
      ? 'Assignation'
      : 'Assigner';

  return (
    <div className="relative flex items-center justify-center" ref={ref}>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => !readOnly && setOpen((v) => !v)}
        title={titre}
        aria-haspopup={readOnly ? undefined : tactile ? 'dialog' : 'menu'}
        aria-expanded={readOnly ? undefined : open}
        // La marge négative compense l'agrandissement : la zone tactile passe
        // à 44 px sans décaler l'avatar ni la mise en page autour.
        className={`flex items-center justify-center rounded-full transition-transform ${
          readOnly ? '' : 'hover:scale-105'
        } ${readOnly ? '' : tactile ? '-m-2 p-2' : ''}`}
      >
        {people.length ? (
          <AvatarStack people={people} />
        ) : (
          <UserCircle2 size={28} className="text-gray-300" strokeWidth={1.5} />
        )}
      </button>

      {open && tactile && (
        <BottomSheet
          open
          title={onSetAssignees ? 'Assigner (plusieurs)' : 'Assigner à'}
          onClose={() => setOpen(false)}
        >
          <div className="space-y-0.5">
            {users.map((u) => (
              <LigneMembre
                key={u.id}
                user={u}
                checked={selectedIds.has(u.id)}
                multi={!!onSetAssignees}
                tactile
                onToggle={() => toggle(u.id)}
              />
            ))}
            {people.length > 0 && (
              <button
                type="button"
                onClick={toutRetirer}
                className="mt-1 flex min-h-[48px] w-full items-center gap-3 rounded-md border-t border-gray-100 px-3 py-2 text-left text-base text-gray-500 active:bg-gray-100"
              >
                <X size={18} /> Tout retirer
              </button>
            )}
          </div>
        </BottomSheet>
      )}

      {open && !tactile && (
        <div className="absolute left-1/2 top-full z-30 max-h-72 w-56 -translate-x-1/2 overflow-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
          <div className="px-2 py-1 text-xs font-semibold uppercase text-gray-400">
            {onSetAssignees ? 'Assigner (plusieurs)' : 'Assigner à'}
          </div>
          {users.map((u) => (
            <LigneMembre
              key={u.id}
              user={u}
              checked={selectedIds.has(u.id)}
              multi={!!onSetAssignees}
              tactile={false}
              onToggle={() => toggle(u.id)}
            />
          ))}
          {people.length > 0 && (
            <button
              type="button"
              onClick={toutRetirer}
              className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-gray-100 px-2 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-100"
            >
              <X size={14} /> Tout retirer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
