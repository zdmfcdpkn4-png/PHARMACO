import { query, withTransaction } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

const fetchUsers = async (client, ids) => {
  if (!ids.length) return [];
  const { rows } = await client.query(
    'SELECT id, name, avatar_url FROM users WHERE id = ANY($1) ORDER BY name',
    [ids]
  );
  return rows;
};

// Remplace l'ensemble des assignés d'une tâche. Body : { user_ids: [...] }
export const setTaskAssignees = asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const ids = Array.isArray(req.body.user_ids) ? req.body.user_ids.map(Number) : [];

  const assignees = await withTransaction(async (client) => {
    await client.query('DELETE FROM task_assignments WHERE task_id = $1', [taskId]);
    for (const uid of ids) {
      await client.query(
        'INSERT INTO task_assignments (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [taskId, uid]
      );
    }
    // Synchronise admin_id (1er assigné) pour rétrocompat & alertes
    await client.query(
      `INSERT INTO task_columns (task_id, admin_id) VALUES ($1, $2)
       ON CONFLICT (task_id) DO UPDATE SET admin_id = $2, updated_at = now()`,
      [taskId, ids[0] || null]
    );
    return fetchUsers(client, ids);
  });

  res.json({ assignees, admin: assignees[0] || null });
});

// Remplace l'ensemble des assignés d'un sous-item.
export const setSubtaskAssignees = asyncHandler(async (req, res) => {
  const subId = req.params.id;
  const ids = Array.isArray(req.body.user_ids) ? req.body.user_ids.map(Number) : [];

  const assignees = await withTransaction(async (client) => {
    await client.query('DELETE FROM sub_task_assignments WHERE sub_task_id = $1', [subId]);
    for (const uid of ids) {
      await client.query(
        'INSERT INTO sub_task_assignments (sub_task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [subId, uid]
      );
    }
    await client.query(
      `INSERT INTO sub_task_columns (sub_task_id, admin_id) VALUES ($1, $2)
       ON CONFLICT (sub_task_id) DO UPDATE SET admin_id = $2, updated_at = now()`,
      [subId, ids[0] || null]
    );
    return fetchUsers(client, ids);
  });

  res.json({ assignees, admin: assignees[0] || null });
});
