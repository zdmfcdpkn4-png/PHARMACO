import { useEffect, useRef, useState } from 'react';
import {
  X,
  LayoutGrid,
  User,
  CircleDot,
  Calendar,
  ShieldAlert,
  SlidersHorizontal,
  ListChecks,
  MessageSquare,
  Plus,
  Trash2,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import StatusBadge from './StatusBadge.jsx';
import PriorityBadge from './PriorityBadge.jsx';
import AdminCell from './AdminCell.jsx';
import CustomCell from './CustomCell.jsx';
import TagCell from './TagCell.jsx';
import StepProgress from './StepProgress.jsx';
import TaskAuditTrail from './TaskAuditTrail.jsx';
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
//
// C'est LA fenêtre de gestion d'une tâche : toutes les vues (tableau, kanban,
// calendrier, Gantt, planning, vue d'équipe, mobile) l'ouvrent au clic. Elle
// porte donc l'ensemble des données rattachées — attributs, circuit, champs
// personnalisés, sous-items, discussion — et les actions de cycle de vie.
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
  onCreateTag,
  onSetCategoryValue,
  steps = [],
  stepProgress = [],
  onSetTaskStep,
  onToggleTaskStep,
  // Données rattachées
  commentCount = 0,
  onOpenComments,
  onCreateSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  // Cycle de vie de la tâche
  canDelete = false,
  onArchive,
  onDelete,
  // Traçabilité : réservée aux administrateurs (le serveur tranche aussi).
  isAdmin = false,
}) {
  const [name, setName] = useState(task.name);
  useEffect(() => setName(task.name), [task.id, task.name]);
  const [nouveauSousItem, setNouveauSousItem] = useState('');
  const [ajoutOuvert, setAjoutOuvert] = useState(false);

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

  const sousItems = task.subtasks || [];
  const validerSousItem = () => {
    const n = nouveauSousItem.trim();
    if (n) onCreateSubtask?.(task.id, n);
    setNouveauSousItem('');
    setAjoutOuvert(false);
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
          {task.archived && (
            <span className="mt-1.5 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
              Archivée
            </span>
          )}
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Corps : attributs principaux */}
        <div className="flex-1 overflow-auto px-4">
          {/* Position de la tâche dans le circuit d'intervention. La « phase »
              affichée est le groupe courant : c'est lui qui structure le projet. */}
          {steps.length > 0 && (
            <div className="pt-3">
              <StepProgress
                variant="detail"
                steps={steps}
                taskId={task.id}
                currentStepId={task.step_id ?? null}
                progress={stepProgress}
                phaseName={groups.find((g) => g.id === task.group_id)?.name || null}
                canEdit={canEdit}
                onSelectStep={(id) => onSetTaskStep?.(task.id, id)}
                onToggleStep={(stepId, completed) =>
                  onToggleTaskStep?.(task.id, stepId, completed)
                }
              />
            </div>
          )}

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
              onCreate={canEdit && onCreateTag ? (name) => onCreateTag('etape', name) : undefined}
            />
          </Field>

          <Field icon={Tag} label="Type">
            <TagCell
              value={task.intervention_tag_id}
              tags={tags.filter((t) => t.tag_type === 'intervention')}
              canEdit={canEdit}
              onChange={(id) => onChangeTag?.('intervention_tag_id', id)}
              onCreate={
                canEdit && onCreateTag ? (name) => onCreateTag('intervention', name) : undefined
              }
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

          {/* Sous-items : la descendance directe de la tâche, rendue ici en
              liste compacte — SubtaskList est taillé pour le tableau large. */}
          <div className="mt-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <ListChecks size={13} /> Sous-items
              {sousItems.length > 0 && <span className="normal-case">({sousItems.length})</span>}
            </div>
            {sousItems.length === 0 && !ajoutOuvert && (
              <p className="py-2 text-sm text-gray-400">Aucun sous-item.</p>
            )}
            <ul className="space-y-1">
              {sousItems.map((s) => (
                <li
                  key={s.id}
                  className="group/sub flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-gray-50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{s.name}</span>
                  <div className="w-28 shrink-0">
                    <StatusBadge
                      status={s.status}
                      readOnly={!canEdit}
                      onChange={(st) => onUpdateSubtask?.(s.id, { status: st })}
                    />
                  </div>
                  {canDelete && onDeleteSubtask && (
                    <button
                      type="button"
                      onClick={() => onDeleteSubtask(s.id)}
                      title="Supprimer le sous-item (admin)"
                      className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition hover:text-status-blocked group-hover/sub:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && onCreateSubtask && (
              ajoutOuvert ? (
                <div className="mt-1 flex gap-1.5">
                  <input
                    autoFocus
                    value={nouveauSousItem}
                    onChange={(e) => setNouveauSousItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') validerSousItem();
                      if (e.key === 'Escape') setAjoutOuvert(false);
                    }}
                    placeholder="Nom du sous-item…"
                    className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={validerSousItem}
                    disabled={!nouveauSousItem.trim()}
                    className="rounded-md bg-primary px-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Ajouter
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAjoutOuvert(true)}
                  className="mt-1 flex w-full items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-2 text-sm text-gray-500 hover:border-primary hover:text-primary"
                >
                  <Plus size={14} /> Ajouter un sous-item
                </button>
              )
            )}
          </div>

          {/* Discussion : le fil vit dans TaskDrawer, on y renvoie. */}
          {onOpenComments && (
            <button
              type="button"
              onClick={onOpenComments}
              className="mt-4 flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 hover:border-primary hover:text-primary"
            >
              <MessageSquare size={16} className="text-gray-400" />
              Discussion
              {commentCount > 0 && (
                <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
                  {commentCount}
                </span>
              )}
            </button>
          )}

          {/* Traçabilité : qui a changé quoi, et quand. Administrateurs seuls. */}
          {isAdmin && <TaskAuditTrail taskId={task.id} />}

          <div className="h-6" />
        </div>

        {/* Actions de cycle de vie — c'est ici, et depuis n'importe quelle vue,
            qu'une tâche créée par erreur se range ou se supprime. */}
        {(onArchive || (canDelete && onDelete)) && (
          <div className="flex items-center gap-2 border-t border-gray-100 p-3">
            {onArchive && (
              <button
                type="button"
                onClick={() => onArchive(!task.archived)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                {task.archived ? (
                  <>
                    <ArchiveRestore size={15} className="text-brand-teal" /> Sortir des archives
                  </>
                ) : (
                  <>
                    <Archive size={15} className="text-brand-orange" /> Archiver
                  </>
                )}
              </button>
            )}
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2.5 text-sm text-status-blocked hover:bg-red-50"
              >
                <Trash2 size={15} /> Supprimer
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
