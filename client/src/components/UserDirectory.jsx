import { Search } from 'lucide-react';
import { useState } from 'react';
import Avatar from './Avatar.jsx';

const ROLE_LABELS = { admin: 'Admin', member: 'Membre', viewer: 'Observateur' };

// Annuaire des agents : liste des utilisateurs + leurs équipes.
export default function UserDirectory({ users }) {
  const [q, setQ] = useState('');
  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(q.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto bg-canvas p-6">
      {/* Barre de recherche */}
      <div className="mb-4 flex max-w-sm items-center gap-2 rounded-lg border border-gray-200 bg-white px-3">
        <Search size={16} className="text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un agent…"
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* En-tête */}
        <div className="flex items-center border-b border-gray-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <div className="flex-1">Agent</div>
          <div className="hidden w-56 sm:block">Email</div>
          <div className="w-28">Rôle global</div>
          <div className="w-72">Équipes associées</div>
        </div>

        {/* Lignes */}
        {filtered.map((u) => (
          <div
            key={u.id}
            className="flex items-center border-b border-gray-50 px-4 py-3 last:border-b-0 hover:bg-gray-50"
          >
            <div className="flex flex-1 items-center gap-3">
              <Avatar name={u.name} src={u.avatar_url} size={34} ring={false} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-800">{u.name}</div>
                <div className="truncate text-xs text-gray-400 sm:hidden">{u.email}</div>
              </div>
            </div>
            <div className="hidden w-56 truncate text-sm text-gray-500 sm:block">{u.email}</div>
            <div className="w-28">
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {ROLE_LABELS[u.role] || u.role}
              </span>
            </div>
            <div className="flex w-72 flex-wrap gap-1.5">
              {(u.teams || []).map((t) => (
                <span
                  key={t.id}
                  className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                  title={t.role}
                >
                  {t.name}
                </span>
              ))}
              {(!u.teams || u.teams.length === 0) && (
                <span className="text-xs text-gray-300">Aucune équipe</span>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">Aucun agent trouvé</div>
        )}
      </div>
    </div>
  );
}
