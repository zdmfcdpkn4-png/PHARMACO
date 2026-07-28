import { useEffect, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';

// Convertit une couleur hex en versions pastel (fond) + soutenue (texte).
export function pastel(hex) {
  const h = (hex || '#579bfc').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.15)`,
    text: `rgb(${Math.round(r * 0.7)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.7)})`,
  };
}

// Pilule d'étiquette colorée.
export function TagPill({ tag, onRemove }) {
  if (!tag) return null;
  const c = pastel(tag.color);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {tag.name}
      {onRemove && (
        <button onClick={onRemove} className="opacity-60 hover:opacity-100">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// Cellule d'étiquette : affiche la pilule + popover de sélection au clic.
// Si `onCreate` est fourni, on peut créer une nouvelle étiquette à la volée.
export default function TagCell({ value, tags, canEdit = true, onChange, onCreate, placeholder = 'Définir' }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);
  const selected = tags.find((t) => t.id === value) || null;

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const submitNew = async () => {
    const n = newName.trim();
    if (!n || creating || !onCreate) return;
    setCreating(true);
    try {
      const created = await onCreate(n);
      if (created && created.id != null) onChange(created.id);
      setNewName('');
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center" ref={ref}>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 disabled:cursor-default"
      >
        {selected ? (
          <TagPill tag={selected} />
        ) : (
          <span className="flex items-center gap-1 text-xs text-gray-300 hover:text-gray-500">
            <Plus size={12} /> {placeholder}
          </span>
        )}
      </button>

      {open && canEdit && (
        <div className="absolute left-1/2 top-full z-30 mt-1 max-h-64 w-52 -translate-x-1/2 overflow-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
          {tags.length === 0 && !onCreate && (
            <div className="px-2 py-3 text-center text-xs text-gray-400">
              Aucune étiquette. Créez-en dans la config du tableau.
            </div>
          )}
          {tags.length === 0 && onCreate && (
            <div className="px-2 pb-1 pt-2 text-center text-[11px] text-gray-400">
              Aucune étiquette. Créez-en une ci-dessous.
            </div>
          )}
          {tags.map((t) => {
            const c = pastel(t.color);
            return (
              <button
                key={t.id}
                onClick={() => {
                  setOpen(false);
                  onChange(t.id === value ? null : t.id);
                }}
                className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium last:mb-0 hover:opacity-90"
                style={{ backgroundColor: c.bg, color: c.text }}
              >
                {t.name}
                {t.id === value && <Check size={13} />}
              </button>
            );
          })}
          {selected && (
            <button
              onClick={() => {
                setOpen(false);
                onChange(null);
              }}
              className="mt-1 flex w-full items-center gap-1 border-t border-gray-100 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
            >
              <X size={12} /> Retirer l'étiquette
            </button>
          )}

          {onCreate && (
            <div className="mt-1 flex items-center gap-1 border-t border-gray-100 pt-1.5">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitNew();
                  }
                }}
                placeholder="Nouvelle étiquette…"
                className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-primary"
              />
              <button
                onClick={submitNew}
                disabled={!newName.trim() || creating}
                title="Créer et appliquer"
                className="shrink-0 rounded-md bg-primary p-1.5 text-white disabled:opacity-40"
              >
                <Plus size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
