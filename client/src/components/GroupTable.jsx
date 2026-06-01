import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskRow from './TaskRow.jsx';
import GroupSummary from './GroupSummary.jsx';

// Section pliable contenant l'en-tête de colonnes, les tâches et le résumé.
export default function GroupTable({
  group,
  users,
  selectedIds,
  filterFn,
  sortFn,
  dragEnabled,
  groupDragProvided = null,
  groupDragSnapshot = null,
  onToggleSelect,
  onAddTask,
  onRenameTask,
  onChangeStatus,
  onChangePriority,
  onAssign,
  onChangeDate,
  onDeleteTask,
  onOpenDrawer,
  commentCounts = {},
  onRenameGroup,
  onDeleteGroup,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(group.name);

  const tasks = sortFn
    ? [...group.tasks].filter(filterFn).sort(sortFn)
    : group.tasks.filter(filterFn);

  const submitNew = () => {
    const name = newName.trim();
    if (name) onAddTask(name);
    setNewName('');
    setAdding(false);
  };

  const groupDragging = groupDragSnapshot?.isDragging;

  return (
    <section
      ref={groupDragProvided?.innerRef}
      {...(groupDragProvided?.draggableProps || {})}
      style={groupDragProvided?.draggableProps?.style}
      className={`print-group mb-8 ${groupDragging ? 'rounded-lg bg-white shadow-2xl ring-1 ring-primary/20' : ''}`}
    >
      {/* Titre du groupe */}
      <div className="group/title mb-1 flex items-center gap-1">
        {/* Poignée de déplacement du groupe */}
        {dragEnabled && (
          <span
            {...(groupDragProvided?.dragHandleProps || {})}
            title="Glisser pour réordonner le groupe"
            className="no-print cursor-grab text-gray-300 opacity-0 transition hover:text-gray-500 group-hover/title:opacity-100 active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="no-print rounded p-0.5 hover:bg-gray-200"
          style={{ color: group.color }}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
        </button>

        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              const n = titleDraft.trim();
              if (n && n !== group.name) onRenameGroup(n);
              else setTitleDraft(group.name);
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="rounded border px-2 py-0.5 text-lg font-semibold outline-none"
            style={{ color: group.color, borderColor: group.color }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="text-lg font-semibold hover:underline"
            style={{ color: group.color }}
          >
            {group.name}
          </button>
        )}
        <span className="ml-1 text-sm text-gray-400">{group.tasks.length}</span>

        <button
          type="button"
          onClick={() => onDeleteGroup()}
          title="Supprimer le groupe"
          className="no-print ml-2 text-gray-300 hover:text-status-blocked"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {!collapsed && (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          {/* En-tête de colonnes */}
          <div className="flex items-stretch border-b border-gray-200 bg-white text-xs font-medium uppercase tracking-wide text-gray-500">
            <div className="w-1 shrink-0" style={{ backgroundColor: group.color }} />
            <div className="w-6 shrink-0" />
            <div className="w-10 shrink-0" />
            <div className="flex-1 py-2.5 pl-2">Tâche</div>
            <div className="w-28 shrink-0 border-l border-gray-100 py-2.5 text-center">Priorité</div>
            <div className="w-32 shrink-0 border-l border-gray-100 py-2.5 text-center">Admin</div>
            <div className="w-40 shrink-0 border-l border-gray-100 py-2.5 text-center">Statut</div>
            <div className="w-36 shrink-0 border-l border-gray-100 py-2.5 text-center">Échéance</div>
            <div className="w-10 shrink-0 border-l border-gray-100" />
          </div>

          {/* Lignes de tâches (zone de dépôt) */}
          <Droppable droppableId={String(group.id)} type="TASK">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={snapshot.isDraggingOver ? 'bg-primary-light/40' : ''}
              >
                {tasks.map((task, index) => (
                  <Draggable
                    key={task.id}
                    draggableId={String(task.id)}
                    index={index}
                    isDragDisabled={!dragEnabled}
                  >
                    {(dragProvided, dragSnapshot) => (
                      <TaskRow
                        task={task}
                        users={users}
                        groupColor={group.color}
                        selected={selectedIds.has(task.id)}
                        dragEnabled={dragEnabled}
                        dragProvided={dragProvided}
                        dragSnapshot={dragSnapshot}
                        commentCount={commentCounts[task.id] || 0}
                        onToggleSelect={() => onToggleSelect(task.id)}
                        onRename={(name) => onRenameTask(task.id, name)}
                        onChangeStatus={(status) => onChangeStatus(task.id, status)}
                        onChangePriority={(priority) => onChangePriority(task.id, priority)}
                        onAssign={(adminId) => onAssign(task.id, adminId)}
                        onChangeDate={(date) => onChangeDate(task.id, date)}
                        onDelete={() => onDeleteTask(task.id)}
                        onOpenDrawer={(tabKey) => onOpenDrawer?.(task, tabKey)}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Ajouter une tâche */}
          <div className="no-print flex items-stretch border-b border-gray-100 bg-white">
            <div className="w-1 shrink-0" style={{ backgroundColor: group.color }} />
            <div className="w-6 shrink-0" />
            <div className="w-10 shrink-0" />
            <div className="flex-1 py-2 pl-2">
              {adding ? (
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={submitNew}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitNew();
                    if (e.key === 'Escape') {
                      setNewName('');
                      setAdding(false);
                    }
                  }}
                  placeholder="Nom de la tâche…"
                  className="w-full rounded border border-primary px-2 py-1 text-sm outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:text-primary"
                >
                  <Plus size={15} /> Ajouter tâche
                </button>
              )}
            </div>
          </div>

          {/* Résumé / statistiques */}
          <GroupSummary tasks={group.tasks} />
        </div>
      )}
    </section>
  );
}
