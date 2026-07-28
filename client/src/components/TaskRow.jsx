import { useEffect, useRef, useState } from 'react';
import { Trash2, GripVertical, Pencil, MessageSquare, ChevronRight, ChevronDown } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import PriorityBadge from './PriorityBadge.jsx';
import AdminCell from './AdminCell.jsx';
import CustomCell from './CustomCell.jsx';
import TagCell from './TagCell.jsx';
import { formatShortDate } from '../lib/constants.js';

// Une ligne de tâche : poignée drag, checkbox, nom, priorité, admin, statut, échéance.
export default function TaskRow({
  task,
  users,
  groupColor,
  selected,
  dragEnabled = false,
  dragHandleProps = null,
  dragSnapshot = null,
  commentCount = 0,
  subtaskCount = 0,
  expanded = false,
  onToggleExpand,
  onToggleSelect,
  onRename,
  onChangeStatus,
  onChangePriority,
  onAssign,
  onSetAssignees,
  onChangeDate,
  onDelete,
  canDelete = true,
  onOpenDrawer,
  onOpenDetail,
  categories = [],
  categoryValue,
  onSetCategoryValue,
  tags = [],
  onChangeTag,
  getColWidth = () => 150,
  canEdit = true,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.name);
  const inputRef = useRef(null);

  // Style d'une cellule à largeur fixe (alignée sur l'en-tête).
  const cw = (key) => {
    const w = getColWidth(key);
    return { width: w, minWidth: w, maxWidth: w };
  };

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
      className={`group flex min-w-max items-stretch border-b border-gray-100 bg-white text-sm transition-shadow hover:bg-gray-50 ${
        isDragging ? 'rotate-[1.5deg] rounded-lg shadow-2xl ring-1 ring-primary/30' : ''
      } ${task.archived ? 'opacity-60' : ''}`}
      title={task.archived ? 'Tâche archivée' : undefined}
    >
      {/* Barre de couleur du groupe */}
      <div className="w-1 shrink-0" style={{ backgroundColor: groupColor }} />

      {/* Poignée de drag */}
      <div className="no-print flex w-6 shrink-0 items-center justify-center">
        {dragEnabled ? (
          <span
            {...(dragHandleProps || {})}
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
      <div className="no-print flex w-10 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
        />
      </div>

      {/* Nom de la tâche (éditable au clic) */}
      <div className="flex shrink-0 items-center py-2 pr-3" style={cw('task')}>
        {editing && canEdit ? (
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
          <div className="flex w-full min-w-0 items-center gap-1">
            {/* Chevron de développement des sous-items */}
            <button
              type="button"
              onClick={onToggleExpand}
              title={expanded ? 'Replier les sous-items' : 'Développer les sous-items'}
              className={`shrink-0 rounded p-0.5 hover:bg-gray-200 ${
                subtaskCount > 0 ? 'text-gray-500' : 'text-gray-300'
              }`}
            >
              {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            <button
              type="button"
              onClick={() => onOpenDetail?.()}
              title="Ouvrir le détail de la tâche"
              className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-gray-800 hover:bg-gray-100"
            >
              {task.name}
              {subtaskCount > 0 && (
                <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-500">
                  {subtaskCount}
                </span>
              )}
            </button>

            {/* Bulle de commentaires */}
            <button
              type="button"
              onClick={() => onOpenDrawer?.('discussion')}
              title={commentCount > 0 ? `${commentCount} message(s) non lu(s)` : 'Commenter'}
              className={`no-print relative flex items-center gap-0.5 rounded px-1 py-0.5 text-xs transition ${
                commentCount > 0
                  ? 'text-primary'
                  : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-500'
              }`}
            >
              <MessageSquare size={15} />
              {commentCount > 0 && <span className="font-semibold">{commentCount}</span>}
            </button>

            {/* Édition rapide */}
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="Renommer"
                className="no-print rounded p-1 text-gray-300 opacity-0 transition hover:text-primary group-hover:opacity-100"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Priorité */}
      <div className="flex shrink-0 items-center justify-center border-l border-gray-100" style={cw('priority')}>
        <PriorityBadge priority={task.priority} onChange={onChangePriority} readOnly={!canEdit} />
      </div>

      {/* Admin */}
      <div className="flex shrink-0 items-center justify-center border-l border-gray-100" style={cw('admin')}>
        <AdminCell
          admin={task.admin}
          assignees={task.assignees}
          users={users}
          onSetAssignees={onSetAssignees}
          readOnly={!canEdit}
        />
      </div>

      {/* Statut */}
      <div className="flex shrink-0 items-stretch border-l border-gray-100" style={cw('status')}>
        <StatusBadge status={task.status} onChange={onChangeStatus} readOnly={!canEdit} />
      </div>

      {/* Échéance */}
      <div className="relative flex shrink-0 items-center justify-center border-l border-gray-100" style={cw('duedate')}>
        <label className={`flex items-center gap-1 text-gray-600 ${canEdit ? 'cursor-pointer' : ''}`}>
          <span className={task.status === 'Fait' ? 'text-gray-400 line-through' : ''}>
            {formatShortDate(task.duedate) || '—'}
          </span>
          {canEdit && (
            <input
              type="date"
              value={task.duedate ? task.duedate.slice(0, 10) : ''}
              onChange={(e) => onChangeDate(e.target.value || null)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          )}
        </label>
      </div>

      {/* Étiquettes : Étape / Type */}
      <div className="flex shrink-0 items-center justify-center border-l border-gray-100" style={cw('etape')}>
        <TagCell
          value={task.etape_tag_id}
          tags={tags.filter((t) => t.tag_type === 'etape')}
          canEdit={canEdit}
          onChange={(id) => onChangeTag?.('etape_tag_id', id)}
        />
      </div>
      <div className="flex shrink-0 items-center justify-center border-l border-gray-100" style={cw('intervention')}>
        <TagCell
          value={task.intervention_tag_id}
          tags={tags.filter((t) => t.tag_type === 'intervention')}
          canEdit={canEdit}
          onChange={(id) => onChangeTag?.('intervention_tag_id', id)}
        />
      </div>

      {/* Colonnes personnalisées */}
      {categories.map((c) => (
        <div
          key={c.id}
          className="flex shrink-0 items-center justify-center border-l border-gray-100"
          style={cw(`cat-${c.id}`)}
        >
          <CustomCell
            category={c}
            value={categoryValue ? categoryValue(c.id, task.id) : ''}
            users={users}
            canEdit={canEdit}
            onChange={(val) => onSetCategoryValue?.(c.id, task.id, val)}
          />
        </div>
      ))}

      {/* Action supprimer (au survol) — visible si autorisé */}
      <div className="no-print flex w-10 shrink-0 items-center justify-center border-l border-gray-100">
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Supprimer la tâche"
            className="text-gray-300 opacity-0 transition hover:text-status-blocked group-hover:opacity-100"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
