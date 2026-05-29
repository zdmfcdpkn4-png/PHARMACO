import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

export const listAlerts = asyncHandler(async (req, res) => {
  const { user_id, unread } = req.query;
  const conditions = [];
  const params = [];

  if (user_id) {
    params.push(user_id);
    conditions.push(`user_id = $${params.length}`);
  }
  if (unread === 'true') {
    conditions.push('is_read = FALSE');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT 100`,
    params
  );
  res.json(rows);
});

export const markRead = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'UPDATE alerts SET is_read = TRUE WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Alerte introuvable' });
  res.json(rows[0]);
});

export const markAllRead = asyncHandler(async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id requis' });
  await query('UPDATE alerts SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [
    user_id,
  ]);
  res.json({ ok: true });
});
