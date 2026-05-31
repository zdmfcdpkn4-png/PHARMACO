import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Détermine s'il faut activer SSL :
//  - PGSSL=true               -> forcé
//  - PGSSL=false              -> désactivé
//  - sinon, auto : activé si l'URL contient sslmode=require/verify
//    (cas classique des bases hébergées : Render, Neon, Supabase, Heroku…)
const url = process.env.DATABASE_URL || '';
const sslFromUrl = /sslmode=(require|verify-ca|verify-full)/.test(url);
let useSsl;
if (process.env.PGSSL === 'true') useSsl = true;
else if (process.env.PGSSL === 'false') useSsl = false;
else useSsl = sslFromUrl;

// rejectUnauthorized:false accepte les certificats auto-signés des
// fournisseurs gérés (sinon erreur "self-signed certificate").
const sslOption = useSsl ? { rejectUnauthorized: false } : false;

// Si DATABASE_URL est fourni, on l'utilise ; sinon on retombe sur les
// variables PG* standard (lues automatiquement par node-postgres).
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: sslOption }
    : { ssl: sslOption }
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
