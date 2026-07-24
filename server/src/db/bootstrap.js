// Amorçage des données de PRODUCTION (idempotent, exécuté au démarrage de
// l'API après la migration du schéma, uniquement en production).
//
// Objectif : une base Supabase neuve (ou accidentellement seedée avec les
// données de démo) devient utilisable et propre sans intervention manuelle :
//  1. suppression des comptes de test de la démo (uniquement s'ils sont
//     restés dans leur état d'origine — jamais un compte réellement utilisé) ;
//  2. le compte administrateur initial reçoit son mot de passe de départ
//     (changement obligatoire à la première connexion) ;
//  3. si la base ne contient aucun utilisateur, le compte admin est créé.
import { query } from './pool.js';
import { hashPassword } from '../utils/password.js';

// Hash scrypt du mot de passe de démo « pharmaco123 » tel qu'inséré par
// db/seed.sql : sert à reconnaître les comptes restés à l'état de démo.
const SEED_DEMO_HASH =
  'scrypt$f4100b77cf486dd553ac76da34d49ee0$6c382664f6ed0d2afb5a4f2f18f66bc6fc85a225d089900d2e0c4121df01dfc5144957887263393059a5e82d796f7665c572d4079607259ea16687d5a6a05524';

// Comptes de test du seed de démonstration : à purger en production.
const DEMO_TEST_EMAILS = [
  'alice.martin@example.com',
  'bob.durand@example.com',
  'chloe.petit@example.com',
];

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'erwin.raingeard@gmail.com';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Erwin Raingeard';
const ADMIN_INITIAL_PASSWORD =
  process.env.ADMIN_INITIAL_PASSWORD || 'Password123!';

export const bootstrapProduction = async () => {
  // 1. Purge des comptes de test (seulement s'ils sont intacts : hash de démo
  //    ou aucun mot de passe — un compte au mot de passe personnalisé est
  //    considéré comme réel et n'est jamais touché).
  const purge = await query(
    `DELETE FROM users
     WHERE lower(email) = ANY($1)
       AND (password_hash = $2 OR password_hash IS NULL)`,
    [DEMO_TEST_EMAILS, SEED_DEMO_HASH]
  );
  if (purge.rowCount > 0) {
    console.log(`[bootstrap] ${purge.rowCount} compte(s) de test supprimé(s).`);
  }

  // 2. Compte admin initial encore à l'état de démo -> mot de passe de départ
  //    + changement obligatoire à la première connexion.
  const reset = await query(
    `UPDATE users
     SET password_hash = $1, must_change_password = true
     WHERE lower(email) = lower($2)
       AND (password_hash = $3 OR password_hash IS NULL)`,
    [hashPassword(ADMIN_INITIAL_PASSWORD), ADMIN_EMAIL, SEED_DEMO_HASH]
  );
  if (reset.rowCount > 0) {
    console.log(
      `[bootstrap] Mot de passe initial appliqué à ${ADMIN_EMAIL} ` +
        '(changement obligatoire à la première connexion).'
    );
  }

  // 3. Base vide -> création du compte administrateur initial.
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n === 0) {
    await query(
      `INSERT INTO users (name, email, role, password_hash, must_change_password)
       VALUES ($1, $2, 'admin', $3, true)`,
      [ADMIN_NAME, ADMIN_EMAIL, hashPassword(ADMIN_INITIAL_PASSWORD)]
    );
    console.log(
      `[bootstrap] Compte administrateur créé : ${ADMIN_EMAIL} ` +
        '(changement de mot de passe obligatoire à la première connexion).'
    );
  }
};
