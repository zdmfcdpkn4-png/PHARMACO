import { useEffect, useRef, useState } from 'react';
import { X, UserPlus, Search, Check, Trash2, Users } from 'lucide-react';
import Avatar from './Avatar.jsx';

const TEAM_ROLES = ['membre', "responsable d'équipe"];

// Modale de gestion des membres d'une équipe.
export default function TeamManagementModal({
  team,
  users,
  onClose,
  onAddMembers,
  onUpdateRole,
  onRemoveMember,
}) {
  const [members, setMembers] = useState(team.members || []);
  const [adding, setAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => setMembers(team.members || []), [team]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const memberIds = new Set(members.map((m) => m.id));
  const available = users.filter(
    (u) => !memberIds.has(u.id) && u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const togglePick = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const confirmAdd = async () => {
    if (picked.size === 0) return;
    setBusy(true);
    try {
      const res = await onAddMembers([...picked]);
      if (res?.members) setMembers(res.members);
      setPicked(new Set());
      setSearchTerm('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (userId, role) => {
    const res = await onUpdateRole(userId, role);
    if (res?.members) setMembers(res.members);
  };

  const remove = async (userId) => {
    const res = await onRemoveMember(userId);
    if (res?.members) setMembers(res.members);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
              <Users size={18} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-800">{team.name}</h2>
              <p className="text-xs text-gray-400">{members.length} membre(s)</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {/* Bouton d'ajout / picker */}
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2.5 text-sm text-gray-600 hover:border-primary hover:text-primary"
            >
              <UserPlus size={16} /> Ajouter des membres
            </button>
          ) : (
            <div ref={pickerRef} className="mb-4 rounded-xl border border-gray-200 p-3">
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-gray-200 px-3">
                <Search size={15} className="text-gray-400" />
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un agent…"
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
              </div>
              <div className="max-h-52 space-y-1 overflow-auto">
                {available.map((u) => {
                  const checked = picked.has(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => togglePick(u.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-100"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked ? 'border-primary bg-primary text-white' : 'border-gray-300'
                        }`}
                      >
                        {checked && <Check size={12} />}
                      </span>
                      <Avatar name={u.name} src={u.avatar_url} size={26} ring={false} />
                      <span className="flex-1 truncate text-sm text-gray-700">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.email}</span>
                    </button>
                  );
                })}
                {available.length === 0 && (
                  <p className="py-4 text-center text-xs text-gray-400">
                    Aucun agent disponible
                  </p>
                )}
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setAdding(false);
                    setPicked(new Set());
                  }}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmAdd}
                  disabled={picked.size === 0 || busy}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Ajouter {picked.size > 0 ? `(${picked.size})` : ''}
                </button>
              </div>
            </div>
          )}

          {/* Liste des membres ou état vide */}
          {members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-300">
                <Users size={24} />
              </span>
              <p className="text-sm font-medium text-gray-600">Aucun membre dans cette équipe</p>
              <p className="text-xs text-gray-400">
                Ajoutez des agents pour commencer à collaborer.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50"
                >
                  <Avatar name={m.name} src={m.avatar_url} size={32} ring={false} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-800">{m.name}</div>
                    {m.email && <div className="truncate text-xs text-gray-400">{m.email}</div>}
                  </div>
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                    className="cursor-pointer rounded-md border border-gray-200 px-2 py-1 text-xs capitalize outline-none focus:border-primary"
                  >
                    {TEAM_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(m.id)}
                    title="Retirer de l'équipe"
                    className="rounded p-1 text-gray-300 opacity-0 transition hover:text-status-blocked group-hover:opacity-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
