import { useEffect, useMemo, useRef, useState } from 'react';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays as fnsAddDays,
  addWeeks,
  addMonths,
  format,
  isSameDay,
  isToday,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AvatarStack } from './AdminCell.jsx';
import { TagPill } from './TagCell.jsx';
import { STATUS_META, toYmd, parseYmd } from '../lib/constants.js';

const MODES = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'range', label: 'Période' },
];

// Vue temporelle auto-ajustable : grille jours/semaines (PC/tablette) ou
// timeline verticale (mobile).
export default function DynamicTimeView({ board, tags = [], onOpenTask }) {
  const [mode, setMode] = useState('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [range, setRange] = useState({ from: toYmd(new Date()), to: toYmd(fnsAddDays(new Date(), 13)) });
  const containerRef = useRef(null);
  const [width, setWidth] = useState(1000);

  // Mesure la largeur disponible (auto-fit)
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const isPhone = width < 640;
  const isTablet = width >= 640 && width < 1024;

  // Tâches à plat avec leur groupe
  const tasks = useMemo(() => {
    const out = [];
    for (const g of board?.groups || []) {
      for (const t of g.tasks) {
        if (!t.duedate && !t.start_date) continue;
        out.push({ ...t, groupColor: g.color, groupName: g.name });
      }
    }
    return out;
  }, [board]);

  const tagById = useMemo(() => Object.fromEntries(tags.map((t) => [t.id, t])), [tags]);

  // Bornes de la période selon le mode
  const period = useMemo(() => {
    if (mode === 'day') return { start: anchor, end: anchor };
    if (mode === 'week')
      return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
    if (mode === 'month')
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    // range
    return { start: parseYmd(range.from), end: parseYmd(range.to) };
  }, [mode, anchor, range]);

  const allDays = useMemo(
    () => eachDayOfInterval({ start: period.start, end: period.end }),
    [period]
  );

  // Colonnes affichées : auto-fit.
  // - Mois sur tablette : regroupe par semaines (≈4 colonnes).
  // - Sinon : 1 colonne par jour.
  const columns = useMemo(() => {
    const condenseToWeeks = mode === 'month' && isTablet;
    if (!condenseToWeeks) {
      return allDays.map((d) => ({ key: toYmd(d), start: d, end: d, label: format(d, 'd'), sub: format(d, 'EEE', { locale: fr }) }));
    }
    // Regroupe par semaine ISO
    const cols = [];
    let cur = startOfWeek(period.start, { weekStartsOn: 1 });
    while (cur <= period.end) {
      const wEnd = endOfWeek(cur, { weekStartsOn: 1 });
      cols.push({
        key: toYmd(cur),
        start: cur,
        end: wEnd,
        label: `${format(cur, 'd')}–${format(wEnd, 'd')}`,
        sub: format(cur, 'MMM', { locale: fr }),
      });
      cur = addWeeks(cur, 1);
    }
    return cols;
  }, [allDays, mode, isTablet, period]);

  const shift = (dir) => {
    if (mode === 'day') setAnchor((a) => fnsAddDays(a, dir));
    else if (mode === 'week') setAnchor((a) => addWeeks(a, dir));
    else if (mode === 'month') setAnchor((a) => addMonths(a, dir));
  };

  const TaskBlock = ({ t }) => {
    const people = t.assignees && t.assignees.length ? t.assignees : t.admin ? [t.admin] : [];
    return (
      <button
        onClick={() => onOpenTask?.(t)}
        className="w-full rounded-lg border border-gray-100 bg-white p-2 text-left shadow-sm transition hover:shadow-md"
      >
        <div className="flex items-start gap-1">
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: STATUS_META[t.status]?.bg || t.groupColor }}
          />
          <span className="flex-1 truncate text-sm font-medium text-gray-800">{t.name}</span>
        </div>
        {t.etape_tag_id && tagById[t.etape_tag_id] && (
          <div className="mt-1.5">
            <TagPill tag={tagById[t.etape_tag_id]} />
          </div>
        )}
        {people.length > 0 && (
          <div className="mt-1.5">
            <AvatarStack people={people} size={22} />
          </div>
        )}
      </button>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden bg-canvas">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-3 py-1.5 text-sm transition ${
                mode === m.key ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'range' ? (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="rounded-md border border-gray-200 px-2 py-1 outline-none focus:border-primary"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="rounded-md border border-gray-200 px-2 py-1 outline-none focus:border-primary"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-40 text-center text-sm font-medium capitalize text-gray-700">
              {mode === 'month'
                ? format(anchor, 'MMMM yyyy', { locale: fr })
                : `${format(period.start, 'd MMM', { locale: fr })} – ${format(period.end, 'd MMM', { locale: fr })}`}
            </span>
            <button onClick={() => shift(1)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Aujourd'hui
            </button>
          </div>
        )}

        <span className="ml-auto hidden text-xs text-gray-400 sm:block">
          {isPhone ? 'Vue liste' : isTablet ? 'Vue condensée' : 'Vue complète'} · auto-ajustée
        </span>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto p-4">
        {isPhone ? (
          /* ---- Timeline verticale (mobile) ---- */
          <div className="space-y-4">
            {allDays.map((d) => {
              const dayTasks = tasks.filter((t) => isSameDay(parseYmd(t.duedate || t.start_date), d));
              if (dayTasks.length === 0) return null;
              return (
                <div key={toYmd(d)}>
                  <div
                    className={`mb-1.5 text-sm font-semibold ${
                      isToday(d) ? 'text-primary' : 'text-gray-600'
                    }`}
                  >
                    {format(d, 'EEEE d MMMM', { locale: fr })}
                  </div>
                  <div className="space-y-2">
                    {dayTasks.map((t) => (
                      <TaskBlock key={t.id} t={t} />
                    ))}
                  </div>
                </div>
              );
            })}
            {tasks.filter((t) =>
              allDays.some((d) => isSameDay(parseYmd(t.duedate || t.start_date), d))
            ).length === 0 && (
              <p className="py-10 text-center text-sm text-gray-400">Aucune tâche sur cette période</p>
            )}
          </div>
        ) : (
          /* ---- Grille (PC / tablette) ---- */
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((col) => (
              <div key={col.key} className="flex flex-col">
                <div
                  className={`mb-2 rounded-lg py-1.5 text-center text-xs ${
                    columns.length === 1 ? 'bg-primary-light text-primary' : 'bg-white text-gray-500'
                  }`}
                >
                  <div className="uppercase">{col.sub}</div>
                  <div className="text-sm font-semibold text-gray-700">{col.label}</div>
                </div>
                <div className="flex-1 space-y-2 rounded-lg bg-gray-100/50 p-1.5">
                  {tasks
                    .filter((t) =>
                      isWithinInterval(parseYmd(t.duedate || t.start_date), {
                        start: new Date(col.start.getFullYear(), col.start.getMonth(), col.start.getDate()),
                        end: new Date(col.end.getFullYear(), col.end.getMonth(), col.end.getDate(), 23, 59, 59),
                      })
                    )
                    .map((t) => (
                      <TaskBlock key={t.id} t={t} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
