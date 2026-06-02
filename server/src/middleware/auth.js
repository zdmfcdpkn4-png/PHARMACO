import crypto from 'node:crypto';
import { query } from '../db/pool.js';
import { AUTH_SECRET } from '../utils/authConfig.js';

// Vérifie un jeton signé HMAC (base64url de `${userId}.${ts}.${sig}`) et
// renvoie l'id utilisateur s'il est authentique, sinon null.
function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    const expected = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(`${userId}.${ts}`)
      .digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return Number(userId);
  } catch {
    return null;
  }
}

function extractToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

// Attache req.user (ou null) à partir du jeton d'authentification.
// Posé globalement : ne bloque jamais, se contente d'identifier l'appelant.
export const authenticate = async (req, _res, next) => {
  const token = extractToken(req);
  const userId = token ? verifyToken(token) : null;
  if (userId) {
    try {
      const { rows } = await query(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [userId]
      );
      req.user = rows[0] || null;
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
};

// Exige un administrateur authentifié (à placer après authenticate).
export const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentification requise' });
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Action réservée aux administrateurs' });
  }
  next();
};
