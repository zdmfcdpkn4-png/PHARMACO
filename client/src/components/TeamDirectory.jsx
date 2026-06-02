import { useState } from 'react';
import { Search, Plus, Pencil, Trash2, X, Loader2, Check, Users, Settings2, Folder } from 'lucide-react';
import Avatar from './Avatar.jsx';

// Modale de création / édition d'une équipe (nom + description).
function TeamModal({ mode, team, onClose, onSubmit }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(team?.name || '');
  const [description, setDescription] = useState(team?.description || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() });
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
            {isEdit ? 'Modifier l\'équipe' : 'Créer une équipe'}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit}>
          <label className="mb-1 block text-xs font-medium text-gray-500">Nom de l'équipe</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Équipe Pharmacie"
            required
            className="mb-3 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Rôle ou périmètre de l'équipe (optionnel)"
            rows={3}
            className="mb-3 w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {error && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-status-blocked">{error}</div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {isEdit ? 'Enregistrer' : 'Créer'}
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

// Répertoire des équipes : liste de toutes les équipes avec, pour un
// administrateur, la création, le renommage/édition, la gestion des membres
// et la suppression.
export default function TeamDirectory({
  teams,
  canManage = false,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onManageMembers,
}) {
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // { mode, team }
  const [busyId, setBusyId] = useState(null);

  const filtered = teams.filter(
    (t) =>
      t.name.toLowerCase().includes(q.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(q.toLowerCase())
  );

  const submitModal = async (data) => {
    if (modal.mode === 'create') await onCreateTeam(data.name, data.description);
    else await onUpdateTeam(modal.team.id, data);
  };

  const remove = async (t) => {
    if (!confirm(`Supprimer définitivement l'équipe « ${t.name} » ?`)) return;
    setBusyId(t.id);
    try {
      await onDeleteTeam(t.id);
    } catch (err) {
      alert(err.message || 'Échec de la suppression');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-canvas p-6">
      {/* Barre de recherche + création */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex max-w-sm flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3">
          <Search size={16} className="text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une équipe…"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        {canManage && onCreateTeam && (
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Plus size={16} /> Créer une équipe
          </button>
        )}
      </div>

      {/* Grille des équipes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <Users size={18} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-gray-800">{t.name}</div>
                  <div className="text-xs text-gray-400">{(t.members || []).length} membre(s)</div>
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => setModal({ mode: 'edit', team: t })}
                    title="Modifier / renommer"
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(t)}
                    disabled={busyId === t.id}
                    title="Supprimer"
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-status-blocked disabled:opacity-40"
                  >
                    {busyId === t.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              )}
            </div>

            {t.description && (
              <p className="mb-2 line-clamp-2 text-sm text-gray-500">{t.description}</p>
            )}

            {/* Projets associés */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <Folder size={13} className="text-gray-400" />
              {(t.projects || []).length ? (
                t.projects.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {p.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-300">Aucun projet associé</span>
              )}
            </div>

            {/* Membres */}
            <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-3">
              {(t.members || []).length ? (
                <div className="flex -space-x-1.5">
                  {t.members.slice(0, 6).map((m) => (
                    <Avatar key={m.id} name={m.name} src={m.avatar_url} size={26} ring />
                  ))}
                  {t.members.length > 6 && (
                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-500 ring-2 ring-white">
                      +{t.members.length - 6}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-gray-300">Aucun membre</span>
              )}
              {canManage && onManageMembers && (
                <button
                  onClick={() => onManageMembers(t)}
                  className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-primary hover:text-primary"
                >
                  <Settings2 size={13} /> Membres
                </button>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-400">
            Aucune équipe. {canManage && 'Créez-en une pour commencer.'}
          </div>
        )}
      </div>

      {modal && (
        <TeamModal
          mode={modal.mode}
          team={modal.team}
          onClose={() => setModal(null)}
          onSubmit={submitModal}
        />
      )}
    </div>
  );
}
