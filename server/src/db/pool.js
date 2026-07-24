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
