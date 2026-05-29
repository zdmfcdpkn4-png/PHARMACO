import { query, withTransaction } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Récupère une tâche mise en forme (avec admin joint) par son id.
const fetchTaskShaped = async (taskId, client = { query }) => {
  const { rows } = await client.query(
    `SELECT
        t.id, t.group_id, t.name, t.position, t.created_at,
        tc.admin_id, tc.status, tc.duedate,
        u.id AS admin_user_id, u.name AS admin_name, u.avatar_url AS admin_avatar_url
     FROM tasks t
     LEFT JOIN task_columns tc ON tc.task_id = t.id
     LEFT JOIN users u ON u.id = tc.admin_id
     WHERE t.id = $1`,
    [taskId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    group_id: row.group_id,
    name: row.name,
    position: row.position,
    created_at: row.created_at,
    status: row.status || 'À faire',
    duedate: row.duedate,
    admin: row.admin_user_id
      ? { id: row.admin_user_id, name: row.admin_name, avatar_url: row.admin_avatar_url }
      : null,
  };
};

// Crée une alerte "Bloqué" pour l'admin de la tâche (si assigné).
const createBlockedAlert = async (client, taskId) => {
  const { rows } = await client.query(
    `SELECT t.name, tc.admin_id
     FROM tasks t JOIN task_columns tc ON tc.task_id = t.id
     WHERE t.id = $1`,
    [taskId]
  );
  if (!rows.length || !rows[0].admin_id) return;
  await client.query(
    `INSERT INTO alerts (user_id, message, type)
     VALUES ($1, $2, 'blocked')`,
    [rows[0].admin_id, `La tâche « ${rows[0].name} » est passée au statut Bloqué.`]
  );
};

/**
 * Crée une tâche + sa ligne task_columns associée (transaction).
 * Body : { group_id, name, admin_id?, status?, duedate? }
 */
export const createTask = asyncHandler(async (req, res) => {
  const { group_id, name, admin_id, status, duedate } = req.body;
  if (!group_id || !name) {
    return res.status(400).json({ error: 'group_id et name sont requis' });
  }

  const task = await withTransaction(async (client) => {
    const posRes = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks WHERE group_id = $1',
      [group_id]
    );
    const position = posRes.rows[0].next;

    const taskRes = await client.query(
      'INSERT INTO tasks (group_id, name, position) VALUES ($1, $2, $3) RETURNING id',
      [group_id, name, position]
    );
    const taskId = taskRes.rows[0].id;

    await client.query(
      `INSERT INTO task_columns (task_id, admin_id, status, duedate)
       VALUES ($1, $2, COALESCE($3, 'À faire'), $4)`,
      [taskId, admin_id || null, status || null, duedate || null]
    );

    if (status === 'Bloqué') {
      await createBlockedAlert(client, taskId);
    }

    return fetchTaskShaped(taskId, client);
  });

  res.status(201).json(task);
});

/**
 * Met à jour une tâche et/ou ses colonnes.
 * Body : { name?, position?, group_id?, admin_id?, status?, duedate? }
 * Si status passe à "Bloqué", une alerte est créée pour l'admin.
 */
export const updateTask = asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const { name, position, group_id, admin_id, status, duedate } = req.body;

  const task = await withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT t.id, tc.status AS prev_status
       FROM tasks t LEFT JOIN task_columns tc ON tc.task_id = t.id
       WHERE t.id = $1`,
      [taskId]
    );
    if (!existing.rows.length) {
      const err = new Error('Tâche introuvable');
      err.status = 404;
      throw err;
    }
    const prevStatus = existing.rows[0].prev_status;

    // Mise à jour des champs propres à la tâche
    if (name !== undefined || position !== undefined || group_id !== undefined) {
      await client.query(
        `UPDATE tasks
         SET name = COALESCE($1, name),
             position = COALESCE($2, position),
             group_id = COALESCE($3, group_id)
         WHERE id = $4`,
        [name ?? null, position ?? null, group_id ?? null, taskId]
      );
    }

    // Mise à jour des colonnes (admin/status/duedate)
    // $5 / $6 indiquent si l'on doit toucher admin_id / duedate (pour
    // pouvoir les remettre à NULL explicitement sans les écraser sinon).
    if (admin_id !== undefined || status !== undefined || duedate !== undefined) {
      await client.query(
        `INSERT INTO task_columns (task_id, admin_id, status, duedate)
         VALUES ($1, $2, COALESCE($3, 'À faire'), $4)
         ON CONFLICT (task_id) DO UPDATE SET
           admin_id = CASE WHEN $5 THEN EXCLUDED.admin_id ELSE task_columns.admin_id END,
           status   = COALESCE($3, task_columns.status),
           duedate  = CASE WHEN $6 THEN EXCLUDED.duedate ELSE task_columns.duedate END`,
        [
          taskId,
          admin_id ?? null,
          status ?? null,
          duedate ?? null,
          admin_id !== undefined,
          duedate !== undefined,
        ]
      );
    }

    // Alerte si on vient de passer à "Bloqué"
    if (status === 'Bloqué' && prevStatus !== 'Bloqué') {
      await createBlockedAlert(client, taskId);
    }

    return fetchTaskShaped(taskId, client);
  });

  res.json(task);
});

export const deleteTask = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Tâche introuvable' });
  res.status(204).end();
});
