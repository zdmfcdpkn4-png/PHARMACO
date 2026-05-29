import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

export const listWorkspaces = asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT w.*, COUNT(b.id)::int AS board_count
     FROM workspaces w
     LEFT JOIN boards b ON b.workspace_id = w.id
     GROUP BY w.id
     ORDER BY w.id`
  );
  res.json(rows);
});

export const getWorkspace = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM workspaces WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Workspace introuvable' });

  const boards = await query(
    'SELECT id, name, description, created_at FROM boards WHERE workspace_id = $1 ORDER BY id',
    [req.params.id]
  );
  res.json({ ...rows[0], boards: boards.rows });
});

export const createWorkspace = asyncHandler(async (req, res) => {
  const { name, description, created_by } = req.body;
  if (!name) return res.status(400).json({ error: 'name est requis' });
  const { rows } = await query(
    `INSERT INTO workspaces (name, description, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [name, description || null, created_by || null]
  );
  res.status(201).json(rows[0]);
});
