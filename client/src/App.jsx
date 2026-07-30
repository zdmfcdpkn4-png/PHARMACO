import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Plus, LogOut, Menu, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Sidebar from './components/Sidebar.jsx';
import RailPanel from './components/RailPanel.jsx';
import BoardHeader from './components/BoardHeader.jsx';
import GroupTable from './components/GroupTable.jsx';
import AlertsPanel from './components/AlertsPanel.jsx';
import Avatar from './components/Avatar.jsx';
import BoardTabs from './components/BoardTabs.jsx';
import ProjectModal from './components/ProjectModal.jsx';
import TaskDrawer from './components/TaskDrawer.jsx';
import TaskDetailPanel from './components/TaskDetailPanel.jsx';
import MobileNav from './components/MobileNav.jsx';
import MobileHeader from './components/MobileHeader.jsx';
import MobileBoard from './components/MobileBoard.jsx';
import ProjectActionsSheet from './components/ProjectActionsSheet.jsx';
import BottomSheet from './components/BottomSheet.jsx';
import BandeauErreur from './components/BandeauErreur.jsx';
import { SqueletteVue, AnnonceChargement } from './components/Skeleton.jsx';
import Login from './components/Login.jsx';
import useIsMobile from './lib/useIsMobile.js';
import { useColumnWidths } from './lib/useColumnWidths.js';
import { useViewPreferences } from './lib/useViewPreferences.js';
import { api, IS_MOCK } from './api/index.js';

// Vues secondaires : chargées à la demande pour alléger le premier rendu.
// Ne PAS rendre paresseux GroupTable / BoardHeader / Sidebar : ils sont
// affichés d'emblée, et GroupTable vit à l'intérieur du DragDropContext.
const TeamWorkloadView = lazy(() => import('./components/TeamWorkloadView.jsx'));
const ReportingView = lazy(() => import('./components/ReportingView.jsx'));
const GanttChartView = lazy(() => import('./components/GanttChartView.jsx'));
const DynamicTimeView = lazy(() => import('./components/DynamicTimeView.jsx'));
const TeamsView = lazy(() => import('./components/TeamsView.jsx'));
const TeamProjectView = lazy(() => import('./components/TeamProjectView.jsx'));
const OverviewView = lazy(() => import('./components/OverviewView.jsx'));
const AgentView = lazy(() => import('./components/AgentView.jsx'));
const KanbanView = lazy(() => import('./components/KanbanView.jsx'));
const CalendarView = lazy(() => import('./components/CalendarView.jsx'));

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

  // Met à jour l'utilisateur connecté (ex. après modification de son profil /
  // avatar) pour rafraîchir l'en-tête sans reconnexion.
  const handleUpdateCurrentUser = (patch) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user: { ...prev.user, ...patch } };
      try {
        localStorage.setItem(AUTH_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (!auth?.user) return <Login onAuth={handleAuth} />;

  return (
    <Board
      currentUser={auth.user}
      onLogout={handleLogout}
      onUpdateCurrentUser={handleUpdateCurrentUser}
    />
  );
}

function Board({ currentUser, onLogout, onUpdateCurrentUser }) {
  const CURRENT_USER_ID = currentUser.id;
  const isMobile = useIsMobile();
  const [board, setBoard] = useState(null);
  const [boards, setBoards] = useState([]); // liste des projets actifs (métadonnées)
  const [archivedBoards, setArchivedBoards] = useState([]); // projets archivés
  const [projectModal, setProjectModal] = useState(null); // { mode, project }
  const [currentBoardId, setCurrentBoardId] = useState(null);
  // Largeurs de colonnes redimensionnables (persistées par projet).
  const {
    getWidth: getColWidth,
    setWidth: setColWidth,
    resetWidth: resetColWidth,
  } = useColumnWidths(currentBoardId);
  // Préférences d'affichage du tableau (persistées par projet).
  const { prefs: viewPrefs, setPref: setViewPref } = useViewPreferences(currentBoardId);
  const groupByStep = viewPrefs.groupByStep;
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Base sans aucun projet et utilisateur sans droit de création (observateur).
  const [noProjects, setNoProjects] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // sidebar coulissante (mobile)
  // Feuille d'actions du projet (mobile) : pendant du menu de BoardHeader.
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  // Affichage des tâches archivées (« corbeille » du projet courant). Le ref
  // double l'état : tous les rechargements de projet doivent respecter le
  // choix courant, y compris ceux déclenchés hors rendu (resynchronisation).
  const [showArchived, setShowArchived] = useState(false);
  const showArchivedRef = useRef(false);
  // Chargement du projet COURANT : passe systématiquement par ce helper pour
  // que l'option d'archivage soit appliquée partout de la même façon.
  const chargerBoard = useCallback(
    (id) => api.getBoard(id, { include_archived: showArchivedRef.current }),
    []
  );

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
  const [agentViewUser, setAgentViewUser] = useState(null); // agent visualisé (vue tâches)

  // -------- Gestion fine des rôles --------
  // viewer : lecture seule. member / admin / propriétaire : édition.
  const isOwner = !board || board.created_by == null || board.created_by === CURRENT_USER_ID;
  const isAdmin = currentUser.role === 'admin';
  const isViewer = currentUser.role === 'viewer';
  const canEdit = !isViewer; // membres et admins peuvent éditer

  // Création de structure (groupes, colonnes) : propriétaire ou admin seulement.
  const canManageBoard = isOwner || isAdmin;

  // Suppression (tâches, groupes, projets) réservée au rôle administrateur.
  // eslint-disable-next-line no-unused-vars
  const canDeleteTask = (_task) => isAdmin;

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
        const all = await api.getBoards({ include_archived: true }).catch(() => []);
        const list = all.filter((b) => !b.archived);
        setArchivedBoards(all.filter((b) => b.archived));
        let firstId = list[0]?.id || all[0]?.id || null;
        // Base neuve (aucun projet) : crée automatiquement un premier projet
        // « Suivi », comme en mode démo. Le serveur crée aussi l'espace de
        // travail par défaut si nécessaire.
        if (!firstId) {
          try {
            const created = await api.createBoard({
              name: 'Suivi',
              created_by: CURRENT_USER_ID,
            });
            firstId = created.id;
          } catch {
            // Observateur (lecture seule) : écran « aucun projet » ci-dessous.
          }
        }
        if (!firstId) {
          const u = await api.getUsers().catch(() => []);
          setUsers(u);
          setNoProjects(true);
          return;
        }
        const [b, u] = await Promise.all([chargerBoard(firstId), api.getUsers()]);
        setBoards(list.length ? list : [{ id: b.id, name: b.name, description: b.description }]);
        setCurrentBoardId(b.id);
        setBoard(b);
        setUsers(u);
        await loadAlerts();
        loadCommentCounts(b);
        api.getTeams().then(setTeams).catch(() => {});
        api.getShortcuts(CURRENT_USER_ID).then(setShortcuts).catch(() => {});
      } catch (e) {
        signalerErreur(e, 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAlerts, loadCommentCounts]);

  // -------- Mises à jour optimistes --------

  // Émetteur unique de messages d'erreur. UN SEUL minuteur : sans cela, deux
  // erreurs successives laissent deux minuteurs et le plus ancien efface le
  // message du plus récent.
  const minuterieErreur = useRef(null);
  const signalerErreur = useCallback((e, secours = 'Une erreur est survenue') => {
    const message = typeof e === 'string' ? e : e?.message || secours;
    setError(message);
    clearTimeout(minuterieErreur.current);
    minuterieErreur.current = setTimeout(() => setError(null), 6000);
  }, []);
  useEffect(() => () => clearTimeout(minuterieErreur.current), []);

  // Réf toujours à jour du tableau courant. Lire l'état depuis un updater
  // setState n'est pas fiable — React peut différer son exécution, et
  // <React.StrictMode> la double en développement. On lit donc l'instantané
  // ICI, hors de setBoard, exactement comme le fait déjà handleDragEnd.
  const boardRef = useRef(null);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Recharge le projet depuis la source de vérité. Filet utilisé quand un
  // retour arrière exact n'est plus possible (d'autres mutations ont suivi).
  // L'identifiant est CELUI capturé au moment de la mutation : l'utilisateur
  // a pu changer de projet entre-temps.
  const resynchroniserBoard = useCallback(async (boardId) => {
    if (!boardId) return;
    try {
      const frais = await chargerBoard(boardId);
      boardRef.current = frais;
      setBoard(frais);
    } catch {
      /* la resynchronisation est un filet : son échec ne doit rien casser */
    }
  }, []);

  // Variante pour les états de liste hors `board` (raccourcis, équipes…).
  const optimisteListe = useCallback(
    async (setEtat, instantane, mutator, apiCall, secours) => {
      setEtat(mutator(instantane));
      try {
        return await apiCall();
      } catch (e) {
        setEtat(instantane); // retour arrière
        signalerErreur(e, secours);
        return undefined;
      }
    },
    [signalerErreur]
  );

  // Applique une transformation locale immédiate, lance l'appel API, et
  // restaure l'état précédent en cas d'échec.
  //
  // `mutator` reçoit un CLONE de l'état et renvoie l'état suivant.
  // Renvoie le résultat de l'appel API, ou undefined si celui-ci a échoué.
  const optimistic = useCallback(
    async (mutator, apiCall, secours = 'Échec de la synchronisation') => {
      const instantane = boardRef.current;
      if (!instantane) return undefined;
      const idProjet = instantane.id;

      const suivant = mutator(structuredClone(instantane));
      boardRef.current = suivant; // avant setBoard : deux mutations dans le
      setBoard(suivant); //         même tick partent alors du bon état.

      try {
        return await apiCall();
      } catch (e) {
        if (boardRef.current === suivant) {
          // Personne n'a touché au tableau depuis : retour arrière exact.
          boardRef.current = instantane;
          setBoard(instantane);
        } else {
          // D'autres mutations ont suivi ; restaurer l'instantané les
          // effacerait. On repart donc de la source de vérité.
          await resynchroniserBoard(idProjet);
        }
        signalerErreur(e, secours);
        return undefined;
      }
    },
    [resynchroniserBoard, signalerErreur]
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
  const handleDeleteShortcut = (id) =>
    optimisteListe(
      setShortcuts,
      shortcuts,
      (prev) => prev.filter((s) => s.id !== id),
      () => api.deleteShortcut(id),
      'Suppression du raccourci impossible'
    );
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
    // Rafraîchit les compteurs de messages non lus pour la synthèse.
    loadCommentCounts();
  };
  // Ouvre la vue agent (tâches affectées + classement des priorités).
  const handleOpenAgent = (user) => {
    setAgentViewUser(user);
    setView('agent');
  };
  // Ouvre la fiche d'une tâche depuis une vue multi-projets (« Mes tâches ») :
  // il faut d'abord charger SON projet, sinon la fiche afficherait les groupes
  // et le circuit d'un autre tableau.
  const handleOpenTaskFromBoard = async (task) => {
    if (task?._boardId && task._boardId !== currentBoardId) {
      await handleSelectProject(task._boardId);
    }
    setDetailTask(task);
  };
  // Ouvre directement la discussion d'une tâche depuis un message de la vue
  // d'ensemble (charge le bon projet si nécessaire).
  const handleOpenMessage = async (h) => {
    try {
      let b = board;
      if (h.board_id && h.board_id !== currentBoardId) {
        b = await chargerBoard(h.board_id);
        setBoard(b);
        setCurrentBoardId(h.board_id);
      }
      setView('board');
      const task = (b?.groups || []).flatMap((g) => g.tasks).find((t) => t.id === h.task_id);
      if (task) setDrawerTask(task);
    } catch (e) {
      signalerErreur(e, "Impossible d'ouvrir la discussion");
    }
  };
  // Marque comme lues les discussions correspondant aux messages indiqués.
  const handleMarkHighlightsRead = async (taskIds) => {
    const ids = [...new Set(taskIds)];
    await Promise.all(
      ids.map((id) => api.markCommentsRead(id, CURRENT_USER_ID).catch(() => {}))
    );
    loadCommentCounts();
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
      const b = await chargerBoard(id);
      setBoard(b);
      setCurrentBoardId(id);
      setTeamView(null);
      setView('board');
    } catch (e) {
      signalerErreur(e, 'Impossible de charger le projet');
    }
  };

  // Recharge la liste des projets actifs + archivés.
  const refreshBoards = async () => {
    const all = await api.getBoards({ include_archived: true }).catch(() => null);
    if (!all) return;
    setBoards(all.filter((b) => !b.archived));
    setArchivedBoards(all.filter((b) => b.archived));
  };

  // Ouvre la modale de création de projet.
  const handleNewProject = () => setProjectModal({ mode: 'create', project: null });
  // Ouvre la modale de personnalisation du projet courant.
  const handleCustomizeProject = (project) =>
    setProjectModal({ mode: 'edit', project: project || board });

  // Création ou personnalisation (nom / couleur / vignette).
  const handleSubmitProject = async ({ name, color, icon }) => {
    if (projectModal?.mode === 'edit') {
      const id = projectModal.project.id;
      const updated = await api.updateBoard(id, { name, color, icon });
      await refreshBoards();
      if (id === currentBoardId) setBoard((b) => (b ? { ...b, ...updated } : b));
    } else {
      const created = await api.createBoard({
        name,
        color,
        icon,
        workspace_id: board?.workspace_id || 1,
        created_by: CURRENT_USER_ID,
      });
      await refreshBoards();
      const b = await chargerBoard(created.id);
      setBoard(b);
      setCurrentBoardId(created.id);
      setNoProjects(false); // on sort de l'écran « aucun projet »
      setView('board');
    }
  };

  // Archive / désarchive un projet (admin).
  const handleArchiveProject = async (id, archived = true) => {
    try {
      await api.updateBoard(id, { archived });
      await refreshBoards();
      // Si on archive le projet courant, bascule sur un autre projet actif.
      if (archived && id === currentBoardId) {
        const next = (await api.getBoards().catch(() => [])).find((b) => b.id !== id);
        if (next) {
          const b = await chargerBoard(next.id);
          setBoard(b);
          setCurrentBoardId(next.id);
          setView('overview');
        } else {
          // Dernier projet actif archivé : recharge (un projet « Suivi »
          // sera recréé automatiquement si besoin).
          window.location.reload();
        }
      }
    } catch (e) {
      signalerErreur(e, "Impossible d'archiver le projet");
    }
  };

  // Supprime définitivement un projet (admin uniquement).
  const handleDeleteProject = async (id) => {
    if (!confirm('Supprimer définitivement ce projet et toutes ses tâches ? Action irréversible.'))
      return;
    try {
      await api.deleteBoard(id);
      await refreshBoards();
      if (id === currentBoardId) {
        const next = (await api.getBoards().catch(() => [])).find((b) => b.id !== id);
        if (next) {
          const b = await chargerBoard(next.id);
          setBoard(b);
          setCurrentBoardId(next.id);
          setView('overview');
        } else {
          // Dernier projet supprimé : bascule sur l'écran « aucun projet ».
          // Surtout PAS de rechargement : l'effet de démarrage recréerait
          // aussitôt un projet « Suivi », et la suppression semblerait échouer.
          setBoard(null);
          setCurrentBoardId(null);
          setNoProjects(true);
        }
      }
    } catch (e) {
      signalerErreur(e, 'Suppression impossible (réservée aux administrateurs)');
    }
  };
  const handleOpenDirectory = () => {
    setTeamSection('directory');
    setView('teams');
  };
  // Définit les équipes associées au projet courant (table project_teams).
  const handleSetBoardTeams = async (teamIds) => {
    await api.setBoardTeams(board.id, teamIds);
    const fresh = await chargerBoard(board.id);
    setBoard(fresh);
    // Met à jour la liste « projets associés » de chaque équipe.
    api.getTeams().then(setTeams).catch(() => {});
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

  const handleAddTeam = async (name, description) => {
    const created = await api.createTeam({ name, description });
    setTeams((prev) => [...prev, created]);
    return created;
  };
  const handleUpdateTeam = async (teamId, patch) => {
    const updated = await api.updateTeam(teamId, patch);
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, ...updated } : t))
    );
    // Répercute le renommage sur les équipes impliquées du board courant.
    setBoard((b) =>
      b && b.teams
        ? { ...b, teams: b.teams.map((t) => (t.id === teamId ? { ...t, ...updated } : t)) }
        : b
    );
    return updated;
  };
  const handleDeleteTeam = async (teamId) => {
    await api.deleteTeam(teamId);
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
    setBoard((b) =>
      b && b.teams ? { ...b, teams: b.teams.filter((t) => t.id !== teamId) } : b
    );
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
  const handleDeleteTag = (tagId) =>
    optimistic(
      (b) => {
        b.tags = (b.tags || []).filter((t) => t.id !== tagId);
        // Le serveur remet les clés étrangères à NULL (ON DELETE SET NULL) :
        // sans ce détachement local, l'état garderait des étiquettes fantômes
        // jusqu'au prochain rechargement.
        for (const g of b.groups || [])
          for (const t of g.tasks) {
            if (t.etape_tag_id === tagId) t.etape_tag_id = null;
            if (t.intervention_tag_id === tagId) t.intervention_tag_id = null;
            for (const st of t.subtasks || []) {
              if (st.etape_tag_id === tagId) st.etape_tag_id = null;
              if (st.intervention_tag_id === tagId) st.intervention_tag_id = null;
            }
          }
        return b;
      },
      () => api.deleteTag(tagId),
      "Suppression de l'étiquette impossible"
    );

  // -------- Circuit d'intervention (étapes / sous-étapes) --------
  const handleCreateStep = async (name, color, parent_id = null) => {
    const created = await api.createStep(board.id, { name, color, parent_id });
    setBoard((b) => ({ ...b, steps: [...(b.steps || []), created] }));
    return created;
  };

  const handleUpdateStep = (stepId, patch) =>
    optimistic(
      (b) => ({
        ...b,
        steps: (b.steps || []).map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
      }),
      () => api.updateStep(stepId, patch),
      "Échec de la modification de l'étape"
    );

  const handleDeleteStep = (stepId) => {
    // La suppression est en cascade côté serveur : sous-étapes, franchissements
    // et rattachements des tâches. On reproduit exactement le même effet.
    const supprimes = new Set([stepId]);
    for (const s of board.steps || []) if (s.parent_id === stepId) supprimes.add(s.id);
    return optimistic(
      (b) => ({
        ...b,
        steps: (b.steps || []).filter((s) => !supprimes.has(s.id)),
        stepProgress: (b.stepProgress || []).filter((p) => !supprimes.has(p.step_id)),
        groups: (b.groups || []).map((g) => ({
          ...g,
          tasks: g.tasks.map((t) => ({
            ...t,
            step_id: supprimes.has(t.step_id) ? null : t.step_id,
            subtasks: (t.subtasks || []).map((s) => ({
              ...s,
              step_id: supprimes.has(s.step_id) ? null : s.step_id,
            })),
          })),
        })),
      }),
      () => api.deleteStep(stepId),
      "Échec de la suppression de l'étape"
    );
  };

  const handleReorderSteps = (items) => {
    const parIds = new Map(items.map((it) => [it.id, it]));
    return optimistic(
      (b) => ({
        ...b,
        steps: (b.steps || []).map((s) =>
          parIds.has(s.id)
            ? { ...s, parent_id: parIds.get(s.id).parent_id, position: parIds.get(s.id).position }
            : s
        ),
      }),
      () => api.reorderSteps(items),
      'Échec du réordonnancement des étapes'
    );
  };

  // Étape courante d'une tâche.
  const handleSetTaskStep = (taskId, stepId) =>
    optimistic(
      (b) => patchTaskLocal(b, taskId, { step_id: stepId }),
      () => api.updateTask(taskId, { step_id: stepId })
    );

  // Franchissement d'une étape par une tâche (traçabilité qui / quand).
  const handleToggleTaskStep = async (taskId, stepId, completed) => {
    const snapshot = board;
    setBoard((b) => {
      const autres = (b.stepProgress || []).filter(
        (p) => !(p.task_id === taskId && p.step_id === stepId)
      );
      return {
        ...b,
        stepProgress: completed
          ? [
              ...autres,
              {
                task_id: taskId,
                step_id: stepId,
                completed_at: new Date().toISOString(),
                completed_by: CURRENT_USER_ID,
              },
            ]
          : autres,
      };
    });
    try {
      await api.setStepProgress(taskId, stepId, completed, CURRENT_USER_ID);
    } catch (e) {
      setBoard(snapshot);
      signalerErreur(e, "Échec de l'enregistrement du franchissement");
    }
  };

  // Multi-assignation d'une tâche.
  const handleSetTaskAssignees = (taskId, userIds) => {
    const shaped = userIds.map((id) => users.find((u) => u.id === id)).filter(Boolean);
    optimistic(
      (b) => patchTaskLocal(b, taskId, { assignees: shaped, admin: shaped[0] || null }),
      () => api.setTaskAssignees(taskId, userIds, actor.actor_id)
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
      signalerErreur(e);
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
      signalerErreur('Vous n’êtes pas autorisé à supprimer cette tâche.');
      return false;
    }
    if (!confirm(`Supprimer la tâche « ${task?.name || ''} » ?`)) return false;
    optimistic(
      (b) => {
        for (const g of b.groups) g.tasks = g.tasks.filter((t) => t.id !== taskId);
        return b;
      },
      () => api.deleteTask(taskId),
      'Suppression impossible (réservée aux administrateurs)'
    );
    // Renvoie si la suppression a bien été lancée : la fenêtre de tâche s'en
    // sert pour ne se fermer qu'en cas de confirmation.
    return true;
  };

  // Archive / désarchive une tâche. Ouvert aux éditeurs : une tâche créée par
  // erreur doit pouvoir être rangée sans attendre un administrateur — seule la
  // SUPPRESSION définitive reste réservée aux admins.
  const handleArchiveTask = (taskId, archived = true) =>
    optimistic(
      (b) => {
        for (const g of b.groups) {
          // La liste ne montre que les tâches actives : archiver = retirer.
          if (archived) g.tasks = g.tasks.filter((t) => t.id !== taskId);
          else for (const t of g.tasks) if (t.id === taskId) t.archived = false;
        }
        return b;
      },
      () => api.updateTask(taskId, { archived, ...actor }),
      archived ? "Archivage impossible" : 'Restauration impossible'
    );

  // Bascule l'affichage des tâches archivées : le filtrage est fait par le
  // serveur (et à l'identique par le mock), donc il faut recharger le projet.
  const handleToggleArchived = async () => {
    const suivant = !showArchived;
    setShowArchived(suivant);
    showArchivedRef.current = suivant;
    if (!currentBoardId && !board) return;
    try {
      const frais = await chargerBoard(currentBoardId ?? board.id);
      setBoard(frais);
    } catch (e) {
      // Retour arrière : l'affichage doit refléter ce qui est réellement chargé.
      setShowArchived(!suivant);
      showArchivedRef.current = !suivant;
      signalerErreur(e, 'Impossible de charger les tâches archivées');
    }
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
      // La fiche a pu être ouverte AVANT la réponse du serveur (fréquent au
      // doigt, et sur une API qui se réveille) : elle pointerait alors un id
      // temporaire, et toutes ses actions échoueraient en silence. On la
      // recale sur la tâche réelle.
      setDetailTask((t) => (t && t.id === tempId ? created : t));
      setDrawerTask((t) => (t && t.id === tempId ? created : t));
    } catch (e) {
      setBoard((b) => {
        const next = structuredClone(b);
        const g = next.groups.find((x) => x.id === groupId);
        g.tasks = g.tasks.filter((t) => t.id !== tempId);
        return next;
      });
      // La tâche n'existe plus : ne pas laisser une fiche ouverte dessus.
      setDetailTask((t) => (t && t.id === tempId ? null : t));
      setDrawerTask((t) => (t && t.id === tempId ? null : t));
      signalerErreur(e);
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
      signalerErreur(e);
    }
  };

  const handleDeleteSubtask = (subId) =>
    optimistic(
      (b) => {
        for (const g of b.groups)
          for (const t of g.tasks)
            if (t.subtasks) t.subtasks = t.subtasks.filter((s) => s.id !== subId);
        return b;
      },
      () => api.deleteSubtask(subId),
      'Suppression du sous-item impossible'
    );

  // Renommage du projet courant. Handler nommé plutôt qu'appel dans le JSX :
  // il n'existe aujourd'hui que dans la branche bureau, et un handler nommé
  // est prêt à être branché sur mobile sans dupliquer la logique.
  const handleRenameBoard = (name) =>
    optimistic(
      (b) => ({ ...b, name }),
      async () => {
        const maj = await api.updateBoard(board.id, { name });
        await refreshBoards();
        return maj;
      },
      'Renommage du projet impossible'
    );

  // -------- Catégories / colonnes personnalisées --------
  const handleCreateCategory = async (name, type) => {
    const created = await api.createCategory(board.id, { name, type });
    setBoard((b) => ({ ...b, categories: [...(b.categories || []), created] }));
  };

  const handleDeleteCategory = (catId) =>
    optimistic(
      (b) => ({
        ...b,
        categories: (b.categories || []).filter((c) => c.id !== catId),
        categoryValues: (b.categoryValues || []).filter((v) => v.category_id !== catId),
      }),
      () => api.deleteCategory(catId),
      'Suppression de la colonne impossible'
    );


  const handleSetCategoryValue = (categoryId, taskId, value) =>
    optimistic(
      (b) => {
        b.categoryValues = b.categoryValues || [];
        const existing = b.categoryValues.find(
          (v) => v.category_id === categoryId && v.task_id === taskId
        );
        if (existing) existing.value = value;
        else b.categoryValues.push({ category_id: categoryId, task_id: taskId, value });
        return b;
      },
      () => api.setCategoryValue({ category_id: categoryId, task_id: taskId, value }),
      'Enregistrement de la valeur impossible'
    );

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
        signalerErreur(e, 'Échec de la mise à jour');
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
    const fresh = await chargerBoard(board.id);
    setBoard(fresh);
  };

  const handleDeleteDependency = (depId) =>
    optimistic(
      (b) => ({ ...b, dependencies: (b.dependencies || []).filter((d) => d.id !== depId) }),
      () => api.deleteDependency(depId),
      'Suppression de la dépendance impossible'
    );

  // -------- Handlers groupes --------
  const handleAddGroup = async () => {
    const name = 'Nouveau groupe';
    const color = GROUP_COLORS[board.groups.length % GROUP_COLORS.length];
    try {
      const created = await api.createGroup({ board_id: board.id, name, color });
      setBoard((b) => ({ ...b, groups: [...b.groups, created] }));
    } catch (e) {
      signalerErreur(e);
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
  const handleAddUser = async ({ name, email, role, password, avatar_url }) => {
    const created = await api.createUser({ name, email, role, password, avatar_url });
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
    const shaped = { id: updated.id, name: updated.name, avatar_url: updated.avatar_url };
    setBoard((b) => {
      if (!b) return b;
      const next = structuredClone(b);
      for (const g of next.groups) {
        for (const t of g.tasks) {
          if (t.admin?.id === id) t.admin = shaped;
          if (t.assignees) t.assignees = t.assignees.map((a) => (a.id === id ? shaped : a));
          for (const s of t.subtasks || []) {
            if (s.admin?.id === id) s.admin = shaped;
            if (s.assignees) s.assignees = s.assignees.map((a) => (a.id === id ? shaped : a));
          }
        }
      }
      return next;
    });
    // Si l'utilisateur modifie son propre profil, rafraîchit l'en-tête.
    if (id === CURRENT_USER_ID) {
      onUpdateCurrentUser?.({
        name: updated.name,
        email: updated.email,
        avatar_url: updated.avatar_url,
        role: updated.role,
      });
    }
    return updated;
  };

  const handleDeleteUser = async (id) => {
    await api.deleteUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    // Désassigne ce membre des tâches ET des sous-items (admin + assignés),
    // comme le fait handleUpdateUser pour un changement de profil.
    setBoard((b) => {
      if (!b) return b;
      const next = structuredClone(b);
      for (const g of next.groups) {
        for (const t of g.tasks) {
          if (t.assignees) t.assignees = t.assignees.filter((a) => a.id !== id);
          if (t.admin?.id === id) t.admin = t.assignees?.[0] || null;
          for (const s of t.subtasks || []) {
            if (s.assignees) s.assignees = s.assignees.filter((a) => a.id !== id);
            if (s.admin?.id === id) s.admin = s.assignees?.[0] || null;
          }
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

    // L'état suivant est calculé HORS de setBoard : lire une variable
    // renseignée dans l'updater ne fonctionne que si React l'exécute
    // immédiatement, ce qui n'est pas garanti.
    const snapshot = board;
    if (!snapshot) return;
    const next = structuredClone(snapshot);
    const [moved] = next.groups.splice(source.index, 1);
    if (!moved) return;
    next.groups.splice(destination.index, 0, moved);
    next.groups.forEach((g, i) => {
      g.position = i;
    });
    const payload = next.groups.map((g) => ({ id: g.id, position: g.position }));

    setBoard(next);
    api.reorderGroups(payload).catch((e) => {
      setBoard(snapshot);
      signalerErreur(e, 'Échec du déplacement du groupe');
    });
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

    // L'état suivant est calculé HORS de setBoard (voir handleGroupDragEnd).
    const snapshot = board;
    if (!snapshot) return;
    const next = structuredClone(snapshot);
    const fromGroup = next.groups.find((g) => g.id === fromGroupId);
    const toGroup = next.groups.find((g) => g.id === toGroupId);
    if (!fromGroup || !toGroup) return;

    // Retire la tâche de sa position d'origine
    const [moved] = fromGroup.tasks.splice(source.index, 1);
    if (!moved || moved.id !== taskId) return; // index et tâche doivent coïncider
    moved.group_id = toGroupId;

    // Insère à la position cible
    toGroup.tasks.splice(destination.index, 0, moved);

    // Recalcule les positions des groupes affectés
    const affected = new Set([fromGroupId, toGroupId]);
    const payload = [];
    for (const g of next.groups) {
      if (!affected.has(g.id)) continue;
      g.tasks.forEach((t, i) => {
        t.position = i;
        payload.push({ id: t.id, group_id: g.id, position: i });
      });
    }

    // Persistance optimiste : l'UI d'abord, rollback si échec.
    setBoard(next);
    api.reorderTasks(payload).catch((e) => {
      setBoard(snapshot);
      signalerErreur(e, 'Échec du déplacement');
    });
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

  // Défilement horizontal synchronisé entre tous les groupes du tableau :
  // chaque conteneur scrollable s'enregistre et recopie sa position aux autres.
  const scrollersRef = useRef([]);
  const syncingScroll = useRef(false);
  const registerScroller = useCallback((node) => {
    if (!node || scrollersRef.current.includes(node)) return;
    scrollersRef.current.push(node);
    node.addEventListener('scroll', () => {
      if (syncingScroll.current) return;
      syncingScroll.current = true;
      scrollersRef.current = scrollersRef.current.filter((n) => n.isConnected);
      for (const other of scrollersRef.current) {
        if (other !== node && other.scrollLeft !== node.scrollLeft) {
          other.scrollLeft = node.scrollLeft;
        }
      }
      syncingScroll.current = false;
    });
  }, []);

  // Agents impliqués dans le projet : membres des équipes associées + toute
  // personne affectée à une tâche/sous-tâche (admin ou assigné).
  const involvedAgents = useMemo(() => {
    const map = new Map();
    const add = (u) => {
      if (u && u.id != null && !map.has(u.id)) {
        map.set(u.id, { id: u.id, name: u.name, avatar_url: u.avatar_url });
      }
    };
    for (const t of board?.teams || []) for (const m of t.members || []) add(m);
    for (const g of board?.groups || [])
      for (const tk of g.tasks || []) {
        add(tk.admin);
        for (const a of tk.assignees || []) add(a);
        for (const s of tk.subtasks || []) {
          add(s.admin);
          for (const a of s.assignees || []) add(a);
        }
      }
    return [...map.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [board]);

  // Le drag n'a de sens que sur l'ordre "naturel" : on le désactive quand
  // un tri, une recherche ou un filtre modifie l'ordre/visibilité affiché
  // (sinon les index de la liste filtrée déplaceraient la mauvaise tâche).
  const dragEnabled =
    !sortBy &&
    !search.trim() &&
    !personFilter &&
    !statusFilter &&
    showDone &&
    !etapeFilter &&
    !interventionFilter &&
    // Le regroupement par étape repartitionne les lignes : les index affichés
    // ne correspondent plus à group.tasks, sur lequel raisonne handleDragEnd.
    !groupByStep;

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
            data.cell.styles.textColor = hexToRgb(meta.text);
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 4) {
          const meta = PRIORITY_META[data.cell.raw];
          if (meta) {
            data.cell.styles.fillColor = hexToRgb(meta.bg);
            data.cell.styles.textColor = hexToRgb(meta.text);
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
    // Écran fantôme plutôt qu'un simple texte : la mise en page ne saute pas
    // à l'arrivée des données et l'attente paraît plus courte.
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <SqueletteVue />
        <AnnonceChargement>Chargement de votre espace de travail…</AnnonceChargement>
      </div>
    );
  }

  // Aucun projet accessible : base neuve vue par un observateur, ou dernier
  // projet supprimé. Écran neutre plutôt qu'une erreur rouge — et une porte de
  // sortie pour qui a le droit de créer.
  if (noProjects && !board) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
        <div className="text-lg font-semibold text-primary">Aucun projet pour le moment</div>
        <p className="max-w-sm text-sm text-gray-500">
          {canEdit
            ? 'Créez un projet pour commencer.'
            : "Un administrateur ou un membre doit créer le premier projet. Actualisez la page une fois que c'est fait."}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {canEdit && (
            <button
              onClick={handleNewProject}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <Plus size={16} /> Créer un projet
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              canEdit
                ? 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                : 'bg-primary text-white hover:bg-primary-hover'
            }`}
          >
            Actualiser
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Se déconnecter
          </button>
        </div>
        {/* Modale de création : cet écran précède les branches mobile/bureau,
            elle doit donc être montée ici aussi. */}
        {projectModal && (
          <ProjectModal
            mode={projectModal.mode}
            project={projectModal.project}
            onClose={() => setProjectModal(null)}
            onSubmit={handleSubmitProject}
          />
        )}
      </div>
    );
  }

  if (error && !board) {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas text-status-blocked">
        {error}
      </div>
    );
  }

  // ---------- Layout MOBILE (< 768px) ----------
  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
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
                archivedProjects={archivedBoards}
                onRestoreProject={(id) => handleArchiveProject(id, false)}
                onDeleteProject={handleDeleteProject}
                isAdmin={isAdmin}
                view={view}
                onSelectView={(v) => {
                  setView(v);
                  setMenuOpen(false);
                }}
                involvedTeams={board.teams || []}
                involvedAgents={involvedAgents}
                allTeams={teams}
                onSetInvolvedTeams={handleSetBoardTeams}
                teamView={teamView}
                onSelectTeamView={(id, s) => {
                  handleSelectTeamView(id, s);
                  setMenuOpen(false);
                }}
                onOpenAgent={(a) => {
                  handleOpenAgent(a);
                  setMenuOpen(false);
                }}
                onOpenOverview={() => {
                  handleOpenOverview();
                  setMenuOpen(false);
                }}
                onOpenMyTasks={() => {
                  handleOpenAgent(currentUser);
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
                onSelectRail={(rail) => {
                  setActiveRail(rail);
                  setMenuOpen(false);
                }}
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

        {/* Panneau du rail (agents, étiquettes, circuit d'intervention).
            En plein écran sur mobile : sans lui, la configuration des étapes
            et des étiquettes n'était atteignable que depuis un ordinateur. */}
        {activeRail !== 'Espaces' && (
          <RailPanel
            rail={activeRail}
            variante="mobile"
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onSetPassword={handleSetPassword}
            tags={board.tags || []}
            canManage={canManageBoard}
            onCreateTag={handleCreateTag}
            onDeleteTag={handleDeleteTag}
            steps={board.steps || []}
            canDeleteStep={isAdmin}
            onCreateStep={handleCreateStep}
            onUpdateStep={handleUpdateStep}
            onDeleteStep={handleDeleteStep}
            onReorderSteps={handleReorderSteps}
            onClose={() => setActiveRail('Espaces')}
          />
        )}

        {/* Bandeau d'erreur global (visible quelle que soit la vue mobile) */}
        <BandeauErreur message={error} onFermer={() => setError(null)} />

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
              steps={board.steps || []}
              groupByStep={groupByStep}
              onToggleGroupByStep={() => setViewPref('groupByStep', !groupByStep)}
              showArchived={showArchived}
              onToggleArchived={handleToggleArchived}
              onOpenProjectMenu={() => setProjectMenuOpen(true)}
            />
            <div className="overflow-x-auto">
              <BoardTabs active={boardView} onChange={setBoardView} />
            </div>
            {boardView === 'table' && (
              <MobileBoard
                board={board}
                users={users}
                filterFn={filterFn}
                tags={board.tags || []}
                steps={board.steps || []}
                groupByStep={groupByStep}
                commentCounts={commentCounts}
                onOpenComments={(t) => setDrawerTask(t)}
                onOpenDetail={(t) => setDetailTask(t)}
                onChangeStatus={handleChangeStatus}
                onAssign={handleAssign}
                onAddTask={(gid) => handleAddTask(gid, 'Nouvelle tâche')}
              />
            )}
            {/* Kanban et Calendrier sont chargés à la demande : sans cette
                frontière, React lève « A component suspended while responding
                to synchronous input » au changement d'onglet (la branche
                bureau, elle, les rend déjà dans son propre <Suspense>). */}
            {boardView === 'kanban' && (
              <Suspense fallback={<><SqueletteVue variant="cards" /><AnnonceChargement /></>}>
                <div className="flex-1 overflow-auto pb-20">
                  <KanbanView
                    board={board}
                    filterFn={filterFn}
                    canEdit={canEdit}
                    commentCounts={commentCounts}
                    onChangeStatus={handleChangeStatus}
                    onOpenTask={(t) => setDetailTask(t)}
                    onAddTask={() =>
                      board.groups[0] && handleAddTask(board.groups[0].id, 'Nouvelle tâche')
                    }
                  />
                </div>
              </Suspense>
            )}
            {boardView === 'calendar' && (
              <Suspense fallback={<><SqueletteVue variant="cards" /><AnnonceChargement /></>}>
                <div className="flex flex-1 flex-col overflow-hidden pb-20">
                  <CalendarView
                    board={board}
                    filterFn={filterFn}
                    canEdit={canEdit}
                    onOpenTask={(t) => setDetailTask(t)}
                    onChangeDate={handleChangeDate}
                    onAddTaskOnDate={handleCreateTaskOnDate}
                  />
                </div>
              </Suspense>
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
                  : view === 'agent'
                  ? "Tâches de l'agent"
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
              <Suspense fallback={<><SqueletteVue /><AnnonceChargement /></>}>
              {view === 'overview' && (
                <OverviewView
                  boards={boards}
                  loadFull={(id) => api.getBoard(id)}
                  onOpenProject={(id) => {
                    handleSelectProject(id);
                  }}
                  unreadCounts={commentCounts}
                  currentUserId={CURRENT_USER_ID}
                  loadHighlights={() => api.getCommentHighlights(CURRENT_USER_ID)}
                  onOpenMessage={(h) => {
                    handleOpenMessage(h);
                  }}
                  onMarkAllRead={handleMarkHighlightsRead}
                />
              )}
              {view === 'agent' && (
                <AgentView
                  agent={agentViewUser}
                  boards={boards}
                  loadFull={(id) => api.getBoard(id)}
                  onBack={handleOpenDirectory}
                  onOpenProject={(id) => handleSelectProject(id)}
                  onOpenTask={handleOpenTaskFromBoard}
                />
              )}
              {view === 'gantt' && (
                <GanttChartView
                  board={board}
                  onUpdateTask={handleUpdateTaskDates}
                  onCreateTask={handleCreateTaskFull}
                  onAddDependency={handleAddDependency}
                  onDeleteDependency={handleDeleteDependency}
                  onOpenTask={(t) => setDetailTask(t)}
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
              {view === 'workload' && (
                <TeamWorkloadView board={board} users={users} onOpenTask={(t) => setDetailTask(t)} />
              )}
              {view === 'team-project' &&
                (() => {
                  const [tid, section] = (teamView || '').split(':');
                  const team = (board.teams || []).find((t) => String(t.id) === tid);
                  return team ? (
                    <TeamProjectView
                      board={board}
                      team={team}
                      section={section}
                      onOpenTask={(t) => setDetailTask(t)}
                    />
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
                  onUpdateTeam={handleUpdateTeam}
                  onDeleteTeam={handleDeleteTeam}
                  onAddTeamMembers={handleAddTeamMembers}
                  onUpdateMemberRole={handleUpdateMemberRole}
                  onRemoveTeamMember={handleRemoveTeamMember}
                  canManageAgents={isAdmin}
                  currentUserId={CURRENT_USER_ID}
                  onAddUser={handleAddUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  onSetPassword={handleSetPassword}
                  onOpenAgent={(u) => {
                    handleOpenAgent(u);
                    setMenuOpen(false);
                  }}
                />
              )}
              </Suspense>
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
              steps={board.steps || []}
              stepProgress={board.stepProgress || []}
              onSetTaskStep={handleSetTaskStep}
              onToggleTaskStep={handleToggleTaskStep}
              commentCount={commentCounts[live.id] || 0}
              onOpenComments={() => setDrawerTask(live)}
              onCreateSubtask={handleCreateSubtask}
              onUpdateSubtask={handleUpdateSubtask}
              onDeleteSubtask={handleDeleteSubtask}
              canDelete={canDeleteTask(live)}
              isAdmin={isAdmin}
              onArchive={(archived) => {
                handleArchiveTask(live.id, archived);
                setDetailTask(null);
              }}
              onDelete={() => {
                if (handleDeleteTask(live.id)) setDetailTask(null);
              }}
            />
          );
        })()}
        {/* Actions du projet — pendant mobile du menu de BoardHeader (bureau).
            Montée à la demande : l'état interne (renommage) repart propre à
            chaque ouverture et suit le projet courant. */}
        {projectMenuOpen && (
          <ProjectActionsSheet
            open
            onClose={() => setProjectMenuOpen(false)}
            boardName={board.name}
            canEdit={canEdit}
            canManage={canManageBoard}
            isAdmin={isAdmin}
            onRename={handleRenameBoard}
            onCustomize={() => handleCustomizeProject(board)}
            onArchive={() => handleArchiveProject(board.id, true)}
            onDelete={() => handleDeleteProject(board.id)}
          />
        )}
        {projectModal && (
          <ProjectModal
            mode={projectModal.mode}
            project={projectModal.project}
            onClose={() => setProjectModal(null)}
            onSubmit={handleSubmitProject}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <div className="contents no-print">
        <Sidebar
          workspaceName="Espace de travail principal"
          projects={boards.length ? boards : [{ id: board.id, name: board.name }]}
          selectedProjectId={currentBoardId ?? board.id}
          onSelectProject={handleSelectProject}
          onNewBoard={handleNewProject}
          archivedProjects={archivedBoards}
          onRestoreProject={(id) => handleArchiveProject(id, false)}
          onDeleteProject={handleDeleteProject}
          isAdmin={isAdmin}
          view={view}
          onSelectView={setView}
          involvedTeams={board.teams || []}
          involvedAgents={involvedAgents}
          allTeams={teams}
          onSetInvolvedTeams={handleSetBoardTeams}
          teamView={teamView}
          onSelectTeamView={handleSelectTeamView}
          onOpenAgent={handleOpenAgent}
          onOpenOverview={handleOpenOverview}
          onOpenMyTasks={() => handleOpenAgent(currentUser)}
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
            steps={board.steps || []}
            canDeleteStep={isAdmin}
            onCreateStep={handleCreateStep}
            onUpdateStep={handleUpdateStep}
            onDeleteStep={handleDeleteStep}
            onReorderSteps={handleReorderSteps}
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

        {/* Bandeau d'erreur unique de la branche bureau : il était auparavant
            dupliqué cinq fois et absent des vues Vue d'ensemble, Agent et
            Équipes, où une erreur passait donc totalement inaperçue. */}
        <BandeauErreur message={error} onFermer={() => setError(null)} />

        <Suspense fallback={<><SqueletteVue /><AnnonceChargement /></>}>
        {view === 'agent' ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                Tâches de l'agent
              </h2>
            </div>
            <AgentView
              agent={agentViewUser}
              boards={boards}
              loadFull={(id) => api.getBoard(id)}
              onBack={handleOpenDirectory}
              onOpenProject={handleSelectProject}
              onOpenTask={handleOpenTaskFromBoard}
            />
          </>
        ) : view === 'overview' ? (
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
              unreadCounts={commentCounts}
              currentUserId={CURRENT_USER_ID}
              loadHighlights={() => api.getCommentHighlights(CURRENT_USER_ID)}
              onOpenMessage={handleOpenMessage}
              onMarkAllRead={handleMarkHighlightsRead}
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
              onUpdateTeam={handleUpdateTeam}
              onDeleteTeam={handleDeleteTeam}
              onAddTeamMembers={handleAddTeamMembers}
              onUpdateMemberRole={handleUpdateMemberRole}
              onRemoveTeamMember={handleRemoveTeamMember}
              canManageAgents={isAdmin}
              currentUserId={CURRENT_USER_ID}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onSetPassword={handleSetPassword}
              onOpenAgent={handleOpenAgent}
            />
          </>
        ) : view === 'timeline' ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                Planning dynamique
              </h2>
            </div>
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
            <GanttChartView
              board={board}
              onUpdateTask={handleUpdateTaskDates}
              onCreateTask={handleCreateTaskFull}
              onAddDependency={handleAddDependency}
              onDeleteDependency={handleDeleteDependency}
              onOpenTask={(t) => setDetailTask(t)}
            />
          </>
        ) : view === 'reporting' ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 pt-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-gray-800">
                Tableau de bord et reporting
              </h2>
            </div>
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
                  <TeamProjectView
                    board={board}
                    team={team}
                    section={section}
                    onOpenTask={(t) => setDetailTask(t)}
                  />
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
            <TeamWorkloadView board={board} users={users} onOpenTask={(t) => setDetailTask(t)} />
          </>
        ) : (
          <>
            <BoardHeader
              title={board.name}
              boardColor={board.color}
              boardIcon={board.icon}
              canManage={canManageBoard}
              isAdmin={isAdmin}
              onCustomizeProject={() => handleCustomizeProject(board)}
              onArchiveProject={() => handleArchiveProject(board.id, true)}
              onDeleteProject={() => handleDeleteProject(board.id)}
              onRenameBoard={(name) => {
                setBoard((b) => ({ ...b, name }));
                handleRenameBoard(name);
              }}
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
              showArchived={showArchived}
              onToggleArchived={handleToggleArchived}
              onExportCsv={handleExportCsv}
              onExportPdf={handleExportPdf}
              onPrint={handlePrint}
              tags={board.tags || []}
              etapeFilter={etapeFilter}
              onEtapeFilter={setEtapeFilter}
              interventionFilter={interventionFilter}
              onInterventionFilter={setInterventionFilter}
              steps={board.steps || []}
              groupByStep={groupByStep}
              onToggleGroupByStep={() => setViewPref('groupByStep', !groupByStep)}
            />

            {/* Onglets de vue : Tableau / Kanban / Calendrier */}
            <div className="no-print">
              <BoardTabs active={boardView} onChange={setBoardView} />
            </div>

            {/* Bandeau d'erreur transitoire */}

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
                              canDeleteGroup={isAdmin}
                              canDeleteTask={canDeleteTask}
                              categories={board.categories || []}
                              categoryValue={categoryValue}
                              onCreateCategory={handleCreateCategory}
                              onDeleteCategory={handleDeleteCategory}
                              onSetCategoryValue={handleSetCategoryValue}
                              tags={board.tags || []}
                              onChangeTaskTag={handleChangeTaskTag}
                              steps={board.steps || []}
                              groupByStep={groupByStep}
                              onCreateSubtask={handleCreateSubtask}
                              onUpdateSubtask={handleUpdateSubtask}
                              onDeleteSubtask={handleDeleteSubtask}
                              onRenameGroup={(name) => handleRenameGroup(group.id, name)}
                              onDeleteGroup={() => handleDeleteGroup(group.id)}
                              getColWidth={getColWidth}
                              onResizeCol={setColWidth}
                              onResetCol={resetColWidth}
                              registerScroller={registerScroller}
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
                onOpenTask={(t) => setDetailTask(t)}
                onAddTask={() => board.groups[0] && handleAddTask(board.groups[0].id, 'Nouvelle tâche')}
              />
            )}

            {boardView === 'calendar' && (
              <CalendarView
                board={board}
                filterFn={filterFn}
                canEdit={canEdit}
                onOpenTask={(t) => setDetailTask(t)}
                onChangeDate={handleChangeDate}
                onAddTaskOnDate={handleCreateTaskOnDate}
              />
            )}
          </>
        )}
        </Suspense>
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
              steps={board.steps || []}
              stepProgress={board.stepProgress || []}
              onSetTaskStep={handleSetTaskStep}
              onToggleTaskStep={handleToggleTaskStep}
              commentCount={commentCounts[live.id] || 0}
              onOpenComments={() => setDrawerTask(live)}
              onCreateSubtask={handleCreateSubtask}
              onUpdateSubtask={handleUpdateSubtask}
              onDeleteSubtask={handleDeleteSubtask}
              canDelete={canDeleteTask(live)}
              isAdmin={isAdmin}
              onArchive={(archived) => {
                handleArchiveTask(live.id, archived);
                setDetailTask(null);
              }}
              onDelete={() => {
                if (handleDeleteTask(live.id)) setDetailTask(null);
              }}
            />
          </div>
        );
      })()}
      {projectModal && (
        <ProjectModal
          mode={projectModal.mode}
          project={projectModal.project}
          onClose={() => setProjectModal(null)}
          onSubmit={handleSubmitProject}
        />
      )}
    </div>
  );
}
