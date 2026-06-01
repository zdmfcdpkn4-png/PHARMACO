import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

export const listTags = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, board_id, name, color, tag_type FROM project_tags WHERE board_id = $1 ORDER BY tag_type, id',
    [req.params.boardId]
  );
  res.json(rows);
});

export const createTag = asyncHandler(async (req, res) => {
  const { name, color, tag_type } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name est requis' });
  if (!['etape', 'intervention'].includes(tag_type)) {
    return res.status(400).json({ error: 'tag_type invalide' });
  }
  const { rows } = await query(
    `INSERT INTO project_tags (board_id, name, color, tag_type)
     VALUES ($1, $2, $3, $4::tag_type)
     RETURNING id, board_id, name, color, tag_type`,
    [req.params.boardId, name.trim(), color || '#579bfc', tag_type]
  );
  res.status(201).json(rows[0]);
});

export const deleteTag = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM project_tags WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Étiquette introuvable' });
  res.status(204).end();
});
