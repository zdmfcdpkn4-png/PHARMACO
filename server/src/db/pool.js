import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Si DATABASE_URL est fourni, on l'utilise ; sinon on retombe sur les
// variables PG* standard (lues automatiquement par node-postgres).
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      }
    : {}
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
