import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, CheckSquare, X } from 'lucide-react';
import TaskCard from './TaskCard.jsx';
import BottomSheet from './BottomSheet.jsx';
import Avatar from './Avatar.jsx';
import { STATUSES, STATUS_META } from '../lib/constants.js';

// Vue board mobile : groupes pliables de cartes verticales.
export default function MobileBoard({
  board,
  users,
  filterFn,
  commentCounts,
  onOpenComments,
  onOpenDetail,
  onChangeStatus,
  onAssign,
  onAddTask,
}) {
  const [collapsed, setCollapsed] = useState({});
  const [statusSheet, setStatusSheet] = useState(null); // tâche dont on change le statut
  const [adminSheet, setAdminSheet] = useState(null); // tâche dont on change l'admin
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const toggleSel = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const exitSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };

  // Applique un statut à toute la sélection
  const applyBulkStatus = (status) => {
    for (const id of selected) onChangeStatus(id, status);
    exitSelection();
  };

  return (
    <div className="flex-1 overflow-auto bg-canvas px-3 pb-24 pt-3">
      {/* Bandeau de sélection multiple */}
      {selectionMode && (
        <div className="sticky top-0 z-20 mb-3 flex items-center justify-between rounded-xl bg-primary px-3 py-2 text-white shadow">
          <span className="text-sm font-medium">{selected.size} sélectionnée(s)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusSheet({ bulk: true })}
              className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-medium"
            >
              Changer le statut
            </button>
            <button onClick={exitSelection} className="rounded-md p-1">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {board.groups.map((group) => {
        const tasks = group.tasks.filter(filterFn);
        const isCollapsed = collapsed[group.id];
        return (
          <section key={group.id} className="mb-5">
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
              className="mb-2 flex w-full items-center gap-1.5 text-base font-semibold"
              style={{ color: group.color }}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
              {group.name}
              <span className="text-sm text-gray-400">{tasks.length}</span>
            </button>

            {!isCollapsed && (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    groupColor={group.color}
                    commentCount={commentCounts[task.id] || 0}
                    selectionMode={selectionMode}
                    selected={selected.has(task.id)}
                    onOpenComments={() => onOpenComments(task)}
                    onOpenDetail={() => onOpenDetail?.(task)}
                    onMarkDone={() => onChangeStatus(task.id, 'Fait')}
                    onOpenStatusSheet={() => setStatusSheet({ task })}
                    onToggleSelect={() => toggleSel(task.id)}
                    onEnterSelection={() => {
                      setSelectionMode(true);
                      toggleSel(task.id);
                    }}
                  />
                ))}

                <button
                  onClick={() => onAddTask(group.id)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2.5 text-sm text-gray-500"
                >
                  <Plus size={16} /> Ajouter une tâche
                </button>
              </div>
            )}
          </section>
        );
      })}

      {/* Bottom sheet : changement de statut (simple ou en masse) */}
      <BottomSheet
        open={!!statusSheet}
        title="Choisir un statut"
        onClose={() => setStatusSheet(null)}
      >
        <div className="space-y-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                if (statusSheet.bulk) applyBulkStatus(s);
                else onChangeStatus(statusSheet.task.id, s);
                setStatusSheet(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-medium text-white"
              style={{ backgroundColor: STATUS_META[s].bg }}
            >
              {s}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Bottom sheet : assignation d'admin (déclenchée ailleurs si besoin) */}
      <BottomSheet open={!!adminSheet} title="Assigner à" onClose={() => setAdminSheet(null)}>
        <div className="space-y-1">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                onAssign(adminSheet.task.id, u.id);
                setAdminSheet(null);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-100"
            >
              <Avatar name={u.name} src={u.avatar_url} size={32} ring={false} />
              <span className="text-sm text-gray-700">{u.name}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
