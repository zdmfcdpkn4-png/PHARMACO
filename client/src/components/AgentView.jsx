import { useEffect, useMemo, useState } from 'react';
import {
  ListChecks,
  Flame,
  AlarmClock,
  CheckCircle2,
  Folder,
  ChevronLeft,
  Calendar,
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import { STATUS_META, PRIORITY_META, PRIORITIES, formatShortDate } from '../lib/constants.js';

const todayKey = new Date().toISOString().slice(0, 10);
const isDone = (t) => t.status === 'Fait';
const isOverdue = (t) => !isDone(t) && t.duedate && t.duedate.slice(0, 10) < todayKey;

// Vue agent : tâches affectées à un agent sur l'ensemble des projets,
// classées par priorité (P1 > P2 > P3), avec une synthèse en tête.
export default function AgentView({ agent, boards, loadFull, onBack, onOpenProject }) {
  const [fullBoards, setFullBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(boards.map((b) => loadFull(b.id).catch(() => null)));
        if (!cancelled) setFullBoards(results.filter(Boolean));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boards, loadFull]);

  // Tâches affectées à l'agent (via assignees, repli sur admin), avec projet.
  const tasks = useMemo(() => {
    if (!agent) return [];
    const out = [];
    for (const b of fullBoards) {
      for (const g of b.groups || []) {
        for (const t of g.tasks) {
          const assignees = t.assignees && t.assignees.length ? t.assignees : t.admin ? [t.admin] : [];
          if (assignees.some((a) => a.id === agent.id)) {
            out.push({ ...t, _boardId: b.id, _boardName: b.name, _groupName: g.name });
          }
        }
      }
    }
    return out;
  }, [fullBoards, agent]);

  const summary = useMemo(() => {
    let urgent = 0;
    let overdue = 0;
    let done = 0;
    for (const t of tasks) {
      if (!isDone(t) && (t.priority || '').startsWith('P1')) urgent += 1;
      if (isOverdue(t)) overdue += 1;
      if (isDone(t)) done += 1;
    }
    return { total: tasks.length, urgent, overdue, done, active: tasks.length - done };
  }, [tasks]);

  // Regroupement par priorité ; au sein d'un groupe, en cours d'abord puis par
  // échéance croissante, les tâches terminées reléguées en fin.
  const byPriority = useMemo(() => {
    const map = {};
    for (const p of PRIORITIES) map[p] = [];
    for (const t of tasks) {
      const key = PRIORITIES.includes(t.priority) ? t.priority : 'P3 - Normal';
      map[key].push(t);
    }
    const rank = (t) => (isDone(t) ? 1 : 0);
    for (const p of PRIORITIES) {
      map[p].sort((a, b) => {
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        const da = a.duedate || '9999-12-31';
        const db = b.duedate || '9999-12-31';
        return da.localeCompare(db);
      });
    }
    return map;
  }, [tasks]);

  const Stat = ({ icon: Icon, label, value, color }) => (
    <div className="flex min-w-[130px] flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        <Icon size={20} />
      </span>
      <div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );

  const TaskRow = ({ t }) => (
    <button
      type="button"
      onClick={() => onOpenProject?.(t._boardId)}
      className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-50 ${
        isDone(t) ? 'opacity-60' : ''
      }`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_META[t.status]?.bg || '#c4c4c4' }}
        title={t.status}
      />
      <span className={`min-w-0 flex-1 truncate text-sm text-gray-800 ${isDone(t) ? 'line-through' : ''}`}>
        {t.name}
      </span>
      <span className="hidden items-center gap-1 truncate text-xs text-gray-400 sm:flex">
        <Folder size={12} /> {t._boardName}
      </span>
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
        style={{
          backgroundColor: STATUS_META[t.status]?.bg || '#9aadbd',
          color: STATUS_META[t.status]?.text || '#fff',
        }}
      >
        {t.status}
      </span>
      <span
        className={`flex w-20 items-center justify-end gap-1 text-xs ${
          isOverdue(t) ? 'font-semibold text-status-blocked' : 'text-gray-500'
        }`}
      >
        {t.duedate && <Calendar size={12} />}
        {formatShortDate(t.duedate) || '—'}
      </span>
    </button>
  );

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* En-tête agent */}
      <div className="mb-5 flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:border-primary hover:text-primary"
            title="Retour à l'annuaire"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <Avatar name={agent?.name} src={agent?.avatar_url} size={48} ring={false} />
        <div>
          <h3 className="text-xl font-bold text-gray-800">{agent?.name}</h3>
          <p className="text-sm text-gray-500">{agent?.email}</p>
        </div>
      </div>

      {/* Synthèse */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Stat icon={ListChecks} label="Tâches affectées" value={summary.total} color="#005586" />
        <Stat icon={Flame} label="Urgentes (P1)" value={summary.urgent} color="#e82a63" />
        <Stat icon={AlarmClock} label="En retard" value={summary.overdue} color="#e8722e" />
        <Stat icon={CheckCircle2} label="Terminées" value={summary.done} color="#00c875" />
      </div>

      {/* Classement par priorité */}
      {summary.total === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-16 text-center text-sm text-gray-400">
          {loading ? 'Chargement…' : 'Aucune tâche affectée à cet agent.'}
        </div>
      ) : (
        <div className="space-y-4">
          {PRIORITIES.map((p) => {
            const list = byPriority[p];
            if (!list.length) return null;
            const meta = PRIORITY_META[p];
            return (
              <div key={p} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: meta.bg }}
                >
                  <span className="rounded bg-white/25 px-1.5 py-0.5 text-xs font-bold">{meta.label}</span>
                  {meta.full}
                  <span className="ml-auto rounded-full bg-white/25 px-2 py-0.5 text-xs">
                    {list.length}
                  </span>
                </div>
                <div>
                  {list.map((t) => (
                    <TaskRow key={`${t._boardId}-${t.id}`} t={t} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
