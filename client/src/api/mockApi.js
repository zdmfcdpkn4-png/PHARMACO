// Adaptateur "mock" : reproduit le comportement de l'API en mémoire.
// Permet de faire tourner le frontend sans backend ni PostgreSQL.
import { GROUP_COLORS } from '../lib/constants.js';

let nextId = 1000;
const uid = () => ++nextId;

// Date (YYYY-MM-DD) du jour de la semaine en cours : 0 = lundi … 6 = dimanche.
const weekday = (dow) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const cur = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - cur + dow);
  return d.toISOString().slice(0, 10);
};

// Date ISO il y a N jours (pour created_at de démo).
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

// avatar_url laissé à null : les pastilles d'initiales sont générées
// localement par le composant Avatar (aucune dépendance réseau).
const users = [
  { id: 1, name: 'Erwin Raingeard', email: 'erwin.raingeard@gmail.com', avatar_url: null, role: 'admin' },
  { id: 2, name: 'Alice Martin', email: 'alice.martin@example.com', avatar_url: null, role: 'member' },
  { id: 3, name: 'Bob Durand', email: 'bob.durand@example.com', avatar_url: null, role: 'member' },
  { id: 4, name: 'Chloé Petit', email: 'chloe.petit@example.com', avatar_url: null, role: 'viewer' },
];

const findUser = (id) => users.find((u) => u.id === id) || null;
const adminShape = (id) => {
  const u = findUser(id);
  return u ? { id: u.id, name: u.name, avatar_url: u.avatar_url } : null;
};

let alerts = [
  { id: 900, user_id: 1, message: 'La tâche « Tâche 3 » est passée au statut Bloqué.', type: 'blocked', is_read: false, created_at: new Date().toISOString() },
];

// État du board "Suivi" (reproduit la maquette)
const board = {
  id: 1,
  workspace_id: 1,
  name: 'Suivi',
  description: 'Tableau de bord de suivi du projet',
  created_by: 1, // Erwin est propriétaire
  categories: [],
  categoryValues: [],
  tags: [
    { id: 701, board_id: 1, name: 'Étape 1 : Cadrage', color: '#579bfc', tag_type: 'etape' },
    { id: 702, board_id: 1, name: 'Étape 2 : Production', color: '#a25ddc', tag_type: 'etape' },
    { id: 703, board_id: 1, name: 'Étape 3 : Contrôle', color: '#00c875', tag_type: 'etape' },
    { id: 704, board_id: 1, name: 'Ajustement technique', color: '#e8722e', tag_type: 'intervention' },
    { id: 705, board_id: 1, name: 'Rapport / Synthèse', color: '#0073ea', tag_type: 'intervention' },
    { id: 706, board_id: 1, name: 'Logistique', color: '#fdab3d', tag_type: 'intervention' },
  ],
  groups: [
    {
      id: 1,
      board_id: 1,
      name: 'To-do',
      color: '#579bfc',
      position: 0,
      tasks: [
        { id: 11, group_id: 1, name: 'Tâche 1', position: 0, status: 'En cours', priority: 'P1 - Urgent', start_date: weekday(0), duedate: weekday(2), created_at: daysAgo(10), admin: adminShape(1), assignees: [adminShape(1), adminShape(2)], etape_tag_id: 701, intervention_tag_id: null, subtasks: [
          { id: 510, parent_task_id: 11, name: 'Préparer le dossier', position: 0, status: 'Fait', duedate: weekday(0), admin: adminShape(1), etape_tag_id: 701, intervention_tag_id: 705 },
          { id: 511, parent_task_id: 11, name: 'Valider avec Alice', position: 1, status: 'En cours', duedate: weekday(1), admin: adminShape(2), etape_tag_id: null, intervention_tag_id: 706 },
        ] },
        { id: 12, group_id: 1, name: 'Tâche 2', position: 1, status: 'Fait', priority: 'P3 - Normal', start_date: weekday(1), duedate: weekday(3), created_at: daysAgo(9), admin: adminShape(2) },
        { id: 13, group_id: 1, name: 'Tâche 3', position: 2, status: 'Bloqué', priority: 'P2 - Élevé', start_date: weekday(2), duedate: weekday(4), created_at: daysAgo(7), admin: null },
        // Erwin chargé sur mardi (pour illustrer la saturation > 3)
        { id: 14, group_id: 1, name: 'Audit qualité', position: 3, status: 'En cours', priority: 'P2 - Élevé', start_date: weekday(1), duedate: weekday(1), created_at: daysAgo(5), admin: adminShape(1) },
        { id: 15, group_id: 1, name: 'Revue lots', position: 4, status: 'À faire', priority: 'P3 - Normal', start_date: weekday(3), duedate: weekday(5), created_at: daysAgo(3), admin: adminShape(1) },
        { id: 16, group_id: 1, name: 'Contrôle péremption', position: 5, status: 'En cours', priority: 'P3 - Normal', start_date: weekday(0), duedate: weekday(1), created_at: daysAgo(1), admin: adminShape(1) },
      ],
    },
    {
      id: 2,
      board_id: 1,
      name: 'Terminé',
      color: '#00c875',
      position: 1,
      tasks: [],
    },
  ],
};

// Discussion & journal d'activité en mémoire
let comments = [
  { id: 700, task_id: 13, content: 'En attente du réapprovisionnement fournisseur.', user: adminShape(1), created_at: daysAgo(2) },
  { id: 701, task_id: 13, content: 'Relance envoyée ce matin.', user: adminShape(2), created_at: daysAgo(1) },
];
let activity = [
  { id: 800, task_id: 13, action_type: 'status', old_value: 'En cours', new_value: 'Bloqué', user: adminShape(1), created_at: daysAgo(2) },
  { id: 801, task_id: 13, action_type: 'created', old_value: null, new_value: 'Tâche 3', user: adminShape(1), created_at: daysAgo(7) },
];

// Dépendances Gantt : predecessor doit finir avant successor (Finish-to-Start)
let dependencies = [{ id: 600, predecessor_id: 11, successor_id: 13 }];

// Équipes & raccourcis (sidebar)
let teams = [
  {
    id: 1,
    name: 'Équipe Pharmacie',
    description: 'Production et contrôle qualité',
    members: [
      { id: 1, name: 'Erwin Raingeard', avatar_url: null, role: 'responsable' },
      { id: 2, name: 'Alice Martin', avatar_url: null, role: 'membre' },
    ],
  },
  {
    id: 2,
    name: 'Équipe Logistique',
    description: 'Approvisionnement et stocks',
    members: [
      { id: 3, name: 'Bob Durand', avatar_url: null, role: 'responsable' },
      { id: 4, name: 'Chloé Petit', avatar_url: null, role: 'membre' },
    ],
  },
];
let shortcuts = [];

// Suivi lu/non-lu : { `${userId}:${taskId}`: ISO last_read_at }
let commentReads = {};
const readKey = (userId, taskId) => `${userId}:${taskId}`;

const logActivity = (taskId, action, oldV, newV, actorId) => {
  activity = [
    {
      id: uid(),
      task_id: taskId,
      action_type: action,
      old_value: oldV == null ? null : String(oldV),
      new_value: newV == null ? null : String(newV),
      user: actorId ? adminShape(actorId) : null,
      created_at: new Date().toISOString(),
    },
    ...activity,
  ];
};

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));

const findGroup = (gid) => board.groups.find((g) => g.id === gid);
const findTask = (tid) => {
  for (const g of board.groups) {
    const t = g.tasks.find((x) => x.id === tid);
    if (t) return { task: t, group: g };
  }
  return { task: null, group: null };
};

const addIso = (iso, n) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const diffIso = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// Contrainte Finish-to-Start (mock) : repousse en cascade les successeurs.
const cascadeShift = (taskId, depth = 0, acc = []) => {
  if (depth > 200) return acc;
  const { task: pred } = findTask(taskId);
  const predEnd = pred?.duedate || pred?.start_date;
  if (!predEnd) return acc;
  const minStart = addIso(predEnd.slice(0, 10), 1);
  for (const dep of dependencies.filter((d) => d.predecessor_id === taskId)) {
    const { task: succ } = findTask(dep.successor_id);
    if (!succ) continue;
    const sStart = (succ.start_date || succ.duedate || '').slice(0, 10);
    if (sStart && sStart < minStart) {
      const duration = succ.start_date && succ.duedate ? diffIso(succ.start_date, succ.duedate) : 0;
      succ.start_date = minStart;
      succ.duedate = addIso(minStart, duration);
      acc.push(JSON.parse(JSON.stringify(succ)));
      cascadeShift(succ.id, depth + 1, acc);
    }
  }
  return acc;
};

export const mockApi = {
  async login(email, password) {
    await delay();
    const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
    // Démo : on accepte le mot de passe propre au membre s'il en a un,
    // sinon le mot de passe par défaut « pharmaco123 ».
    const expected = user?.password || 'pharmaco123';
    if (!user || password !== expected) {
      throw new Error('Identifiants invalides');
    }
    const { password: _pw, ...safe } = user;
    return { token: `mock-${user.id}`, user: clone(safe) };
  },

  async createUser({ name, email, role, password }) {
    await delay();
    if (!name || !email) throw new Error('name et email sont requis');
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Un membre avec cet e-mail existe déjà');
    }
    const user = {
      id: uid(),
      name,
      email,
      avatar_url: null,
      role: role || 'member',
      // En démo, on stocke le mot de passe en clair pour permettre le login.
      password: password || null,
    };
    users.push(user);
    const { password: _pw, ...safe } = user;
    return clone(safe);
  },

  async updateUser(id, patch) {
    await delay();
    const u = users.find((x) => x.id === id);
    if (!u) throw new Error('Utilisateur introuvable');
    if (
      patch.email &&
      users.some((x) => x.id !== id && x.email.toLowerCase() === patch.email.toLowerCase())
    ) {
      throw new Error('Un membre avec cet e-mail existe déjà');
    }
    if (patch.name !== undefined) u.name = patch.name;
    if (patch.email !== undefined) u.email = patch.email;
    if (patch.role !== undefined) u.role = patch.role;
    // password : chaîne -> (re)définit ; null -> supprime ; absent -> inchangé
    if (patch.password !== undefined) u.password = patch.password || null;
    const { password: _pw, ...safe } = u;
    return clone(safe);
  },

  async deleteUser(id) {
    await delay();
    const idx = users.findIndex((x) => x.id === id);
    if (idx >= 0) users.splice(idx, 1);
  },

  async getUsers() {
    await delay();
    return clone(users.map(({ password: _pw, ...rest }) => rest));
  },

  async getBoard(/* id */) {
    await delay();
    // Garantit subtasks + assignees (dérivés de admin si absents)
    for (const g of board.groups)
      for (const t of g.tasks) {
        if (!t.subtasks) t.subtasks = [];
        if (!t.assignees) t.assignees = t.admin ? [t.admin] : [];
        t.admin = t.assignees[0] || null;
        for (const s of t.subtasks) {
          if (!s.assignees) s.assignees = s.admin ? [s.admin] : [];
          s.admin = s.assignees[0] || null;
        }
      }
    return clone({ ...board, dependencies });
  },

  async setTaskAssignees(taskId, userIds) {
    await delay(60);
    const { task } = findTask(taskId);
    if (!task) throw new Error('Tâche introuvable');
    task.assignees = userIds.map((id) => adminShape(id)).filter(Boolean);
    task.admin = task.assignees[0] || null;
    return clone({ assignees: task.assignees, admin: task.admin });
  },

  async setSubtaskAssignees(subId, userIds) {
    await delay(60);
    for (const g of board.groups)
      for (const t of g.tasks) {
        const s = (t.subtasks || []).find((x) => x.id === subId);
        if (s) {
          s.assignees = userIds.map((id) => adminShape(id)).filter(Boolean);
          s.admin = s.assignees[0] || null;
          return clone({ assignees: s.assignees, admin: s.admin });
        }
      }
    throw new Error('Sous-item introuvable');
  },

  async createSubtask(taskId, { name, admin_id, status, duedate }) {
    await delay(80);
    const { task } = findTask(taskId);
    if (!task) throw new Error('Tâche introuvable');
    if (!task.subtasks) task.subtasks = [];
    const sub = {
      id: uid(),
      parent_task_id: taskId,
      name: name.trim(),
      position: task.subtasks.length,
      status: status || 'À faire',
      duedate: duedate || null,
      admin: admin_id ? adminShape(admin_id) : null,
    };
    task.subtasks.push(sub);
    return clone(sub);
  },

  async updateSubtask(id, patch) {
    await delay(60);
    let parent = null;
    let sub = null;
    for (const g of board.groups) {
      for (const t of g.tasks) {
        const s = (t.subtasks || []).find((x) => x.id === id);
        if (s) { parent = t; sub = s; break; }
      }
      if (sub) break;
    }
    if (!sub) throw new Error('Sous-item introuvable');
    if (patch.name !== undefined) sub.name = patch.name;
    if (patch.status !== undefined) sub.status = patch.status;
    if (patch.duedate !== undefined) sub.duedate = patch.duedate;
    if (patch.etape_tag_id !== undefined) sub.etape_tag_id = patch.etape_tag_id;
    if (patch.intervention_tag_id !== undefined) sub.intervention_tag_id = patch.intervention_tag_id;
    if (patch.admin_id !== undefined) sub.admin = patch.admin_id ? adminShape(patch.admin_id) : null;

    // Auto-complétion : tous les sous-items "Fait" -> parent "Fait"
    let parentCompleted = false;
    const subs = parent.subtasks || [];
    if (subs.length > 0 && subs.every((s) => s.status === 'Fait')) {
      parent.status = 'Fait';
      parentCompleted = true;
    }
    return clone({ subtask: sub, parentCompleted, parentId: parent.id });
  },

  async deleteSubtask(id) {
    await delay(40);
    for (const g of board.groups) {
      for (const t of g.tasks) {
        if (t.subtasks) t.subtasks = t.subtasks.filter((s) => s.id !== id);
      }
    }
  },

  async createCategory(boardId, { name, type }) {
    await delay(60);
    const cat = {
      id: uid(),
      board_id: boardId,
      name: name.trim(),
      type: ['text', 'status', 'person', 'date'].includes(type) ? type : 'text',
      position: board.categories.length,
    };
    board.categories.push(cat);
    return clone(cat);
  },

  async deleteCategory(id) {
    await delay(40);
    board.categories = board.categories.filter((c) => c.id !== id);
    board.categoryValues = board.categoryValues.filter((v) => v.category_id !== id);
  },

  async setCategoryValue({ category_id, task_id, value }) {
    await delay(30);
    const existing = board.categoryValues.find(
      (v) => v.category_id === category_id && v.task_id === task_id
    );
    if (existing) existing.value = value;
    else board.categoryValues.push({ category_id, task_id, value });
    return { ok: true };
  },

  async createTag(boardId, { name, color, tag_type }) {
    await delay(50);
    const tag = { id: uid(), board_id: boardId, name: name.trim(), color: color || '#579bfc', tag_type };
    board.tags.push(tag);
    return clone(tag);
  },

  async deleteTag(id) {
    await delay(40);
    board.tags = board.tags.filter((t) => t.id !== id);
    // Détache l'étiquette des tâches/sous-items
    for (const g of board.groups)
      for (const t of g.tasks) {
        if (t.etape_tag_id === id) t.etape_tag_id = null;
        if (t.intervention_tag_id === id) t.intervention_tag_id = null;
        for (const s of t.subtasks || []) {
          if (s.etape_tag_id === id) s.etape_tag_id = null;
          if (s.intervention_tag_id === id) s.intervention_tag_id = null;
        }
      }
  },

  async getTeams() {
    await delay(40);
    return clone(teams);
  },
  async createTeam({ name, description }) {
    await delay(50);
    const t = { id: uid(), name: name.trim(), description: description || null, members: [] };
    teams.push(t);
    return clone(t);
  },
  async deleteTeam(id) {
    await delay(40);
    teams = teams.filter((t) => t.id !== id);
  },
  async setTeamMembers(id, members) {
    await delay(50);
    const t = teams.find((x) => x.id === id);
    if (t)
      t.members = members
        .map((m) => {
          const u = users.find((x) => x.id === m.user_id);
          return u ? { id: u.id, name: u.name, avatar_url: u.avatar_url, role: m.role || 'membre' } : null;
        })
        .filter(Boolean);
    return { ok: true };
  },

  async getShortcuts(userId) {
    await delay(30);
    return clone(shortcuts.filter((s) => s.user_id === userId));
  },
  async createShortcut({ user_id, name, target_url, icon_name }) {
    await delay(40);
    const s = {
      id: uid(),
      user_id,
      name: name.trim(),
      target_url,
      icon_name: icon_name || 'Link',
      position: shortcuts.length,
    };
    shortcuts.push(s);
    return clone(s);
  },
  async deleteShortcut(id) {
    await delay(30);
    shortcuts = shortcuts.filter((s) => s.id !== id);
  },

  async getDependencies() {
    await delay(40);
    return clone(dependencies);
  },

  async addDependency(predecessor_id, successor_id) {
    await delay(60);
    if (predecessor_id === successor_id) throw new Error('Une tâche ne peut dépendre d’elle-même');
    // Détection de cycle (succ atteint déjà pred ?)
    const reaches = (from, target, seen = new Set()) => {
      if (from === target) return true;
      for (const d of dependencies.filter((x) => x.predecessor_id === from)) {
        if (!seen.has(d.successor_id)) {
          seen.add(d.successor_id);
          if (reaches(d.successor_id, target, seen)) return true;
        }
      }
      return false;
    };
    if (reaches(successor_id, predecessor_id)) throw new Error('Dépendance circulaire détectée');
    if (dependencies.some((d) => d.predecessor_id === predecessor_id && d.successor_id === successor_id)) {
      throw new Error('Cette dépendance existe déjà');
    }
    const dep = { id: uid(), predecessor_id, successor_id };
    dependencies.push(dep);
    return clone(dep);
  },

  async deleteDependency(id) {
    await delay(40);
    dependencies = dependencies.filter((d) => d.id !== id);
  },

  async createGroup({ name, color }) {
    await delay();
    const position = board.groups.length;
    const group = {
      id: uid(),
      board_id: board.id,
      name,
      color: color || GROUP_COLORS[position % GROUP_COLORS.length],
      position,
      tasks: [],
    };
    board.groups.push(group);
    return clone(group);
  },

  async updateGroup(id, patch) {
    await delay();
    const g = findGroup(id);
    if (!g) throw new Error('Groupe introuvable');
    Object.assign(g, patch);
    return clone(g);
  },

  async deleteGroup(id) {
    await delay();
    const idx = board.groups.findIndex((g) => g.id === id);
    if (idx >= 0) board.groups.splice(idx, 1);
  },

  async reorderGroups(items) {
    await delay(80);
    const posById = new Map(items.map((it) => [it.id, it.position]));
    for (const g of board.groups) {
      if (posById.has(g.id)) g.position = posById.get(g.id);
    }
    board.groups.sort((a, b) => a.position - b.position);
    return { ok: true, updated: items.length };
  },

  async createTask({ group_id, name, admin_id, status, duedate, priority, start_date, actor_id }) {
    await delay();
    const g = findGroup(group_id);
    if (!g) throw new Error('Groupe introuvable');
    const task = {
      id: uid(),
      group_id,
      name,
      position: g.tasks.length,
      status: status || 'À faire',
      priority: priority || 'P3 - Normal',
      start_date: start_date || null,
      duedate: duedate || null,
      created_at: new Date().toISOString(),
      admin: admin_id ? adminShape(admin_id) : null,
    };
    g.tasks.push(task);
    if (task.status === 'Bloqué' && admin_id) this._pushBlockedAlert(task, admin_id);
    logActivity(task.id, 'created', null, name, actor_id);
    return clone(task);
  },

  async updateTask(id, patch) {
    await delay();
    const { task } = findTask(id);
    if (!task) throw new Error('Tâche introuvable');
    const prev = { status: task.status, priority: task.priority, name: task.name, duedate: task.duedate, start_date: task.start_date, admin: task.admin };

    if (patch.name !== undefined) task.name = patch.name;
    if (patch.status !== undefined) task.status = patch.status;
    if (patch.priority !== undefined) task.priority = patch.priority;
    if (patch.duedate !== undefined) task.duedate = patch.duedate;
    if (patch.start_date !== undefined) task.start_date = patch.start_date;
    if (patch.etape_tag_id !== undefined) task.etape_tag_id = patch.etape_tag_id;
    if (patch.intervention_tag_id !== undefined) task.intervention_tag_id = patch.intervention_tag_id;
    if (patch.admin_id !== undefined) task.admin = patch.admin_id ? adminShape(patch.admin_id) : null;

    if (patch.status === 'Bloqué' && prev.status !== 'Bloqué' && task.admin) {
      this._pushBlockedAlert(task, task.admin.id);
    }

    // Journalisation des changements
    const actor = patch.actor_id;
    if (patch.status !== undefined && prev.status !== task.status)
      logActivity(id, 'status', prev.status, task.status, actor);
    if (patch.priority !== undefined && prev.priority !== task.priority)
      logActivity(id, 'priority', prev.priority, task.priority, actor);
    if (patch.name !== undefined && prev.name !== task.name)
      logActivity(id, 'name', prev.name, task.name, actor);
    if (patch.duedate !== undefined && (prev.duedate || null) !== (task.duedate || null))
      logActivity(id, 'duedate', prev.duedate || '—', task.duedate || '—', actor);
    if (patch.admin_id !== undefined && (prev.admin?.id || null) !== (task.admin?.id || null))
      logActivity(id, 'admin', prev.admin?.name || 'Personne', task.admin?.name || 'Personne', actor);

    // Contrainte de planning : repousse les successeurs si les dates changent
    let shifted = [];
    const datesChanged =
      (patch.start_date !== undefined && (prev.start_date || null) !== (task.start_date || null)) ||
      (patch.duedate !== undefined && (prev.duedate || null) !== (task.duedate || null));
    if (datesChanged) shifted = cascadeShift(id);

    return clone({ ...task, shifted });
  },

  async deleteTask(id) {
    await delay();
    const { task, group } = findTask(id);
    if (group && task) group.tasks = group.tasks.filter((t) => t.id !== id);
  },

  async getComments(taskId, userId) {
    await delay(60);
    // Marque comme lu pour cet utilisateur
    if (userId) commentReads[readKey(userId, taskId)] = new Date().toISOString();
    return clone(
      comments
        .filter((c) => c.task_id === taskId)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    );
  },

  async addComment(taskId, { user_id, content }) {
    await delay(60);
    const text = content.trim();
    const c = {
      id: uid(),
      task_id: taskId,
      content: text,
      user: user_id ? adminShape(user_id) : null,
      created_at: new Date().toISOString(),
    };
    comments.push(c);
    // L'auteur a lu sa propre discussion
    if (user_id) commentReads[readKey(user_id, taskId)] = new Date().toISOString();

    // @mentions -> alertes
    const lower = text.toLowerCase();
    const taskName =
      board.groups.flatMap((g) => g.tasks).find((t) => t.id === taskId)?.name || 'une tâche';
    const authorName = user_id ? adminShape(user_id)?.name : 'Quelqu’un';
    const mentioned = [];
    for (const u of users) {
      if (u.id !== user_id && lower.includes(`@${u.name.toLowerCase()}`)) {
        mentioned.push(u.id);
        alerts = [
          {
            id: uid(),
            user_id: u.id,
            message: `💬 ${authorName} vous a mentionné sur « ${taskName} » : ${text.slice(0, 80)}`,
            type: 'mention',
            is_read: false,
            created_at: new Date().toISOString(),
          },
          ...alerts,
        ];
      }
    }
    return clone({ ...c, mentioned });
  },

  async markCommentsRead(taskId, userId) {
    await delay(40);
    if (userId) commentReads[readKey(userId, taskId)] = new Date().toISOString();
    return { ok: true };
  },

  async getUnreadCounts(userId) {
    await delay(40);
    const counts = {};
    for (const c of comments) {
      if (c.user?.id === userId) continue; // ses propres messages
      const last = commentReads[readKey(userId, c.task_id)];
      if (!last || new Date(c.created_at) > new Date(last)) {
        counts[c.task_id] = (counts[c.task_id] || 0) + 1;
      }
    }
    return counts;
  },

  async getActivity(taskId) {
    await delay(60);
    return clone(
      activity
        .filter((a) => a.task_id === taskId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    );
  },

  async reorderTasks(items) {
    await delay(80);
    // Applique group_id + position à chaque tâche, puis ré-affecte
    // chaque tâche à son groupe cible.
    const byId = new Map(items.map((it) => [it.id, it]));
    const all = [];
    for (const g of board.groups) {
      for (const t of g.tasks) all.push(t);
    }
    // Détache toutes les tâches concernées
    for (const t of all) {
      const it = byId.get(t.id);
      if (it) {
        t.group_id = it.group_id;
        t.position = it.position;
      }
    }
    // Recompose chaque groupe
    for (const g of board.groups) {
      g.tasks = all
        .filter((t) => t.group_id === g.id)
        .sort((a, b) => a.position - b.position);
    }
    return { ok: true, updated: items.length };
  },

  async getAlerts({ user_id } = {}) {
    await delay();
    return clone(user_id ? alerts.filter((a) => a.user_id === user_id) : alerts);
  },

  async markAlertRead(id) {
    await delay();
    const a = alerts.find((x) => x.id === id);
    if (a) a.is_read = true;
    return clone(a);
  },

  async markAllAlertsRead(userId) {
    await delay();
    for (const a of alerts) {
      if (!userId || a.user_id === userId) a.is_read = true;
    }
    return { ok: true };
  },

  _pushBlockedAlert(task, userId) {
    const critical = task.priority === 'P1 - Urgent';
    alerts = [
      {
        id: uid(),
        user_id: userId,
        message: critical
          ? `🚨 CRITIQUE : la tâche P1 « ${task.name} » est BLOQUÉE et nécessite une action immédiate.`
          : `La tâche « ${task.name} » est passée au statut Bloqué.`,
        type: critical ? 'critical' : 'blocked',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      ...alerts,
    ];
  },
};
