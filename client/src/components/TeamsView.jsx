import { BarChart3, Users, Target } from 'lucide-react';
import Avatar from './Avatar.jsx';

// Vue de gestion d'une équipe selon la section sélectionnée.
export default function TeamsView({ teams, teamSection }) {
  const [teamId, section] = (teamSection || '').split(':');
  const team = teams.find((t) => String(t.id) === teamId);

  if (!team) {
    return (
      <div className="flex flex-1 items-center justify-center bg-canvas text-gray-400">
        Sélectionnez une équipe et une section dans la barre latérale.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-canvas p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-800">{team.name}</h2>
        {team.description && <p className="text-sm text-gray-500">{team.description}</p>}
      </div>

      {section === 'members' && (
        <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-2">
          <div className="mb-1 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-gray-700">
            <Users size={16} /> Membres & Rôles
          </div>
          {team.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
              <Avatar name={m.name} src={m.avatar_url} size={32} ring={false} />
              <span className="flex-1 text-sm text-gray-800">{m.name}</span>
              <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      )}

      {section === 'workload' && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <BarChart3 size={16} /> Charge de travail de l'équipe
          </div>
          <p className="text-sm text-gray-500">
            {team.members.length} membre(s). Vue détaillée de la charge à venir — voir aussi
            « Charge de travail » dans le mode Projets.
          </p>
        </div>
      )}

      {section === 'goals' && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Target size={16} /> Objectifs de la période
          </div>
          <p className="text-sm text-gray-400">Aucun objectif défini pour le moment.</p>
        </div>
      )}
    </div>
  );
}
