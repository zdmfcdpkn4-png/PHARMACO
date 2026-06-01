import { useState } from 'react';
import StatusBadge from './StatusBadge.jsx';
import AdminCell from './AdminCell.jsx';
import { formatShortDate } from '../lib/constants.js';

// Cellule de valeur d'une catégorie personnalisée, selon son type.
// La valeur est stockée en texte (id utilisateur pour 'person').
export default function CustomCell({ category, value, users = [], canEdit = true, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  if (category.type === 'status') {
    return (
      <StatusBadge
        status={value || 'À faire'}
        readOnly={!canEdit}
        onChange={(s) => onChange(s)}
      />
    );
  }

  if (category.type === 'person') {
    const admin = users.find((u) => String(u.id) === String(value)) || null;
    return (
      <AdminCell
        admin={admin}
        users={users}
        onAssign={(id) => canEdit && onChange(id == null ? '' : String(id))}
      />
    );
  }

  if (category.type === 'date') {
    return (
      <label className="relative flex cursor-pointer items-center justify-center text-gray-600">
        <span>{formatShortDate(value) || '—'}</span>
        {canEdit && (
          <input
            type="date"
            value={value ? value.slice(0, 10) : ''}
            onChange={(e) => onChange(e.target.value || '')}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        )}
      </label>
    );
  }

  // type 'text'
  return editing && canEdit ? (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onChange(draft);
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="w-full rounded border border-primary px-2 py-1 text-sm outline-none"
    />
  ) : (
    <button
      type="button"
      onClick={() => canEdit && setEditing(true)}
      className="w-full truncate px-2 py-1 text-center text-sm text-gray-700 hover:bg-gray-100"
    >
      {value || <span className="text-gray-300">—</span>}
    </button>
  );
}
