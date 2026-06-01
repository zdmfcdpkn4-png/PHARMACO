import { query, withTransaction } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

const PALETTE = ['#579bfc', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#037f4c'];

/**
 * Réordonne les groupes d'un board en une seule transaction.
 * Body : { items: [{ id, position }, ...] }
 */
export const reorderGroups = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items (tableau non vide) est requis' });
  }
  const ids = [];
  const positions = [];
  for (const it of items) {
    if (it == null || it.id == null || it.position == null) {
      return res.status(400).json({ error: 'chaque item doit avoir id et position' });
    }
    ids.push(Number(it.id));
    positions.push(Number(it.position));
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE groups AS g
         SET position = v.position
       FROM (
         SELECT * FROM unnest($1::int[], $2::int[]) AS u(id, position)
       ) AS v
       WHERE g.id = v.id`,
      [ids, positions]
    );
  });

  res.json({ ok: true, updated: ids.length });
});

export const createGroup = asyncHandler(async (req, res) => {
  const { board_id, name, color } = req.body;
  if (!board_id || !name) {
    return res.status(400).json({ error: 'board_id et name sont requis' });
  }

  // Position = à la fin du board ; couleur par défaut selon le nombre de groupes
  const posRes = await query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM groups WHERE board_id = $1',
    [board_id]
  );
  const position = posRes.rows[0].next;
  const chosenColor = color || PALETTE[position % PALETTE.length];

  const { rows } = await query(
    `INSERT INTO groups (board_id, name, color, position)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [board_id, name, chosenColor, position]
  );
  res.status(201).json({ ...rows[0], tasks: [] });
});

export const updateGroup = asyncHandler(async (req, res) => {
  const { name, color, position } = req.body;
  const { rows } = await query(
    `UPDATE groups
     SET name = COALESCE($1, name),
         color = COALESCE($2, color),
         position = COALESCE($3, position)
     WHERE id = $4 RETURNING *`,
    [name ?? null, color ?? null, position ?? null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Groupe introuvable' });
  res.json(rows[0]);
});

export const deleteGroup = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM groups WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Groupe introuvable' });
  res.status(204).end();
});
