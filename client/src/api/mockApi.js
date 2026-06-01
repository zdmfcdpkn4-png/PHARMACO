// Adaptateur "mock" : reproduit le comportement de l'API en mémoire.
// Permet de faire tourner le frontend sans backend ni PostgreSQL.
import { GROUP_COLORS } from '../lib/constants.js';

let nextId = 1000;
const uid = () => ++nextId;

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
        { id: 11, group_id: 1, name: 'Tâche 1', position: 0, status: 'En cours', duedate: '2026-05-28', admin: adminShape(1) },
        { id: 12, group_id: 1, name: 'Tâche 2', position: 1, status: 'Fait', duedate: '2026-05-29', admin: adminShape(2) },
        { id: 13, group_id: 1, name: 'Tâche 3', position: 2, status: 'Bloqué', duedate: '2026-05-30', admin: null },
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

  async getUsers() {
    await delay();
    return clone(users);
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

  async createTask({ group_id, name, admin_id, status, duedate }) {
    await delay();
    const g = findGroup(group_id);
    if (!g) throw new Error('Groupe introuvable');
    const task = {
      id: uid(),
      group_id,
      name,
      position: g.tasks.length,
      status: status || 'À faire',
      duedate: duedate || null,
      admin: admin_id ? adminShape(admin_id) : null,
    };
    g.tasks.push(task);
    if (task.status === 'Bloqué' && admin_id) this._pushBlockedAlert(task, admin_id);
    return clone(task);
  },

  async updateTask(id, patch) {
    await delay();
    const { task } = findTask(id);
    if (!task) throw new Error('Tâche introuvable');
    const prevStatus = task.status;

    if (patch.name !== undefined) task.name = patch.name;
    if (patch.status !== undefined) task.status = patch.status;
    if (patch.duedate !== undefined) task.duedate = patch.duedate;
    if (patch.admin_id !== undefined) task.admin = patch.admin_id ? adminShape(patch.admin_id) : null;

    if (patch.status === 'Bloqué' && prevStatus !== 'Bloqué' && task.admin) {
      this._pushBlockedAlert(task, task.admin.id);
    }
    return clone(task);
  },

  async deleteTask(id) {
    await delay();
    const { task, group } = findTask(id);
    if (group && task) group.tasks = group.tasks.filter((t) => t.id !== id);
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

  _pushBlockedAlert(task, userId) {
    alerts = [
      {
        id: uid(),
        user_id: userId,
        message: `La tâche « ${task.name} » est passée au statut Bloqué.`,
        type: 'blocked',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      ...alerts,
    ];
  },
};
