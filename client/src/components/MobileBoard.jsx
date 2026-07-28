import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, CheckSquare, X } from 'lucide-react';
import TaskCard from './TaskCard.jsx';
import BottomSheet from './BottomSheet.jsx';
import Avatar from './Avatar.jsx';
import { STATUSES, STATUS_META } from '../lib/constants.js';
import { flattenSteps, rootStepOf } from '../lib/steps.js';

// Vue board mobile : groupes pliables de cartes verticales.
export default function MobileBoard({
  board,
  users,
  filterFn,
  tags = [],
  steps = [],
  groupByStep = false,
  commentCounts,
  onOpenComments,
  onOpenDetail,
  onChangeStatus,
  onAssign,
  onAddTask,
}) {
  const [collapsed, setCollapsed] = useState({});
  const [collapsedSteps, setCollapsedSteps] = useState({});

  // Répartit les tâches par étape de premier niveau, dans l'ordre du circuit.
  const partitionner = (liste) => {
    const racines = flattenSteps(steps).filter((s) => s.depth === 0);
    const parRacine = new Map(racines.map((s) => [s.id, []]));
    const sans = [];
    for (const t of liste) {
      const racine = rootStepOf(steps, t.step_id);
      if (racine && parRacine.has(racine.id)) parRacine.get(racine.id).push(t);
      else sans.push(t);
    }
    const out = racines
      .map((s) => ({ step: s, tasks: parRacine.get(s.id) }))
      .filter((sec) => sec.tasks.length > 0);
    if (sans.length) out.push({ step: null, tasks: sans });
    return out;
  };
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
              <>
                {(groupByStep ? partitionner(tasks) : [{ step: null, tasks, brut: true }]).map(
                  (sec) => {
                    const cle = `${group.id}:${sec.step ? sec.step.id : 'sans'}`;
                    const ouvert = !collapsedSteps[cle];
                    return (
                      <div key={cle} className={sec.brut ? '' : 'mb-3'}>
                        {!sec.brut && (
                          <button
                            onClick={() =>
                              setCollapsedSteps((c) => ({ ...c, [cle]: !c[cle] }))
                            }
                            className="mb-1.5 flex w-full items-center gap-1.5 text-sm font-medium text-gray-600"
                          >
                            {ouvert ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: sec.step ? sec.step.color : '#9aadbd' }}
                            />
                            <span className="truncate">
                              {sec.step ? sec.step.name : 'Sans étape'}
                            </span>
                            <span className="text-xs text-gray-400">{sec.tasks.length}</span>
                          </button>
                        )}
                        {(sec.brut || ouvert) && (
                          <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0 lg:grid-cols-3">
                            {sec.tasks.map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                groupColor={group.color}
                                tags={tags}
                                steps={steps}
                                stepProgress={board.stepProgress || []}
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
                          </div>
                        )}
                      </div>
                    );
                  }
                )}

                <button
                  onClick={() => onAddTask(group.id)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2.5 text-sm text-gray-500"
                >
                  <Plus size={16} /> Ajouter une tâche
                </button>
              </>
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
              className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-medium"
              style={{ backgroundColor: STATUS_META[s].bg, color: STATUS_META[s].text || '#fff' }}
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
