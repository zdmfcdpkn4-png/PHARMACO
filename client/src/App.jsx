import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Plus, LogOut, Menu, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Sidebar from './components/Sidebar.jsx';
import RailPanel from './components/RailPanel.jsx';
import BoardHeader from './components/BoardHeader.jsx';
import GroupTable from './components/GroupTable.jsx';
import AlertsPanel from './components/AlertsPanel.jsx';
import Avatar from './components/Avatar.jsx';
import TeamWorkloadView from './components/TeamWorkloadView.jsx';
import ReportingView from './components/ReportingView.jsx';
import GanttChartView from './components/GanttChartView.jsx';
import DynamicTimeView from './components/DynamicTimeView.jsx';
import TeamsView from './components/TeamsView.jsx';
import TeamProjectView from './components/TeamProjectView.jsx';
import OverviewView from './components/OverviewView.jsx';
import KanbanView from './components/KanbanView.jsx';
import CalendarView from './components/CalendarView.jsx';
import BoardTabs from './components/BoardTabs.jsx';
import TaskDrawer from './components/TaskDrawer.jsx';
import TaskDetailPanel from './components/TaskDetailPanel.jsx';
import MobileNav from './components/MobileNav.jsx';
import MobileHeader from './components/MobileHeader.jsx';
import MobileBoard from './components/MobileBoard.jsx';
import BottomSheet from './components/BottomSheet.jsx';
import Login from './components/Login.jsx';
import useIsMobile from './lib/useIsMobile.js';
import { api, IS_MOCK } from './api/index.js';
import { GROUP_COLORS, STATUS_META, PRIORITY_META } from './lib/constants.js';

const AUTH_KEY = 'pharmaco_auth';

// Palette de couleurs cyclique pour les étiquettes créées à la volée.
const TAG_PALETTE = [
  '#579bfc', '#00c875', '#e2445c', '#fdab3d',
  '#a25ddc', '#00c2e0', '#ff5ac4', '#784bd1',
];

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
  const isMobile = useIsMobile();
  const [board, setBoard] = useState(null);
  const [boards, setBoards] = useState([]); // liste des projets (métadonnées)
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // sidebar coulissante (mobile)

  // Filtres / recherche
  const [search, setSearch] = useState('');
  const [personFilter, setPersonFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [etapeFilter, setEtapeFilter] = useState(null);
  const [interventionFilter, setInterventionFilter] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [alertsOpen, setAlertsOpen] = useState(false);

  // Navigation latérale + outils de tri / affichage
  const [view, setView] = useState('board'); // 'board' | 'workload'
  const [activeRail, setActiveRail] = useState('Espaces');
  const [sortBy, setSortBy] = useState(null); // null | 'nom' | 'statut' | 'échéance'
  const [showDone, setShowDone] = useState(true); // afficher les tâches "Fait"

  // Drawer de tâche (discussion / historique) + compteurs de commentaires
  const [drawerTask, setDrawerTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null); // panneau Item Detail
  const [commentCounts, setCommentCounts] = useState({});

  // Onglet de vue du tableau : 'table' | 'kanban' | 'calendar'
  const [boardView, setBoardView] = useState('table');

  // Double sidebar : mode + équipes + raccourcis
  const [sidebarMode, setSidebarMode] = useState('projects'); // 'projects' | 'teams'
  const [teams, setTeams] = useState([]);
  const [shortcuts, setShortcuts] = useState([]);
  const [teamSection, setTeamSection] = useState(null); // `${teamId}:${section}` (gestion)
  const [teamView, setTeamView] = useState(null); // `${teamId}:${section}` (équipe impliquée)

  // -------- Gestion fine des rôles --------
  // viewer : lecture seule. member / admin / propriétaire : édition.
  const isOwner = !board || board.created_by == null || board.created_by === CURRENT_USER_ID;
  const isAdmin = currentUser.role === 'admin';
  const isViewer = currentUser.role === 'viewer';
  const canEdit = !isViewer; // membres et admins peuvent éditer

  // Création de structure (groupes, colonnes) : propriétaire ou admin seulement.
  const canManageBoard = isOwner || isAdmin;

  // Suppression d'une tâche : propriétaire, admin, admin assigné, ou tâche vide.
  const canDeleteTask = (task) =>
    !isViewer && (isOwner || isAdmin || !task.admin || task.admin.id === CURRENT_USER_ID);

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

  // Charge le nombre de commentaires NON LUS par tâche (pour la bulle).
  const loadCommentCounts = useCallback(async () => {
    try {
      const counts = await api.getUnreadCounts(CURRENT_USER_ID);
      setCommentCounts(counts || {});
    } catch {
      /* non bloquant */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.getBoards().catch(() => []);
        const firstId = list[0]?.id || 1;
        const [b, u] = await Promise.all([api.getBoard(firstId), api.getUsers()]);
        setBoards(list.length ? list : [{ id: b.id, name: b.name, description: b.description }]);
        setCurrentBoardId(b.id);
        setBoard(b);
        setUsers(u);
        await loadAlerts();
        loadCommentCounts(b);
        api.getTeams().then(setTeams).catch(() => {});
        api.getShortcuts(CURRENT_USER_ID).then(setShortcuts).catch(() => {});
      } catch (e) {
        setError(e.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAlerts, loadCommentCounts]);

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
  // actor_id : attribue les entrées du journal d'activité à l'utilisateur courant.
  const actor = { actor_id: CURRENT_USER_ID };

  const handleRenameTask = (taskId, name) =>
    optimistic((b) => patchTaskLocal(b, taskId, { name }), () =>
      api.updateTask(taskId, { name, ...actor })
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
      await api.updateTask(taskId, { status, ...actor });
      if (status === 'Bloqué') loadAlerts(); // alerte (critique si P1) créée côté serveur
    });
  };

  const handleChangePriority = (taskId, priority) => {
    optimistic((b) => patchTaskLocal(b, taskId, { priority }), () =>
      api.updateTask(taskId, { priority, ...actor })
    );
  };

  // -------- Raccourcis & équipes --------
  const handleAddShortcut = async (name, currentView) => {
    const created = await api.createShortcut({
      user_id: CURRENT_USER_ID,
      name,
      target_url: currentView, // on stocke la vue ciblée
      icon_name:
        currentView === 'gantt'
          ? 'GanttChartSquare'
          : currentView === 'reporting'
          ? 'PieChart'
          : currentView === 'timeline'
          ? 'CalendarRange'
          : 'Table2',
    });
    setShortcuts((prev) => [...prev, created]);
  };
  const handleDeleteShortcut = async (id) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
    try {
      await api.deleteShortcut(id);
    } catch {
      /* ignore */
    }
  };
  const handleOpenShortcut = (s) => {
    setSidebarMode('projects');
    setView(s.target_url || 'board');
  };
  const handleSelectTeamSection = (teamId, section) => {
    setTeamSection(`${teamId}:${section}`);
    setView('teams');
  };
  // Vue contextuelle d'une équipe impliquée dans le projet (charge / répartition).
  const handleSelectTeamView = (teamId, section) => {
    setTeamView(`${teamId}:${section}`);
    setView('team-project');
  };
  const handleOpenTeams = () => {
    setTeamSection(null);
    setView('teams');
  };
  const handleOpenOverview = () => {
    setView('overview');
  };

  // -------- Multi-projets (un board par projet) --------
  // Bascule vers un autre projet : recharge le tableau complet correspondant.
  const handleSelectProject = async (id) => {
    // Depuis la vue d'ensemble, on recharge toujours (cohérence du board actif).
    if (id === currentBoardId && view !== 'overview') {
      setView('board');
      return;
    }
    try {
      const b = await api.getBoard(id);
      setBoard(b);
      setCurrentBoardId(id);
      setTeamView(null);
      setView('board');
    } catch (e) {
      setError(e.message || 'Impossible de charger le projet');
      setTimeout(() => setError(null), 3000);
    }
  };

  // Crée un nouveau projet (board) et l'ouvre.
  const handleNewProject = async () => {
    const name = window.prompt('Nom du nouveau projet :');
    if (!name || !name.trim()) return;
    try {
      const created = await api.createBoard({
        name: name.trim(),
        workspace_id: board?.workspace_id || 1,
        created_by: CURRENT_USER_ID,
      });
      const list = await api.getBoards().catch(() => null);
      if (list) setBoards(list);
      else setBoards((prev) => [...prev, created]);
      const b = await api.getBoard(created.id);
      setBoard(b);
      setCurrentBoardId(created.id);
      setView('board');
    } catch (e) {
      setError(e.message || 'Impossible de créer le projet');
      setTimeout(() => setError(null), 3000);
    }
  };
  const handleOpenDirectory = () => {
    setTeamSection('directory');
    setView('teams');
  };
  // Définit les équipes associées au projet courant (table project_teams).
  const handleSetBoardTeams = async (teamIds) => {
    await api.setBoardTeams(board.id, teamIds);
    const fresh = await api.getBoard(board.id);
    setBoard(fresh);
  };

  // Rafraîchit users (pour les badges d'équipes de l'annuaire) + teams.
  const refreshTeamsAndUsers = async () => {
    try {
      const [t, u] = await Promise.all([api.getTeams(), api.getUsers()]);
      setTeams(t);
      setUsers(u);
    } catch {
      /* ignore */
    }
  };

  const handleAddTeam = async (name) => {
    const created = await api.createTeam({ name });
    setTeams((prev) => [...prev, created]);
  };
  const handleAddTeamMembers = async (teamId, userIds) => {
    const res = await api.addTeamMembers(teamId, userIds);
    await refreshTeamsAndUsers();
    return res;
  };
  const handleUpdateMemberRole = async (teamId, userId, role) => {
    const res = await api.updateTeamMemberRole(teamId, userId, role);
    await refreshTeamsAndUsers();
    return res;
  };
  const handleRemoveTeamMember = async (teamId, userId) => {
    const res = await api.removeTeamMember(teamId, userId);
    await refreshTeamsAndUsers();
    return res;
  };

  // Configuration des étiquettes (dictionnaires du board).
  const handleCreateTag = async (name, color, tag_type) => {
    const created = await api.createTag(board.id, { name, color, tag_type });
    setBoard((b) => ({ ...b, tags: [...(b.tags || []), created] }));
    return created;
  };
  // Création rapide d'une étiquette depuis la fiche de tâche (couleur auto).
  const handleCreateTagInline = (tag_type, name) => {
    const count = (board.tags || []).filter((t) => t.tag_type === tag_type).length;
    const color = TAG_PALETTE[count % TAG_PALETTE.length];
    return handleCreateTag(name, color, tag_type);
  };
  const handleDeleteTag = async (tagId) => {
    setBoard((b) => ({ ...b, tags: (b.tags || []).filter((t) => t.id !== tagId) }));
    try {
      await api.deleteTag(tagId);
    } catch {
      /* ignore */
    }
  };

  // Multi-assignation d'une tâche.
  const handleSetTaskAssignees = (taskId, userIds) => {
    const shaped = userIds.map((id) => users.find((u) => u.id === id)).filter(Boolean);
    optimistic(
      (b) => patchTaskLocal(b, taskId, { assignees: shaped, admin: shaped[0] || null }),
      () => api.setTaskAssignees(taskId, userIds)
    );
  };

  const handleSetSubtaskAssignees = async (subId, userIds) => {
    const shaped = userIds.map((id) => users.find((u) => u.id === id)).filter(Boolean);
    setBoard((b) => {
      const next = structuredClone(b);
      for (const g of next.groups)
        for (const t of g.tasks) {
          const s = (t.subtasks || []).find((x) => x.id === subId);
          if (s) {
            s.assignees = shaped;
            s.admin = shaped[0] || null;
          }
        }
      return next;
    });
    try {
      await api.setSubtaskAssignees(subId, userIds);
    } catch (e) {
      setError(e.message);
    }
  };

  // Étiquette (Étape / Type) d'une tâche.
  const handleChangeTaskTag = (taskId, field, tagId) =>
    optimistic((b) => patchTaskLocal(b, taskId, { [field]: tagId }), () =>
      api.updateTask(taskId, { [field]: tagId, ...actor })
    );

  // Déplace une tâche vers un autre groupe (depuis le panneau détaillé).
  const handleChangeGroup = (taskId, groupId) => {
    optimistic(
      (b) => {
        let moved = null;
        for (const g of b.groups) {
          const idx = g.tasks.findIndex((t) => t.id === taskId);
          if (idx >= 0) {
            [moved] = g.tasks.splice(idx, 1);
            break;
          }
        }
        if (moved) {
          moved.group_id = groupId;
          const dest = b.groups.find((g) => g.id === groupId);
          if (dest) dest.tasks.push(moved);
        }
        return b;
      },
      () => api.updateTask(taskId, { group_id: groupId, ...actor })
    );
  };

  const handleAssign = (taskId, adminId) => {
    const admin = adminId ? users.find((u) => u.id === adminId) : null;
    const adminShape = admin
      ? { id: admin.id, name: admin.name, avatar_url: admin.avatar_url }
      : null;
    optimistic((b) => patchTaskLocal(b, taskId, { admin: adminShape }), () =>
      api.updateTask(taskId, { admin_id: adminId, ...actor })
    );
  };

  const handleChangeDate = (taskId, date) =>
    optimistic((b) => patchTaskLocal(b, taskId, { duedate: date }), () =>
      api.updateTask(taskId, { duedate: date, ...actor })
    );

  const handleDeleteTask = (taskId) => {
    const task = board?.groups.flatMap((g) => g.tasks).find((t) => t.id === taskId);
    if (task && !canDeleteTask(task)) {
      setError('Vous n’êtes pas autorisé à supprimer cette tâche.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (!confirm(`Supprimer la tâche « ${task?.name || ''} » ?`)) return;
    optimistic(
      (b) => {
        for (const g of b.groups) g.tasks = g.tasks.filter((t) => t.id !== taskId);
        return b;
      },
      () => api.deleteTask(taskId)
    );
  };

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
      const created = await api.createTask({ group_id: groupId, name, ...actor });
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

  // Création complète (Gantt) : name + dates. Renvoie la tâche créée.
  const handleCreateTaskFull = async ({ group_id, name, start_date, duedate }) => {
    const created = await api.createTask({ group_id, name, start_date, duedate, ...actor });
    setBoard((b) => {
      const next = structuredClone(b);
      const g = next.groups.find((x) => x.id === group_id);
      if (g) g.tasks.push(created);
      return next;
    });
    return created;
  };

  // -------- Sous-items --------
  const handleCreateSubtask = async (taskId, name) => {
    const created = await api.createSubtask(taskId, { name });
    setBoard((b) => {
      const next = structuredClone(b);
      for (const g of next.groups) {
        const t = g.tasks.find((x) => x.id === taskId);
        if (t) {
          t.subtasks = [...(t.subtasks || []), created];
          break;
        }
      }
      return next;
    });
  };

  const handleUpdateSubtask = async (subId, patch) => {
    // Optimiste local
    setBoard((b) => {
      const next = structuredClone(b);
      for (const g of next.groups)
        for (const t of g.tasks) {
          const s = (t.subtasks || []).find((x) => x.id === subId);
          if (s) {
            if (patch.name !== undefined) s.name = patch.name;
            if (patch.status !== undefined) s.status = patch.status;
            if (patch.duedate !== undefined) s.duedate = patch.duedate;
            if (patch.admin_id !== undefined)
              s.admin = patch.admin_id ? users.find((u) => u.id === patch.admin_id) || null : null;
          }
        }
      return next;
    });
    try {
      const res = await api.updateSubtask(subId, patch);
      // Auto-complétion du parent reflétée dans l'UI
      if (res?.parentCompleted && res.parentId) {
        setBoard((b) => patchTaskLocal(structuredClone(b), res.parentId, { status: 'Fait' }));
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteSubtask = async (subId) => {
    setBoard((b) => {
      const next = structuredClone(b);
      for (const g of next.groups)
        for (const t of g.tasks)
          if (t.subtasks) t.subtasks = t.subtasks.filter((s) => s.id !== subId);
      return next;
    });
    try {
      await api.deleteSubtask(subId);
    } catch {
      /* ignore */
    }
  };

  // -------- Catégories / colonnes personnalisées --------
  const handleCreateCategory = async (name, type) => {
    const created = await api.createCategory(board.id, { name, type });
    setBoard((b) => ({ ...b, categories: [...(b.categories || []), created] }));
  };

  const handleDeleteCategory = async (catId) => {
    setBoard((b) => ({
      ...b,
      categories: (b.categories || []).filter((c) => c.id !== catId),
      categoryValues: (b.categoryValues || []).filter((v) => v.category_id !== catId),
    }));
    try {
      await api.deleteCategory(catId);
    } catch {
      /* ignore */
    }
  };

  const handleSetCategoryValue = (categoryId, taskId, value) => {
    setBoard((b) => {
      const next = structuredClone(b);
      next.categoryValues = next.categoryValues || [];
      const existing = next.categoryValues.find(
        (v) => v.category_id === categoryId && v.task_id === taskId
      );
      if (existing) existing.value = value;
      else next.categoryValues.push({ category_id: categoryId, task_id: taskId, value });
      return next;
    });
    api.setCategoryValue({ category_id: categoryId, task_id: taskId, value }).catch(() => {});
  };

  // Accès rapide à la valeur d'une catégorie pour une tâche.
  const categoryValue = (categoryId, taskId) =>
    (board?.categoryValues || []).find(
      (v) => v.category_id === categoryId && v.task_id === taskId
    )?.value ?? '';

  // Création rapide d'une tâche à une date donnée (Calendrier).
  const handleCreateTaskOnDate = async (dateKey) => {
    const group = board?.groups?.[0];
    if (!group) return;
    const name = window.prompt('Nom de la nouvelle tâche :');
    if (!name || !name.trim()) return;
    await handleCreateTaskFull({
      group_id: group.id,
      name: name.trim(),
      start_date: dateKey,
      duedate: dateKey,
    });
  };

  // Mise à jour des dates depuis le Gantt (déplacement / redimensionnement).
  // Applique aussi les successeurs repoussés par la contrainte de planning.
  const handleUpdateTaskDates = (taskId, patch) => {
    setBoard((prev) => patchTaskLocal(structuredClone(prev), taskId, patch));
    const snapshot = board;
    (async () => {
      try {
        const res = await api.updateTask(taskId, { ...patch, ...actor });
        const shifted = res?.shifted || [];
        if (shifted.length) {
          setBoard((b) => {
            const next = structuredClone(b);
            for (const s of shifted) {
              patchTaskLocal(next, s.id, { start_date: s.start_date, duedate: s.duedate });
            }
            return next;
          });
        }
      } catch (e) {
        setBoard(snapshot);
        setError(e.message || 'Échec de la mise à jour');
        setTimeout(() => setError(null), 3000);
      }
    })();
  };

  // Dépendances (Gantt)
  const handleAddDependency = async (predId, succId) => {
    await api.addDependency(predId, succId);
    setBoard((b) => ({
      ...b,
      dependencies: [
        ...(b.dependencies || []),
        { id: `tmp-${Date.now()}`, predecessor_id: predId, successor_id: succId },
      ],
    }));
    // Recharge pour récupérer l'id réel + d'éventuels recalages
    const fresh = await api.getBoard(board.id);
    setBoard(fresh);
  };

  const handleDeleteDependency = async (depId) => {
    setBoard((b) => ({
      ...b,
      dependencies: (b.dependencies || []).filter((d) => d.id !== depId),
    }));
    try {
      await api.deleteDependency(depId);
    } catch {
      /* ignore */
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
      prev
        // Conserve les équipes dérivées (non renvoyées par updateUser).
        .map((u) => (u.id === id ? { ...updated, teams: updated.teams ?? u.teams } : u))
        .sort((a, b) => a.name.localeCompare(b.name))
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
    // Une tâche correspond au filtre d'étiquette si elle-même OU l'un de ses
    // sous-items porte l'étiquette ciblée.
    const matchesTag = (task, field, val) => {
      if (!val) return true;
      if (task[field] === val) return true;
      return (task.subtasks || []).some((s) => s[field] === val);
    };
    return (task) => {
      if (q && !task.name.toLowerCase().includes(q)) return false;
      if (personFilter && task.admin?.id !== personFilter) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (!showDone && task.status === 'Fait') return false;
      if (!matchesTag(task, 'etape_tag_id', etapeFilter)) return false;
      if (!matchesTag(task, 'intervention_tag_id', interventionFilter)) return false;
      return true;
    };
  }, [search, personFilter, statusFilter, showDone, etapeFilter, interventionFilter]);

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

  // -------- Export --------
  // Construit les lignes visibles (filtres + tri actifs appliqués), groupe par groupe.
  const buildVisibleRows = () => {
    const rows = [];
    for (const g of board?.groups || []) {
      let tasks = g.tasks.filter(filterFn);
      if (sortFn) tasks = [...tasks].sort(sortFn);
      for (const t of tasks) {
        rows.push({
          groupe: g.name,
          tache: t.name,
          admin: t.admin?.name || '',
          statut: t.status,
          priorite: t.priority || 'P3 - Normal',
          echeance: t.duedate ? t.duedate.slice(0, 10) : '',
        });
      }
    }
    return rows;
  };

  const handleExportCsv = () => {
    const rows = buildVisibleRows();
    const header = ['Groupe', 'Tâche', 'Admin', 'Statut', 'Priorité', 'Échéance'];
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header, ...rows.map((r) => [r.groupe, r.tache, r.admin, r.statut, r.priorite, r.echeance])];
    const csv = lines.map((l) => l.map(escape).join(';')).join('\n');
    // BOM pour Excel + accents
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(board?.name || 'tableau').replace(/\s+/g, '-')}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  // Export PDF direct du tableau (jsPDF + autoTable), filtres/tri respectés.
  const handleExportPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const rows = buildVisibleRows();

    const hexToRgb = (hex) => {
      const h = hex.replace('#', '');
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    };

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 32;

    // En-tête
    doc.setFontSize(16);
    doc.setTextColor(59, 31, 122);
    doc.text(`PHARMACO — ${board?.name || 'Tableau'}`, margin, margin);
    doc.setFontSize(9);
    doc.setTextColor(120);
    const filtres = [
      search.trim() && `recherche « ${search.trim()} »`,
      personFilter && `personne`,
      statusFilter && `statut ${statusFilter}`,
      !showDone && 'tâches terminées masquées',
    ].filter(Boolean);
    doc.text(
      `Synthèse du ${new Date().toLocaleDateString('fr-FR')}${
        filtres.length ? ' · Filtres : ' + filtres.join(', ') : ''
      } · ${rows.length} tâche(s)`,
      margin,
      margin + 16
    );

    autoTable(doc, {
      startY: margin + 28,
      margin: { left: margin, right: margin },
      head: [['Groupe', 'Tâche', 'Admin', 'Statut', 'Priorité', 'Échéance']],
      body: rows.map((r) => [r.groupe, r.tache, r.admin || '—', r.statut, r.priorite, r.echeance || '—']),
      styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak' },
      headStyles: { fillColor: [59, 31, 122], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 247, 251] },
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
      },
      // Colorise les cellules Statut (3) et Priorité (4)
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        if (data.column.index === 3) {
          const meta = STATUS_META[data.cell.raw];
          if (meta) {
            data.cell.styles.fillColor = hexToRgb(meta.bg);
            data.cell.styles.textColor = 255;
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 4) {
          const meta = PRIORITY_META[data.cell.raw];
          if (meta) {
            data.cell.styles.fillColor = hexToRgb(meta.bg);
            data.cell.styles.textColor = 255;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    doc.save(
      `${(board?.name || 'tableau').replace(/\s+/g, '-')}-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );
  };

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

  // ---------- Layout MOBILE (< 768px) ----------
  if (isMobile) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-canvas">
        {/* Sidebar coulissante (burger) : 85% de largeur + overlay */}
        {menuOpen && (
          <div className="fixed inset-0 z-[70] flex">
            <div
              className="absolute inset-0 bg-black/30 animate-[fadeIn_.15s_ease-out]"
              onClick={() => setMenuOpen(false)}
            />
            <div className="relative h-full w-[85%] max-w-sm animate-[slideInLeft_.2s_ease-out] bg-white shadow-2xl">
              <button
                onClick={() => setMenuOpen(false)}
                className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
              <Sidebar
                workspaceName="Espace de travail principal"
                projects={boards.length ? boards : [{ id: board.id, name: board.name }]}
                selectedProjectId={currentBoardId ?? board.id}
                onSelectProject={(id) => {
                  handleSelectProject(id);
                  setMenuOpen(false);
                }}
                onNewBoard={() => {
                  handleNewProject();
                  setMenuOpen(false);
                }}
                view={view}
                onSelectView={(v) => {
                  setView(v);
                  setMenuOpen(false);
                }}
                involvedTeams={board.teams || []}
                allTeams={teams}
                onSetInvolvedTeams={handleSetBoardTeams}
                teamView={teamView}
                onSelectTeamView={(id, s) => {
                  handleSelectTeamView(id, s);
                  setMenuOpen(false);
                }}
                onOpenOverview={() => {
                  handleOpenOverview();
                  setMenuOpen(false);
                }}
                onOpenTeams={() => {
                  handleOpenTeams();
                  setMenuOpen(false);
                }}
                onOpenDirectory={() => {
                  handleOpenDirectory();
                  setMenuOpen(false);
                }}
                onSelectRail={(rail) => setActiveRail(rail)}
                shortcuts={shortcuts}
                onAddShortcut={handleAddShortcut}
                onDeleteShortcut={handleDeleteShortcut}
                onOpenShortcut={(sc) => {
                  handleOpenShortcut(sc);
                  setMenuOpen(false);
                }}
                forceOpen
              />
            </div>
          </div>
        )}

        {view === 'board' ? (
          <>
            <MobileHeader
              title={board.name}
              onOpenMenu={() => setMenuOpen(true)}
              onAddTask={() => board.groups[0] && handleAddTask(board.groups[0].id, 'Nouvelle tâche')}
              search={search}
              onSearch={setSearch}
              personFilter={personFilter}
              onPersonFilter={setPersonFilter}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              users={users}
              tags={board.tags || []}
              etapeFilter={etapeFilter}
              onEtapeFilter={setEtapeFilter}
              interventionFilter={interventionFilter}
              onInterventionFilter={setInterventionFilter}
            />
            <div className="overflow-x-auto">
              <BoardTabs active={boardView} onChange={setBoardView} />
            </div>
            {error && (
              <div className="bg-red-50 px-4 py-2 text-sm text-status-blocked">{error}</div>
            )}
            {boardView === 'table' && (
              <MobileBoard
                board={board}
                users={users}
                filterFn={filterFn}
                tags={board.tags || []}
                commentCounts={commentCounts}
                onOpenComments={(t) => setDrawerTask(t)}
                onOpenDetail={(t) => setDetailTask(t)}
                onChangeStatus={handleChangeStatus}
                onAssign={handleAssign}
                onAddTask={(gid) => handleAddTask(gid, 'Nouvelle tâche')}
              />
            )}
            {boardView === 'kanban' && (
              <div className="flex-1 overflow-auto pb-20">
                <KanbanView
                  board={board}
                  filterFn={filterFn}
                  canEdit={canEdit}
                  commentCounts={commentCounts}
                  onChangeStatus={handleChangeStatus}
                  onOpenTask={(t) => setDrawerTask(t)}
                  onAddTask={() => board.groups[0] && handleAddTask(board.groups[0].id, 'Nouvelle tâche')}
                />
              </div>
            )}
            {boardView === 'calendar' && (
              <div className="flex flex-1 flex-col overflow-hidden pb-20">
                <CalendarView
                  board={board}
                  filterFn={filterFn}
                  canEdit={canEdit}
                  onOpenTask={(t) => setDrawerTask(t)}
                  onChangeDate={handleChangeDate}
                  onAddTaskOnDate={handleCreateTaskOnDate}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
              <button
                onClick={() => setMenuOpen(true)}
                className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100"
                title="Menu"
              >
                <Menu size={20} />
              </button>
              <h1 className="text-lg font-bold text-gray-800">
                {view === 'overview'
                  ? "Vue d'ensemble"
                  : view === 'gantt'
                  ? 'Gantt / Chronogramme'
                  : view === 'timeline'
                  ? 'Planning dynamique'
                  : view === 'reporting'
                  ? 'Reporting'
                  : view === 'teams'
                  ? teamSection === 'directory'
                    ? 'Annuaire des agents'
                    : 'Gestion des Équipes'
                  : view === 'team-project'
                  ? (teamView || '').endsWith(':distribution')
                    ? 'Répartition des tâches'
                    : "Charge de l'équipe"
                  : 'Charge de travail'}
              </h1>
            </div>
            <div className="flex flex-1 flex-col overflow-auto pb-20">
              {view === 'overview' && (
                <OverviewView
                  boards={boards}
                  loadFull={(id) => api.getBoard(id)}
                  onOpenProject={(id) => {
                    handleSelectProject(id);
                  }}
                />
              )}
              {view === 'gantt' && (
                <GanttChartView
                  board={board}
                  onUpdateTask={handleUpdateTaskDates}
                  onCreateTask={handleCreateTaskFull}
                  onAddDependency={handleAddDependency}
                  onDeleteDependency={handleDeleteDependency}
                />
              )}
              {view === 'timeline' && (
                <DynamicTimeView
                  board={board}
                  tags={board.tags || []}
                  onOpenTask={(t) => setDetailTask(t)}
                />
              )}
              {view === 'reporting' && <ReportingView board={board} users={users} />}
              {view === 'workload' && <TeamWorkloadView board={board} users={users} />}
              {view === 'team-project' &&
                (() => {
                  const [tid, section] = (teamView || '').split(':');
                  const team = (board.teams || []).find((t) => String(t.id) === tid);
                  return team ? (
                    <TeamProjectView board={board} team={team} section={section} />
                  ) : (
                    <div className="p-6 text-sm text-gray-400">Équipe introuvable.</div>
                  );
                })()}
              {view === 'teams' && (
                <TeamsView
                  teams={teams}
                  users={users}
                  teamSection={teamSection}
                  onAddTeam={handleAddTeam}
                  onAddTeamMembers={handleAddTeamMembers}
                  onUpdateMemberRole={handleUpdateMemberRole}
                  onRemoveTeamMember={handleRemoveTeamMember}
                  canManageAgents={isAdmin}
                  currentUserId={CURRENT_USER_ID}
                  onAddUser={handleAddUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  onSetPassword={handleSetPassword}
                />
              )}
            </div>
          </div>
        )}

        {/* Navigation basse */}
        <MobileNav
          view={view}
          onSelectView={setView}
          onOpenAlerts={() => setAlertsOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
          unreadCount={unreadCount}
        />

        {/* Alertes en bottom sheet */}
        <BottomSheet open={alertsOpen} title="Notifications" onClose={() => setAlertsOpen(false)}>
          <div className="divide-y divide-gray-100">
            {alerts.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">Aucune alerte</p>
            )}
            {alerts.map((a) => (
              <button
                key={a.id}
                onClick={() => handleMarkRead(a.id)}
                className={`flex w-full items-start gap-2 px-2 py-3 text-left text-sm ${
                  a.is_read ? 'opacity-50' : ''
                } ${a.type === 'critical' && !a.is_read ? 'bg-red-50/60' : ''}`}
              >
                <span className="flex-1 text-gray-700">{a.message}</span>
                {!a.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </BottomSheet>

        {/* Profil en bottom sheet */}
        <BottomSheet open={profileOpen} title="Profil" onClose={() => setProfileOpen(false)}>
          <div className="flex flex-col items-center gap-2 py-4">
            <Avatar name={currentUser.name} src={currentUser.avatar_url} size={56} ring={false} />
            <div className="text-base font-semibold text-gray-800">{currentUser.name}</div>
            <div className="text-sm text-gray-500">{currentUser.email}</div>
            <button
              onClick={onLogout}
              className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-status-blocked"
            >
              <LogOut size={16} /> Se déconnecter
            </button>
          </div>
        </BottomSheet>

        {/* Drawer commentaires (réutilisé tel quel) */}
        {drawerTask && (
          <TaskDrawer
            task={board.groups.flatMap((g) => g.tasks).find((t) => t.id === drawerTask.id) || drawerTask}
            currentUser={currentUser}
            users={users}
            onClose={() => {
              setDrawerTask(null);
              loadCommentCounts();
              loadAlerts();
            }}
            onCommentsCountChange={() => loadCommentCounts()}
          />
        )}

        {/* Panneau détaillé (Item Detail) — mobile */}
        {detailTask && (() => {
          const live =
            board.groups.flatMap((g) => g.tasks).find((t) => t.id === detailTask.id) || detailTask;
          return (
            <TaskDetailPanel
              task={live}
              groups={board.groups}
              users={users}
              categories={board.categories || []}
              categoryValue={categoryValue}
              tags={board.tags || []}
              canEdit={canEdit}
              onClose={() => setDetailTask(null)}
              onRename={(name) => handleRenameTask(live.id, name)}
              onChangeGroup={(gid) => handleChangeGroup(live.id, gid)}
              onChangeStatus={(s) => handleChangeStatus(live.id, s)}
              onChangePriority={(p) => handleChangePriority(live.id, p)}
              onAssign={(adminId) => handleAssign(live.id, adminId)}
              onSetAssignees={(ids) => handleSetTaskAssignees(live.id, ids)}
              onChangeDate={(d) => handleChangeDate(live.id, d)}
              onChangeTag={(field, tagId) => handleChangeTaskTag(live.id, field, tagId)}
              onCreateTag={handleCreateTagInline}
              onSetCategoryValue={handleSetCategoryValue}
            />
          );
        })()}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <div className="contents no-print">
        <Sidebar
          workspaceName="Espace de travail principal"
          projects={boards.length ? boards : [{ id: board.id, name: board.name }]}
          selectedProjectId={currentBoardId ?? board.id}
          onSelectProject={handleSelectProject}
          onNewBoard={handleNewProject}
          view={view}
          onSelectView={setView}
          involvedTeams={board.teams || []}
          allTeams={teams}
          onSetInvolvedTeams={handleSetBoardTeams}
          teamView={teamView}
          onSelectTeamView={handleSelectTeamView}
          onOpenOverview={handleOpenOverview}
          onOpenTeams={handleOpenTeams}
          onOpenDirectory={handleOpenDirectory}
          onSelectRail={(rail) => setActiveRail(rail)}
          shortcuts={shortcuts}
          onAddShortcut={handleAddShortcut}
          onDeleteShortcut={handleDeleteShortcut}
          onOpenShortcut={handleOpenShortcut}
        />
      </div>

      {activeRail !== 'Espaces' && (
        <div className="contents no-print">
          <RailPanel
            rail={activeRail}
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onSetPassword={handleSetPassword}
            tags={board.tags || []}
            canManage={canManageBoard}
            onCreateTag={handleCreateTag}
            onDeleteTag={handleDeleteTag}
            onClose={() => setActiveRail('Espaces')}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barre supérieure */}
        <div className="no-print relative flex items-center justify-between border-b border-gray-200 bg-white px-6 py-2">
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

        {view === 'overview' ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                Vue d'ensemble des projets
              </h2>
            </div>
            <OverviewView
              boards={boards}
              loadFull={(id) => api.getBoard(id)}
              onOpenProject={handleSelectProject}
            />
          </>
        ) : view === 'teams' ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                {teamSection === 'directory' ? 'Annuaire des agents' : 'Gestion des Équipes'}
              </h2>
            </div>
            <TeamsView
              teams={teams}
              users={users}
              teamSection={teamSection}
              onAddTeam={handleAddTeam}
              onAddTeamMembers={handleAddTeamMembers}
              onUpdateMemberRole={handleUpdateMemberRole}
              onRemoveTeamMember={handleRemoveTeamMember}
              canManageAgents={isAdmin}
              currentUserId={CURRENT_USER_ID}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onSetPassword={handleSetPassword}
            />
          </>
        ) : view === 'timeline' ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                Planning dynamique
              </h2>
            </div>
            {error && (
              <div className="bg-red-50 px-6 py-2 text-sm text-status-blocked">{error}</div>
            )}
            <DynamicTimeView
              board={board}
              tags={board.tags || []}
              onOpenTask={(t) => setDetailTask(t)}
            />
          </>
        ) : view === 'gantt' ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                Gantt / Chronogramme
              </h2>
            </div>
            {error && (
              <div className="bg-red-50 px-6 py-2 text-sm text-status-blocked">{error}</div>
            )}
            <GanttChartView
              board={board}
              onUpdateTask={handleUpdateTaskDates}
              onCreateTask={handleCreateTaskFull}
              onAddDependency={handleAddDependency}
              onDeleteDependency={handleDeleteDependency}
            />
          </>
        ) : view === 'reporting' ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                Tableau de bord et reporting
              </h2>
            </div>
            {error && (
              <div className="bg-red-50 px-6 py-2 text-sm text-status-blocked">{error}</div>
            )}
            <ReportingView board={board} users={users} />
          </>
        ) : view === 'team-project' ? (
          (() => {
            const [tid, section] = (teamView || '').split(':');
            const team = (board.teams || []).find((t) => String(t.id) === tid);
            const title =
              section === 'distribution'
                ? 'Répartition des tâches'
                : "Charge de travail de l'équipe";
            return (
              <>
                <div className="border-b border-gray-200 bg-white px-6 pt-4">
                  <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                    {team ? `${team.name} · ${title}` : title}
                  </h2>
                  <p className="mb-3 -mt-1 text-sm text-gray-400">
                    Projet « {board.name} »
                  </p>
                </div>
                {team ? (
                  <TeamProjectView board={board} team={team} section={section} />
                ) : (
                  <div className="p-6 text-sm text-gray-400">Équipe introuvable.</div>
                )}
              </>
            );
          })()
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
              onExportCsv={handleExportCsv}
              onExportPdf={handleExportPdf}
              onPrint={handlePrint}
              tags={board.tags || []}
              etapeFilter={etapeFilter}
              onEtapeFilter={setEtapeFilter}
              interventionFilter={interventionFilter}
              onInterventionFilter={setInterventionFilter}
            />

            {/* Onglets de vue : Tableau / Kanban / Calendrier */}
            <div className="no-print">
              <BoardTabs active={boardView} onChange={setBoardView} />
            </div>

            {/* Bandeau d'erreur transitoire */}
            {error && (
              <div className="no-print bg-red-50 px-6 py-2 text-sm text-status-blocked">{error}</div>
            )}

            {/* Titre visible uniquement à l'impression */}
            <div className="hidden px-6 pt-2 print:block">
              <h1 className="text-xl font-bold text-gray-800">{board.name}</h1>
              <p className="text-xs text-gray-500">
                Synthèse imprimée le {new Date().toLocaleDateString('fr-FR')}
                {(search || personFilter || statusFilter || !showDone) && ' · filtres actifs'}
              </p>
            </div>

            {/* Contenu scrollable */}
            {boardView === 'table' && (
            <main className="print-area flex-1 overflow-auto px-6 py-5">
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
                              onSetAssignees={handleSetTaskAssignees}
                              onSetSubtaskAssignees={handleSetSubtaskAssignees}
                              onChangeDate={handleChangeDate}
                              onDeleteTask={handleDeleteTask}
                              commentCounts={commentCounts}
                              onOpenDrawer={(t) => setDrawerTask(t)}
                              onOpenDetail={(t) => setDetailTask(t)}
                              canEdit={canEdit}
                              canManage={canManageBoard}
                              canDeleteTask={canDeleteTask}
                              categories={board.categories || []}
                              categoryValue={categoryValue}
                              onCreateCategory={handleCreateCategory}
                              onDeleteCategory={handleDeleteCategory}
                              onSetCategoryValue={handleSetCategoryValue}
                              tags={board.tags || []}
                              onChangeTaskTag={handleChangeTaskTag}
                              onCreateSubtask={handleCreateSubtask}
                              onUpdateSubtask={handleUpdateSubtask}
                              onDeleteSubtask={handleDeleteSubtask}
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

              {canManageBoard && (
                <button
                  type="button"
                  onClick={handleAddGroup}
                  className="no-print mt-2 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm hover:border-primary hover:text-primary"
                >
                  <Plus size={16} /> Ajouter un nouveau groupe
                </button>
              )}
            </main>
            )}

            {boardView === 'kanban' && (
              <KanbanView
                board={board}
                filterFn={filterFn}
                canEdit={canEdit}
                commentCounts={commentCounts}
                onChangeStatus={handleChangeStatus}
                onOpenTask={(t) => setDrawerTask(t)}
                onAddTask={() => board.groups[0] && handleAddTask(board.groups[0].id, 'Nouvelle tâche')}
              />
            )}

            {boardView === 'calendar' && (
              <CalendarView
                board={board}
                filterFn={filterFn}
                canEdit={canEdit}
                onOpenTask={(t) => setDrawerTask(t)}
                onChangeDate={handleChangeDate}
                onAddTaskOnDate={handleCreateTaskOnDate}
              />
            )}
          </>
        )}
      </div>

      {/* Drawer contextuel d'une tâche (discussion + historique) */}
      {drawerTask && (
        <div className="contents no-print">
        <TaskDrawer
          task={
            // garde la version à jour de la tâche depuis le board
            board.groups.flatMap((g) => g.tasks).find((t) => t.id === drawerTask.id) || drawerTask
          }
          currentUser={currentUser}
          users={users}
          onClose={() => {
            setDrawerTask(null);
            loadCommentCounts(); // rafraîchit les non-lus (la discussion a été lue)
            loadAlerts(); // une @mention a pu générer une alerte
          }}
          onCommentsCountChange={() => loadCommentCounts()}
        />
        </div>
      )}

      {/* Panneau de configuration détaillée (Item Detail) */}
      {detailTask && (() => {
        const live =
          board.groups.flatMap((g) => g.tasks).find((t) => t.id === detailTask.id) || detailTask;
        return (
          <div className="contents no-print">
            <TaskDetailPanel
              task={live}
              groups={board.groups}
              users={users}
              categories={board.categories || []}
              categoryValue={categoryValue}
              tags={board.tags || []}
              canEdit={canEdit}
              onClose={() => setDetailTask(null)}
              onRename={(name) => handleRenameTask(live.id, name)}
              onChangeGroup={(gid) => handleChangeGroup(live.id, gid)}
              onChangeStatus={(s) => handleChangeStatus(live.id, s)}
              onChangePriority={(p) => handleChangePriority(live.id, p)}
              onAssign={(adminId) => handleAssign(live.id, adminId)}
              onSetAssignees={(ids) => handleSetTaskAssignees(live.id, ids)}
              onChangeDate={(d) => handleChangeDate(live.id, d)}
              onChangeTag={(field, tagId) => handleChangeTaskTag(live.id, field, tagId)}
              onCreateTag={handleCreateTagInline}
              onSetCategoryValue={handleSetCategoryValue}
            />
          </div>
        );
      })()}
    </div>
  );
}
