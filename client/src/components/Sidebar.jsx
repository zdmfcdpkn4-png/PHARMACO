import {
  Folder,
  Users,
  Zap,
  Heart,
  BookUser,
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
  Trash2,
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

// En-tête de section (petit libellé en capitales).
function SectionLabel({ children, action }) {
  return (
    <div className="mb-1 mt-4 flex items-center justify-between px-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</span>
      {action}
    </div>
  );
}

// Double barre latérale :
//  A. Rail d'icônes (extrême gauche) listant les PROJETS comme des espaces
//     (façon Discord / Slack), + icônes globales en bas.
//  B. Panneau principal = hiérarchie du projet sélectionné :
//     « Vues du Projet » + « Équipes Impliquées » (accordéons) + « Raccourcis ».
export default function Sidebar({
  workspaceName = 'Espace de travail principal',
  projects = [],
  selectedProjectId,
  onSelectProject,
  onNewBoard,
  view = 'board',
  onSelectView,
  // Équipes impliquées dans le projet (table project_teams)
  involvedTeams = [],
  allTeams = [],
  onSetInvolvedTeams,
  teamView, // `${teamId}:${section}` actif
  onSelectTeamView,
  // Icônes globales
  onOpenTeams,
  onOpenDirectory,
  onSelectRail,
  // Raccourcis
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
  const [teamsSectionOpen, setTeamsSectionOpen] = useState(true);
  const [managingTeams, setManagingTeams] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(true);
  const [pinning, setPinning] = useState(false);
  const [pinName, setPinName] = useState('');

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0] || { name: 'Projet' };

  // Icône globale (en bas du rail)
  const RailIcon = ({ icon: Icon, label, active, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex w-full flex-col items-center gap-1 py-2.5 text-[10px] transition ${
        active ? 'text-primary' : 'text-gray-500 hover:text-primary'
      }`}
    >
      <span className={`rounded-lg p-1.5 ${active ? 'bg-primary-light' : ''}`}>
        <Icon size={19} />
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
      {/* === A. Rail d'icônes : les PROJETS comme des espaces === */}
      <nav className="flex w-16 shrink-0 flex-col items-center border-r border-gray-200 bg-white pt-3">
        <div className="mb-3" title="PHARMACO">
          <Logo size={34} />
        </div>

        {/* Liste des projets (espaces) */}
        <div className="flex w-full flex-col items-center gap-1.5 overflow-y-auto px-1">
          {projects.map((p) => {
            const active = p.id === selectedProject.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProject?.(p.id)}
                title={p.name}
                className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold transition-all hover:rounded-xl ${
                  active
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-gray-100 text-gray-500 hover:bg-primary-light hover:text-primary'
                }`}
              >
                {/* Liseré actif à gauche */}
                <span
                  className={`absolute -left-1 h-6 w-1 rounded-r-full bg-primary transition-all ${
                    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
                  }`}
                />
                {(p.name || '?').charAt(0).toUpperCase()}
              </button>
            );
          })}

          {/* Nouveau projet / tableau */}
          <button
            type="button"
            onClick={() => onNewBoard?.()}
            title="Nouveau tableau"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 transition-all hover:rounded-xl hover:bg-primary-light hover:text-primary"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="my-2 h-px w-8 bg-gray-100" />

        {/* === Icônes globales (en bas) === */}
        <div className="mt-auto flex w-full flex-col items-center">
          <RailIcon icon={Users} label="Équipes" onClick={() => onOpenTeams?.()} />
          <RailIcon icon={BookUser} label="Annuaire" onClick={() => onOpenDirectory?.()} />
          <RailIcon icon={Heart} label="Favoris" onClick={() => onSelectRail?.('Favoris')} />

          {/* Réduction du panneau */}
          {!forceOpen && (
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              title={panelOpen ? 'Replier le panneau' : 'Déplier le panneau'}
              className={`mb-3 mt-1 rounded-lg p-2 transition ${
                panelOpen ? 'text-gray-400 hover:bg-gray-100' : 'bg-primary-light text-primary'
              }`}
            >
              <PanelLeft size={18} />
            </button>
          )}
        </div>
      </nav>

      {/* === B. Panneau principal : hiérarchie du projet === */}
      {open && (
        <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
          {/* En-tête : nom du projet sélectionné */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                <Folder size={16} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-800">
                  {selectedProject.name}
                </div>
                <div className="truncate text-[11px] text-gray-400">{workspaceName}</div>
              </div>
            </div>
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

          {/* Contenu défilant */}
          <div className="flex-1 overflow-auto px-3 pb-2">
            {/* ---- Vues du Projet ---- */}
            <SectionLabel>Vues du Projet</SectionLabel>
            <ul className="space-y-0.5">
              <li>
                <NavItem
                  icon={Table2}
                  label="Tableau principal"
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
                  icon={PieChart}
                  label="Tableau de bord et reporting"
                  active={view === 'reporting'}
                  onClick={() => onSelectView?.('reporting')}
                />
              </li>
            </ul>

            {/* ---- Équipes Impliquées (accordéons) ---- */}
            <SectionLabel
              action={
                <div className="flex items-center gap-0.5">
                  {onSetInvolvedTeams && (
                    <button
                      onClick={() => setManagingTeams((v) => !v)}
                      className={`rounded p-0.5 hover:bg-gray-100 ${
                        managingTeams ? 'text-primary' : 'text-gray-400 hover:text-primary'
                      }`}
                      title="Associer des équipes au projet"
                    >
                      <Plus size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => setTeamsSectionOpen((v) => !v)}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
                    title={teamsSectionOpen ? 'Réduire' : 'Déployer'}
                  >
                    {teamsSectionOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                </div>
              }
            >
              Équipes Impliquées
            </SectionLabel>

            {managingTeams && (
              <div className="mb-2 rounded-lg border border-gray-200 p-2">
                <div className="mb-1.5 text-[11px] font-medium text-gray-500">
                  Équipes associées à ce projet
                </div>
                <ul className="space-y-0.5">
                  {allTeams.map((t) => {
                    const checked = involvedTeams.some((it) => it.id === t.id);
                    return (
                      <li key={t.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-gray-600 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const ids = involvedTeams.map((it) => it.id);
                              const next = checked
                                ? ids.filter((id) => id !== t.id)
                                : [...ids, t.id];
                              onSetInvolvedTeams(next);
                            }}
                            className="accent-primary"
                          />
                          <span className="truncate">{t.name}</span>
                        </label>
                      </li>
                    );
                  })}
                  {allTeams.length === 0 && (
                    <li className="px-1.5 py-1 text-xs text-gray-400">Aucune équipe disponible.</li>
                  )}
                </ul>
              </div>
            )}

            {teamsSectionOpen && (
              <ul className="space-y-0.5">
                {involvedTeams.map((t) => {
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
                              label="Charge de travail de l'équipe"
                              active={teamView === `${t.id}:workload`}
                              onClick={() => onSelectTeamView?.(t.id, 'workload')}
                            />
                          </li>
                          <li>
                            <NavItem
                              indent
                              icon={PieChart}
                              label="Répartition des tâches"
                              active={teamView === `${t.id}:distribution`}
                              onClick={() => onSelectTeamView?.(t.id, 'distribution')}
                            />
                          </li>
                        </ul>
                      )}
                    </li>
                  );
                })}
                {involvedTeams.length === 0 && (
                  <li className="flex items-center gap-2 px-2 py-3 text-xs text-gray-400">
                    <Users size={14} /> Aucune équipe associée à ce projet.
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* === Section Raccourcis (pliable) === */}
          <div className="border-t border-gray-100 px-3 py-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShortcutsOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
              >
                {shortcutsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <Zap size={13} /> Raccourcis
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
