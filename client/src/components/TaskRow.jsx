import { useEffect, useRef, useState } from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import AdminCell from './AdminCell.jsx';
import { formatShortDate } from '../lib/constants.js';

// Une ligne de tâche : poignée drag, checkbox, nom éditable, admin, statut, échéance.
export default function TaskRow({
  task,
  users,
  groupColor,
  selected,
  dragEnabled = false,
  dragProvided = null,
  dragSnapshot = null,
  onToggleSelect,
  onRename,
  onChangeStatus,
  onAssign,
  onChangeDate,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitName = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== task.name) onRename(next);
    else setDraft(task.name);
  };

  const isDragging = dragSnapshot?.isDragging;

  return (
    <div
      ref={dragProvided?.innerRef}
      {...(dragProvided?.draggableProps || {})}
      style={dragProvided?.draggableProps?.style}
      className={`group flex items-stretch border-b border-gray-100 bg-white text-sm transition-shadow hover:bg-gray-50 ${
        isDragging ? 'rotate-[1.5deg] rounded-lg shadow-2xl ring-1 ring-primary/30' : ''
      }`}
    >
      {/* Barre de couleur du groupe */}
      <div className="w-1 shrink-0" style={{ backgroundColor: groupColor }} />

      {/* Poignée de drag */}
      <div className="flex w-6 shrink-0 items-center justify-center">
        {dragEnabled ? (
          <span
            {...(dragProvided?.dragHandleProps || {})}
            title="Glisser pour réorganiser"
            className="cursor-grab text-gray-300 opacity-0 transition hover:text-gray-500 group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </span>
        ) : (
          <span className="w-4" />
        )}
      </div>

      {/* Checkbox */}
      <div className="flex w-10 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
        />
      </div>

      {/* Nom de la tâche (éditable au clic) */}
      <div className="flex min-w-0 flex-1 items-center py-2 pr-3">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setDraft(task.name);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-primary px-2 py-1 text-gray-800 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full truncate rounded px-2 py-1 text-left text-gray-800 hover:bg-gray-100"
          >
            {task.name}
          </button>
        )}
      </div>

      {/* Admin */}
      <div className="flex w-32 shrink-0 items-center justify-center border-l border-gray-100">
        <AdminCell admin={task.admin} users={users} onAssign={onAssign} />
      </div>

      {/* Statut */}
      <div className="flex w-40 shrink-0 items-stretch border-l border-gray-100">
        <StatusBadge status={task.status} onChange={onChangeStatus} />
      </div>

      {/* Échéance */}
      <div className="relative flex w-36 shrink-0 items-center justify-center border-l border-gray-100">
        <label className="flex cursor-pointer items-center gap-1 text-gray-600">
          <span className={task.status === 'Fait' ? 'text-gray-400 line-through' : ''}>
            {formatShortDate(task.duedate) || '—'}
          </span>
          <input
            type="date"
            value={task.duedate ? task.duedate.slice(0, 10) : ''}
            onChange={(e) => onChangeDate(e.target.value || null)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>

      {/* Action supprimer (au survol) */}
      <div className="flex w-10 shrink-0 items-center justify-center border-l border-gray-100">
        <button
          type="button"
          onClick={onDelete}
          title="Supprimer la tâche"
          className="text-gray-300 opacity-0 transition hover:text-status-blocked group-hover:opacity-100"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
