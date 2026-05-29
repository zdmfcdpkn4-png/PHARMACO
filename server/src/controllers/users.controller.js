import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

export const listUsers = asyncHandler(async (_req, res) => {
  const { rows } = await query(
    'SELECT id, name, email, avatar_url, role, created_at FROM users ORDER BY name'
  );
  res.json(rows);
});

export const getUser = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, email, avatar_url, role, created_at FROM users WHERE id = $1',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(rows[0]);
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, avatar_url, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name et email sont requis' });
  }
  const { rows } = await query(
    `INSERT INTO users (name, email, avatar_url, role)
     VALUES ($1, $2, $3, COALESCE($4, 'member'))
     RETURNING id, name, email, avatar_url, role, created_at`,
    [name, email, avatar_url || null, role || null]
  );
  res.status(201).json(rows[0]);
});
