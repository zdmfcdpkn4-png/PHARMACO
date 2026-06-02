import {
  Layers,
  Users,
  Sparkles,
  Heart,
  Home,
  Table2,
  BarChart3,
  PieChart,
  GanttChartSquare,
  CalendarRange,
  Link as LinkIcon,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  PanelLeft,
  Target,
  Trash2,
  BookUser,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import Avatar from './Avatar.jsx';

// Icônes disponibles pour les raccourcis (par nom).
const SHORTCUT_ICONS = { Link: LinkIcon, Table2, GanttChartSquare, PieChart, CalendarRange };

// Élément de navigation réutilisable (état actif sur fond violet léger).
function NavItem({ icon: Icon, label, active, onClick, indent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
        indent ? 'pl-7' : ''
      } ${active ? 'bg-primary-light font-medium text-primary' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {Icon && <Icon size={16} />} <span className="truncate">{label}</span>
    </button>
  );
}

// Double barre latérale : rail d'icônes + panneau principal dynamique
// (mode Projets ou Équipes) + section Raccourcis.
export default function Sidebar({
  workspaceName = 'Espace de travail principal',
  boardName = 'Suivi',
  activeRail = 'Espaces',
  onSelectRail,
  onNewBoard,
  view = 'board',
  onSelectView,
  // Mode & données équipes / raccourcis
  mode = 'projects',
  onChangeMode,
  teams = [],
  teamSection,
  onSelectTeamSection,
  onOpenDirectory,
  onAddTeam,
  shortcuts = [],
  onAddShortcut,
  onDeleteShortcut,
  onOpenShortcut,
  forceOpen = false, // mobile : panneau toujours déployé
}) {
  const [panelOpen, setPanelOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  useEffect(() => {
    if (forceOpen) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => setPanelOpen(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [forceOpen]);
  const open = forceOpen || panelOpen;

  const [openTeams, setOpenTeams] = useState({});
  const [shortcutsOpen, setShortcutsOpen] = useState(true);
  const [pinning, setPinning] = useState(false);
  const [pinName, setPinName] = useState('');

  // Bouton du rail (icône + label)
  const RailBtn = ({ icon: Icon, label, active, onClick, badge }) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex w-full flex-col items-center gap-1 py-3 text-[11px] transition ${
        active ? 'text-primary' : 'text-gray-500 hover:text-primary'
      }`}
    >
      <span className={`rounded-lg p-1.5 ${active ? 'bg-primary-light' : ''}`}>
        <Icon size={20} />
      </span>
      <span className="leading-none">{label}</span>
    </button>
  );

  const submitPin = () => {
    const n = pinName.trim();
    if (n) onAddShortcut?.(n, view);
    setPinName('');
    setPinning(false);
  };

  return (
    <div className="flex h-full">
      {/* === A. Rail d'icônes (extrême gauche) === */}
      <nav className="flex w-16 shrink-0 flex-col items-center border-r border-gray-200 bg-white pt-3">
        <div className="mb-3" title="PHARMACO">
          <Logo size={36} />
        </div>

        {/* Bascule de mode Projets / Équipes */}
        <RailBtn
          icon={Layers}
          label="Projets"
          active={mode === 'projects'}
          onClick={() => onChangeMode?.('projects')}
        />
        <RailBtn
          icon={Users}
          label="Équipes"
          active={mode === 'teams'}
          onClick={() => onChangeMode?.('teams')}
        />

        <div className="my-2 h-px w-8 bg-gray-100" />

        {/* Icônes globales */}
        <RailBtn icon={Sparkles} label="Sidekick" onClick={() => onSelectRail?.('Sidekick')} />
        <RailBtn icon={Heart} label="Favoris" onClick={() => onSelectRail?.('Favoris')} />

        {/* Réduction du panneau (en bas) */}
        {!forceOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            title={panelOpen ? 'Replier le panneau' : 'Déplier le panneau'}
            className={`mt-auto mb-3 rounded-lg p-2 transition ${
              panelOpen ? 'text-gray-400 hover:bg-gray-100' : 'bg-primary-light text-primary'
            }`}
          >
            <PanelLeft size={18} />
          </button>
        )}
      </nav>

      {/* === B. Panneau principal dynamique === */}
      {open && (
        <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-gray-700">
              {mode === 'teams' ? 'Gestion des Équipes' : 'Espace de travail'}
            </span>
            {!forceOpen && (
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                title="Replier le panneau"
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </div>

          {/* Contenu défilant + transition de mode */}
          <div className="flex-1 overflow-auto">
            <div key={mode} className="animate-[fadeIn_.2s_ease-out]">
              {mode === 'projects' ? (
                <div className="px-3">
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-2 py-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-primary-light text-xs font-bold text-primary">
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

                  <div className="mt-4 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Contenu
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    <li>
                      <NavItem icon={Home} label="Accueil de l'espace" onClick={() => onSelectView?.('board')} />
                    </li>
                    <li>
                      <NavItem
                        icon={Table2}
                        label={boardName}
                        active={view === 'board'}
                        onClick={() => onSelectView?.('board')}
                      />
                    </li>
                    <li>
                      <NavItem
                        icon={GanttChartSquare}
                        label="Gantt / Chronogramme"
                        active={view === 'gantt'}
                        onClick={() => onSelectView?.('gantt')}
                      />
                    </li>
                    <li>
                      <NavItem
                        icon={CalendarRange}
                        label="Planning dynamique"
                        active={view === 'timeline'}
                        onClick={() => onSelectView?.('timeline')}
                      />
                    </li>
                    <li>
                      <NavItem
                        icon={BarChart3}
                        label="Charge de travail"
                        active={view === 'workload'}
                        onClick={() => onSelectView?.('workload')}
                      />
                    </li>
                    <li>
                      <NavItem
                        icon={PieChart}
                        label="Tableau de bord et reporting"
                        active={view === 'reporting'}
                        onClick={() => onSelectView?.('reporting')}
                      />
                    </li>
                  </ul>
                </div>
              ) : (
                /* ---- Mode Équipes ---- */
                <div className="px-3">
                  {/* Annuaire des agents */}
                  <NavItem
                    icon={BookUser}
                    label="Annuaire des agents"
                    active={teamSection === 'directory'}
                    onClick={() => onOpenDirectory?.()}
                  />
                  <div className="mb-1 mt-3 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Équipes
                    </span>
                    {onAddTeam && (
                      <button
                        onClick={() => {
                          const n = window.prompt("Nom de la nouvelle équipe :");
                          if (n && n.trim()) onAddTeam(n.trim());
                        }}
                        title="Nouvelle équipe"
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-primary"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {teams.map((t) => {
                      const expanded = !!openTeams[t.id];
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => setOpenTeams((o) => ({ ...o, [t.id]: !o[t.id] }))}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <Users size={15} className="text-primary" />
                            <span className="flex-1 truncate">{t.name}</span>
                            <div className="flex -space-x-1.5">
                              {(t.members || []).slice(0, 3).map((m) => (
                                <Avatar key={m.id} name={m.name} src={m.avatar_url} size={18} ring />
                              ))}
                            </div>
                          </button>
                          {expanded && (
                            <ul className="mb-1 mt-0.5 space-y-0.5 animate-[fadeIn_.15s_ease-out]">
                              <li>
                                <NavItem
                                  indent
                                  icon={BarChart3}
                                  label="Charge de travail"
                                  active={teamSection === `${t.id}:workload`}
                                  onClick={() => onSelectTeamSection?.(t.id, 'workload')}
                                />
                              </li>
                              <li>
                                <NavItem
                                  indent
                                  icon={Users}
                                  label="Membres & Rôles"
                                  active={teamSection === `${t.id}:members`}
                                  onClick={() => onSelectTeamSection?.(t.id, 'members')}
                                />
                              </li>
                              <li>
                                <NavItem
                                  indent
                                  icon={Target}
                                  label="Objectifs de la période"
                                  active={teamSection === `${t.id}:goals`}
                                  onClick={() => onSelectTeamSection?.(t.id, 'goals')}
                                />
                              </li>
                            </ul>
                          )}
                        </li>
                      );
                    })}
                    {teams.length === 0 && (
                      <li className="px-2 py-4 text-center text-xs text-gray-400">Aucune équipe</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* === Section Raccourcis (pliable, valable pour les 2 modes) === */}
          <div className="border-t border-gray-100 px-3 py-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShortcutsOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
              >
                {shortcutsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <LinkIcon size={13} /> Raccourcis
              </button>
              <button
                onClick={() => setPinning((v) => !v)}
                title="Épingler la vue actuelle"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-primary"
              >
                <Plus size={14} />
              </button>
            </div>

            {pinning && (
              <div className="mt-2 rounded-lg border border-gray-200 p-2">
                <input
                  autoFocus
                  value={pinName}
                  onChange={(e) => setPinName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitPin();
                    if (e.key === 'Escape') setPinning(false);
                  }}
                  placeholder="Nom du raccourci…"
                  className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={submitPin}
                  disabled={!pinName.trim()}
                  className="w-full rounded-md bg-primary py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Épingler la vue actuelle
                </button>
              </div>
            )}

            {shortcutsOpen && (
              <ul className="mt-1 space-y-0.5">
                {shortcuts.map((s) => {
                  const Icon = SHORTCUT_ICONS[s.icon_name] || LinkIcon;
                  return (
                    <li key={s.id} className="group flex items-center">
                      <button
                        onClick={() => onOpenShortcut?.(s)}
                        className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100"
                      >
                        <Icon size={14} className="text-gray-400" />
                        <span className="truncate">{s.name}</span>
                      </button>
                      <button
                        onClick={() => onDeleteShortcut?.(s.id)}
                        className="px-1 text-gray-300 opacity-0 transition hover:text-status-blocked group-hover:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  );
                })}
                {shortcuts.length === 0 && !pinning && (
                  <li className="px-2 py-1 text-xs text-gray-400">Aucun raccourci épinglé.</li>
                )}
              </ul>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
