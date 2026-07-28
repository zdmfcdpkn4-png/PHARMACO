import { query, withTransaction } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

const SELECT_STEP = `
  SELECT id, board_id, parent_id, name, color, position, is_terminal
    FROM intervention_steps`;

// Profondeur maximale du circuit : Étape -> Sous-étape.
// Une sous-étape ne peut donc pas être parente à son tour.
const assertParentValide = async (client, boardId, parentId, selfId = null) => {
  if (parentId == null) return null;
  const id = Number(parentId);
  if (!Number.isInteger(id)) {
    const err = new Error('parent_id invalide');
    err.status = 400;
    throw err;
  }
  if (selfId != null && id === Number(selfId)) {
    const err = new Error('Une étape ne peut pas être sa propre parente');
    err.status = 400;
    throw err;
  }
  const { rows } = await client.query(
    'SELECT id, board_id, parent_id FROM intervention_steps WHERE id = $1',
    [id]
  );
  const parent = rows[0];
  if (!parent) {
    const err = new Error('Étape parente introuvable');
    err.status = 404;
    throw err;
  }
  if (Number(parent.board_id) !== Number(boardId)) {
    const err = new Error("L'étape parente doit appartenir au même projet");
    err.status = 400;
    throw err;
  }
  if (parent.parent_id != null) {
    const err = new Error('Le circuit est limité à deux niveaux (étape puis sous-étape)');
    err.status = 400;
    throw err;
  }
  return id;
};

export const listSteps = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `${SELECT_STEP} WHERE board_id = $1 ORDER BY position, id`,
    [req.params.boardId]
  );
  res.json(rows);
});

export const createStep = asyncHandler(async (req, res) => {
  const { name, color, parent_id, is_terminal } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name est requis' });
  }
  const boardId = Number(req.params.boardId);
  if (!Number.isInteger(boardId)) {
    return res.status(400).json({ error: 'boardId invalide' });
  }

  const created = await withTransaction(async (client) => {
    const parentId = await assertParentValide(client, boardId, parent_id);
    // Position suivante parmi les frères et sœurs (même parent).
    const { rows: posRows } = await client.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next
         FROM intervention_steps
        WHERE board_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
      [boardId, parentId]
    );
    const { rows } = await client.query(
      `INSERT INTO intervention_steps (board_id, parent_id, name, color, position, is_terminal)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, board_id, parent_id, name, color, position, is_terminal`,
      [
        boardId,
        parentId,
        name.trim(),
        color || '#005586',
        posRows[0].next,
        is_terminal === true,
      ]
    );
    return rows[0];
  });

  res.status(201).json(created);
});

export const updateStep = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id invalide' });
  }
  const { name, color, parent_id, position, is_terminal } = req.body;

  const updated = await withTransaction(async (client) => {
    const { rows: current } = await client.query(
      'SELECT id, board_id, parent_id FROM intervention_steps WHERE id = $1',
      [id]
    );
    if (!current.length) {
      const err = new Error('Étape introuvable');
      err.status = 404;
      throw err;
    }
    const boardId = current[0].board_id;

    // Re-parenter : on vérifie la profondeur et l'appartenance au projet.
    let parentId = current[0].parent_id;
    if (parent_id !== undefined) {
      parentId = await assertParentValide(client, boardId, parent_id, id);
      // Une étape qui a déjà des sous-étapes ne peut pas devenir sous-étape.
      if (parentId != null) {
        const { rows: enfants } = await client.query(
          'SELECT 1 FROM intervention_steps WHERE parent_id = $1 LIMIT 1',
          [id]
        );
        if (enfants.length) {
          const err = new Error(
            "Cette étape porte des sous-étapes : elle ne peut pas devenir elle-même une sous-étape"
          );
          err.status = 400;
          throw err;
        }
      }
    }

    const { rows } = await client.query(
      `UPDATE intervention_steps
          SET name        = COALESCE($2, name),
              color       = COALESCE($3, color),
              parent_id   = $4,
              position    = COALESCE($5, position),
              is_terminal = COALESCE($6, is_terminal)
        WHERE id = $1
        RETURNING id, board_id, parent_id, name, color, position, is_terminal`,
      [
        id,
        name != null && String(name).trim() ? String(name).trim() : null,
        color || null,
        parentId,
        position != null && Number.isInteger(Number(position)) ? Number(position) : null,
        typeof is_terminal === 'boolean' ? is_terminal : null,
      ]
    );
    return rows[0];
  });

  res.json(updated);
});

export const deleteStep = asyncHandler(async (req, res) => {
  // ON DELETE CASCADE retire les sous-étapes et les franchissements ;
  // tasks.step_id / sub_tasks.step_id repassent à NULL (ON DELETE SET NULL).
  const { rowCount } = await query('DELETE FROM intervention_steps WHERE id = $1', [
    req.params.id,
  ]);
  if (!rowCount) return res.status(404).json({ error: 'Étape introuvable' });
  res.status(204).end();
});

export const reorderSteps = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items doit être un tableau' });
  }
  const ids = [];
  const parents = [];
  const positions = [];
  for (const it of items) {
    if (!it || it.id == null || it.position == null) {
      return res.status(400).json({ error: 'chaque item doit avoir id et position' });
    }
    const id = Number(it.id);
    const position = Number(it.position);
    const parent = it.parent_id == null ? null : Number(it.parent_id);
    if (!Number.isInteger(id) || !Number.isInteger(position)) {
      return res.status(400).json({ error: 'id et position doivent être des entiers' });
    }
    if (parent !== null && !Number.isInteger(parent)) {
      return res.status(400).json({ error: 'parent_id doit être un entier ou nul' });
    }
    if (parent !== null && parent === id) {
      return res.status(400).json({ error: 'Une étape ne peut pas être sa propre parente' });
    }
    ids.push(id);
    parents.push(parent);
    positions.push(position);
  }

  await withTransaction(async (client) => {
    // Un seul UPDATE pour toutes les lignes (même idiome que reorderTasks).
    await client.query(
      `UPDATE intervention_steps AS s
          SET parent_id = v.parent_id,
              position  = v.position
         FROM (
           SELECT * FROM unnest(
             $1::int[], $2::int[], $3::int[]
           ) AS u(id, parent_id, position)
         ) AS v
        WHERE s.id = v.id`,
      [ids, parents, positions]
    );
    // Garde-fou : le circuit reste à deux niveaux après réordonnancement.
    const { rows } = await client.query(
      `SELECT 1
         FROM intervention_steps enfant
         JOIN intervention_steps parent ON parent.id = enfant.parent_id
        WHERE parent.parent_id IS NOT NULL
        LIMIT 1`
    );
    if (rows.length) {
      const err = new Error('Le circuit est limité à deux niveaux (étape puis sous-étape)');
      err.status = 400;
      throw err; // la transaction est annulée
    }
  });

  res.json({ ok: true, updated: ids.length });
});

/**
 * Marque une étape franchie pour une tâche, ou annule ce franchissement.
 * Body : { task_id, step_id, completed = true, note }
 */
export const setStepProgress = asyncHandler(async (req, res) => {
  const { task_id, step_id, completed = true, actor_id, note } = req.body;
  const taskId = Number(task_id);
  const stepId = Number(step_id);
  if (!Number.isInteger(taskId) || !Number.isInteger(stepId)) {
    return res.status(400).json({ error: 'task_id et step_id sont requis' });
  }

  if (!completed) {
    await query('DELETE FROM task_step_progress WHERE task_id = $1 AND step_id = $2', [
      taskId,
      stepId,
    ]);
    return res.status(204).end();
  }

  const { rows } = await query(
    `INSERT INTO task_step_progress (task_id, step_id, completed_at, completed_by, note)
     VALUES ($1, $2, now(), $3, $4)
     ON CONFLICT (task_id, step_id) DO UPDATE
        SET completed_at = now(),
            completed_by = EXCLUDED.completed_by,
            note         = COALESCE(EXCLUDED.note, task_step_progress.note)
     RETURNING task_id, step_id, completed_at, completed_by, note`,
    // L'identité vient du jeton ; actor_id n'est qu'un repli (parité mock).
    [taskId, stepId, req.user?.id ?? actor_id ?? null, note ?? null]
  );
  res.status(201).json(rows[0]);
});
