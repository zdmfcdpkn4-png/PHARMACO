import { query, withTransaction } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Met en forme un sous-item (avec admin joint).
const shapeSub = (row) => ({
  id: row.id,
  parent_task_id: row.parent_task_id,
  name: row.name,
  position: row.position,
  status: row.status || 'À faire',
  duedate: row.duedate,
  etape_tag_id: row.etape_tag_id,
  intervention_tag_id: row.intervention_tag_id,
  admin: row.admin_user_id
    ? { id: row.admin_user_id, name: row.admin_name, avatar_url: row.admin_avatar_url }
    : null,
});

const SUB_SELECT = `
  SELECT s.id, s.parent_task_id, s.name, s.position,
         s.etape_tag_id, s.intervention_tag_id,
         c.admin_id, c.status, c.duedate,
         u.id AS admin_user_id, u.name AS admin_name, u.avatar_url AS admin_avatar_url
  FROM sub_tasks s
  LEFT JOIN sub_task_columns c ON c.sub_task_id = s.id
  LEFT JOIN users u ON u.id = c.admin_id`;

// Liste les sous-items d'une tâche.
export const listSubtasks = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `${SUB_SELECT} WHERE s.parent_task_id = $1 ORDER BY s.position, s.id`,
    [req.params.taskId]
  );
  res.json(rows.map(shapeSub));
});

// Crée un sous-item (+ sa ligne de colonnes).
export const createSubtask = asyncHandler(async (req, res) => {
  const { name, admin_id, status, duedate } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name est requis' });
  const taskId = req.params.taskId;

  const sub = await withTransaction(async (client) => {
    const posRes = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM sub_tasks WHERE parent_task_id = $1',
      [taskId]
    );
    const subRes = await client.query(
      'INSERT INTO sub_tasks (parent_task_id, name, position) VALUES ($1, $2, $3) RETURNING id',
      [taskId, name.trim(), posRes.rows[0].next]
    );
    const subId = subRes.rows[0].id;
    await client.query(
      `INSERT INTO sub_task_columns (sub_task_id, admin_id, status, duedate)
       VALUES ($1, $2, COALESCE($3::task_status, 'À faire'), $4)`,
      [subId, admin_id || null, status || null, duedate || null]
    );
    const { rows } = await client.query(`${SUB_SELECT} WHERE s.id = $1`, [subId]);
    return shapeSub(rows[0]);
  });

  res.status(201).json(sub);
});

// Met à jour un sous-item. Règle d'ergonomie : si tous les sous-items d'une
// tâche passent à 'Fait', la tâche parente passe automatiquement à 'Fait'.
export const updateSubtask = asyncHandler(async (req, res) => {
  const subId = req.params.id;
  const { name, admin_id, status, duedate, etape_tag_id, intervention_tag_id } = req.body;

  const result = await withTransaction(async (client) => {
    const cur = await client.query('SELECT parent_task_id FROM sub_tasks WHERE id = $1', [subId]);
    if (!cur.rows.length) {
      const err = new Error('Sous-item introuvable');
      err.status = 404;
      throw err;
    }
    const parentId = cur.rows[0].parent_task_id;

    if (name !== undefined || etape_tag_id !== undefined || intervention_tag_id !== undefined) {
      await client.query(
        `UPDATE sub_tasks SET
           name = COALESCE($1, name),
           etape_tag_id = CASE WHEN $3 THEN $4 ELSE etape_tag_id END,
           intervention_tag_id = CASE WHEN $5 THEN $6 ELSE intervention_tag_id END
         WHERE id = $2`,
        [
          name ?? null,
          subId,
          etape_tag_id !== undefined,
          etape_tag_id ?? null,
          intervention_tag_id !== undefined,
          intervention_tag_id ?? null,
        ]
      );
    }
    if (admin_id !== undefined || status !== undefined || duedate !== undefined) {
      await client.query(
        `INSERT INTO sub_task_columns (sub_task_id, admin_id, status, duedate)
         VALUES ($1, $2, COALESCE($3::task_status, 'À faire'), $4)
         ON CONFLICT (sub_task_id) DO UPDATE SET
           admin_id = CASE WHEN $5 THEN EXCLUDED.admin_id ELSE sub_task_columns.admin_id END,
           status   = COALESCE($3::task_status, sub_task_columns.status),
           duedate  = CASE WHEN $6 THEN EXCLUDED.duedate ELSE sub_task_columns.duedate END,
           updated_at = now()`,
        [subId, admin_id ?? null, status ?? null, duedate ?? null, admin_id !== undefined, duedate !== undefined]
      );
    }

    // Auto-complétion du parent
    let parentCompleted = false;
    const stats = await client.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE c.status = 'Fait')::int AS done
       FROM sub_tasks s LEFT JOIN sub_task_columns c ON c.sub_task_id = s.id
       WHERE s.parent_task_id = $1`,
      [parentId]
    );
    const { total, done } = stats.rows[0];
    if (total > 0 && total === done) {
      await client.query(
        `INSERT INTO task_columns (task_id, status) VALUES ($1, 'Fait')
         ON CONFLICT (task_id) DO UPDATE SET status = 'Fait', updated_at = now()`,
        [parentId]
      );
      parentCompleted = true;
    }

    const { rows } = await client.query(`${SUB_SELECT} WHERE s.id = $1`, [subId]);
    return { subtask: shapeSub(rows[0]), parentCompleted, parentId };
  });

  res.json(result);
});

export const deleteSubtask = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM sub_tasks WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Sous-item introuvable' });
  res.status(204).end();
});
