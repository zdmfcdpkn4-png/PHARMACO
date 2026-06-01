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
  { id: 4, name: 'Chloé Petit', email: 'chloe.petit@example.com', avatar_url: null, role: 'member' },
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
  groups: [
    {
      id: 1,
      board_id: 1,
      name: 'To-do',
      color: '#579bfc',
      position: 0,
      tasks: [
        { id: 11, group_id: 1, name: 'Tâche 1', position: 0, status: 'En cours', priority: 'P1 - Urgent', start_date: weekday(0), duedate: weekday(2), created_at: daysAgo(10), admin: adminShape(1) },
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
    return clone(board);
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
    const prev = { status: task.status, priority: task.priority, name: task.name, duedate: task.duedate, admin: task.admin };

    if (patch.name !== undefined) task.name = patch.name;
    if (patch.status !== undefined) task.status = patch.status;
    if (patch.priority !== undefined) task.priority = patch.priority;
    if (patch.duedate !== undefined) task.duedate = patch.duedate;
    if (patch.start_date !== undefined) task.start_date = patch.start_date;
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
    return clone(task);
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
