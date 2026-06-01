import { Table2, KanbanSquare, Calendar } from 'lucide-react';

// Onglets de vue du tableau : Tableau / Kanban / Calendrier.
const TABS = [
  { key: 'table', label: 'Tableau', icon: Table2 },
  { key: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { key: 'calendar', label: 'Calendrier', icon: Calendar },
];

export default function BoardTabs({ active, onChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-6">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition ${
              isActive
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} /> {t.label}
          </button>
        );
      })}
    </div>
  );
}
