import { useState } from 'react';
import { BarChart3, Users, Target, Settings2 } from 'lucide-react';
import Avatar from './Avatar.jsx';
import UserDirectory from './UserDirectory.jsx';
import TeamDirectory from './TeamDirectory.jsx';
import TeamManagementModal from './TeamManagementModal.jsx';

// Vue de gestion d'une équipe selon la section sélectionnée (+ annuaire).
export default function TeamsView({
  teams,
  users,
  teamSection,
  onAddTeam,
  onUpdateTeam,
  onDeleteTeam,
  onAddTeamMembers,
  onUpdateMemberRole,
  onRemoveTeamMember,
  // Gestion des agents (administrateur)
  canManageAgents = false,
  currentUserId,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSetPassword,
}) {
  const [managing, setManaging] = useState(null); // équipe en cours de gestion

  // "directory" pseudo-section, sinon "teamId:section"
  const isDirectory = teamSection === 'directory';
  const [teamId, section] = (teamSection || '').split(':');
  const team = teams.find((t) => String(t.id) === teamId);

  if (isDirectory) {
    return (
      <UserDirectory
        users={users}
        canManage={canManageAgents}
        currentUserId={currentUserId}
        onAddUser={onAddUser}
        onUpdateUser={onUpdateUser}
        onDeleteUser={onDeleteUser}
        onSetPassword={onSetPassword}
      />
    );
  }

  // Aucune équipe sélectionnée : répertoire complet de gestion des équipes.
  if (!team) {
    return (
      <>
        <TeamDirectory
          teams={teams}
          canManage={canManageAgents}
          onCreateTeam={onAddTeam}
          onUpdateTeam={onUpdateTeam}
          onDeleteTeam={onDeleteTeam}
          onManageMembers={(t) => setManaging(t)}
        />
        {managing && (
          <TeamManagementModal
            team={managing}
            users={users}
            onClose={() => setManaging(null)}
            onAddMembers={(ids) => onAddTeamMembers(managing.id, ids)}
            onUpdateRole={(userId, role) => onUpdateMemberRole(managing.id, userId, role)}
            onRemoveMember={(userId) => onRemoveTeamMember(managing.id, userId)}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-canvas p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{team.name}</h2>
          {team.description && <p className="text-sm text-gray-500">{team.description}</p>}
        </div>
        <button
          onClick={() => setManaging(team)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-primary hover:text-primary"
        >
          <Settings2 size={15} /> Gérer les membres
        </button>
      </div>

      {section === 'members' && (
        <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-2">
          <div className="mb-1 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-gray-700">
            <Users size={16} /> Membres & Rôles
          </div>
          {team.members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Users size={28} className="text-gray-300" />
              <p className="text-sm text-gray-500">Aucun membre dans cette équipe</p>
              <button
                onClick={() => setManaging(team)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
              >
                Ajouter des membres
              </button>
            </div>
          ) : (
            team.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                <Avatar name={m.name} src={m.avatar_url} size={32} ring={false} />
                <span className="flex-1 text-sm text-gray-800">{m.name}</span>
                <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                  {m.role}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {section === 'workload' && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <BarChart3 size={16} /> Charge de travail de l'équipe
          </div>
          <p className="text-sm text-gray-500">
            {team.members.length} membre(s) dans cette équipe.
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

      {managing && (
        <TeamManagementModal
          team={managing}
          users={users}
          onClose={() => setManaging(null)}
          onAddMembers={(ids) => onAddTeamMembers(managing.id, ids)}
          onUpdateRole={(userId, role) => onUpdateMemberRole(managing.id, userId, role)}
          onRemoveMember={(userId) => onRemoveTeamMember(managing.id, userId)}
        />
      )}
    </div>
  );
}
