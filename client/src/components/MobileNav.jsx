import { Table2, GanttChartSquare, BarChart3, Bell, User } from 'lucide-react';

// Barre de navigation fixe en bas (mobile). Raccourcis clés + alertes + profil.
export default function MobileNav({ view, onSelectView, onOpenAlerts, onOpenProfile, unreadCount }) {
  const Item = ({ icon: Icon, label, active, onClick, badge }) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] ${
        active ? 'text-primary' : 'text-gray-500'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
      {badge > 0 && (
        <span className="absolute right-1/2 top-0.5 translate-x-3 rounded-full bg-status-blocked px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(0,0,0,0.04)] md:hidden">
      <Item icon={Table2} label="Tableau" active={view === 'board'} onClick={() => onSelectView('board')} />
      <Item
        icon={GanttChartSquare}
        label="Gantt"
        active={view === 'gantt'}
        onClick={() => onSelectView('gantt')}
      />
      <Item
        icon={BarChart3}
        label="Reporting"
        active={view === 'reporting'}
        onClick={() => onSelectView('reporting')}
      />
      <Item icon={Bell} label="Alertes" badge={unreadCount} onClick={onOpenAlerts} />
      <Item icon={User} label="Profil" onClick={onOpenProfile} />
    </nav>
  );
}
