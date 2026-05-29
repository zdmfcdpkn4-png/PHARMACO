// Initialise la base : exécute schema.sql, puis seed.sql si --seed est passé.
//   node src/db/init.js          -> schéma uniquement
//   node src/db/init.js --seed   -> schéma + données de démo
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pool from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, '..', '..', 'db');

const run = async () => {
  const withSeed = process.argv.includes('--seed');
  try {
    console.log('-> Application du schéma (schema.sql)...');
    await pool.query(readFileSync(join(dbDir, 'schema.sql'), 'utf8'));
    console.log('OK Schéma appliqué.');

    if (withSeed) {
      console.log('-> Insertion des données de démo (seed.sql)...');
      await pool.query(readFileSync(join(dbDir, 'seed.sql'), 'utf8'));
      console.log('OK Données de démo insérées.');
    }
  } catch (err) {
    console.error('ECHEC de l\'initialisation :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
