import { useState } from 'react';
import { X, Bot, Sparkles, Heart, UserPlus, Loader2 } from 'lucide-react';
import Avatar from './Avatar.jsx';

// Formulaire d'ajout de membre (agent).
function AddMemberForm({ onAddUser }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onAddUser({
        name: name.trim(),
        email: email.trim(),
        role,
        password: password.trim() || undefined,
      });
      setName('');
      setEmail('');
      setRole('member');
      setPassword('');
      setOpen(false);
    } catch (err) {
      setError(err.message || "Échec de l'ajout");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-primary hover:text-primary"
      >
        <UserPlus size={16} /> Ajouter un membre
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 rounded-lg border border-gray-200 p-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom complet"
        required
        className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="e-mail@exemple.com"
        required
        className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
      >
        <option value="member">Membre</option>
        <option value="admin">Admin</option>
        <option value="viewer">Observateur</option>
      </select>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mot de passe (optionnel)"
        autoComplete="new-password"
        className="mb-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
      />
      <p className="mb-2 text-[11px] text-gray-400">
        Laisser vide si le membre n'a pas besoin de se connecter.
      </p>

      {error && (
        <div className="mb-2 rounded-md bg-red-50 px-2 py-1 text-xs text-status-blocked">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Ajouter
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

// Panneau latéral affiché quand on sélectionne un onglet du rail
// (Agents = membres de l'équipe, Sidekick, Favoris).
export default function RailPanel({ rail, users = [], onClose, onAddUser }) {
  const config = {
    Agents: {
      icon: Bot,
      title: 'Agents & membres',
      body: (
        <>
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
          {onAddUser && <AddMemberForm onAddUser={onAddUser} />}
        </>
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
