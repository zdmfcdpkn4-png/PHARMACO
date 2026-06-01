import {
  LayoutGrid,
  Sparkles,
  Bot,
  Heart,
  Home,
  Table2,
  BarChart3,
  PieChart,
  GanttChartSquare,
  Plus,
  ChevronLeft,
  PanelLeft,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';

// Barre latérale de navigation, façon Monday.com.
export default function Sidebar({
  workspaceName = 'Espace de travail principal',
  boardName = 'Suivi',
  activeRail = 'Espaces',
  onSelectRail,
  onNewBoard,
  view = 'board',
  onSelectView,
}) {
  // Panneau d'espace de travail repliable. Replié par défaut sur tablette
  // (768–1024px) pour gagner de la place, déplié au-delà.
  const [panelOpen, setPanelOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => setPanelOpen(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const Rail = ({ icon: Icon, label }) => {
    const active = activeRail === label;
    return (
      <button
        type="button"
        onClick={() => onSelectRail?.(label)}
        className={`flex w-full flex-col items-center gap-1 py-3 text-[11px] transition ${
          active ? 'text-primary' : 'text-gray-500 hover:text-primary'
        }`}
        title={label}
      >
        <span className={`rounded-lg p-1.5 ${active ? 'bg-blue-50' : ''}`}>
          <Icon size={20} />
        </span>
        <span className="leading-none">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-full">
      {/* Rail d'icônes */}
      <nav className="flex w-16 shrink-0 flex-col items-center border-r border-gray-200 bg-white pt-3">
        <div className="mb-2" title="PHARMACO">
          <Logo size={36} />
        </div>
        <Rail icon={LayoutGrid} label="Espaces" />
        <Rail icon={Sparkles} label="Sidekick" />
        <Rail icon={Bot} label="Agents" />
        <Rail icon={Heart} label="Favoris" />

        {/* Bascule du panneau (utile en tablette) */}
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? 'Replier le panneau' : 'Déplier le panneau'}
          className={`mt-auto mb-3 rounded-lg p-2 transition ${
            panelOpen ? 'text-gray-400 hover:bg-gray-100' : 'bg-blue-50 text-primary'
          }`}
        >
          <PanelLeft size={18} />
        </button>
      </nav>

      {/* Panneau de l'espace de travail (repliable) */}
      {panelOpen && (
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-gray-700">Espace de travail</span>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            title="Replier le panneau"
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="px-3">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-2 py-2">
            <div className="flex items-center gap-2 truncate">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-bold text-primary">
                E
              </span>
              <span className="truncate text-sm text-gray-700">{workspaceName}</span>
            </div>
            <button
              type="button"
              onClick={() => onNewBoard?.()}
              className="rounded p-1 hover:bg-gray-100"
              title="Nouveau tableau"
            >
              <Plus size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="mt-4 px-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Contenu
        </div>

        <ul className="mt-1 space-y-0.5 px-2">
          <li>
            <button
              type="button"
              onClick={() => onSelectRail?.('Espaces')}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-600 hover:bg-gray-100"
            >
              <Home size={16} /> Accueil de l'espace
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                onSelectRail?.('Espaces');
                onSelectView?.('board');
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                view === 'board'
                  ? 'bg-blue-50 font-medium text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Table2 size={16} /> {boardName}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                onSelectRail?.('Espaces');
                onSelectView?.('gantt');
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                view === 'gantt'
                  ? 'bg-blue-50 font-medium text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <GanttChartSquare size={16} /> Gantt / Chronogramme
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                onSelectRail?.('Espaces');
                onSelectView?.('workload');
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                view === 'workload'
                  ? 'bg-blue-50 font-medium text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 size={16} /> Charge de travail de l'équipe
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                onSelectRail?.('Espaces');
                onSelectView?.('reporting');
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                view === 'reporting'
                  ? 'bg-blue-50 font-medium text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <PieChart size={16} /> Tableau de bord et reporting
            </button>
          </li>
        </ul>
      </aside>
      )}
    </div>
  );
}
