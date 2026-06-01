import { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Lock, Plus, MessageSquare } from 'lucide-react';
import { AvatarStack } from './AdminCell.jsx';
import { STATUSES, STATUS_META, PRIORITY_META, formatShortDate } from '../lib/constants.js';

// Vue Kanban : une colonne par statut, cartes déplaçables (si propriétaire).
export default function KanbanView({
  board,
  filterFn,
  canEdit,
  commentCounts = {},
  onChangeStatus,
  onOpenTask,
  onAddTask,
}) {
  // Regroupe les tâches (filtrées) par statut, en conservant la couleur du groupe.
  const byStatus = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map((s) => [s, []]));
    for (const g of board?.groups || []) {
      for (const t of g.tasks) {
        if (!filterFn(t)) continue;
        if (map[t.status]) map[t.status].push({ ...t, groupColor: g.color, groupName: g.name });
      }
    }
    return map;
  }, [board, filterFn]);

  const onDragEnd = (result) => {
    if (!canEdit) return;
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const toStatus = destination.droppableId;
    const fromStatus = source.droppableId;
    if (toStatus === fromStatus) return;
    onChangeStatus(Number(draggableId), toStatus);
  };

  const Card = ({ task, dragProps, dragHandle, innerRef, dragging }) => (
    <div
      ref={innerRef}
      {...dragProps}
      {...dragHandle}
      onClick={() => onOpenTask?.(task)}
      className={`mb-2 rounded-lg border-l-4 bg-white p-3 shadow-sm ring-1 ring-black/5 transition ${
        canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${dragging ? 'rotate-[1.5deg] shadow-xl' : ''}`}
      style={{ borderLeftColor: task.groupColor, ...(dragProps?.style || {}) }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-800">{task.name}</span>
        {(task.assignees?.length || task.admin) && (
          <AvatarStack
            people={task.assignees?.length ? task.assignees : task.admin ? [task.admin] : []}
            size={24}
          />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
          style={{ backgroundColor: PRIORITY_META[task.priority]?.bg || '#579bfc' }}
        >
          {PRIORITY_META[task.priority]?.label || 'P3'}
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: task.groupColor }}
        >
          {task.groupName}
        </span>
        <span className="ml-auto text-xs text-gray-400">{formatShortDate(task.duedate) || '—'}</span>
        {commentCounts[task.id] > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-primary">
            <MessageSquare size={12} /> {commentCounts[task.id]}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-canvas p-4">
      {!canEdit && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <Lock size={15} /> Mode visualisation : vous n'êtes pas propriétaire de ce tableau.
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4">
          {STATUSES.map((status) => (
            <div key={status} className="flex w-72 shrink-0 flex-col">
              {/* En-tête de colonne */}
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_META[status].bg }}
                />
                <span className="text-sm font-semibold text-gray-700">{status}</span>
                <span className="rounded-full bg-gray-100 px-2 text-xs text-gray-500">
                  {byStatus[status].length}
                </span>
              </div>

              <Droppable droppableId={status} isDropDisabled={!canEdit}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[120px] flex-1 rounded-xl p-2 transition ${
                      snapshot.isDraggingOver ? 'bg-primary-light/50' : 'bg-gray-100/60'
                    }`}
                  >
                    {byStatus[status].map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={String(task.id)}
                        index={index}
                        isDragDisabled={!canEdit}
                      >
                        {(p, snap) => (
                          <Card
                            task={task}
                            innerRef={p.innerRef}
                            dragProps={p.draggableProps}
                            dragHandle={p.dragHandleProps}
                            dragging={snap.isDragging}
                          />
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {/* Ajout rapide (propriétaire, statut "À faire") */}
                    {canEdit && status === 'À faire' && (
                      <button
                        onClick={() => onAddTask?.()}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-primary hover:text-primary"
                      >
                        <Plus size={15} /> Ajouter
                      </button>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
