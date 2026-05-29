import {
  LayoutGrid,
  Sparkles,
  Bot,
  Heart,
  Home,
  Table2,
  BarChart3,
  Plus,
  ChevronLeft,
} from 'lucide-react';

// Barre latérale de navigation, façon Monday.com.
export default function Sidebar({ workspaceName = 'Espace de travail principal', boardName = 'Suivi' }) {
  const Rail = ({ icon: Icon, label }) => (
    <button
      type="button"
      className="flex w-full flex-col items-center gap-1 py-3 text-[11px] text-gray-500 hover:text-primary"
      title={label}
    >
      <Icon size={20} />
      <span className="leading-none">{label}</span>
    </button>
  );

  return (
    <div className="flex h-full">
      {/* Rail d'icônes */}
      <nav className="flex w-16 shrink-0 flex-col items-center border-r border-gray-200 bg-white pt-3">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-white">
          P
        </div>
        <Rail icon={LayoutGrid} label="Espaces" />
        <Rail icon={Sparkles} label="Sidekick" />
        <Rail icon={Bot} label="Agents" />
        <Rail icon={Heart} label="Favoris" />
      </nav>

      {/* Panneau de l'espace de travail */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-gray-700">Espace de travail</span>
          <ChevronLeft size={16} className="text-gray-400" />
        </div>

        <div className="px-3">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-2 py-2">
            <div className="flex items-center gap-2 truncate">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-bold text-primary">
                E
              </span>
              <span className="truncate text-sm text-gray-700">{workspaceName}</span>
            </div>
            <button className="rounded p-1 hover:bg-gray-100" title="Nouveau">
              <Plus size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="mt-4 px-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Contenu
        </div>

        <ul className="mt-1 space-y-0.5 px-2">
          <li>
            <a className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-600 hover:bg-gray-100">
              <Home size={16} /> Accueil de l'espace
            </a>
          </li>
          <li>
            <a className="flex items-center gap-2 rounded-md bg-blue-50 px-2 py-2 text-sm font-medium text-primary">
              <Table2 size={16} /> {boardName}
            </a>
          </li>
          <li>
            <a className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-600 hover:bg-gray-100">
              <BarChart3 size={16} /> Tableau de bord et reporting
            </a>
          </li>
        </ul>
      </aside>
    </div>
  );
}
