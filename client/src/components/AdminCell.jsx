import { useEffect, useRef, useState } from 'react';
import { UserCircle2, Check, X } from 'lucide-react';
import Avatar from './Avatar.jsx';

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

// Cellule d'assignation : pile d'avatars + popover multi-sélection (checkboxes).
// Accepte `assignees` (tableau) ou rétro-compat `admin` (unique).
// `readOnly` : affiche les avatars sans permettre de modifier l'assignation.
export default function AdminCell({ admin, assignees, users, onAssign, onSetAssignees, readOnly = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Liste effective des assignés
  const people = assignees && assignees.length ? assignees : admin ? [admin] : [];
  const selectedIds = new Set(people.map((p) => p.id));

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

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

  return (
    <div className="relative flex items-center justify-center" ref={ref}>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => !readOnly && setOpen((v) => !v)}
        title={people.length ? people.map((p) => p.name).join(', ') : readOnly ? 'Assignation' : 'Assigner'}
        className={`flex items-center justify-center rounded-full transition-transform ${readOnly ? '' : 'hover:scale-105'}`}
      >
        {people.length ? (
          <AvatarStack people={people} />
        ) : (
          <UserCircle2 size={28} className="text-gray-300" strokeWidth={1.5} />
        )}
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-30 max-h-72 w-56 -translate-x-1/2 overflow-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
          <div className="px-2 py-1 text-xs font-semibold uppercase text-gray-400">
            {onSetAssignees ? 'Assigner (plusieurs)' : 'Assigner à'}
          </div>
          {users.map((u) => {
            const checked = selectedIds.has(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100"
              >
                {onSetAssignees && (
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? 'border-primary bg-primary text-white' : 'border-gray-300'
                    }`}
                  >
                    {checked && <Check size={12} />}
                  </span>
                )}
                <Avatar name={u.name} src={u.avatar_url} size={24} ring={false} />
                <span className="flex-1 truncate text-gray-700">{u.name}</span>
                {!onSetAssignees && checked && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
          {people.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (onSetAssignees) onSetAssignees([]);
                else onAssign?.(null);
                setOpen(false);
              }}
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
