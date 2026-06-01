import { query, withTransaction } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Récupère une tâche mise en forme (avec admin joint) par son id.
const fetchTaskShaped = async (taskId, client = { query }) => {
  const { rows } = await client.query(
    `SELECT
        t.id, t.group_id, t.name, t.position, t.priority, t.created_at,
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
    priority: row.priority || 'P3 - Normal',
    created_at: row.created_at,
    status: row.status || 'À faire',
    duedate: row.duedate,
    admin: row.admin_user_id
      ? { id: row.admin_user_id, name: row.admin_name, avatar_url: row.admin_avatar_url }
      : null,
  };
};

// Crée une alerte quand une tâche passe "Bloqué".
// Une tâche P1 - Urgent bloquée génère une alerte CRITIQUE.
const createBlockedAlert = async (client, taskId) => {
  const { rows } = await client.query(
    `SELECT t.name, t.priority, tc.admin_id
     FROM tasks t JOIN task_columns tc ON tc.task_id = t.id
     WHERE t.id = $1`,
    [taskId]
  );
  if (!rows.length || !rows[0].admin_id) return null;
  const { name, priority, admin_id } = rows[0];
  const critical = priority === 'P1 - Urgent';
  const type = critical ? 'critical' : 'blocked';
  const message = critical
    ? `🚨 CRITIQUE : la tâche P1 « ${name} » est BLOQUÉE et nécessite une action immédiate.`
    : `La tâche « ${name} » est passée au statut Bloqué.`;
  const { rows: inserted } = await client.query(
    `INSERT INTO alerts (user_id, message, type)
     VALUES ($1, $2, $3::alert_type) RETURNING *`,
    [admin_id, message, type]
  );
  return inserted[0];
};

/**
 * Crée une tâche + sa ligne task_columns associée (transaction).
 * Body : { group_id, name, admin_id?, status?, duedate?, priority? }
 */
export const createTask = asyncHandler(async (req, res) => {
  const { group_id, name, admin_id, status, duedate, priority } = req.body;
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
      `INSERT INTO tasks (group_id, name, position, priority)
       VALUES ($1, $2, $3, COALESCE($4::task_priority, 'P3 - Normal')) RETURNING id`,
      [group_id, name, position, priority || null]
    );
    const taskId = taskRes.rows[0].id;

    await client.query(
      `INSERT INTO task_columns (task_id, admin_id, status, duedate)
       VALUES ($1, $2, COALESCE($3::task_status, 'À faire'), $4)`,
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
 * Body : { name?, position?, group_id?, admin_id?, status?, duedate?, priority? }
 * Si status passe à "Bloqué", une alerte est créée pour l'admin
 * (critique si la tâche est P1 - Urgent).
 */
export const updateTask = asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const { name, position, group_id, admin_id, status, duedate, priority } = req.body;

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

    // Mise à jour des champs propres à la tâche (dont la priorité, AVANT
    // le calcul d'alerte pour qu'un passage P1+Bloqué déclenche le critique).
    if (
      name !== undefined ||
      position !== undefined ||
      group_id !== undefined ||
      priority !== undefined
    ) {
      await client.query(
        `UPDATE tasks
         SET name = COALESCE($1, name),
             position = COALESCE($2, position),
             group_id = COALESCE($3, group_id),
             priority = COALESCE($4::task_priority, priority)
         WHERE id = $5`,
        [name ?? null, position ?? null, group_id ?? null, priority ?? null, taskId]
      );
    }

    // Mise à jour des colonnes (admin/status/duedate)
    // $5 / $6 indiquent si l'on doit toucher admin_id / duedate (pour
    // pouvoir les remettre à NULL explicitement sans les écraser sinon).
    if (admin_id !== undefined || status !== undefined || duedate !== undefined) {
      await client.query(
        `INSERT INTO task_columns (task_id, admin_id, status, duedate)
         VALUES ($1, $2, COALESCE($3::task_status, 'À faire'), $4)
         ON CONFLICT (task_id) DO UPDATE SET
           admin_id = CASE WHEN $5 THEN EXCLUDED.admin_id ELSE task_columns.admin_id END,
           status   = COALESCE($3::task_status, task_columns.status),
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

/**
 * Réordonne / déplace des tâches en une seule transaction.
 * Body : { items: [{ id, group_id, position }, ...] }
 * Met à jour group_id et position pour chaque tâche fournie via un
 * UPDATE ... FROM (unnest) unique, donc une seule requête en base.
 */
export const reorderTasks = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items (tableau non vide) est requis' });
  }

  // Validation + extraction en colonnes parallèles pour unnest()
  const ids = [];
  const groupIds = [];
  const positions = [];
  for (const it of items) {
    if (it == null || it.id == null || it.group_id == null || it.position == null) {
      return res
        .status(400)
        .json({ error: 'chaque item doit avoir id, group_id et position' });
    }
    ids.push(Number(it.id));
    groupIds.push(Number(it.group_id));
    positions.push(Number(it.position));
  }

  await withTransaction(async (client) => {
    // Un seul UPDATE pour toutes les lignes : on déballe les 3 tableaux
    // en une table virtuelle (id, group_id, position) puis on joint.
    await client.query(
      `UPDATE tasks AS t
         SET group_id = v.group_id,
             position = v.position
       FROM (
         SELECT * FROM unnest(
           $1::int[], $2::int[], $3::int[]
         ) AS u(id, group_id, position)
       ) AS v
       WHERE t.id = v.id`,
      [ids, groupIds, positions]
    );
  });

  res.json({ ok: true, updated: ids.length });
});
