import { useEffect, useRef, useState } from 'react';
import { Plus, Type, CircleDot, User, Calendar } from 'lucide-react';

const TYPES = [
  { type: 'text', label: 'Texte', icon: Type },
  { type: 'status', label: 'Statut', icon: CircleDot },
  { type: 'person', label: 'Personne', icon: User },
  { type: 'date', label: 'Date', icon: Calendar },
];

// Bouton "+" d'ajout de colonne personnalisée (menu de types).
export default function AddColumnButton({ onCreate }) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(null); // type choisi en attente de nom
  const [name, setName] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setNaming(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const submit = () => {
    const n = name.trim();
    if (n) onCreate(n, naming);
    setName('');
    setNaming(null);
    setOpen(false);
  };

  return (
    <div className="relative flex w-10 shrink-0 items-center justify-center" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Ajouter une colonne"
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-primary"
      >
        <Plus size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
          {naming === null ? (
            <>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase text-gray-400">
                Type de colonne
              </div>
              {TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setNaming(t.type)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Icon size={15} className="text-primary" /> {t.label}
                  </button>
                );
              })}
            </>
          ) : (
            <div className="p-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                  if (e.key === 'Escape') setNaming(null);
                }}
                placeholder="Nom de la colonne…"
                className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={submit}
                  disabled={!name.trim()}
                  className="flex-1 rounded-md bg-primary py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Créer
                </button>
                <button
                  onClick={() => setNaming(null)}
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-500"
                >
                  Retour
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
