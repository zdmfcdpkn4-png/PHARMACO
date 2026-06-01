// Hachage de mot de passe avec scrypt (module natif Node, sans dépendance).
// Format stocké : "scrypt$<salt_hex>$<hash_hex>"
import crypto from 'node:crypto';

const KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const candidate = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  // Comparaison à temps constant
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Génère un jeton de session simple (opaque). Suffisant pour cette démo ;
// pour une vraie prod, préférer un JWT signé ou une table de sessions.
export function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}
