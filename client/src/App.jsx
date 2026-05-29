import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import BoardHeader from './components/BoardHeader.jsx';
import GroupTable from './components/GroupTable.jsx';
import AlertsPanel from './components/AlertsPanel.jsx';
import { api, IS_MOCK } from './api/index.js';
import { GROUP_COLORS } from './lib/constants.js';

const CURRENT_USER_ID = 1; // utilisateur connecté (démo)

export default function App() {
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

  // -------- Chargement initial --------
  const loadAlerts = useCallback(async () => {
    try {
      const a = await api.getAlerts({ user_id: CURRENT_USER_ID });
      setAlerts(a);
    } catch {
      /* non bloquant */
    }
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

  const handleChangeStatus = (taskId, status) => {
    optimistic((b) => patchTaskLocal(b, taskId, { status }), async () => {
      await api.updateTask(taskId, { status });
      if (status === 'Bloqué') loadAlerts(); // l'alerte est créée côté serveur
    });
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
      return true;
    };
  }, [search, personFilter, statusFilter]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const handleMarkRead = async (id) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    try {
      await api.markAlertRead(id);
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
      <Sidebar boardName={board.name} />

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
            />
            <img
              src={users.find((u) => u.id === CURRENT_USER_ID)?.avatar_url}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          </div>
        </div>

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
        />

        {/* Bandeau d'erreur transitoire */}
        {error && (
          <div className="bg-red-50 px-6 py-2 text-sm text-status-blocked">{error}</div>
        )}

        {/* Contenu scrollable */}
        <main className="flex-1 overflow-auto px-6 py-5">
          {board.groups.map((group) => (
            <GroupTable
              key={group.id}
              group={group}
              users={users}
              selectedIds={selectedIds}
              filterFn={filterFn}
              onToggleSelect={toggleSelect}
              onAddTask={(name) => handleAddTask(group.id, name)}
              onRenameTask={handleRenameTask}
              onChangeStatus={handleChangeStatus}
              onAssign={handleAssign}
              onChangeDate={handleChangeDate}
              onDeleteTask={handleDeleteTask}
              onRenameGroup={(name) => handleRenameGroup(group.id, name)}
              onDeleteGroup={() => handleDeleteGroup(group.id)}
            />
          ))}

          <button
            type="button"
            onClick={handleAddGroup}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm hover:border-primary hover:text-primary"
          >
            <Plus size={16} /> Ajouter un nouveau groupe
          </button>
        </main>
      </div>
    </div>
  );
}
