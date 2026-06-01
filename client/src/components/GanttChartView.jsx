import { useMemo, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Link2 } from 'lucide-react';
import {
  STATUS_META,
  toYmd,
  parseYmd,
  addDays,
  daysBetween,
} from '../lib/constants.js';

const DAY_MS = 86400000;
const ROW_H = 40; // hauteur d'une ligne de tâche (px)
const DAY_W = 38; // largeur d'un jour en vue "semaine" (px)
const WEEK_W = 56; // largeur d'une semaine en vue "mois" (px)

const MONTHS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Lundi de la semaine d'une date.
function mondayOf(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

// Vue Gantt / Chronogramme : tâches (par groupe) × échelle de temps.
export default function GanttChartView({
  board,
  onUpdateTask,
  onCreateTask,
  onAddDependency,
  onDeleteDependency,
}) {
  const [mode, setMode] = useState('week'); // 'week' | 'month'
  const [anchor, setAnchor] = useState(() => mondayOf(new Date())); // début de fenêtre
  const [drag, setDrag] = useState(null); // état d'un drag/resize en cours
  const [quickCreate, setQuickCreate] = useState(null); // { group_id, start, end }
  const [linking, setLinking] = useState(null); // { fromId, x, y } création de lien
  const gridRef = useRef(null);

  const unit = mode === 'week' ? DAY_W : WEEK_W;
  // Nombre d'unités visibles (jours en semaine, semaines en mois)
  const unitsCount = mode === 'week' ? 28 : 18; // 4 sem. / ~4 mois

  // Échelle : liste d'unités { key (ymd du début), label, isToday, isWeekend, spanDays }
  const scale = useMemo(() => {
    const start = mondayOf(anchor);
    const out = [];
    const todayKey = toYmd(new Date());
    for (let i = 0; i < unitsCount; i += 1) {
      if (mode === 'week') {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = toYmd(d);
        out.push({
          key,
          label: String(d.getDate()),
          sub: WEEKDAYS[(d.getDay() + 6) % 7],
          month: d.getDate() === 1 || i === 0 ? MONTHS[d.getMonth()] : null,
          isToday: key === todayKey,
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
          spanDays: 1,
        });
      } else {
        const d = new Date(start);
        d.setDate(start.getDate() + i * 7);
        const key = toYmd(d);
        const end = new Date(d);
        end.setDate(d.getDate() + 6);
        out.push({
          key,
          label: `${d.getDate()}`,
          sub: `${MONTHS[d.getMonth()]}`,
          month: d.getDate() <= 7 ? MONTHS[d.getMonth()] : null,
          isToday: todayKey >= key && todayKey <= toYmd(end),
          isWeekend: false,
          spanDays: 7,
        });
      }
    }
    return out;
  }, [anchor, mode, unitsCount]);

  const rangeStart = scale[0]?.key;
  const totalDays = mode === 'week' ? unitsCount : unitsCount * 7;
  const gridWidth = unitsCount * unit;
  const pxPerDay = gridWidth / totalDays;

  // Lignes : groupes + leurs tâches (mémoïsé)
  const rows = useMemo(() => {
    const out = [];
    for (const g of board?.groups || []) {
      out.push({ type: 'group', group: g });
      for (const t of g.tasks) out.push({ type: 'task', task: t, group: g });
    }
    return out;
  }, [board]);

  // Index de ligne par tâche (pour positionner les flèches de dépendance)
  const rowIndexByTask = useMemo(() => {
    const m = new Map();
    rows.forEach((r, i) => {
      if (r.type === 'task') m.set(r.task.id, i);
    });
    return m;
  }, [rows]);

  const taskById = useMemo(() => {
    const m = new Map();
    for (const r of rows) if (r.type === 'task') m.set(r.task.id, r.task);
    return m;
  }, [rows]);

  // Position d'une barre (left/width en px) à partir de start/due.
  const barGeometry = useCallback(
    (task) => {
      const s = task.start_date || task.duedate;
      const e = task.duedate || task.start_date;
      if (!s && !e) return null;
      const start = s || e;
      const end = e || s;
      const offsetDays = daysBetween(rangeStart, start);
      const durDays = Math.max(1, daysBetween(start, end) + 1);
      return {
        left: offsetDays * pxPerDay,
        width: durDays * pxPerDay,
        start,
        end,
      };
    },
    [rangeStart, pxPerDay]
  );

  // Flèches de dépendance : du bord droit du prédécesseur au bord gauche du successeur.
  const arrows = useMemo(() => {
    const deps = board?.dependencies || [];
    const out = [];
    for (const d of deps) {
      const pi = rowIndexByTask.get(d.predecessor_id);
      const si = rowIndexByTask.get(d.successor_id);
      const pTask = taskById.get(d.predecessor_id);
      const sTask = taskById.get(d.successor_id);
      if (pi == null || si == null || !pTask || !sTask) continue;
      const pg = barGeometry(pTask);
      const sg = barGeometry(sTask);
      if (!pg || !sg) continue;
      const x1 = pg.left + Math.max(pg.width, 12);
      const y1 = pi * ROW_H + ROW_H / 2;
      const x2 = sg.left;
      const y2 = si * ROW_H + ROW_H / 2;
      out.push({ id: d.id, x1, y1, x2, y2 });
    }
    return out;
  }, [board?.dependencies, rowIndexByTask, taskById, barGeometry]);

  // ----- Création de lien (drag depuis la pastille de liaison) -----
  const onLinkPointerDown = (e, task) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + gridRef.current.scrollLeft;
    const y = e.clientY - rect.top + gridRef.current.scrollTop;
    setLinking({ fromId: task.id, sx: x, sy: y, x, y });
    const move = (ev) => {
      const rx = ev.clientX - rect.left + gridRef.current.scrollLeft;
      const ry = ev.clientY - rect.top + gridRef.current.scrollTop;
      setLinking((prev) => (prev ? { ...prev, x: rx, y: ry } : prev));
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const bar = target?.closest('[data-task-id]');
      const toId = bar ? Number(bar.getAttribute('data-task-id')) : null;
      setLinking(null);
      if (toId && toId !== task.id) {
        onAddDependency?.(task.id, toId);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ----- Drag / Resize via pointer events -----
  const onBarPointerDown = (e, task, kind) => {
    e.stopPropagation();
    e.preventDefault();
    const geo = barGeometry(task);
    if (!geo) return;
    setDrag({
      taskId: task.id,
      kind, // 'move' | 'resize-start' | 'resize-end'
      startX: e.clientX,
      origStart: geo.start,
      origEnd: geo.end,
      preview: { start: geo.start, end: geo.end },
    });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const dragRef = useRef(null);
  dragRef.current = drag;

  const onPointerMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d) return;
      const deltaDays = Math.round((e.clientX - d.startX) / pxPerDay);
      let start = d.origStart;
      let end = d.origEnd;
      if (d.kind === 'move') {
        start = addDays(d.origStart, deltaDays);
        end = addDays(d.origEnd, deltaDays);
      } else if (d.kind === 'resize-start') {
        start = addDays(d.origStart, deltaDays);
        if (daysBetween(start, end) < 0) start = end;
      } else if (d.kind === 'resize-end') {
        end = addDays(d.origEnd, deltaDays);
        if (daysBetween(start, end) < 0) end = start;
      }
      setDrag((prev) => (prev ? { ...prev, preview: { start, end } } : prev));
    },
    [pxPerDay]
  );

  const onPointerUp = useCallback(() => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    const d = dragRef.current;
    if (d && d.preview) {
      const changed =
        d.preview.start !== d.origStart || d.preview.end !== d.origEnd;
      if (changed) {
        onUpdateTask?.(d.taskId, {
          start_date: d.preview.start,
          duedate: d.preview.end,
        });
      }
    }
    setDrag(null);
  }, [onPointerMove, onUpdateTask]);

  // ----- Double-clic sur zone vide -> création rapide -----
  const onLanePointerDblClick = (e, group) => {
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + gridRef.current.scrollLeft;
    const dayIndex = Math.floor(x / pxPerDay);
    const start = addDays(rangeStart, dayIndex);
    const end = addDays(start, mode === 'week' ? 1 : 6);
    setQuickCreate({ group_id: group.id, group, start, end });
  };

  const shiftWindow = (dir) => {
    const step = mode === 'week' ? 7 : 28;
    setAnchor((a) => {
      const x = new Date(a);
      x.setDate(x.getDate() + dir * step);
      return x;
    });
  };

  const labelFor = (task) => {
    const geo = drag && drag.taskId === task.id ? drag.preview : barGeometry(task);
    if (!geo) return '';
    const s = parseYmd(geo.start);
    const e = parseYmd(geo.end);
    return `${s.getDate()} ${MONTHS[s.getMonth()]} → ${e.getDate()} ${MONTHS[e.getMonth()]}`;
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Barre d'outils Gantt */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
          {['week', 'month'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm transition ${
                mode === m ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {m === 'week' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftWindow(-1)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            title="Période précédente"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setAnchor(mondayOf(new Date()))}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => shiftWindow(1)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            title="Période suivante"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <span className="ml-auto text-xs text-gray-400">
          Glissez une barre pour déplacer · étirez les bords pour redimensionner ·
          double-cliquez une zone vide pour créer
        </span>
      </div>

      {/* Grille */}
      <div className="flex flex-1 overflow-hidden">
        {/* Colonne fixe : noms des tâches */}
        <div className="w-56 shrink-0 overflow-hidden border-r border-gray-200 bg-white">
          {/* En-tête aligné avec l'échelle (2 lignes) */}
          <div className="h-12 border-b border-gray-200" />
          <div className="overflow-hidden">
            {rows.map((r, i) =>
              r.type === 'group' ? (
                <div
                  key={`g-${r.group.id}`}
                  className="flex items-center gap-2 px-3 text-sm font-semibold"
                  style={{ height: ROW_H, color: r.group.color }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.group.color }} />
                  {r.group.name}
                </div>
              ) : (
                <div
                  key={`t-${r.task.id}`}
                  className="flex items-center truncate border-t border-gray-50 px-3 pl-7 text-sm text-gray-700"
                  style={{ height: ROW_H }}
                  title={r.task.name}
                >
                  <span className="truncate">{r.task.name}</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Zone scrollable : échelle + barres */}
        <div ref={gridRef} className="relative flex-1 overflow-auto">
          <div style={{ width: gridWidth }}>
            {/* En-tête de l'échelle */}
            <div className="sticky top-0 z-10 flex h-12 border-b border-gray-200 bg-white">
              {scale.map((u, i) => (
                <div
                  key={u.key}
                  className={`flex flex-col items-center justify-center border-r border-gray-100 text-[11px] ${
                    u.isToday ? 'bg-primary-light' : u.isWeekend ? 'bg-gray-50' : ''
                  }`}
                  style={{ width: unit }}
                >
                  <span className="text-gray-400">{u.month || u.sub}</span>
                  <span className={`font-medium ${u.isToday ? 'text-primary' : 'text-gray-600'}`}>
                    {u.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Lignes */}
            <div className="relative">
              {/* Colonnes de fond */}
              <div className="pointer-events-none absolute inset-0 flex">
                {scale.map((u) => (
                  <div
                    key={u.key}
                    className={`border-r border-gray-100 ${
                      u.isToday ? 'bg-primary-light/40' : u.isWeekend ? 'bg-gray-50/60' : ''
                    }`}
                    style={{ width: unit }}
                  />
                ))}
              </div>

              {rows.map((r) =>
                r.type === 'group' ? (
                  <div
                    key={`gr-${r.group.id}`}
                    className="border-t border-gray-100 bg-gray-50/40"
                    style={{ height: ROW_H }}
                  />
                ) : (
                  <GanttLane
                    key={`tr-${r.task.id}`}
                    task={r.task}
                    group={r.group}
                    geo={drag && drag.taskId === r.task.id ? null : barGeometry(r.task)}
                    previewGeo={
                      drag && drag.taskId === r.task.id
                        ? {
                            left: daysBetween(rangeStart, drag.preview.start) * pxPerDay,
                            width: Math.max(1, daysBetween(drag.preview.start, drag.preview.end) + 1) * pxPerDay,
                          }
                        : null
                    }
                    rowH={ROW_H}
                    label={labelFor(r.task)}
                    onPointerDownBar={(e, kind) => onBarPointerDown(e, r.task, kind)}
                    onLinkStart={(e) => onLinkPointerDown(e, r.task)}
                    onDblClick={(e) => onLanePointerDblClick(e, r.group)}
                  />
                )
              )}

              {/* Calque SVG des flèches de dépendance */}
              <svg
                className="pointer-events-none absolute inset-0"
                style={{ width: gridWidth, height: rows.length * ROW_H }}
              >
                <defs>
                  <marker
                    id="gantt-arrow"
                    markerWidth="7"
                    markerHeight="7"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="#7a6aa8" />
                  </marker>
                </defs>
                {arrows.map((a) => {
                  const midX = Math.max(a.x1 + 14, (a.x1 + a.x2) / 2);
                  const path = `M ${a.x1} ${a.y1} C ${midX} ${a.y1}, ${midX} ${a.y2}, ${a.x2 - 6} ${a.y2}`;
                  return (
                    <g key={a.id} className="pointer-events-auto">
                      <path
                        d={path}
                        fill="none"
                        stroke="#7a6aa8"
                        strokeWidth="1.6"
                        markerEnd="url(#gantt-arrow)"
                      />
                      {/* zone de clic épaisse pour supprimer */}
                      <path
                        d={path}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="10"
                        className="cursor-pointer"
                        onClick={() => {
                          if (confirm('Supprimer cette dépendance ?')) onDeleteDependency?.(a.id);
                        }}
                      >
                        <title>Cliquer pour supprimer la dépendance</title>
                      </path>
                    </g>
                  );
                })}
                {/* Ligne en cours de création */}
                {linking && (
                  <line
                    x1={linking.sx}
                    y1={linking.sy}
                    x2={linking.x}
                    y2={linking.y}
                    stroke="#0073ea"
                    strokeWidth="1.6"
                    strokeDasharray="4 3"
                  />
                )}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Mini-formulaire de création rapide */}
      {quickCreate && (
        <QuickCreate
          info={quickCreate}
          onCancel={() => setQuickCreate(null)}
          onSubmit={async (name) => {
            await onCreateTask?.({
              group_id: quickCreate.group_id,
              name,
              start_date: quickCreate.start,
              duedate: quickCreate.end,
            });
            setQuickCreate(null);
          }}
        />
      )}
    </div>
  );
}

// Une ligne (lane) avec sa barre de tâche.
function GanttLane({
  task,
  group,
  geo,
  previewGeo,
  rowH,
  label,
  onPointerDownBar,
  onLinkStart,
  onDblClick,
}) {
  const g = previewGeo || geo;
  const color = STATUS_META[task.status]?.bg || group.color;
  return (
    <div
      className="relative border-t border-gray-50"
      style={{ height: rowH }}
      onDoubleClick={onDblClick}
    >
      {g && (
        <div
          data-task-id={task.id}
          className="group/bar absolute top-1/2 flex -translate-y-1/2 items-center rounded-md text-[11px] font-medium text-white shadow-sm ring-1 ring-black/5"
          style={{
            left: g.left,
            width: Math.max(g.width, 12),
            height: rowH - 14,
            backgroundColor: color,
            opacity: previewGeo ? 0.85 : 1,
            cursor: 'grab',
          }}
          onPointerDown={(e) => onPointerDownBar(e, 'move')}
          title={`${task.name} · ${label}`}
        >
          {/* poignée gauche */}
          <span
            onPointerDown={(e) => onPointerDownBar(e, 'resize-start')}
            className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l-md bg-black/10 opacity-0 group-hover/bar:opacity-100"
          />
          <span className="truncate px-2">{task.name}</span>
          {/* poignée droite */}
          <span
            onPointerDown={(e) => onPointerDownBar(e, 'resize-end')}
            className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r-md bg-black/10 opacity-0 group-hover/bar:opacity-100"
          />
          {/* pastille de liaison (créer une dépendance) */}
          <span
            onPointerDown={onLinkStart}
            title="Glisser vers une autre tâche pour créer une dépendance"
            className="absolute -right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full bg-white text-primary opacity-0 shadow ring-1 ring-primary/40 group-hover/bar:opacity-100"
          >
            <Link2 size={10} />
          </span>
        </div>
      )}
    </div>
  );
}

// Mini-formulaire flottant pour la création rapide.
function QuickCreate({ info, onCancel, onSubmit }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onCancel}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Nouvelle tâche</h3>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <p className="mb-2 text-xs text-gray-500">
          Groupe « {info.group.name} » · {info.start} → {info.end}
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de la tâche…"
          className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer
          </button>
        </div>
      </form>
    </div>
  );
}
