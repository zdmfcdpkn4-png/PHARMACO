import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Les alertes sont personnelles : chaque utilisateur n'accède qu'aux
// siennes. Un admin peut consulter celles d'un autre via ?user_id=.
export const listAlerts = asyncHandler(async (req, res) => {
  const { user_id, unread } = req.query;
  if (user_id && Number(user_id) !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à vos propres alertes' });
  }
  const params = [user_id || req.user.id];
  const conditions = ['user_id = $1'];
  if (unread === 'true') {
    conditions.push('is_read = FALSE');
  }

  const { rows } = await query(
    `SELECT * FROM alerts WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`,
    params
  );
  res.json(rows);
});

export const markRead = asyncHandler(async (req, res) => {
  const own = req.user.role !== 'admin';
  const { rows } = await query(
    `UPDATE alerts SET is_read = TRUE WHERE id = $1 ${own ? 'AND user_id = $2' : ''} RETURNING *`,
    own ? [req.params.id, req.user.id] : [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Alerte introuvable' });
  res.json(rows[0]);
});

export const markAllRead = asyncHandler(async (req, res) => {
  const { user_id } = req.body;
  if (user_id && Number(user_id) !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à vos propres alertes' });
  }
  await query('UPDATE alerts SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [
    user_id || req.user.id,
  ]);
  res.json({ ok: true });
});
