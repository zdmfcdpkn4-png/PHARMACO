import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Liste les commentaires d'une tâche (avec l'auteur joint).
export const listComments = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.task_id, c.content, c.created_at,
            u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar_url
     FROM task_comments c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.task_id = $1
     ORDER BY c.created_at ASC`,
    [req.params.taskId]
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      content: r.content,
      created_at: r.created_at,
      user: r.user_id
        ? { id: r.user_id, name: r.user_name, avatar_url: r.user_avatar_url }
        : null,
    }))
  );
});

// Ajoute un commentaire.
export const createComment = asyncHandler(async (req, res) => {
  const { user_id, content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'content est requis' });
  }
  const { rows } = await query(
    `INSERT INTO task_comments (task_id, user_id, content)
     VALUES ($1, $2, $3) RETURNING id, task_id, content, created_at`,
    [req.params.taskId, user_id || null, content.trim()]
  );
  // Recharge l'auteur pour la réponse
  const c = rows[0];
  let user = null;
  if (user_id) {
    const u = await query('SELECT id, name, avatar_url FROM users WHERE id = $1', [user_id]);
    if (u.rows.length) user = u.rows[0];
  }
  res.status(201).json({ ...c, user });
});

// Journal d'activité d'une tâche (avec l'auteur joint).
export const listActivity = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.task_id, a.action_type, a.old_value, a.new_value, a.created_at,
            u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar_url
     FROM activity_log a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.task_id = $1
     ORDER BY a.created_at DESC`,
    [req.params.taskId]
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      action_type: r.action_type,
      old_value: r.old_value,
      new_value: r.new_value,
      created_at: r.created_at,
      user: r.user_id
        ? { id: r.user_id, name: r.user_name, avatar_url: r.user_avatar_url }
        : null,
    }))
  );
});
