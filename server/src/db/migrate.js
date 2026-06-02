// Migration idempotente : applique schema.sql (et seed.sql à la demande).
// schema.sql n'utilise que des CREATE ... IF NOT EXISTS / ALTER ... ADD COLUMN
// IF NOT EXISTS / DO $$ pour les enums : il peut donc être ré-exécuté sans
// risque à chaque démarrage pour amener une base existante au schéma courant
// (nouvelles tables : teams, team_members, project_teams, sidebar_shortcuts…).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pool from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, '..', '..', 'db');

export const applySchema = async () => {
  const sql = readFileSync(join(dbDir, 'schema.sql'), 'utf8');
  await pool.query(sql);
};

export const applySeed = async () => {
  const sql = readFileSync(join(dbDir, 'seed.sql'), 'utf8');
  await pool.query(sql);
};
