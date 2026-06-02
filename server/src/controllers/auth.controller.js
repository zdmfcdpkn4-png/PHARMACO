import crypto from 'node:crypto';
import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';
import { verifyPassword, hashPassword } from '../utils/password.js';
import { AUTH_SECRET } from '../utils/authConfig.js';

// Authentification simple par e-mail + mot de passe.
// Renvoie un jeton opaque (signé HMAC) encodant l'id utilisateur.
function sign(userId) {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email et password sont requis' });
  }

  const { rows } = await query(
    'SELECT id, name, email, avatar_url, role, password_hash FROM users WHERE lower(email) = lower($1)',
    [email]
  );
  const user = rows[0];

  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'pharmaco123';

  // Auto-réparation : si le compte n'a pas encore de mot de passe (créé par
  // un ancien seed, password_hash NULL), on accepte le mot de passe par
  // défaut et on enregistre son hash à la volée.
  if (!user.password_hash) {
    if (password !== DEFAULT_PASSWORD) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      hashPassword(password),
      user.id,
    ]);
  } else if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const { password_hash, ...safe } = user;
  res.json({ token: sign(user.id), user: safe });
});

// Permet de définir/réinitialiser un mot de passe (utilitaire de démo).
export const setPassword = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email et password sont requis' });
  }
  const { rowCount } = await query(
    'UPDATE users SET password_hash = $1 WHERE lower(email) = lower($2)',
    [hashPassword(password), email]
  );
  if (!rowCount) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ ok: true });
});
