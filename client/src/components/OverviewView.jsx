import { useEffect, useMemo, useState } from 'react';
import { Folder, Users, CheckCircle2, ListTodo, LayoutDashboard, ArrowRight } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { STATUS_META } from '../lib/constants.js';

const STATUSES = ['À faire', 'En cours', 'Bloqué', 'Fait'];

// Calcule les statistiques d'un projet (board complet).
function computeStats(full) {
  const tasks = [];
  for (const g of full.groups || []) for (const t of g.tasks) tasks.push(t);
  const byStatus = {};
  for (const s of STATUSES) byStatus[s] = 0;
  for (const t of tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  const total = tasks.length;
  const done = byStatus['Fait'] || 0;
  const blocked = byStatus['Bloqué'] || 0;
  return {
    total,
    done,
    blocked,
    byStatus,
    pct: total ? Math.round((done / total) * 100) : 0,
    teams: full.teams || [],
  };
}

// Vue d'ensemble : tableau de bord agrégé de tous les projets.
export default function OverviewView({ boards, loadFull, onOpenProject }) {
  const [fullById, setFullById] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          boards.map((b) => loadFull(b.id).catch(() => null))
        );
        if (cancelled) return;
        const map = {};
        results.forEach((full, i) => {
          if (full) map[boards[i].id] = full;
        });
        setFullById(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boards, loadFull]);

  const cards = useMemo(
    () =>
      boards.map((b) => ({
        meta: b,
        stats: fullById[b.id] ? computeStats(fullById[b.id]) : null,
      })),
    [boards, fullById]
  );

  const totals = useMemo(() => {
    let total = 0;
    let done = 0;
    let blocked = 0;
    for (const c of cards) {
      if (!c.stats) continue;
      total += c.stats.total;
      done += c.stats.done;
      blocked += c.stats.blocked;
    }
    return { projects: boards.length, total, done, blocked, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [cards, boards.length]);

  const Stat = ({ icon: Icon, label, value, color }) => (
    <div className="flex min-w-[140px] flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
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

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Récapitulatif global */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Stat icon={LayoutDashboard} label="Projets" value={totals.projects} color="#3b1f7a" />
        <Stat icon={ListTodo} label="Tâches au total" value={totals.total} color="#579bfc" />
        <Stat icon={CheckCircle2} label="Terminées" value={`${totals.done} (${totals.pct}%)`} color="#00c875" />
        <Stat icon={Folder} label="Bloquées" value={totals.blocked} color="#e2445c" />
      </div>

      {/* Grille des projets */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ meta, stats }) => (
          <button
            key={meta.id}
            type="button"
            onClick={() => onOpenProject(meta.id)}
            className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <Folder size={18} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-gray-800">{meta.name}</div>
                  {meta.description && (
                    <div className="truncate text-xs text-gray-400">{meta.description}</div>
                  )}
                </div>
              </div>
              <ArrowRight
                size={16}
                className="mt-1 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-primary"
              />
            </div>

            {stats ? (
              <>
                {/* Barre de progression */}
                <div className="mb-1 mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>{stats.total} tâche(s)</span>
                  <span className="font-medium text-gray-700">{stats.pct}% terminé</span>
                </div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-status-done transition-all"
                    style={{ width: `${stats.pct}%` }}
                  />
                </div>

                {/* Répartition par statut */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => {
                    const n = stats.byStatus[s] || 0;
                    if (!n) return null;
                    return (
                      <span
                        key={s}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                        style={{ backgroundColor: STATUS_META[s]?.bg || '#c4c4c4' }}
                      >
                        {s} · {n}
                      </span>
                    );
                  })}
                  {stats.total === 0 && (
                    <span className="text-xs text-gray-400">Aucune tâche pour l'instant.</span>
                  )}
                </div>

                {/* Équipes impliquées */}
                <div className="mt-auto flex items-center gap-2 border-t border-gray-50 pt-3 text-xs text-gray-500">
                  <Users size={14} className="text-gray-400" />
                  {stats.teams.length ? (
                    <>
                      <div className="flex -space-x-1.5">
                        {stats.teams
                          .flatMap((t) => t.members || [])
                          .slice(0, 5)
                          .map((m, i) => (
                            <Avatar key={`${m.id}-${i}`} name={m.name} src={m.avatar_url} size={20} ring />
                          ))}
                      </div>
                      <span className="truncate">
                        {stats.teams.map((t) => t.name).join(', ')}
                      </span>
                    </>
                  ) : (
                    <span>Aucune équipe associée</span>
                  )}
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-xs text-gray-300">
                {loading ? 'Chargement…' : 'Statistiques indisponibles'}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
