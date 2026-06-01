import { useState } from 'react';
import { Plus, SlidersHorizontal, Search } from 'lucide-react';
import BottomSheet from './BottomSheet.jsx';
import Logo from './Logo.jsx';
import { STATUSES } from '../lib/constants.js';

// En-tête mobile : logo + titre, bouton ajouter, entonnoir de filtres (bottom sheet).
export default function MobileHeader({
  title,
  onAddTask,
  search,
  onSearch,
  personFilter,
  onPersonFilter,
  statusFilter,
  onStatusFilter,
  users,
  tags = [],
  etapeFilter,
  onEtapeFilter,
  interventionFilter,
  onInterventionFilter,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const etapeTags = tags.filter((t) => t.tag_type === 'etape');
  const interventionTags = tags.filter((t) => t.tag_type === 'intervention');
  const activeCount = [
    search.trim(),
    personFilter,
    statusFilter,
    etapeFilter,
    interventionFilter,
  ].filter(Boolean).length;

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Logo size={28} />
        <h1 className="flex-1 truncate text-lg font-bold text-gray-800">{title}</h1>

        <button
          onClick={() => setFiltersOpen(true)}
          className={`relative rounded-lg p-2 ${
            activeCount ? 'bg-blue-50 text-primary' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Filtres"
        >
          <SlidersHorizontal size={18} />
          {activeCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>

        <button
          onClick={onAddTask}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Bottom sheet de filtres */}
      <BottomSheet open={filtersOpen} title="Filtres" onClose={() => setFiltersOpen(false)}>
        <div className="space-y-4 p-2">
          {/* Recherche */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
              Recherche
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3">
              <Search size={16} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Nom de la tâche…"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
          </div>

          {/* Personne */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
              Personne
            </label>
            <div className="flex flex-wrap gap-2">
              <Chip active={!personFilter} onClick={() => onPersonFilter(null)}>
                Tous
              </Chip>
              {users.map((u) => (
                <Chip
                  key={u.id}
                  active={personFilter === u.id}
                  onClick={() => onPersonFilter(u.id)}
                >
                  {u.name}
                </Chip>
              ))}
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
              Statut
            </label>
            <div className="flex flex-wrap gap-2">
              <Chip active={!statusFilter} onClick={() => onStatusFilter(null)}>
                Tous
              </Chip>
              {STATUSES.map((s) => (
                <Chip key={s} active={statusFilter === s} onClick={() => onStatusFilter(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          {/* Étape */}
          {etapeTags.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                Étape
              </label>
              <div className="flex flex-wrap gap-2">
                <Chip active={!etapeFilter} onClick={() => onEtapeFilter(null)}>
                  Toutes
                </Chip>
                {etapeTags.map((t) => (
                  <Chip key={t.id} active={etapeFilter === t.id} onClick={() => onEtapeFilter(t.id)}>
                    {t.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Type d'intervention */}
          {interventionTags.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                Type
              </label>
              <div className="flex flex-wrap gap-2">
                <Chip active={!interventionFilter} onClick={() => onInterventionFilter(null)}>
                  Tous
                </Chip>
                {interventionTags.map((t) => (
                  <Chip
                    key={t.id}
                    active={interventionFilter === t.id}
                    onClick={() => onInterventionFilter(t.id)}
                  >
                    {t.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setFiltersOpen(false)}
            className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-white"
          >
            Voir les résultats
          </button>
        </div>
      </BottomSheet>
    </header>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm ${
        active
          ? 'border-primary bg-blue-50 font-medium text-primary'
          : 'border-gray-200 text-gray-600'
      }`}
    >
      {children}
    </button>
  );
}
