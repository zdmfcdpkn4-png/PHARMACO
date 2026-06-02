import { useEffect, useMemo, useState } from 'react';
import {
  Folder,
  Users,
  CheckCircle2,
  ListTodo,
  LayoutDashboard,
  ArrowRight,
  Flame,
  AlarmClock,
  MessageSquare,
  Reply,
  Megaphone,
  Flag,
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import { STATUS_META } from '../lib/constants.js';

const STATUSES = ['À faire', 'En cours', 'Bloqué', 'Fait'];
const todayKey = new Date().toISOString().slice(0, 10);

// Horodatage relatif court.
function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'hier';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Petite pastille de synthèse (urgences, retards, discussions). Grisée à 0.
function SynthChip({ icon: Icon, label, value, color }) {
  const active = value > 0;
  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
      style={
        active
          ? { borderColor: `${color}33`, backgroundColor: `${color}0f` }
          : { borderColor: '#f1f1f1', backgroundColor: '#fafafa' }
      }
    >
      <Icon size={15} style={{ color: active ? color : '#c4c4c4' }} />
      <div className="leading-tight">
        <div
          className="text-sm font-bold"
          style={{ color: active ? color : '#9ca3af' }}
        >
          {value}
        </div>
        <div className="text-[10px] text-gray-500">{label}</div>
      </div>
    </div>
  );
}

// Calcule les statistiques d'un projet (board complet) : avancement,
// tâches urgentes / en retard, et synthèse des discussions (non lus / à
// répondre) à partir des compteurs de messages non lus de l'utilisateur.
function computeStats(full, unreadCounts = {}) {
  const tasks = [];
  for (const g of full.groups || []) for (const t of g.tasks) tasks.push(t);
  const byStatus = {};
  for (const s of STATUSES) byStatus[s] = 0;

  let urgent = 0;
  let overdue = 0;
  let unreadMessages = 0;
  let toReply = 0;

  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    const open = t.status !== 'Fait';
    if (open && (t.priority || '').startsWith('P1')) urgent += 1;
    if (open && t.duedate && t.duedate.slice(0, 10) < todayKey) overdue += 1;

    const unread = unreadCounts[t.id] || 0;
    if (unread > 0) {
      unreadMessages += unread;
      toReply += 1; // une discussion en attente de lecture/réponse
    }
  }

  const total = tasks.length;
  const done = byStatus['Fait'] || 0;
  const blocked = byStatus['Bloqué'] || 0;
  return {
    total,
    done,
    blocked,
    urgent,
    overdue,
    unreadMessages,
    toReply,
    byStatus,
    pct: total ? Math.round((done / total) * 100) : 0,
    teams: full.teams || [],
  };
}

// Vue d'ensemble : tableau de bord agrégé de tous les projets.
export default function OverviewView({
  boards,
  loadFull,
  onOpenProject,
  unreadCounts = {},
  currentUserId,
  loadHighlights,
}) {
  const [fullById, setFullById] = useState({});
  const [loading, setLoading] = useState(true);
  const [highlights, setHighlights] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!loadHighlights) return;
      try {
        const h = await loadHighlights();
        if (!cancelled) setHighlights(Array.isArray(h) ? h : []);
      } catch {
        /* non bloquant */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHighlights]);

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
        stats: fullById[b.id] ? computeStats(fullById[b.id], unreadCounts) : null,
      })),
    [boards, fullById, unreadCounts, currentUserId]
  );

  const totals = useMemo(() => {
    let total = 0;
    let done = 0;
    let urgent = 0;
    let overdue = 0;
    let unreadMessages = 0;
    for (const c of cards) {
      if (!c.stats) continue;
      total += c.stats.total;
      done += c.stats.done;
      urgent += c.stats.urgent;
      overdue += c.stats.overdue;
      unreadMessages += c.stats.unreadMessages;
    }
    return {
      projects: boards.length,
      total,
      done,
      urgent,
      overdue,
      unreadMessages,
      pct: total ? Math.round((done / total) * 100) : 0,
    };
  }, [cards, boards.length]);

  // Tâches urgentes / en retard regroupées par agent (sur tous les projets).
  const agentAlerts = useMemo(() => {
    const map = new Map();
    for (const b of boards) {
      const full = fullById[b.id];
      if (!full) continue;
      for (const g of full.groups || []) {
        for (const t of g.tasks) {
          const open = t.status !== 'Fait';
          const urgent = open && (t.priority || '').startsWith('P1');
          const overdue = open && t.duedate && t.duedate.slice(0, 10) < todayKey;
          if (!urgent && !overdue) continue;
          const assignees = t.assignees && t.assignees.length ? t.assignees : t.admin ? [t.admin] : [];
          const entry = { ...t, _boardId: b.id, _boardName: b.name };
          const targets = assignees.length ? assignees : [{ id: 0, name: 'Non assignée' }];
          for (const a of targets) {
            if (!map.has(a.id)) map.set(a.id, { user: a, urgent: [], overdue: [] });
            const e = map.get(a.id);
            if (urgent) e.urgent.push(entry);
            if (overdue) e.overdue.push(entry);
          }
        }
      }
    }
    return [...map.values()].sort(
      (a, b) => b.urgent.length + b.overdue.length - (a.urgent.length + a.overdue.length)
    );
  }, [boards, fullById]);

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
        <Stat icon={LayoutDashboard} label="Projets" value={totals.projects} color="#005586" />
        <Stat icon={ListTodo} label="Tâches au total" value={totals.total} color="#005586" />
        <Stat icon={CheckCircle2} label="Terminées" value={`${totals.done} (${totals.pct}%)`} color="#00c875" />
        <Stat icon={Flame} label="Urgentes (P1)" value={totals.urgent} color="#e82a63" />
        <Stat icon={AlarmClock} label="En retard" value={totals.overdue} color="#e8722e" />
        <Stat icon={MessageSquare} label="Messages non lus" value={totals.unreadMessages} color="#005586" />
      </div>

      {/* Messages prioritaires/ciblés + Urgences par agent */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Messages mis en avant */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700">
            <Megaphone size={16} className="text-brand-rose" /> Messages prioritaires & ciblés
            {highlights.length > 0 && (
              <span className="ml-auto rounded-full bg-brand-rose/15 px-2 py-0.5 text-xs font-medium text-brand-rose">
                {highlights.length}
              </span>
            )}
          </div>
          <div className="max-h-72 overflow-auto">
            {highlights.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                Aucun message prioritaire ou ciblé.
              </p>
            ) : (
              highlights.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => m.board_id && onOpenProject(m.board_id)}
                  className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50 ${
                    m.is_read ? '' : 'bg-brand-rose/[0.03]'
                  }`}
                >
                  <Avatar name={m.user?.name || '?'} src={m.user?.avatar_url} size={32} ring={false} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                      <span className="font-medium text-gray-700">{m.user?.name || 'Inconnu'}</span>
                      {m.priority && (
                        <span className="flex items-center gap-0.5 rounded-full bg-brand-rose/15 px-1.5 py-0.5 font-medium text-brand-rose">
                          <Flag size={9} /> Prioritaire
                        </span>
                      )}
                      {m.recipient && (
                        <span className="rounded-full bg-primary-light px-1.5 py-0.5 font-medium text-primary">
                          → {m.recipient.name}
                        </span>
                      )}
                      {!m.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand-rose" />}
                      <span className="ml-auto">{timeAgo(m.created_at)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-gray-800">{m.content}</div>
                    <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-gray-400">
                      <Folder size={11} /> {m.board_name} · {m.task_name}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Urgences / retards par agent */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700">
            <AlarmClock size={16} className="text-brand-rose" /> Tâches urgentes & en retard par agent
          </div>
          <div className="max-h-72 overflow-auto">
            {agentAlerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                {loading ? 'Chargement…' : 'Aucune tâche urgente ou en retard. 👌'}
              </p>
            ) : (
              agentAlerts.map((a) => (
                <div key={a.user.id} className="border-b border-gray-50 px-4 py-3 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Avatar name={a.user.name} src={a.user.avatar_url} size={30} ring={false} />
                    <span className="flex-1 truncate text-sm font-medium text-gray-800">
                      {a.user.name}
                    </span>
                    {a.urgent.length > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-brand-rose/15 px-2 py-0.5 text-xs font-semibold text-brand-rose">
                        <Flame size={11} /> {a.urgent.length}
                      </span>
                    )}
                    {a.overdue.length > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-600">
                        <AlarmClock size={11} /> {a.overdue.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 pl-9">
                    {[...new Map([...a.urgent, ...a.overdue].map((t) => [`${t._boardId}-${t.id}`, t])).values()]
                      .slice(0, 4)
                      .map((t) => (
                        <button
                          key={`${t._boardId}-${t.id}`}
                          type="button"
                          onClick={() => onOpenProject(t._boardId)}
                          title={`${t._boardName} · ${t.name}`}
                          className="flex max-w-[160px] items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:border-primary hover:text-primary"
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: STATUS_META[t.status]?.bg || '#c4c4c4' }}
                          />
                          <span className="truncate">{t.name}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
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

                {/* Synthèse : urgences / retards + discussions */}
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <SynthChip
                    icon={Flame}
                    label="Urgentes"
                    value={stats.urgent}
                    color="#e2445c"
                  />
                  <SynthChip
                    icon={AlarmClock}
                    label="En retard"
                    value={stats.overdue}
                    color="#e8722e"
                  />
                  <SynthChip
                    icon={MessageSquare}
                    label="Non lus"
                    value={stats.unreadMessages}
                    color="#0073ea"
                  />
                  <SynthChip
                    icon={Reply}
                    label="À répondre"
                    value={stats.toReply}
                    color="#3b1f7a"
                  />
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
