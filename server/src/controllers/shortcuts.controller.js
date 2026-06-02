import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

export const listShortcuts = asyncHandler(async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.json([]);
  const { rows } = await query(
    'SELECT id, name, target_url, icon_name, position FROM sidebar_shortcuts WHERE user_id = $1 ORDER BY position, id',
    [userId]
  );
  res.json(rows);
});

export const createShortcut = asyncHandler(async (req, res) => {
  const { user_id, name, target_url, icon_name } = req.body;
  if (!user_id || !name || !target_url) {
    return res.status(400).json({ error: 'user_id, name et target_url sont requis' });
  }
  const posRes = await query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM sidebar_shortcuts WHERE user_id = $1',
    [user_id]
  );
  const { rows } = await query(
    `INSERT INTO sidebar_shortcuts (user_id, name, target_url, icon_name, position)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, target_url, icon_name, position`,
    [user_id, name.trim(), target_url, icon_name || 'Link', posRes.rows[0].next]
  );
  res.status(201).json(rows[0]);
});

export const deleteShortcut = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM sidebar_shortcuts WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Raccourci introuvable' });
  res.status(204).end();
});
