import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import AdminCell from './AdminCell.jsx';
import { formatShortDate } from '../lib/constants.js';

// Sous-table imbriquée des sous-items d'une tâche (indentée, fond grisé).
export default function SubtaskList({
  parentId,
  subtasks,
  users,
  groupColor,
  canEdit = true,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const submit = () => {
    const n = newName.trim();
    if (n) onCreate(parentId, n);
    setNewName('');
    setAdding(false);
  };

  return (
    <div className="border-b border-gray-100 bg-gray-50/70">
      {/* Indentation visuelle */}
      <div className="pl-10">
        {subtasks.map((s) => (
          <SubRow
            key={s.id}
            sub={s}
            users={users}
            groupColor={groupColor}
            canEdit={canEdit}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}

        {canEdit && (
          <div className="flex items-stretch border-l-2 bg-gray-50/70" style={{ borderColor: groupColor }}>
            <div className="flex-1 py-1.5 pl-2">
              {adding ? (
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={submit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') {
                      setNewName('');
                      setAdding(false);
                    }
                  }}
                  placeholder="Nom du sous-item…"
                  className="w-full rounded border border-primary px-2 py-1 text-sm outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-primary"
                >
                  <Plus size={13} /> Ajouter un sous-item
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Une ligne de sous-item : nom éditable, admin, statut, échéance.
function SubRow({ sub, users, groupColor, canEdit, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sub.name);

  const commit = () => {
    setEditing(false);
    const n = draft.trim();
    if (n && n !== sub.name) onUpdate(sub.id, { name: n });
    else setDraft(sub.name);
  };

  return (
    <div
      className="group/sub flex items-stretch border-b border-l-2 border-gray-100 bg-white/60 text-sm"
      style={{ borderLeftColor: groupColor }}
    >
      {/* Nom */}
      <div className="flex min-w-0 flex-1 items-center py-1.5 pl-2 pr-2">
        {editing && canEdit ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(sub.name);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-primary px-2 py-0.5 text-gray-800 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => canEdit && setEditing(true)}
            className="w-full truncate rounded px-2 py-0.5 text-left text-gray-700 hover:bg-gray-100"
          >
            {sub.name}
          </button>
        )}
      </div>

      {/* Admin */}
      <div className="flex w-28 shrink-0 items-center justify-center border-l border-gray-100">
        <AdminCell
          admin={sub.admin}
          users={users}
          onAssign={(adminId) => canEdit && onUpdate(sub.id, { admin_id: adminId })}
        />
      </div>

      {/* Statut */}
      <div className="flex w-40 shrink-0 items-stretch border-l border-gray-100">
        <StatusBadge
          status={sub.status}
          readOnly={!canEdit}
          onChange={(status) => onUpdate(sub.id, { status })}
        />
      </div>

      {/* Échéance */}
      <div className="relative flex w-36 shrink-0 items-center justify-center border-l border-gray-100 text-gray-600">
        <label className="flex cursor-pointer items-center gap-1">
          <span className={sub.status === 'Fait' ? 'text-gray-400 line-through' : ''}>
            {formatShortDate(sub.duedate) || '—'}
          </span>
          {canEdit && (
            <input
              type="date"
              value={sub.duedate ? sub.duedate.slice(0, 10) : ''}
              onChange={(e) => onUpdate(sub.id, { duedate: e.target.value || null })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          )}
        </label>
      </div>

      {/* Supprimer */}
      <div className="flex w-10 shrink-0 items-center justify-center border-l border-gray-100">
        {canEdit && (
          <button
            type="button"
            onClick={() => onDelete(sub.id)}
            className="text-gray-300 opacity-0 transition hover:text-status-blocked group-hover/sub:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
