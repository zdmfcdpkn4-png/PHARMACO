import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Plus, LogOut } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Sidebar from './components/Sidebar.jsx';
import RailPanel from './components/RailPanel.jsx';
import BoardHeader from './components/BoardHeader.jsx';
import GroupTable from './components/GroupTable.jsx';
import AlertsPanel from './components/AlertsPanel.jsx';
import Avatar from './components/Avatar.jsx';
import TeamWorkloadView from './components/TeamWorkloadView.jsx';
import ReportingView from './components/ReportingView.jsx';
import Login from './components/Login.jsx';
import { api, IS_MOCK } from './api/index.js';
import { GROUP_COLORS } from './lib/constants.js';

const AUTH_KEY = 'pharmaco_auth';

// Composant racine : gère l'authentification puis rend le tableau.
export default function App() {
  const [auth, setAuth] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY)) || null;
    } catch {
      return null;
    }
  });

  const handleAuth = (res) => {
    setAuth(res);
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(res));
    } catch {
      /* ignore */
    }
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem(AUTH_KEY);
  };

  if (!auth?.user) return <Login onAuth={handleAuth} />;

  return <Board currentUser={auth.user} onLogout={handleLogout} />;
}

function Board({ currentUser, onLogout }) {
  const CURRENT_USER_ID = currentUser.id;
  const [board, setBoard] = useState(null);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtres / recherche
  const [search, setSearch] = useState('');
  const [personFilter, setPersonFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [alertsOpen, setAlertsOpen] = useState(false);

  // Navigation latérale + outils de tri / affichage
  const [view, setView] = useState('board'); // 'board' | 'workload'
  const [activeRail, setActiveRail] = useState('Espaces');
  const [sortBy, setSortBy] = useState(null); // null | 'nom' | 'statut' | 'échéance'
  const [showDone, setShowDone] = useState(true); // afficher les tâches "Fait"

  // -------- Chargement initial --------
  const loadAlerts = useCallback(async () => {
    try {
      const a = await api.getAlerts({ user_id: CURRENT_USER_ID });
      setAlerts(a);
    } catch {
      /* non bloquant */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [b, u] = await Promise.all([api.getBoard(1), api.getUsers()]);
        setBoard(b);
        setUsers(u);
        await loadAlerts();
      } catch (e) {
        setError(e.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAlerts]);

  // -------- Helpers de mise à jour optimiste --------
  // Applique une transformation locale immédiate, lance l'appel API,
  // et restaure l'état précédent en cas d'échec.
  const optimistic = useCallback(
    async (mutator, apiCall) => {
      setBoard((prev) => {
        const snapshot = prev;
        // On stocke le snapshot pour rollback via closure
        optimistic._snapshot = snapshot;
        return mutator(structuredClone(prev));
      });
      try {
        await apiCall();
      } catch (e) {
        setBoard(optimistic._snapshot); // rollback
        setError(e.message || 'Échec de la synchronisation');
        setTimeout(() => setError(null), 3000);
      }
    },
    []
  );

  const patchTaskLocal = (b, taskId, patch) => {
    for (const g of b.groups) {
      const t = g.tasks.find((x) => x.id === taskId);
      if (t) Object.assign(t, patch);
    }
    return b;
  };

  // -------- Handlers tâches --------
  const handleRenameTask = (taskId, name) =>
    optimistic((b) => patchTaskLocal(b, taskId, { name }), () =>
      api.updateTask(taskId, { name })
    );

  // Renvoie la priorité courante d'une tâche (pour décider du refresh d'alertes)
  const findTaskPriority = (taskId) => {
    for (const g of board?.groups || []) {
      const t = g.tasks.find((x) => x.id === taskId);
      if (t) return t.priority;
    }
    return 'P3 - Normal';
  };

  const handleChangeStatus = (taskId, status) => {
    optimistic((b) => patchTaskLocal(b, taskId, { status }), async () => {
      await api.updateTask(taskId, { status });
      if (status === 'Bloqué') loadAlerts(); // alerte (critique si P1) créée côté serveur
    });
  };

  const handleChangePriority = (taskId, priority) => {
    optimistic((b) => patchTaskLocal(b, taskId, { priority }), () =>
      api.updateTask(taskId, { priority })
    );
  };

  const handleAssign = (taskId, adminId) => {
    const admin = adminId ? users.find((u) => u.id === adminId) : null;
    const adminShape = admin
      ? { id: admin.id, name: admin.name, avatar_url: admin.avatar_url }
      : null;
    optimistic((b) => patchTaskLocal(b, taskId, { admin: adminShape }), () =>
      api.updateTask(taskId, { admin_id: adminId })
    );
  };

  const handleChangeDate = (taskId, date) =>
    optimistic((b) => patchTaskLocal(b, taskId, { duedate: date }), () =>
      api.updateTask(taskId, { duedate: date })
    );

  const handleDeleteTask = (taskId) =>
    optimistic(
      (b) => {
        for (const g of b.groups) g.tasks = g.tasks.filter((t) => t.id !== taskId);
        return b;
      },
      () => api.deleteTask(taskId)
    );

  const handleAddTask = async (groupId, name) => {
    // Création optimiste avec id temporaire, remplacé par la réponse serveur.
    const tempId = `tmp-${Date.now()}`;
    setBoard((b) => {
      const next = structuredClone(b);
      const g = next.groups.find((x) => x.id === groupId);
      g.tasks.push({
        id: tempId,
        group_id: groupId,
        name,
        status: 'À faire',
        duedate: null,
        admin: null,
      });
      return next;
    });
    try {
      const created = await api.createTask({ group_id: groupId, name });
      setBoard((b) => {
        const next = structuredClone(b);
        const g = next.groups.find((x) => x.id === groupId);
        const idx = g.tasks.findIndex((t) => t.id === tempId);
        if (idx >= 0) g.tasks[idx] = created;
        return next;
      });
    } catch (e) {
      setBoard((b) => {
        const next = structuredClone(b);
        const g = next.groups.find((x) => x.id === groupId);
        g.tasks = g.tasks.filter((t) => t.id !== tempId);
        return next;
      });
      setError(e.message);
    }
  };

  // -------- Handlers groupes --------
  const handleAddGroup = async () => {
    const name = 'Nouveau groupe';
    const color = GROUP_COLORS[board.groups.length % GROUP_COLORS.length];
    try {
      const created = await api.createGroup({ board_id: board.id, name, color });
      setBoard((b) => ({ ...b, groups: [...b.groups, created] }));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRenameGroup = (groupId, name) =>
    optimistic(
      (b) => {
        const g = b.groups.find((x) => x.id === groupId);
        if (g) g.name = name;
        return b;
      },
      () => api.updateGroup(groupId, { name })
    );

  const handleDeleteGroup = (groupId) => {
    if (!confirm('Supprimer ce groupe et toutes ses tâches ?')) return;
    optimistic(
      (b) => ({ ...b, groups: b.groups.filter((g) => g.id !== groupId) }),
      () => api.deleteGroup(groupId)
    );
  };

  // -------- Membres / agents --------
  const handleAddUser = async ({ name, email, role, password }) => {
    const created = await api.createUser({ name, email, role, password });
    setUsers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  };

  const handleUpdateUser = async (id, patch) => {
    const updated = await api.updateUser(id, patch);
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? updated : u)).sort((a, b) => a.name.localeCompare(b.name))
    );
    // Répercute le changement de nom/avatar sur les tâches assignées
    setBoard((b) => {
      if (!b) return b;
      const next = structuredClone(b);
      for (const g of next.groups) {
        for (const t of g.tasks) {
          if (t.admin?.id === id) {
            t.admin = { id: updated.id, name: updated.name, avatar_url: updated.avatar_url };
          }
        }
      }
      return next;
    });
    return updated;
  };

  const handleDeleteUser = async (id) => {
    await api.deleteUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    // Désassigne ce membre des tâches
    setBoard((b) => {
      if (!b) return b;
      const next = structuredClone(b);
      for (const g of next.groups) {
        for (const t of g.tasks) {
          if (t.admin?.id === id) t.admin = null;
        }
      }
      return next;
    });
  };

  // Définit (string) ou retire (null) le mot de passe d'un membre.
  const handleSetPassword = async (id, password) => {
    await api.updateUser(id, { password });
  };

  // -------- Glisser-déposer des groupes --------
  const handleGroupDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;

    let payload = null;
    const snapshot = board;
    setBoard((prev) => {
      const next = structuredClone(prev);
      const [moved] = next.groups.splice(source.index, 1);
      next.groups.splice(destination.index, 0, moved);
      next.groups.forEach((g, i) => {
        g.position = i;
      });
      payload = next.groups.map((g) => ({ id: g.id, position: g.position }));
      return next;
    });
    if (payload) {
      api.reorderGroups(payload).catch((e) => {
        setBoard(snapshot);
        setError(e.message || 'Échec du déplacement du groupe');
        setTimeout(() => setError(null), 3000);
      });
    }
  };

  // -------- Glisser-déposer (tâches + groupes) --------
  // Réorganise une liste et renvoie les items déplacés avec leur position.
  const handleDragEnd = (result) => {
    // Réorganisation de groupes (type "GROUP")
    if (result.type === 'GROUP') {
      handleGroupDragEnd(result);
      return;
    }

    const { source, destination, draggableId } = result;
    if (!destination) return; // déposé hors zone
    const sameSpot =
      source.droppableId === destination.droppableId && source.index === destination.index;
    if (sameSpot) return;

    const fromGroupId = Number(source.droppableId);
    const toGroupId = Number(destination.droppableId);
    const taskId = Number(draggableId);

    let payload = null;

    setBoard((prev) => {
      const next = structuredClone(prev);
      const fromGroup = next.groups.find((g) => g.id === fromGroupId);
      const toGroup = next.groups.find((g) => g.id === toGroupId);
      if (!fromGroup || !toGroup) return prev;

      // Retire la tâche de sa position d'origine
      const [moved] = fromGroup.tasks.splice(source.index, 1);
      if (!moved) return prev;
      moved.group_id = toGroupId;

      // Insère à la position cible
      toGroup.tasks.splice(destination.index, 0, moved);

      // Recalcule les positions des groupes affectés
      const affected = new Set([fromGroupId, toGroupId]);
      const items = [];
      for (const g of next.groups) {
        if (!affected.has(g.id)) continue;
        g.tasks.forEach((t, i) => {
          t.position = i;
          items.push({ id: t.id, group_id: g.id, position: i });
        });
      }
      payload = items;
      return next;
    });

    // Persistance (optimiste : l'UI est déjà à jour). Rollback si échec.
    if (payload) {
      const snapshot = board;
      api.reorderTasks(payload).catch((e) => {
        setBoard(snapshot);
        setError(e.message || 'Échec du déplacement');
        setTimeout(() => setError(null), 3000);
      });
      // Le statut "Bloqué" peut dépendre du contexte : on rafraîchit juste
      // l'identité de la tâche déplacée si besoin (no-op ici).
      void taskId;
    }
  };

  // -------- Sélection --------
  const toggleSelect = (taskId) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });

  // -------- Filtrage --------
  const filterFn = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (task) => {
      if (q && !task.name.toLowerCase().includes(q)) return false;
      if (personFilter && task.admin?.id !== personFilter) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (!showDone && task.status === 'Fait') return false;
      return true;
    };
  }, [search, personFilter, statusFilter, showDone]);

  // -------- Tri (cycle : null -> priorité -> nom -> statut -> échéance) --------
  const STATUS_ORDER = { Bloqué: 0, 'En cours': 1, 'À faire': 2, Fait: 3 };
  const PRIORITY_ORDER = { 'P1 - Urgent': 0, 'P2 - Élevé': 1, 'P3 - Normal': 2 };
  const sortFn = useMemo(() => {
    if (!sortBy) return null;
    return (a, b) => {
      if (sortBy === 'priorité')
        return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (sortBy === 'nom') return a.name.localeCompare(b.name);
      if (sortBy === 'statut')
        return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (sortBy === 'échéance')
        return (a.duedate || '9999').localeCompare(b.duedate || '9999');
      return 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  const cycleSort = () => {
    const order = [null, 'priorité', 'nom', 'statut', 'échéance'];
    setSortBy((prev) => order[(order.indexOf(prev) + 1) % order.length]);
  };

  // Le drag n'a de sens que sur l'ordre "naturel" : on le désactive quand
  // un tri, une recherche ou un filtre modifie l'ordre/visibilité affiché.
  const dragEnabled =
    !sortBy && !search.trim() && !personFilter && !statusFilter && showDone;

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const handleMarkRead = async (id) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    try {
      await api.markAlertRead(id);
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllRead = async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    try {
      await api.markAllAlertsRead(CURRENT_USER_ID);
    } catch {
      /* ignore */
    }
  };

  // -------- Rendu --------
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-gray-500">
        Chargement…
      </div>
    );
  }

  if (error && !board) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-status-blocked">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar
        boardName={board.name}
        activeRail={activeRail}
        onSelectRail={(rail) => setActiveRail(rail)}
        onNewBoard={handleAddGroup}
        view={view}
        onSelectView={setView}
      />

      {activeRail !== 'Espaces' && (
        <RailPanel
          rail={activeRail}
          users={users}
          onAddUser={handleAddUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onSetPassword={handleSetPassword}
          onClose={() => setActiveRail('Espaces')}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barre supérieure */}
        <div className="relative flex items-center justify-between border-b border-gray-200 bg-white px-6 py-2">
          <div className="text-sm text-gray-400">
            {IS_MOCK ? 'Mode démo (données en mémoire)' : 'Connecté à l\'API'}
          </div>
          <div className="relative flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAlertsOpen((v) => !v)}
              className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-blocked px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            <AlertsPanel
              alerts={alerts}
              open={alertsOpen}
              onClose={() => setAlertsOpen(false)}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
            />
            <Avatar
              name={currentUser.name || ''}
              src={currentUser.avatar_url}
              size={32}
              ring={false}
            />
            <button
              type="button"
              onClick={onLogout}
              title="Se déconnecter"
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-status-blocked"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {view === 'reporting' ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                Tableau de bord et reporting
              </h2>
            </div>
            {error && (
              <div className="bg-red-50 px-6 py-2 text-sm text-status-blocked">{error}</div>
            )}
            <ReportingView board={board} />
          </>
        ) : view === 'workload' ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                Charge de travail de l'équipe
              </h2>
            </div>
            {error && (
              <div className="bg-red-50 px-6 py-2 text-sm text-status-blocked">{error}</div>
            )}
            <TeamWorkloadView board={board} users={users} />
          </>
        ) : (
          <>
            <BoardHeader
              title={board.name}
              onRenameBoard={(name) => setBoard((b) => ({ ...b, name }))}
              search={search}
              onSearch={setSearch}
              personFilter={personFilter}
              onPersonFilter={setPersonFilter}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              users={users}
              onAddTaskClick={() => board.groups[0] && handleAddTask(board.groups[0].id, 'Nouvelle tâche')}
              sortBy={sortBy}
              onToggleSort={cycleSort}
              showDone={showDone}
              onToggleShowDone={() => setShowDone((v) => !v)}
            />

            {/* Bandeau d'erreur transitoire */}
            {error && (
              <div className="bg-red-50 px-6 py-2 text-sm text-status-blocked">{error}</div>
            )}

            {/* Contenu scrollable */}
            <main className="flex-1 overflow-auto px-6 py-5">
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="board" type="GROUP">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {board.groups.map((group, gIndex) => (
                        <Draggable
                          key={group.id}
                          draggableId={`group-${group.id}`}
                          index={gIndex}
                          isDragDisabled={!dragEnabled}
                        >
                          {(gProvided, gSnapshot) => (
                            <GroupTable
                              group={group}
                              users={users}
                              selectedIds={selectedIds}
                              filterFn={filterFn}
                              sortFn={sortFn}
                              dragEnabled={dragEnabled}
                              groupDragProvided={gProvided}
                              groupDragSnapshot={gSnapshot}
                              onToggleSelect={toggleSelect}
                              onAddTask={(name) => handleAddTask(group.id, name)}
                              onRenameTask={handleRenameTask}
                              onChangeStatus={handleChangeStatus}
                              onChangePriority={handleChangePriority}
                              onAssign={handleAssign}
                              onChangeDate={handleChangeDate}
                              onDeleteTask={handleDeleteTask}
                              onRenameGroup={(name) => handleRenameGroup(group.id, name)}
                              onDeleteGroup={() => handleDeleteGroup(group.id)}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <button
                type="button"
                onClick={handleAddGroup}
                className="mt-2 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm hover:border-primary hover:text-primary"
              >
                <Plus size={16} /> Ajouter un nouveau groupe
              </button>
            </main>
          </>
        )}
      </div>
    </div>
  );
}
