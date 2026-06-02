import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

export const listBoards = asyncHandler(async (req, res) => {
  const { workspace_id, include_archived } = req.query;
  const params = [];
  const clauses = [];
  if (workspace_id) {
    params.push(workspace_id);
    clauses.push(`workspace_id = $${params.length}`);
  }
  // Par défaut, on masque les projets archivés (sauf include_archived=true).
  if (include_archived !== 'true' && include_archived !== '1') {
    clauses.push('archived = false');
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(`SELECT * FROM boards ${where} ORDER BY id`, params);
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
        t.etape_tag_id,
        t.intervention_tag_id,
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
      etape_tag_id: row.etape_tag_id,
      intervention_tag_id: row.intervention_tag_id,
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
      subtasks: [],
    };
    if (!tasksByGroup.has(row.group_id)) tasksByGroup.set(row.group_id, []);
    tasksByGroup.get(row.group_id).push(task);
  }

  // Sous-items de toutes les tâches du board
  const subsRes = await query(
    `SELECT s.id, s.parent_task_id, s.name, s.position,
            s.etape_tag_id, s.intervention_tag_id,
            c.status, c.duedate,
            u.id AS admin_user_id, u.name AS admin_name, u.avatar_url AS admin_avatar_url
     FROM sub_tasks s
     JOIN tasks t ON t.id = s.parent_task_id
     JOIN groups g ON g.id = t.group_id
     LEFT JOIN sub_task_columns c ON c.sub_task_id = s.id
     LEFT JOIN users u ON u.id = c.admin_id
     WHERE g.board_id = $1
     ORDER BY s.position, s.id`,
    [boardId]
  );
  const subsByTask = new Map();
  for (const r of subsRes.rows) {
    const sub = {
      id: r.id,
      parent_task_id: r.parent_task_id,
      name: r.name,
      position: r.position,
      status: r.status || 'À faire',
      duedate: r.duedate,
      etape_tag_id: r.etape_tag_id,
      intervention_tag_id: r.intervention_tag_id,
      admin: r.admin_user_id
        ? { id: r.admin_user_id, name: r.admin_name, avatar_url: r.admin_avatar_url }
        : null,
    };
    if (!subsByTask.has(r.parent_task_id)) subsByTask.set(r.parent_task_id, []);
    subsByTask.get(r.parent_task_id).push(sub);
  }
  for (const list of tasksByGroup.values()) {
    for (const t of list) t.subtasks = subsByTask.get(t.id) || [];
  }

  // Multi-assignation : assignees par tâche et par sous-item
  const taskAssignRes = await query(
    `SELECT a.task_id, u.id, u.name, u.avatar_url
     FROM task_assignments a
     JOIN users u ON u.id = a.user_id
     JOIN tasks t ON t.id = a.task_id
     JOIN groups g ON g.id = t.group_id
     WHERE g.board_id = $1
     ORDER BY a.id`,
    [boardId]
  );
  const subAssignRes = await query(
    `SELECT a.sub_task_id, u.id, u.name, u.avatar_url
     FROM sub_task_assignments a
     JOIN users u ON u.id = a.user_id
     JOIN sub_tasks s ON s.id = a.sub_task_id
     JOIN tasks t ON t.id = s.parent_task_id
     JOIN groups g ON g.id = t.group_id
     WHERE g.board_id = $1
     ORDER BY a.id`,
    [boardId]
  );
  const taskAssignees = new Map();
  for (const r of taskAssignRes.rows) {
    if (!taskAssignees.has(r.task_id)) taskAssignees.set(r.task_id, []);
    taskAssignees.get(r.task_id).push({ id: r.id, name: r.name, avatar_url: r.avatar_url });
  }
  const subAssignees = new Map();
  for (const r of subAssignRes.rows) {
    if (!subAssignees.has(r.sub_task_id)) subAssignees.set(r.sub_task_id, []);
    subAssignees.get(r.sub_task_id).push({ id: r.id, name: r.name, avatar_url: r.avatar_url });
  }
  for (const list of tasksByGroup.values()) {
    for (const t of list) {
      t.assignees = taskAssignees.get(t.id) || (t.admin ? [t.admin] : []);
      t.admin = t.assignees[0] || null; // rétrocompat
      for (const s of t.subtasks) {
        s.assignees = subAssignees.get(s.id) || (s.admin ? [s.admin] : []);
        s.admin = s.assignees[0] || null;
      }
    }
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

  // Catégories personnalisées + leurs valeurs
  const catsRes = await query(
    'SELECT id, board_id, name, type, position FROM custom_categories WHERE board_id = $1 ORDER BY position, id',
    [boardId]
  );
  const valsRes = await query(
    `SELECT v.category_id, v.task_id, v.value
     FROM custom_values v
     JOIN custom_categories c ON c.id = v.category_id
     WHERE c.board_id = $1`,
    [boardId]
  );

  // Étiquettes du board
  const tagsRes = await query(
    'SELECT id, board_id, name, color, tag_type FROM project_tags WHERE board_id = $1 ORDER BY tag_type, id',
    [boardId]
  );

  // Équipes impliquées dans ce projet (avec leurs membres)
  const projTeamsRes = await query(
    `SELECT t.id, t.name, t.description
     FROM project_teams pt JOIN teams t ON t.id = pt.team_id
     WHERE pt.board_id = $1 ORDER BY t.name`,
    [boardId]
  );
  let involvedTeams = projTeamsRes.rows;
  if (involvedTeams.length) {
    const mRes = await query(
      `SELECT m.team_id, m.role, u.id, u.name, u.avatar_url
       FROM team_members m JOIN users u ON u.id = m.user_id
       WHERE m.team_id = ANY($1) ORDER BY u.name`,
      [involvedTeams.map((t) => t.id)]
    );
    const byTeam = new Map();
    for (const r of mRes.rows) {
      if (!byTeam.has(r.team_id)) byTeam.set(r.team_id, []);
      byTeam.get(r.team_id).push({ id: r.id, name: r.name, avatar_url: r.avatar_url, role: r.role });
    }
    involvedTeams = involvedTeams.map((t) => ({ ...t, members: byTeam.get(t.id) || [] }));
  }

  res.json({
    ...boardRes.rows[0],
    groups,
    dependencies: depsRes.rows,
    categories: catsRes.rows,
    categoryValues: valsRes.rows,
    tags: tagsRes.rows,
    teams: involvedTeams,
  });
});

export const createBoard = asyncHandler(async (req, res) => {
  const { workspace_id, name, description, created_by, color, icon } = req.body;
  if (!workspace_id || !name) {
    return res.status(400).json({ error: 'workspace_id et name sont requis' });
  }
  const { rows } = await query(
    `INSERT INTO boards (workspace_id, name, description, created_by, color, icon)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [workspace_id, name, description || null, created_by || null, color || null, icon || null]
  );
  res.status(201).json(rows[0]);
});

export const updateBoard = asyncHandler(async (req, res) => {
  const { name, description, color, icon, archived } = req.body;
  // color/icon : présents (chaîne ou null) -> remplacent ; archived : booléen.
  const setColor = color !== undefined;
  const setIcon = icon !== undefined;
  const setArchived = archived !== undefined;
  const { rows } = await query(
    `UPDATE boards
     SET name        = COALESCE($1, name),
         description = COALESCE($2, description),
         color       = CASE WHEN $3 THEN $4 ELSE color END,
         icon        = CASE WHEN $5 THEN $6 ELSE icon END,
         archived    = CASE WHEN $7 THEN $8 ELSE archived END
     WHERE id = $9 RETURNING *`,
    [
      name ?? null,
      description ?? null,
      setColor,
      color ?? null,
      setIcon,
      icon ?? null,
      setArchived,
      archived === true,
      req.params.id,
    ]
  );
  if (!rows.length) return res.status(404).json({ error: 'Tableau introuvable' });
  res.json(rows[0]);
});

export const deleteBoard = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM boards WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Tableau introuvable' });
  res.status(204).end();
});

// Définit les équipes impliquées dans un projet. Body : { team_ids: [...] }
export const setBoardTeams = asyncHandler(async (req, res) => {
  const boardId = req.params.id;
  const ids = Array.isArray(req.body.team_ids) ? req.body.team_ids : [];
  await query('DELETE FROM project_teams WHERE board_id = $1', [boardId]);
  for (const tid of ids) {
    await query(
      'INSERT INTO project_teams (board_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [boardId, tid]
    );
  }
  res.json({ ok: true });
});
