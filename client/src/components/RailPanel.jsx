import { useState } from 'react';
import {
  X,
  Bot,
  Sparkles,
  Heart,
  UserPlus,
  Loader2,
  Pencil,
  Trash2,
  KeyRound,
  Check,
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import TagConfig from './TagConfig.jsx';

const ROLE_LABELS = { member: 'Membre', admin: 'Admin', viewer: 'Observateur' };

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

// Ligne membre éditable : affichage + modes édition / mot de passe.
function MemberRow({ user, onUpdateUser, onDeleteUser, onSetPassword }) {
  const [mode, setMode] = useState(null); // null | 'edit' | 'password'
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setPassword('');
    setError(null);
    setMode(null);
  };

  const saveEdit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onUpdateUser(user.id, { name: name.trim(), email: email.trim(), role });
      setMode(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (clear = false) => {
    setBusy(true);
    setError(null);
    try {
      await onSetPassword(user.id, clear ? null : password.trim());
      setPassword('');
      setMode(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Supprimer le membre « ${user.name} » ?`)) return;
    setBusy(true);
    try {
      await onDeleteUser(user.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (mode === 'edit') {
    return (
      <li className="rounded-lg border border-gray-200 p-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-1.5 w-full rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-1.5 w-full rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mb-1.5 w-full rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary"
        >
          <option value="member">Membre</option>
          <option value="admin">Admin</option>
          <option value="viewer">Observateur</option>
        </select>
        {error && <div className="mb-1 text-xs text-status-blocked">{error}</div>}
        <div className="flex gap-1.5">
          <button
            onClick={saveEdit}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Enregistrer
          </button>
          <button
            onClick={reset}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            Annuler
          </button>
        </div>
      </li>
    );
  }

  if (mode === 'password') {
    return (
      <li className="rounded-lg border border-gray-200 p-2">
        <div className="mb-1.5 text-xs font-medium text-gray-600">
          Mot de passe — {user.name}
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nouveau mot de passe"
          autoComplete="new-password"
          className="mb-1.5 w-full rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary"
        />
        {error && <div className="mb-1 text-xs text-status-blocked">{error}</div>}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => savePassword(false)}
            disabled={busy || !password.trim()}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Définir
          </button>
          <button
            onClick={() => savePassword(true)}
            disabled={busy}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            title="Retirer le mot de passe (le membre ne pourra plus se connecter)"
          >
            Retirer
          </button>
          <button
            onClick={reset}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            Annuler
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
      <Avatar name={user.name} src={user.avatar_url} size={32} ring={false} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-800">{user.name}</div>
        <div className="truncate text-xs text-gray-400">{user.email}</div>
      </div>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
        {ROLE_LABELS[user.role] || user.role}
      </span>
      {/* Actions (au survol) */}
      <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={() => setMode('edit')}
          title="Modifier"
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-primary"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => setMode('password')}
          title="Mot de passe"
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-brand-orange"
        >
          <KeyRound size={14} />
        </button>
        <button
          onClick={remove}
          disabled={busy}
          title="Supprimer"
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-status-blocked"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}

// Panneau latéral affiché quand on sélectionne un onglet du rail
// (Agents = membres de l'équipe, Sidekick, Favoris).
export default function RailPanel({
  rail,
  users = [],
  onClose,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSetPassword,
  tags = [],
  canManage = true,
  onCreateTag,
  onDeleteTag,
}) {
  const config = {
    Agents: {
      icon: Bot,
      title: 'Agents & étiquettes',
      body: (
        <>
          <ul className="space-y-1">
            {users.map((u) => (
              <MemberRow
                key={u.id}
                user={u}
                onUpdateUser={onUpdateUser}
                onDeleteUser={onDeleteUser}
                onSetPassword={onSetPassword}
              />
            ))}
            {users.length === 0 && (
              <li className="px-2 py-6 text-center text-sm text-gray-400">Aucun membre</li>
            )}
          </ul>
          {onAddUser && <AddMemberForm onAddUser={onAddUser} />}

          {/* Configuration des étiquettes */}
          {onCreateTag && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <div className="mb-3 text-sm font-semibold text-gray-700">
                Configuration des étiquettes
              </div>
              <TagConfig
                tags={tags}
                canManage={canManage}
                onCreate={onCreateTag}
                onDelete={onDeleteTag}
              />
            </div>
          )}
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
