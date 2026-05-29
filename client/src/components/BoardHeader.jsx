import { useState } from 'react';
import {
  Plus,
  Search,
  User,
  Filter,
  ArrowUpDown,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import { STATUSES } from '../lib/constants.js';

// En-tête du tableau : titre éditable + barre d'outils.
export default function BoardHeader({
  title,
  onRenameBoard,
  search,
  onSearch,
  personFilter,
  onPersonFilter,
  statusFilter,
  onStatusFilter,
  users,
  onAddTaskClick,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  const Tool = ({ icon: Icon, children, onClick, active }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${
        active ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={16} />
      {children}
    </button>
  );

  return (
    <div className="border-b border-gray-200 bg-white px-6 pt-4">
      {/* Titre */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const n = draft.trim();
            if (n && n !== title) onRenameBoard(n);
            else setDraft(title);
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="mb-3 rounded border border-primary px-2 py-1 text-2xl font-bold text-gray-800 outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800 hover:text-primary"
        >
          {title}
          <ChevronDown size={18} className="text-gray-400" />
        </button>
      )}

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-1 pb-3">
        <button
          type="button"
          onClick={onAddTaskClick}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover"
        >
          <Plus size={16} /> Ajouter tâche
        </button>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        {/* Recherche */}
        <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Rechercher"
            className="w-28 bg-transparent outline-none placeholder:text-gray-400"
          />
        </div>

        {/* Filtre personne */}
        <div className="relative">
          <Tool icon={User} active={!!personFilter}>
            <select
              value={personFilter || ''}
              onChange={(e) => onPersonFilter(e.target.value ? Number(e.target.value) : null)}
              className="cursor-pointer bg-transparent outline-none"
            >
              <option value="">Personne</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Tool>
        </div>

        {/* Filtre statut */}
        <div className="relative">
          <Tool icon={Filter} active={!!statusFilter}>
            <select
              value={statusFilter || ''}
              onChange={(e) => onStatusFilter(e.target.value || null)}
              className="cursor-pointer bg-transparent outline-none"
            >
              <option value="">Filtre</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Tool>
        </div>

        <Tool icon={ArrowUpDown}>Trier</Tool>
        <Tool icon={EyeOff}>Masquer</Tool>
      </div>
    </div>
  );
}
