// Adaptateur HTTP : appelle le vrai backend Express.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const AUTH_KEY = 'pharmaco_auth';

// Récupère le jeton d'authentification stocké au login (pour l'envoyer au
// backend, qui identifie l'appelant et applique les contrôles d'accès).
function authToken() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY))?.token || null;
  } catch {
    return null;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = authToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error;
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Erreur ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const httpApi = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),

  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  updateUser: (id, patch) => request(`/users/${id}`, { method: 'PATCH', body: patch }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  getBoards: () => request('/boards'),
  getBoard: (id = 1) => request(`/boards/${id}`),
  createBoard: (data) => request('/boards', { method: 'POST', body: data }),
  setBoardTeams: (id, team_ids) =>
    request(`/boards/${id}/teams`, { method: 'PUT', body: { team_ids } }),

  createGroup: (data) => request('/groups', { method: 'POST', body: data }),
  updateGroup: (id, patch) => request(`/groups/${id}`, { method: 'PATCH', body: patch }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  reorderGroups: (items) => request('/groups/reorder', { method: 'PUT', body: { items } }),

  createTask: (data) => request('/tasks', { method: 'POST', body: data }),
  updateTask: (id, patch) => request(`/tasks/${id}`, { method: 'PATCH', body: patch }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  reorderTasks: (items) => request('/tasks/reorder', { method: 'PUT', body: { items } }),
  getComments: (taskId, user_id) =>
    request(`/tasks/${taskId}/comments${user_id ? `?user_id=${user_id}` : ''}`),
  addComment: (taskId, { user_id, content }) =>
    request(`/tasks/${taskId}/comments`, { method: 'POST', body: { user_id, content } }),
  markCommentsRead: (taskId, user_id) =>
    request(`/tasks/${taskId}/comments/read`, { method: 'POST', body: { user_id } }),
  getUnreadCounts: (user_id) => request(`/tasks/comments/unread?user_id=${user_id}`),
  getActivity: (taskId) => request(`/tasks/${taskId}/activity`),

  createSubtask: (taskId, data) =>
    request(`/tasks/${taskId}/subtasks`, { method: 'POST', body: data }),
  updateSubtask: (id, patch) => request(`/subtasks/${id}`, { method: 'PUT', body: patch }),
  deleteSubtask: (id) => request(`/subtasks/${id}`, { method: 'DELETE' }),

  createCategory: (boardId, data) =>
    request(`/boards/${boardId}/categories`, { method: 'POST', body: data }),
  deleteCategory: (id) => request(`/boards/categories/${id}`, { method: 'DELETE' }),
  setCategoryValue: (data) => request('/boards/categories/value', { method: 'POST', body: data }),

  setTaskAssignees: (taskId, user_ids) =>
    request(`/tasks/${taskId}/assignees`, { method: 'PUT', body: { user_ids } }),
  setSubtaskAssignees: (subId, user_ids) =>
    request(`/subtasks/${subId}/assignees`, { method: 'PUT', body: { user_ids } }),

  getTeams: () => request('/teams'),
  createTeam: (data) => request('/teams', { method: 'POST', body: data }),
  updateTeam: (id, patch) => request(`/teams/${id}`, { method: 'PATCH', body: patch }),
  deleteTeam: (id) => request(`/teams/${id}`, { method: 'DELETE' }),
  setTeamMembers: (id, members) =>
    request(`/teams/${id}/members`, { method: 'PUT', body: { members } }),
  addTeamMembers: (id, user_ids) =>
    request(`/teams/${id}/members`, { method: 'POST', body: { user_ids } }),
  updateTeamMemberRole: (id, userId, role) =>
    request(`/teams/${id}/members/${userId}`, { method: 'PATCH', body: { role } }),
  removeTeamMember: (id, userId) =>
    request(`/teams/${id}/members/${userId}`, { method: 'DELETE' }),

  getShortcuts: (user_id) => request(`/shortcuts?user_id=${user_id}`),
  createShortcut: (data) => request('/shortcuts', { method: 'POST', body: data }),
  deleteShortcut: (id) => request(`/shortcuts/${id}`, { method: 'DELETE' }),

  createTag: (boardId, data) => request(`/boards/${boardId}/tags`, { method: 'POST', body: data }),
  deleteTag: (id) => request(`/boards/tags/${id}`, { method: 'DELETE' }),
  updateSubtaskTags: (id, patch) => request(`/subtasks/${id}`, { method: 'PUT', body: patch }),

  getDependencies: (board_id) => request(`/dependencies?board_id=${board_id}`),
  addDependency: (predecessor_id, successor_id) =>
    request('/dependencies', { method: 'POST', body: { predecessor_id, successor_id } }),
  deleteDependency: (id) => request(`/dependencies/${id}`, { method: 'DELETE' }),

  getAlerts: ({ user_id } = {}) =>
    request(`/alerts${user_id ? `?user_id=${user_id}` : ''}`),
  markAlertRead: (id) => request(`/alerts/${id}/read`, { method: 'PATCH' }),
  markAllAlertsRead: (user_id) =>
    request('/alerts/read-all', { method: 'POST', body: { user_id } }),
};
