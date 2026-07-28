import { useState } from 'react';
import { Plus, Trash2, Tag } from 'lucide-react';
import { TagPill } from './TagCell.jsx';

const COLORS = ['#579bfc', '#a25ddc', '#00c875', '#e8722e', '#0073ea', '#fdab3d', '#e2445c', '#037f4c'];

// Configuration des étiquettes du board : Étapes et Types d'intervention.
export default function TagConfig({ tags = [], canManage = true, onCreate, onDelete }) {
  return (
    <div className="space-y-4">
      <Section
        title="Étapes du projet"
        type="etape"
        tags={tags.filter((t) => t.tag_type === 'etape')}
        canManage={canManage}
        onCreate={onCreate}
        onDelete={onDelete}
      />
      <Section
        title="Types d'intervention"
        type="intervention"
        tags={tags.filter((t) => t.tag_type === 'intervention')}
        canManage={canManage}
        onCreate={onCreate}
        onDelete={onDelete}
      />
    </div>
  );
}

function Section({ title, type, tags, canManage, onCreate, onDelete }) {
  // Libellé d'ajout propre à la section (il était codé en dur sur « étape »,
  // y compris dans « Types d'intervention »).
  const addLabel = type === 'etape' ? 'Ajouter une étiquette d’étape' : "Ajouter un type d'intervention";
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [adding, setAdding] = useState(false);

  const submit = () => {
    const n = name.trim();
    if (n) onCreate(n, color, type);
    setName('');
    setColor(COLORS[0]);
    setAdding(false);
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <Tag size={13} /> {title}
      </div>
      <div className="space-y-1.5">
        {tags.map((t) => (
          <div key={t.id} className="group flex items-center justify-between rounded-lg px-1 py-1 hover:bg-gray-50">
            <TagPill tag={t} />
            {canManage && (
              <button
                onClick={() => onDelete(t.id)}
                className="text-gray-300 opacity-0 transition hover:text-status-blocked group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {tags.length === 0 && (
          <p className="px-1 py-1 text-xs text-gray-400">Aucune étiquette.</p>
        )}
      </div>

      {canManage &&
        (adding ? (
          <div className="mt-2 rounded-lg border border-gray-200 p-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Nom de l'étiquette…"
              className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
            <div className="mb-2 flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full ${color === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={submit}
                disabled={!name.trim()}
                className="flex-1 rounded-md bg-primary py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Créer
              </button>
              <button
                onClick={() => setAdding(false)}
                className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-500"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-1.5 text-xs text-gray-500 hover:border-primary hover:text-primary"
          >
            <Plus size={13} /> {addLabel}
          </button>
        ))}
    </div>
  );
}
