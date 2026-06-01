import { X, Bot, Sparkles, Heart } from 'lucide-react';
import Avatar from './Avatar.jsx';

// Panneau latéral affiché quand on sélectionne un onglet du rail
// (Agents = membres de l'équipe, Sidekick, Favoris).
export default function RailPanel({ rail, users = [], onClose }) {
  const config = {
    Agents: {
      icon: Bot,
      title: 'Agents & membres',
      body: (
        <ul className="space-y-1">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50"
            >
              <Avatar name={u.name} src={u.avatar_url} size={32} ring={false} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-800">{u.name}</div>
                <div className="truncate text-xs text-gray-400">{u.email}</div>
              </div>
              <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[11px] capitalize text-gray-500">
                {u.role}
              </span>
            </li>
          ))}
          {users.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-gray-400">Aucun membre</li>
          )}
        </ul>
      ),
    },
    Sidekick: {
      icon: Sparkles,
      title: 'Sidekick',
      body: (
        <p className="px-2 py-6 text-center text-sm text-gray-400">
          Assistant IA — bientôt disponible.
        </p>
      ),
    },
    Favoris: {
      icon: Heart,
      title: 'Favoris',
      body: (
        <p className="px-2 py-6 text-center text-sm text-gray-400">
          Aucun favori pour le moment.
        </p>
      ),
    },
  };

  const c = config[rail];
  if (!c) return null;
  const Icon = c.icon;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Icon size={16} /> {c.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Fermer"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2">{c.body}</div>
    </aside>
  );
}
