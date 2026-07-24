import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Chaîne de connexion : SUPABASE_URL (base hébergée Supabase, prioritaire),
// sinon DATABASE_URL, sinon les variables PG* standard (lues automatiquement
// par node-postgres). SUPABASE_URL doit être l'URL « session pooler » de
// Supabase (compatible IPv4, requis sur Render) — voir docs/DEPLOY-SUPABASE.md.
const url = process.env.SUPABASE_URL || process.env.DATABASE_URL || '';

// Détermine s'il faut activer SSL :
//  - PGSSL=true               -> forcé
//  - PGSSL=false              -> désactivé
//  - sinon, auto : activé si SUPABASE_URL est utilisée (Supabase exige SSL)
//    ou si l'URL contient sslmode=require/verify
//    (cas classique des bases hébergées : Supabase, Neon, Heroku…)
const sslFromUrl =
  !!process.env.SUPABASE_URL ||
  /sslmode=(require|verify-ca|verify-full)/.test(url);
let useSsl;
if (process.env.PGSSL === 'true') useSsl = true;
else if (process.env.PGSSL === 'false') useSsl = false;
else useSsl = sslFromUrl;

// rejectUnauthorized:false accepte les certificats auto-signés des
// fournisseurs gérés (sinon erreur "self-signed certificate").
const sslOption = useSsl ? { rejectUnauthorized: false } : false;

// Journal de diagnostic (sans identifiants) : sur Render/Supabase, la cause
// n° 1 d'échec est une variable de connexion absente ou mal nommée — ce log
// montre laquelle est réellement utilisée.
const connectionSource = process.env.SUPABASE_URL
  ? 'SUPABASE_URL'
  : process.env.DATABASE_URL
    ? 'DATABASE_URL'
    : 'variables PG* (ou défauts localhost)';
const connectionHost = (() => {
  try {
    return url ? new URL(url).host : null; // host = hôte:port, jamais les identifiants
  } catch {
    return null;
  }
})();
console.log(
  `[db] Connexion via ${connectionSource}` +
    (connectionHost ? ` (hôte : ${connectionHost})` : '') +
    `, SSL ${useSsl ? 'activé' : 'désactivé'}`
);

// Traduit les erreurs de connexion les plus fréquentes (Supabase/Render) en
// action corrective concrète. Renvoie null si l'erreur n'est pas reconnue.
export const explainConnectionError = (err) => {
  const msg = String(err?.message || err || '');
  if (/ENETUNREACH/i.test(msg)) {
    return (
      'Hôte injoignable : vous utilisez probablement l’URL de connexion ' +
      'DIRECTE Supabase (db.<ref>.supabase.co), qui est IPv6-only. ' +
      'Utilisez l’URL « Session pooler » (aws-0-<region>.pooler.supabase.com:5432).'
    );
  }
  if (/Connection terminated unexpectedly/i.test(msg)) {
    return (
      'Le serveur a coupé la connexion : SSL probablement requis mais non activé. ' +
      'Définissez SUPABASE_URL (SSL automatique) plutôt que DATABASE_URL, ou PGSSL=true. ' +
      'Vérifiez aussi que l’URL est bien celle du « Session pooler » Supabase.'
    );
  }
  if (/self[- ]signed certificate/i.test(msg)) {
    return 'Certificat refusé : ne définissez pas PGSSL=false avec une base hébergée.';
  }
  if (/password authentication failed/i.test(msg)) {
    return (
      'Mot de passe refusé : vérifiez le mot de passe dans l’URL ' +
      '(caractères spéciaux à encoder en %xx).'
    );
  }
  if (/Tenant or user not found/i.test(msg)) {
    return (
      'Utilisateur inconnu du pooler : avec le « Session pooler » Supabase, ' +
      'l’utilisateur est postgres.<ref_projet>, pas postgres.'
    );
  }
  if (/ECONNREFUSED.*(127\.0\.0\.1|localhost|::1)/i.test(msg)) {
    return (
      'Connexion refusée sur localhost : aucune variable de connexion définie. ' +
      'Renseignez SUPABASE_URL (ou DATABASE_URL) dans l’environnement.'
    );
  }
  return null;
};

const pool = new Pool(
  url ? { connectionString: url, ssl: sslOption } : { ssl: sslOption }
);

pool.on('error', (err) => {
  console.error('[pg] Erreur inattendue sur un client inactif', err);
});

/**
 * Helper de requête simple.
 * @param {string} text - requête SQL paramétrée
 * @param {Array} params - valeurs des paramètres ($1, $2, ...)
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Exécute une fonction dans une transaction.
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export default pool;
