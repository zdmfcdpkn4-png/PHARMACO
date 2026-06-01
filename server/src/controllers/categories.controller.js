import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

const VALID_TYPES = ['text', 'status', 'person', 'date'];

// Liste les catégories personnalisées d'un board.
export const listCategories = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, board_id, name, type, position FROM custom_categories WHERE board_id = $1 ORDER BY position, id',
    [req.params.boardId]
  );
  res.json(rows);
});

// Crée une catégorie / colonne personnalisée.
export const createCategory = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name est requis' });
  const safeType = VALID_TYPES.includes(type) ? type : 'text';
  const boardId = req.params.boardId;

  const posRes = await query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM custom_categories WHERE board_id = $1',
    [boardId]
  );
  const { rows } = await query(
    `INSERT INTO custom_categories (board_id, name, type, position)
     VALUES ($1, $2, $3, $4) RETURNING id, board_id, name, type, position`,
    [boardId, name.trim(), safeType, posRes.rows[0].next]
  );
  res.status(201).json(rows[0]);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM custom_categories WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Catégorie introuvable' });
  res.status(204).end();
});

// Définit la valeur d'une catégorie pour une tâche.
export const setCategoryValue = asyncHandler(async (req, res) => {
  const { category_id, task_id, value } = req.body;
  if (!category_id || !task_id) {
    return res.status(400).json({ error: 'category_id et task_id sont requis' });
  }
  await query(
    `INSERT INTO custom_values (category_id, task_id, value)
     VALUES ($1, $2, $3)
     ON CONFLICT (category_id, task_id) DO UPDATE SET value = EXCLUDED.value`,
    [category_id, task_id, value ?? null]
  );
  res.json({ ok: true });
});
