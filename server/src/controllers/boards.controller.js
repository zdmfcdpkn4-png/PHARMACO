import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

export const listBoards = asyncHandler(async (req, res) => {
  const { workspace_id } = req.query;
  const params = [];
  let where = '';
  if (workspace_id) {
    params.push(workspace_id);
    where = 'WHERE workspace_id = $1';
  }
  const { rows } = await query(
    `SELECT * FROM boards ${where} ORDER BY id`,
    params
  );
  res.json(rows);
});

/**
 * Renvoie un tableau complet, prêt à être affiché :
 * board -> groups[] -> tasks[] (avec colonnes admin/status/duedate)
 * Une seule route pour minimiser les allers-retours côté frontend.
 */
export const getBoardFull = asyncHandler(async (req, res) => {
  const boardId = req.params.id;

  const boardRes = await query('SELECT * FROM boards WHERE id = $1', [boardId]);
  if (!boardRes.rows.length) {
    return res.status(404).json({ error: 'Tableau introuvable' });
  }

  const groupsRes = await query(
    'SELECT * FROM groups WHERE board_id = $1 ORDER BY position, id',
    [boardId]
  );

  const tasksRes = await query(
    `SELECT
        t.id,
        t.group_id,
        t.name,
        t.position,
        t.priority,
        t.start_date,
        t.created_at,
        tc.admin_id,
        tc.status,
        tc.duedate,
        u.id          AS admin_user_id,
        u.name        AS admin_name,
        u.avatar_url  AS admin_avatar_url
     FROM tasks t
     JOIN groups g       ON g.id = t.group_id
     LEFT JOIN task_columns tc ON tc.task_id = t.id
     LEFT JOIN users u   ON u.id = tc.admin_id
     WHERE g.board_id = $1
     ORDER BY t.position, t.id`,
    [boardId]
  );

  // Regroupement des tâches par groupe + mise en forme de l'admin
  const tasksByGroup = new Map();
  for (const row of tasksRes.rows) {
    const task = {
      id: row.id,
      group_id: row.group_id,
      name: row.name,
      position: row.position,
      priority: row.priority || 'P3 - Normal',
      start_date: row.start_date,
      created_at: row.created_at,
      status: row.status || 'À faire',
      duedate: row.duedate,
      admin: row.admin_user_id
        ? {
            id: row.admin_user_id,
            name: row.admin_name,
            avatar_url: row.admin_avatar_url,
          }
        : null,
    };
    if (!tasksByGroup.has(row.group_id)) tasksByGroup.set(row.group_id, []);
    tasksByGroup.get(row.group_id).push(task);
  }

  const groups = groupsRes.rows.map((g) => ({
    ...g,
    tasks: tasksByGroup.get(g.id) || [],
  }));

  // Dépendances entre tâches du board (pour le Gantt)
  const depsRes = await query(
    `SELECT d.id, d.predecessor_id, d.successor_id
     FROM task_dependencies d
     JOIN tasks tp ON tp.id = d.predecessor_id
     JOIN groups g ON g.id = tp.group_id
     WHERE g.board_id = $1`,
    [boardId]
  );

  res.json({ ...boardRes.rows[0], groups, dependencies: depsRes.rows });
});

export const createBoard = asyncHandler(async (req, res) => {
  const { workspace_id, name, description } = req.body;
  if (!workspace_id || !name) {
    return res.status(400).json({ error: 'workspace_id et name sont requis' });
  }
  const { rows } = await query(
    `INSERT INTO boards (workspace_id, name, description)
     VALUES ($1, $2, $3) RETURNING *`,
    [workspace_id, name, description || null]
  );
  res.status(201).json(rows[0]);
});

export const updateBoard = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { rows } = await query(
    `UPDATE boards
     SET name = COALESCE($1, name),
         description = COALESCE($2, description)
     WHERE id = $3 RETURNING *`,
    [name ?? null, description ?? null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Tableau introuvable' });
  res.json(rows[0]);
});

export const deleteBoard = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM boards WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Tableau introuvable' });
  res.status(204).end();
});
