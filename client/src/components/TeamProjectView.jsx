import { useMemo } from 'react';
import { Users, PieChart as PieIcon } from 'lucide-react';
import Avatar from './Avatar.jsx';
import TeamWorkloadView from './TeamWorkloadView.jsx';
import { STATUS_META } from '../lib/constants.js';

// Statuts suivis dans la répartition (ordre d'affichage).
const STATUSES = ['À faire', 'En cours', 'Bloqué', 'Fait'];

// Vue contextuelle d'une équipe DANS un projet donné.
// Le `board` reçu ne contient que les tâches de ce projet : la charge et la
// répartition sont donc automatiquement filtrées au projet courant, et l'on
// restreint en plus aux seuls membres de l'équipe.
export default function TeamProjectView({ board, team, section = 'workload' }) {
  const members = team?.members || [];
  // On normalise les membres au format attendu par TeamWorkloadView.
  const memberUsers = useMemo(
    () =>
      members.map((m) => ({
        id: m.id,
        name: m.name,
        avatar_url: m.avatar_url,
        email: m.email || '',
      })),
    [members]
  );

  // Toutes les tâches du projet, à plat.
  const allTasks = useMemo(() => {
    const out = [];
    for (const g of board?.groups || []) for (const t of g.tasks) out.push(t);
    return out;
  }, [board]);

  // Répartition : pour chaque membre, comptage par statut des tâches du
  // projet qui lui sont assignées (via assignees, rétrocompat admin).
  const distribution = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.id));
    const rows = new Map();
    for (const m of members) {
      rows.set(m.id, { id: m.id, name: m.name, avatar_url: m.avatar_url, total: 0, byStatus: {} });
    }
    for (const t of allTasks) {
      const assignees = t.assignees && t.assignees.length ? t.assignees : t.admin ? [t.admin] : [];
      for (const a of assignees) {
        if (!memberIds.has(a.id)) continue;
        const row = rows.get(a.id);
        row.total += 1;
        row.byStatus[t.status] = (row.byStatus[t.status] || 0) + 1;
      }
    }
    return [...rows.values()];
  }, [allTasks, members]);

  const grandTotal = distribution.reduce((s, r) => s + r.total, 0);

  if (section === 'workload') {
    return <TeamWorkloadView board={board} users={memberUsers} />;
  }

  // ---- Répartition des tâches ----
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
          <Users size={20} />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{team?.name}</h3>
          <p className="text-sm text-gray-500">
            {members.length} membre(s) · {grandTotal} tâche(s) sur ce projet
          </p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-400">
          Aucun membre dans cette équipe.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <div className="w-56 shrink-0 px-4 py-3">Agent</div>
            {STATUSES.map((s) => (
              <div key={s} className="flex-1 border-l border-gray-100 px-2 py-3 text-center">
                {s}
              </div>
            ))}
            <div className="w-24 shrink-0 border-l border-gray-100 px-3 py-3 text-center">Total</div>
          </div>

          {distribution.map((row) => (
            <div
              key={row.id}
              className="flex items-stretch border-b border-gray-100 last:border-b-0"
            >
              <div className="flex w-56 shrink-0 items-center gap-2 px-4 py-3">
                <Avatar name={row.name} src={row.avatar_url} size={30} ring={false} />
                <span className="truncate text-sm font-medium text-gray-800">{row.name}</span>
              </div>
              {STATUSES.map((s) => {
                const n = row.byStatus[s] || 0;
                return (
                  <div
                    key={s}
                    className="flex flex-1 items-center justify-center border-l border-gray-100 py-3"
                  >
                    {n > 0 ? (
                      <span
                        className="flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold"
                        style={{
                          backgroundColor: STATUS_META[s]?.bg || '#9aadbd',
                          color: STATUS_META[s]?.text || '#fff',
                        }}
                      >
                        {n}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                );
              })}
              <div className="flex w-24 shrink-0 items-center justify-center border-l border-gray-100 py-3 text-sm font-bold text-gray-700">
                {row.total}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Répartition globale par statut (barre empilée) */}
      {grandTotal > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <PieIcon size={13} /> Répartition globale de l'équipe
          </div>
          <div className="flex h-4 overflow-hidden rounded-full">
            {STATUSES.map((s) => {
              const n = distribution.reduce((acc, r) => acc + (r.byStatus[s] || 0), 0);
              if (!n) return null;
              return (
                <div
                  key={s}
                  title={`${s} : ${n}`}
                  style={{ width: `${(n / grandTotal) * 100}%`, backgroundColor: STATUS_META[s]?.bg || '#c4c4c4' }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
            {STATUSES.map((s) => {
              const n = distribution.reduce((acc, r) => acc + (r.byStatus[s] || 0), 0);
              return (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: STATUS_META[s]?.bg || '#c4c4c4' }}
                  />
                  {s} ({n})
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
