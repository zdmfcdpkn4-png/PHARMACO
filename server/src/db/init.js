// Initialise la base : exécute schema.sql, puis seed.sql si --seed est passé.
//   node src/db/init.js          -> schéma uniquement
//   node src/db/init.js --seed   -> schéma + données de démo
import pool, { explainConnectionError } from './pool.js';
import { applySchema, applySeed } from './migrate.js';

const run = async () => {
  const withSeed = process.argv.includes('--seed');
  try {
    console.log('-> Application du schéma (schema.sql)...');
    await applySchema();
    console.log('OK Schéma appliqué.');

    if (withSeed) {
      console.log('-> Insertion des données de démo (seed.sql)...');
      await applySeed();
      console.log('OK Données de démo insérées.');
    }
  } catch (err) {
    console.error('ECHEC de l\'initialisation :', err.message);
    const hint = explainConnectionError(err);
    if (hint) console.error('PISTE :', hint);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
