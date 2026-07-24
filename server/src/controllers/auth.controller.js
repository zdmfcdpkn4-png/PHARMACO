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
    `SELECT id, name, email, avatar_url, role, password_hash, must_change_password
     FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  const user = rows[0];

  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'pharmaco123';

  // Auto-réparation : si le compte n'a pas encore de mot de passe (créé sans
  // mot de passe par un admin, password_hash NULL), on accepte le mot de
  // passe par défaut, on enregistre son hash à la volée et on impose un
  // changement immédiat (le mot de passe par défaut n'est pas un secret).
  if (!user.password_hash) {
    if (password !== DEFAULT_PASSWORD) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    await query(
      'UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2',
      [hashPassword(password), user.id]
    );
    user.must_change_password = true;
  } else if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const { password_hash, ...safe } = user;
  res.json({ token: sign(user.id), user: safe });
});

// Changement de son PROPRE mot de passe : authentifié par le mot de passe
// actuel (utilisé notamment quand must_change_password est actif à la
// première connexion). Renvoie un jeton : l'appelant est connecté dans la
// foulée.
export const changePassword = asyncHandler(async (req, res) => {
  const { email, current_password, new_password } = req.body;
  if (!email || !current_password || !new_password) {
    return res
      .status(400)
      .json({ error: 'email, current_password et new_password sont requis' });
  }
  if (String(new_password).length < 8) {
    return res
      .status(400)
      .json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
  }
  if (new_password === current_password) {
    return res
      .status(400)
      .json({ error: 'Le nouveau mot de passe doit être différent de l’actuel' });
  }

  const { rows } = await query(
    `SELECT id, name, email, avatar_url, role, password_hash
     FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  const user = rows[0];
  const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'pharmaco123';
  const currentOk = user
    ? user.password_hash
      ? verifyPassword(current_password, user.password_hash)
      : current_password === DEFAULT_PASSWORD
    : false;
  if (!currentOk) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  await query(
    'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
    [hashPassword(new_password), user.id]
  );

  const { password_hash, ...safe } = user;
  res.json({ token: sign(user.id), user: { ...safe, must_change_password: false } });
});

// Réinitialisation d'un mot de passe par un administrateur : le destinataire
// devra choisir un nouveau mot de passe à sa prochaine connexion.
export const setPassword = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email et password sont requis' });
  }
  const { rowCount } = await query(
    'UPDATE users SET password_hash = $1, must_change_password = true WHERE lower(email) = lower($2)',
    [hashPassword(password), email]
  );
  if (!rowCount) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ ok: true });
});
