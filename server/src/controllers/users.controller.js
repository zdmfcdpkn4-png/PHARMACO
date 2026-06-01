import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';
import { hashPassword } from '../utils/password.js';

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

export const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role, password } = req.body;
  // password : chaîne -> (ré)initialise ; null -> supprime ; absent -> inchangé
  const setPasswordHash = password !== undefined;
  const password_hash = password ? hashPassword(password) : null;

  try {
    const { rows } = await query(
      `UPDATE users SET
         name  = COALESCE($1, name),
         email = COALESCE($2, email),
         role  = COALESCE($3::user_role, role),
         password_hash = CASE WHEN $4 THEN $5 ELSE password_hash END
       WHERE id = $6
       RETURNING id, name, email, avatar_url, role, created_at`,
      [name ?? null, email ?? null, role ?? null, setPasswordHash, password_hash, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Un membre avec cet e-mail existe déjà' });
    }
    throw err;
  }
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.status(204).end();
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, avatar_url, role, password } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name et email sont requis' });
  }
  // Mot de passe optionnel : si fourni, on le hache pour permettre la connexion.
  const password_hash = password ? hashPassword(password) : null;
  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, avatar_url, role, password_hash)
       VALUES ($1, $2, $3, COALESCE($4::user_role, 'member'), $5)
       RETURNING id, name, email, avatar_url, role, created_at`,
      [name, email, avatar_url || null, role || null, password_hash]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // Violation de contrainte d'unicité sur l'e-mail
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Un membre avec cet e-mail existe déjà' });
    }
    throw err;
  }
});
