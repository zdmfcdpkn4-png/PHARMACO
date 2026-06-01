import { useEffect, useRef, useState } from 'react';
import {
  X,
  LayoutGrid,
  User,
  CircleDot,
  Calendar,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import StatusBadge from './StatusBadge.jsx';
import PriorityBadge from './PriorityBadge.jsx';
import AdminCell from './AdminCell.jsx';
import CustomCell from './CustomCell.jsx';
import TagCell from './TagCell.jsx';
import { Tag } from 'lucide-react';
import { formatShortDate } from '../lib/constants.js';

// Ligne d'attribut : icône + libellé à gauche, contrôle à droite.
function Field({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-50 py-3">
      <div className="flex w-36 shrink-0 items-center gap-2 text-sm text-gray-500">
        <Icon size={16} className="text-gray-400" /> {label}
      </div>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

// Panneau latéral de configuration détaillée d'une tâche (Item Detail).
export default function TaskDetailPanel({
  task,
  groups,
  users,
  categories = [],
  categoryValue,
  tags = [],
  canEdit = true,
  onClose,
  onRename,
  onChangeGroup,
  onChangeStatus,
  onChangePriority,
  onAssign,
  onSetAssignees,
  onChangeDate,
  onChangeTag,
  onSetCategoryValue,
}) {
  const [name, setName] = useState(task.name);
  useEffect(() => setName(task.name), [task.id, task.name]);

  const nameRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const commitName = () => {
    const n = name.trim();
    if (n && n !== task.name) onRename(n);
    else setName(task.name);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl animate-[slideIn_.2s_ease-out]">
        {/* En-tête : nom éditable en grand, sans bordure */}
        <div className="flex items-start gap-2 border-b border-gray-100 p-4">
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            disabled={!canEdit}
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xl font-bold text-gray-800 outline-none transition hover:border-gray-200 focus:border-primary disabled:cursor-default"
          />
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Corps : attributs principaux */}
        <div className="flex-1 overflow-auto px-4">
          <Field icon={LayoutGrid} label="Groupe">
            <select
              value={task.group_id}
              onChange={(e) => onChangeGroup(Number(e.target.value))}
              disabled={!canEdit}
              className="w-full cursor-pointer rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary disabled:cursor-default disabled:opacity-70"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>

          <Field icon={User} label="Assignation">
            <div className="flex items-center gap-2">
              <AdminCell
                admin={task.admin}
                assignees={task.assignees}
                users={users}
                onSetAssignees={canEdit ? onSetAssignees : undefined}
              />
              <span className="truncate text-sm text-gray-600">
                {(task.assignees && task.assignees.length
                  ? task.assignees.map((a) => a.name).join(', ')
                  : task.admin?.name) || 'Non assignée'}
              </span>
            </div>
          </Field>

          <Field icon={CircleDot} label="Statut">
            <div className="w-40">
              <StatusBadge status={task.status} readOnly={!canEdit} onChange={onChangeStatus} />
            </div>
          </Field>

          <Field icon={ShieldAlert} label="Priorité">
            <PriorityBadge priority={task.priority} readOnly={!canEdit} onChange={onChangePriority} />
          </Field>

          <Field icon={Tag} label="Étape">
            <TagCell
              value={task.etape_tag_id}
              tags={tags.filter((t) => t.tag_type === 'etape')}
              canEdit={canEdit}
              onChange={(id) => onChangeTag?.('etape_tag_id', id)}
            />
          </Field>

          <Field icon={Tag} label="Type">
            <TagCell
              value={task.intervention_tag_id}
              tags={tags.filter((t) => t.tag_type === 'intervention')}
              canEdit={canEdit}
              onChange={(id) => onChangeTag?.('intervention_tag_id', id)}
            />
          </Field>

          <Field icon={Calendar} label="Échéance">
            <label className="relative flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <span>{formatShortDate(task.duedate) || 'Aucune'}</span>
              {canEdit && (
                <input
                  type="date"
                  value={task.duedate ? task.duedate.slice(0, 10) : ''}
                  onChange={(e) => onChangeDate(e.target.value || null)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary"
                />
              )}
            </label>
          </Field>

          {/* Champs personnalisés */}
          {categories.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <SlidersHorizontal size={13} /> Champs personnalisés
              </div>
              {categories.map((c) => (
                <Field key={c.id} icon={SlidersHorizontal} label={c.name}>
                  <div className="w-full">
                    <CustomCell
                      category={c}
                      value={categoryValue ? categoryValue(c.id, task.id) : ''}
                      users={users}
                      canEdit={canEdit}
                      onChange={(val) => onSetCategoryValue?.(c.id, task.id, val)}
                    />
                  </div>
                </Field>
              ))}
            </div>
          )}

          <div className="h-6" />
        </div>
      </aside>
    </>
  );
}
