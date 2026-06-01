import { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  format,
  isSameMonth,
  isToday,
  isSameDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { STATUS_META, toYmd } from '../lib/constants.js';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Vue Calendrier mensuelle : tâches en bandeaux colorés sur leur duedate.
export default function CalendarView({
  board,
  filterFn,
  canEdit,
  onOpenTask,
  onChangeDate,
  onAddTaskOnDate,
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [dragOverKey, setDragOverKey] = useState(null);

  // Grille du mois (semaines complètes lundi→dimanche)
  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: first, end: last });
  }, [cursor]);

  // Tâches (filtrées) indexées par jour d'échéance
  const tasksByDay = useMemo(() => {
    const map = new Map();
    for (const g of board?.groups || []) {
      for (const t of g.tasks) {
        if (!filterFn(t) || !t.duedate) continue;
        const key = t.duedate.slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ ...t, groupColor: g.color });
      }
    }
    return map;
  }, [board, filterFn]);

  const onDropDay = (e, dayKey) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!canEdit) return;
    const id = Number(e.dataTransfer.getData('text/task-id'));
    if (id) onChangeDate(id, dayKey);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-canvas">
      {/* Barre de navigation du mois */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <button
          onClick={() => setCursor((c) => addMonths(c, -1))}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="min-w-44 text-center text-base font-semibold capitalize text-gray-800">
          {format(cursor, 'MMMM yyyy', { locale: fr })}
        </h3>
        <button
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setCursor(new Date())}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          Aujourd'hui
        </button>
        {!canEdit && (
          <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
            <Lock size={14} /> Lecture seule
          </span>
        )}
      </div>

      {/* Grille */}
      <div className="flex flex-1 flex-col overflow-auto p-4">
        {/* En-têtes des jours */}
        <div className="grid grid-cols-7 gap-px">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-2 text-center text-xs font-semibold uppercase text-gray-400">
              {d}
            </div>
          ))}
        </div>

        {/* Cellules */}
        <div className="grid flex-1 grid-cols-7 gap-px overflow-hidden rounded-lg bg-gray-200">
          {days.map((day) => {
            const key = toYmd(day);
            const dayTasks = tasksByDay.get(key) || [];
            const inMonth = isSameMonth(day, cursor);
            const today = isToday(day);
            return (
              <div
                key={key}
                onDragOver={(e) => {
                  if (canEdit) {
                    e.preventDefault();
                    setDragOverKey(key);
                  }
                }}
                onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                onDrop={(e) => onDropDay(e, key)}
                onClick={() => {
                  if (canEdit && dayTasks.length === 0) onAddTaskOnDate?.(key);
                }}
                className={`min-h-[96px] bg-white p-1.5 transition ${
                  inMonth ? '' : 'bg-gray-50 text-gray-400'
                } ${dragOverKey === key ? 'ring-2 ring-inset ring-primary' : ''} ${
                  canEdit && dayTasks.length === 0 ? 'cursor-pointer hover:bg-blue-50/40' : ''
                }`}
                title={canEdit && dayTasks.length === 0 ? 'Cliquer pour créer une tâche' : undefined}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      today ? 'bg-primary font-bold text-white' : 'text-gray-500'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      draggable={canEdit}
                      onDragStart={(e) => e.dataTransfer.setData('text/task-id', String(t.id))}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTask?.(t);
                      }}
                      className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white ${
                        canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      }`}
                      style={{ backgroundColor: t.groupColor }}
                      title={`${t.name} · ${t.status}`}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: STATUS_META[t.status]?.bg || '#fff' }}
                      />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                  {dayTasks.length > 4 && (
                    <div className="px-1 text-[10px] text-gray-400">+{dayTasks.length - 4} autres</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
