import { query, withTransaction } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Liste toutes les dépendances d'un board.
export const listDependencies = asyncHandler(async (req, res) => {
  const { board_id } = req.query;
  const { rows } = await query(
    `SELECT d.id, d.predecessor_id, d.successor_id
     FROM task_dependencies d
     JOIN tasks tp ON tp.id = d.predecessor_id
     JOIN groups g ON g.id = tp.group_id
     ${board_id ? 'WHERE g.board_id = $1' : ''}
     ORDER BY d.id`,
    board_id ? [board_id] : []
  );
  res.json(rows);
});

// Détecte si ajouter pred->succ crée un cycle (succ atteint déjà pred).
const createsCycle = async (client, predecessorId, successorId) => {
  // Parcours des successeurs de successorId ; si on retombe sur predecessorId -> cycle
  const seen = new Set();
  let frontier = [successorId];
  while (frontier.length) {
    const { rows } = await client.query(
      'SELECT successor_id FROM task_dependencies WHERE predecessor_id = ANY($1)',
      [frontier]
    );
    const next = [];
    for (const r of rows) {
      if (r.successor_id === predecessorId) return true;
      if (!seen.has(r.successor_id)) {
        seen.add(r.successor_id);
        next.push(r.successor_id);
      }
    }
    frontier = next;
  }
  return false;
};

export const createDependency = asyncHandler(async (req, res) => {
  const { predecessor_id, successor_id } = req.body;
  if (!predecessor_id || !successor_id) {
    return res.status(400).json({ error: 'predecessor_id et successor_id sont requis' });
  }
  if (predecessor_id === successor_id) {
    return res.status(400).json({ error: 'Une tâche ne peut dépendre d’elle-même' });
  }

  const result = await withTransaction(async (client) => {
    // Les deux tâches doivent exister et appartenir au même projet.
    const { rows: located } = await client.query(
      `SELECT t.id, g.board_id
       FROM tasks t JOIN groups g ON g.id = t.group_id
       WHERE t.id = ANY($1::int[])`,
      [[predecessor_id, successor_id]]
    );
    if (located.length !== 2) {
      const err = new Error('Tâche introuvable');
      err.status = 404;
      throw err;
    }
    if (located[0].board_id !== located[1].board_id) {
      const err = new Error('Les deux tâches doivent appartenir au même projet');
      err.status = 400;
      throw err;
    }
    if (await createsCycle(client, predecessor_id, successor_id)) {
      const err = new Error('Dépendance circulaire détectée');
      err.status = 409;
      throw err;
    }
    const { rows } = await client.query(
      `INSERT INTO task_dependencies (predecessor_id, successor_id)
       VALUES ($1, $2)
       ON CONFLICT (predecessor_id, successor_id) DO NOTHING
       RETURNING id, predecessor_id, successor_id`,
      [predecessor_id, successor_id]
    );
    return rows[0] || null;
  });

  if (!result) return res.status(409).json({ error: 'Cette dépendance existe déjà' });
  res.status(201).json(result);
});

export const deleteDependency = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM task_dependencies WHERE id = $1', [
    req.params.id,
  ]);
  if (!rowCount) return res.status(404).json({ error: 'Dépendance introuvable' });
  res.status(204).end();
});
