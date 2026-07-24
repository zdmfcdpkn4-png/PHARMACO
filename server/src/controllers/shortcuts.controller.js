import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Les raccourcis sont personnels : toutes les opérations sont rattachées
// à l'utilisateur authentifié (req.user), jamais à un user_id arbitraire.
export const listShortcuts = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, target_url, icon_name, position FROM sidebar_shortcuts WHERE user_id = $1 ORDER BY position, id',
    [req.user.id]
  );
  res.json(rows);
});

export const createShortcut = asyncHandler(async (req, res) => {
  const { name, target_url, icon_name } = req.body;
  if (!name || !target_url) {
    return res.status(400).json({ error: 'name et target_url sont requis' });
  }
  const userId = req.user.id;
  const posRes = await query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM sidebar_shortcuts WHERE user_id = $1',
    [userId]
  );
  const { rows } = await query(
    `INSERT INTO sidebar_shortcuts (user_id, name, target_url, icon_name, position)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, target_url, icon_name, position`,
    [userId, name.trim(), target_url, icon_name || 'Link', posRes.rows[0].next]
  );
  res.status(201).json(rows[0]);
});

export const deleteShortcut = asyncHandler(async (req, res) => {
  const own = req.user.role !== 'admin';
  const { rowCount } = await query(
    `DELETE FROM sidebar_shortcuts WHERE id = $1 ${own ? 'AND user_id = $2' : ''}`,
    own ? [req.params.id, req.user.id] : [req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Raccourci introuvable' });
  res.status(204).end();
});
