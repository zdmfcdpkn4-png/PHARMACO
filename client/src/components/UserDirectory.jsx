import { Search, UserPlus, Pencil, KeyRound, Trash2, X, Loader2, Check, ListChecks } from 'lucide-react';
import { useState } from 'react';
import Avatar from './Avatar.jsx';
import PharmacoAvatar, { AVATAR_PRESET_COUNT, AVATAR_ICON_KEYS } from './PharmacoAvatar.jsx';

const ROLE_LABELS = { admin: 'Admin', member: 'Membre', viewer: 'Observateur' };

// Sélecteur d'avatar : « Initiales », avatars à initiales, et avatars à motif
// (icône pharmacie/santé au centre) — tous dans la charte CHD.
function AvatarPicker({ name, value, onChange }) {
  const initialPresets = Array.from({ length: AVATAR_PRESET_COUNT }, (_, i) => `pharmaco:${i}`);
  // Un motif par icône, avec une palette CHD qui tourne.
  const iconPresets = AVATAR_ICON_KEYS.map((key, i) => `pharmaco:${i % AVATAR_PRESET_COUNT}:${key}`);

  const Option = ({ selected, onClick, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${
        selected ? 'border-primary' : 'border-transparent hover:border-gray-200'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-2">
      <div>
        <div className="mb-1 text-[11px] font-medium text-gray-400">Initiales</div>
        <div className="flex flex-wrap gap-1.5">
          <Option selected={!value} onClick={() => onChange(null)} title="Initiales simples">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: '#9aadbd' }}
            >
              {(name || '?').slice(0, 1).toUpperCase()}
            </span>
          </Option>
          {initialPresets.map((p, i) => (
            <Option key={p} selected={value === p} onClick={() => onChange(p)} title={`Avatar ${i + 1}`}>
              <PharmacoAvatar variant={i} name={name} size={36} ring={false} />
            </Option>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[11px] font-medium text-gray-400">Motifs</div>
        <div className="flex flex-wrap gap-1.5">
          {iconPresets.map((p, i) => (
            <Option key={p} selected={value === p} onClick={() => onChange(p)} title={`Motif ${i + 1}`}>
              <PharmacoAvatar variant={i % AVATAR_PRESET_COUNT} icon={AVATAR_ICON_KEYS[i]} size={36} ring={false} />
            </Option>
          ))}
        </div>
      </div>
    </div>
  );
}

// Modale d'ajout / modification d'un agent (nom, email, rôle, mot de passe).
function AgentModal({ mode, user, onClose, onSubmit }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState(user?.role || 'member');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar_url || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        role,
        password: password.trim(),
        avatar_url: avatar,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Échec de l\'enregistrement');
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl animate-[fadeIn_.15s_ease-out]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">
            {isEdit ? 'Modifier l\'agent' : 'Ajouter un agent'}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="mb-1 block text-xs font-medium text-gray-500">Nom complet</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom complet"
            required
            className="mb-3 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <label className="mb-1 block text-xs font-medium text-gray-500">Avatar</label>
          <div className="mb-3">
            <AvatarPicker name={name} value={avatar} onChange={setAvatar} />
          </div>

          <label className="mb-1 block text-xs font-medium text-gray-500">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e-mail@exemple.com"
            required
            className="mb-3 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <label className="mb-1 block text-xs font-medium text-gray-500">Rôle global</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mb-3 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="member">Membre</option>
            <option value="admin">Admin</option>
            <option value="viewer">Observateur</option>
          </select>
          <label className="mb-1 block text-xs font-medium text-gray-500">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? 'Laisser vide pour ne pas changer' : 'Mot de passe (optionnel)'}
            autoComplete="new-password"
            className="mb-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <p className="mb-3 text-[11px] text-gray-400">
            {isEdit
              ? 'Renseignez un mot de passe uniquement pour le réinitialiser.'
              : 'Laisser vide si l\'agent n\'a pas besoin de se connecter.'}
          </p>

          {error && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-status-blocked">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {isEdit ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// Annuaire des agents : liste des utilisateurs + leurs équipes.
// Pour un administrateur (canManage), permet d'ajouter, modifier, renommer,
// réinitialiser le mot de passe et supprimer un agent.
export default function UserDirectory({
  users,
  canManage = false,
  currentUserId,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSetPassword,
  onOpenAgent,
}) {
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'add' | 'edit', user }
  const [busyId, setBusyId] = useState(null);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(q.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(q.toLowerCase())
  );

  const submitModal = async (data) => {
    if (modal.mode === 'add') {
      await onAddUser({
        name: data.name,
        email: data.email,
        role: data.role,
        password: data.password || undefined,
        avatar_url: data.avatar_url || undefined,
      });
    } else {
      await onUpdateUser(modal.user.id, {
        name: data.name,
        email: data.email,
        role: data.role,
        avatar_url: data.avatar_url ?? null,
      });
      if (data.password) await onSetPassword(modal.user.id, data.password);
    }
  };

  const remove = async (u) => {
    if (u.id === currentUserId) {
      alert('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    if (!confirm(`Supprimer définitivement l'agent « ${u.name} » ?`)) return;
    setBusyId(u.id);
    try {
      await onDeleteUser(u.id);
    } catch (err) {
      alert(err.message || 'Échec de la suppression');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-canvas p-6">
      {/* Barre de recherche + ajout */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex max-w-sm flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3">
          <Search size={16} className="text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un agent…"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        {canManage && onAddUser && (
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <UserPlus size={16} /> Ajouter un agent
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* En-tête */}
        <div className="flex items-center border-b border-gray-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <div className="flex-1">Agent</div>
          <div className="hidden w-56 sm:block">Email</div>
          <div className="w-28">Rôle global</div>
          <div className="w-56">Équipes associées</div>
          {canManage && <div className="w-24 text-right">Actions</div>}
        </div>

        {/* Lignes */}
        {filtered.map((u) => (
          <div
            key={u.id}
            className="group flex items-center border-b border-gray-50 px-4 py-3 last:border-b-0 hover:bg-gray-50"
          >
            <button
              type="button"
              onClick={() => onOpenAgent?.(u)}
              title="Voir les tâches affectées"
              className="flex flex-1 items-center gap-3 text-left"
            >
              <Avatar name={u.name} src={u.avatar_url} size={34} ring={false} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-800 group-hover:text-primary">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-1.5 rounded bg-primary-light px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      vous
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-gray-400 sm:hidden">{u.email}</div>
              </div>
            </button>
            <div className="hidden w-56 truncate text-sm text-gray-500 sm:block">{u.email}</div>
            <div className="w-28">
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {ROLE_LABELS[u.role] || u.role}
              </span>
            </div>
            <div className="flex w-56 flex-wrap gap-1.5">
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
            <button
              onClick={() => onOpenAgent?.(u)}
              title="Voir les tâches affectées"
              className="mr-1 shrink-0 rounded-md border border-gray-200 p-1.5 text-gray-500 hover:border-primary hover:text-primary"
            >
              <ListChecks size={15} />
            </button>
            {canManage && (
              <div className="flex w-24 shrink-0 justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => setModal({ mode: 'edit', user: u })}
                  title="Modifier / renommer"
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-primary"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setModal({ mode: 'edit', user: u })}
                  title="Mot de passe"
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-brand-orange"
                >
                  <KeyRound size={15} />
                </button>
                <button
                  onClick={() => remove(u)}
                  disabled={busyId === u.id || u.id === currentUserId}
                  title={u.id === currentUserId ? 'Impossible de se supprimer soi-même' : 'Supprimer'}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-status-blocked disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {busyId === u.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">Aucun agent trouvé</div>
        )}
      </div>

      {modal && (
        <AgentModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSubmit={submitModal}
        />
      )}
    </div>
  );
}
