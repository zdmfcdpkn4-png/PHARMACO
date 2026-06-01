// Adaptateur HTTP : appelle le vrai backend Express.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
  getBoard: (id = 1) => request(`/boards/${id}`),

  createGroup: (data) => request('/groups', { method: 'POST', body: data }),
  updateGroup: (id, patch) => request(`/groups/${id}`, { method: 'PATCH', body: patch }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  reorderGroups: (items) => request('/groups/reorder', { method: 'PUT', body: { items } }),

  createTask: (data) => request('/tasks', { method: 'POST', body: data }),
  updateTask: (id, patch) => request(`/tasks/${id}`, { method: 'PATCH', body: patch }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  reorderTasks: (items) => request('/tasks/reorder', { method: 'PUT', body: { items } }),

  getAlerts: ({ user_id } = {}) =>
    request(`/alerts${user_id ? `?user_id=${user_id}` : ''}`),
  markAlertRead: (id) => request(`/alerts/${id}/read`, { method: 'PATCH' }),
};
